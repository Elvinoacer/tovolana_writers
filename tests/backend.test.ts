import "dotenv/config";
import test, { after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { MediaAssetPurpose, Prisma } from "@prisma/client";
import { closeDbConnections, db } from "@/lib/db";
import { closeRedisConnection } from "@/lib/redis";
import { env, hasR2Config, MAX_BROWSER_UPLOAD_BYTES } from "@/lib/env";
import { calculateBookingPricing } from "@/lib/pricing";
import { evaluateWritingAssessment } from "@/lib/assessment-evaluator";
import { POST as registerPost } from "@/app/api/auth/register/route";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { GET as googleAuthGet } from "@/app/api/auth/google/route";
import { GET as googleCallbackGet } from "@/app/api/auth/google/callback/route";
import { POST as otpSendPost } from "@/app/api/auth/otp/send/route";
import { POST as otpVerifyPost } from "@/app/api/auth/otp/verify/route";
import { DELETE as deleteCategory } from "@/app/api/admin/categories/[id]/route";
import { POST as creatorApplyPost } from "@/app/api/creators-hub/apply/route";
import { POST as assessmentStartPost } from "@/app/api/creators-hub/assessment/start/route";
import { POST as assessmentSubmitPost } from "@/app/api/creators-hub/assessment/submit/route";
import { POST as createTaskPost } from "@/app/api/tasks/route";
import { POST as reviewListingPost } from "@/app/api/admin/listings/[id]/review/route";
import { POST as lifecycleListingPost } from "@/app/api/admin/listings/[id]/lifecycle/route";
import { POST as createBookingPost } from "@/app/api/bookings/route";
import { POST as checkoutBookingPost } from "@/app/api/bookings/[ref]/checkout/route";
import { POST as intaSendWebhookPost } from "@/app/api/webhooks/intasend/route";
import { POST as deliverBookingPost } from "@/app/api/bookings/[ref]/deliver/route";
import { POST as revisionBookingPost } from "@/app/api/bookings/[ref]/revision/route";
import { POST as disputeBookingPost } from "@/app/api/bookings/[ref]/dispute/route";
import { POST as completeBookingPost } from "@/app/api/bookings/[ref]/complete/route";
import { POST as presignFilePost } from "@/app/api/bookings/[ref]/files/presign/route";
import {
  GET as downloadFileGet,
  DELETE as deleteFileDelete,
} from "@/app/api/files/[fileId]/route";
import { GET as adminOverviewGet } from "@/app/api/admin/overview/route";
import { GET as healthGet } from "@/app/api/health/route";
import { POST as mediaUploadPost } from "@/app/api/media/upload/route";
import { DELETE as mediaDelete } from "@/app/api/media/[id]/route";
import { GET as mediaRawGet } from "@/app/api/media/[id]/raw/route";
import {
  GET as creatorHubProfileGet,
  PATCH as creatorHubProfilePatch,
} from "@/app/api/creators-hub/profile/route";
import {
  GET as settingsGet,
  PATCH as settingsPatch,
} from "@/app/api/settings/route";
import { GET as tasksListGet } from "@/app/api/tasks/route";
import { GET as taskDetailGet } from "@/app/api/tasks/[slug]/route";
import { GET as publicCreatorGet } from "@/app/api/creators/[username]/route";
import { GET as bookingDetailGet } from "@/app/api/bookings/[ref]/route";
import { POST as bookingMessagePost } from "@/app/api/bookings/[ref]/messages/route";
import {
  createMediaStorageKey,
  deleteStoredObject,
  getR2KeyPrefix,
  readPrivateFile,
  readPublicLocalMedia,
} from "@/lib/storage";

function extractCookieValue(setCookie: string | null): string {
  assert.ok(setCookie, "Expected Set-Cookie header");
  return setCookie.split(";")[0];
}

function makeJsonReq(
  url: string,
  method: string,
  body?: unknown,
  cookie?: string
): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function makeFormReq(
  url: string,
  formData: FormData,
  cookie?: string
): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: "POST",
    headers: cookie ? { cookie } : undefined,
    body: formData,
  });
}

test("1. Health check & pricing calculation matrix (Free vs Pro)", async () => {
  const res = await healthGet();
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.data.services.postgres, "up");

  const free = calculateBookingPricing({
    listedPrice: 5000,
    extraCharges: 0,
    standardServiceFeePct: 10,
    proFeeDiscountPct: 50,
    userIsPro: false,
  });
  assert.equal(free.serviceFee, 500);
  assert.equal(free.proDiscount, 0);
  assert.equal(free.totalPayable, 5500);

  const pro = calculateBookingPricing({
    listedPrice: 5000,
    extraCharges: 0,
    standardServiceFeePct: 10,
    proFeeDiscountPct: 50,
    userIsPro: true,
  });
  assert.equal(pro.serviceFee, 250);
  assert.equal(pro.proDiscount, 250);
  assert.equal(pro.totalPayable, 5250);
  assert.equal(pro.creatorNetAmount, 5000);
});

test("2. Dual Auth (Email/Password + Google OAuth) & Phone OTP Verification", async () => {
  const unique = crypto.randomBytes(4).toString("hex");
  const email = `e2e.customer.${unique}@tovolana.test`;

  const regRes = await registerPost(
    makeJsonReq("http://localhost:3000/api/auth/register", "POST", {
      email,
      name: "Test Writer Customer",
      password: "StrongPassword123!",
      phone: "0712345678",
    })
  );
  assert.equal(regRes.status, 201);
  const customerCookie = extractCookieValue(regRes.headers.get("set-cookie"));

  // Login works cleanly
  const loginRes = await loginPost(
    makeJsonReq("http://localhost:3000/api/auth/login", "POST", {
      email,
      password: "StrongPassword123!",
    })
  );
  assert.equal(loginRes.status, 200);

  // Send Phone OTP & verify with 6-digit preview code
  const otpSendRes = await otpSendPost(
    makeJsonReq(
      "http://localhost:3000/api/auth/otp/send",
      "POST",
      { phone: "0712345678" },
      customerCookie
    )
  );
  assert.equal(otpSendRes.status, 200);
  const otpJson = await otpSendRes.json();
  assert.ok(otpJson.data.sandboxOtpPreview);

  const otpVerifyRes = await otpVerifyPost(
    makeJsonReq(
      "http://localhost:3000/api/auth/otp/verify",
      "POST",
      { phone: "0712345678", code: otpJson.data.sandboxOtpPreview },
      customerCookie
    )
  );
  assert.equal(otpVerifyRes.status, 200);

  // Google OAuth redirect & callback flow
  const gInit = await googleAuthGet(
    new NextRequest(
      "http://localhost:3000/api/auth/google?callbackUrl=/explore&email=google.test." +
        unique +
        "@tovolana.test"
    )
  );
  assert.equal(gInit.status, 307);
  const loc = gInit.headers.get("location");
  assert.ok(loc);
  if (loc.startsWith("https://accounts.google.com")) {
    const oauthUrl = new URL(loc);
    const state = oauthUrl.searchParams.get("state");
    assert.ok(oauthUrl.searchParams.get("client_id"));
    assert.ok(state);
    // Live OAuth keys active: verify sandbox bypass code is rejected cleanly
    const rejectCb = await googleCallbackGet(
      new NextRequest(
        `http://localhost:3000/api/auth/google/callback?code=sandbox_google_oauth_code&state=${encodeURIComponent(
          state
        )}`
      )
    );
    assert.equal(rejectCb.status, 307);
    assert.ok(
      rejectCb.headers.get("location")?.includes("error=google_invalid_code")
    );
    assert.equal(rejectCb.headers.get("set-cookie"), null);
  } else {
    const gCbRes = await googleCallbackGet(new NextRequest(loc));
    assert.equal(gCbRes.status, 307);
    assert.ok(gCbRes.headers.get("set-cookie")?.includes(env.sessionCookieName));
    assert.ok(gCbRes.headers.get("location")?.endsWith("/explore"));
  }
});

test("3. Category Deletion Protection (Non-deletable when listings depend on it)", async () => {
  const adminLogin = await loginPost(
    makeJsonReq("http://localhost:3000/api/auth/login", "POST", {
      email: "admin@tovolana.com",
      password: "Password123!",
    })
  );
  const adminCookie = extractCookieValue(adminLogin.headers.get("set-cookie"));

  const usedCategory = await db.category.findFirst({
    where: { slug: "academic-writing" },
  });
  assert.ok(usedCategory);

  const delRes = await deleteCategory(
    makeJsonReq(
      `http://localhost:3000/api/admin/categories/${usedCategory.id}`,
      "DELETE",
      undefined,
      adminCookie
    ),
    { params: Promise.resolve({ id: usedCategory.id }) }
  );
  assert.equal(delRes.status, 409);
  const delJson = await delRes.json();
  assert.equal(delJson.error.code, "CATEGORY_IN_USE");
});

test("4. Automated 6-Criteria Writing Assessment & Immediate Creators Hub Unlock (No ID Required)", async () => {
  const unique = crypto.randomBytes(4).toString("hex");
  const applicantEmail = `creator.cand.${unique}@tovolana.test`;

  const regRes = await registerPost(
    makeJsonReq("http://localhost:3000/api/auth/register", "POST", {
      email: applicantEmail,
      name: "Candidate Author",
      password: "StrongPassword123!",
    })
  );
  const candCookie = extractCookieValue(regRes.headers.get("set-cookie"));

  const applyRes = await creatorApplyPost(
    makeJsonReq(
      "http://localhost:3000/api/creators-hub/apply",
      "POST",
      {
        username: `author_${unique}`,
        displayName: "Candidate Author",
        headline: "Policy Researcher & Developmental Editor",
        bio: "Experienced essayist and empirical synthesis researcher delivering clear academic drafts.",
        writingCategories: ["Academic Writing", "Research Papers"],
        academicIntegrityAccepted: true,
      },
      candCookie
    )
  );
  assert.equal(applyRes.status, 201);

  const startRes = await assessmentStartPost(
    makeJsonReq(
      "http://localhost:3000/api/creators-hub/assessment/start",
      "POST",
      {},
      candCookie
    )
  );
  assert.equal(startRes.status, 201);
  const { data: startData } = await startRes.json();

  const essay = [
    "Transparent scoping and rigorous source verification serve as foundational pillars of trust across digital knowledge marketplaces. When service briefs define exact deliverables, referencing standards, and turnaround windows before checkout, misunderstandings drop measurably. Moreover, structured clarity protects both the customer commissioning a research draft and the independent creator fulfilling it.",
    "Firstly, empirical research demonstrates that unambiguous scoping prevents scope creep and revision friction. According to recent platform governance studies (Mwangi, 2024), projects supported by explicit requirement checklists experience significantly higher first-pass acceptance rates. Furthermore, clear word-count parameters and formatting templates align scholarly expectations from day one.",
    "Secondly, verifiable research citations separate authoritative synthesis from unsubstantiated commentary. For example, requiring creators to ground arguments in peer-reviewed studies and primary datasets ensures methodological integrity. Therefore, standardized rubrics that audit grammar, coherence, tone, and citation accuracy establish reliable benchmarks before a writer enters the public catalog.",
    "In addition, separating listing publication windows from active booking delivery deadlines strengthens operational fairness. Specifically, even when a marketplace offering reaches its validity date and stops accepting new clients, ongoing assignments must remain protected until final sign-off. Consequently, milestone tracking and escrow-backed revisions preserve accountability across every engagement.",
    "Finally, removing arbitrary certificate barriers in favor of direct writing evaluation widens access for skilled writers worldwide. In conclusion, merit-based editorial assessment, transparent service fees, and accountable revision workflows create a dependable ecosystem for research and business communication [1]. Additionally, continuous feedback loops reinforce long-term editorial excellence across every category.",
    "Through disciplined preparation, thoughtful evidence synthesis, and prompt communication, vetted writers consistently convert complex requirements into structured deliverables. Meanwhile, transparent policies clarify revision quotas and cancellation protections ahead of commitment, building lasting confidence across modern digital marketplaces (Ochieng, 2025).",
  ].join("\n\n");

  const directEval = evaluateWritingAssessment({
    responseText: essay,
    promptText: startData.config.promptText,
    minWords: 350,
    maxWords: 600,
    passScoreThreshold: 75,
    reviewScoreThreshold: 60,
  });
  assert.ok(
    directEval.totalScore >= 75,
    `Expected score >= 75, got ${directEval.totalScore}`
  );

  const submitRes = await assessmentSubmitPost(
    makeJsonReq(
      "http://localhost:3000/api/creators-hub/assessment/submit",
      "POST",
      {
        attemptId: startData.attempt.id,
        responseText: essay,
      },
      candCookie
    )
  );
  assert.equal(submitRes.status, 200);
  const submitJson = await submitRes.json();
  assert.equal(submitJson.data.creatorProfile.applicationStatus, "APPROVED");

  // Verify CREATOR role was unlocked in DB immediately
  const promoted = await db.user.findUnique({ where: { email: applicantEmail } });
  assert.ok(promoted?.roles.includes("CREATOR"));
});

test("5. End-to-End Listing Review, Booking Escrow, IntaSend Webhook Idempotency, Revisions, File IDOR & Listing Expiry Independence", async () => {
  const adminLogin = await loginPost(
    makeJsonReq("http://localhost:3000/api/auth/login", "POST", {
      email: "admin@tovolana.com",
      password: "Password123!",
    })
  );
  const adminCookie = extractCookieValue(adminLogin.headers.get("set-cookie"));

  const creatorLogin = await loginPost(
    makeJsonReq("http://localhost:3000/api/auth/login", "POST", {
      email: "creator@tovolana.com",
      password: "Password123!",
    })
  );
  const creatorCookie = extractCookieValue(creatorLogin.headers.get("set-cookie"));

  const customerLogin = await loginPost(
    makeJsonReq("http://localhost:3000/api/auth/login", "POST", {
      email: "free.customer@tovolana.com",
      password: "Password123!",
    })
  );
  const customerCookie = extractCookieValue(
    customerLogin.headers.get("set-cookie")
  );

  const otherLogin = await loginPost(
    makeJsonReq("http://localhost:3000/api/auth/login", "POST", {
      email: "applicant@tovolana.com",
      password: "Password123!",
    })
  );
  const otherCookie = extractCookieValue(otherLogin.headers.get("set-cookie"));

  const category = await db.category.findFirstOrThrow({
    where: { slug: "research-papers" },
  });

  // Creator submits new listing -> PENDING_REVIEW
  const createRes = await createTaskPost(
    makeJsonReq(
      "http://localhost:3000/api/tasks",
      "POST",
      {
        title: "Automated Test Policy Whitepaper Package",
        shortDescription:
          "Detailed empirical policy brief with APA 7th bibliography and summary.",
        fullDescription:
          "Full-service empirical policy synthesis crafted cleanly with verified scholarly citations and executive takeaways.",
        serviceType: "Policy Brief",
        categoryId: category.id,
        pricingType: "FIXED",
        basePrice: 4000,
        deliveryTurnaroundDays: 3,
        maxRevisions: 1,
        manualAcceptanceRequired: false,
        validityType: "SHORT_14D",
        deliverablesSummary: ["2,000-word brief", "Annotated bibliography"],
        revisionPolicy: "1 revision included.",
        cancellationPolicy: "Standard escrow rules apply.",
        submitMode: "SUBMIT_REVIEW",
      },
      creatorCookie
    )
  );
  assert.equal(createRes.status, 201);
  const { data: createdListingData } = await createRes.json();
  const listingId = createdListingData.listing.id;
  assert.equal(createdListingData.listing.status, "PENDING_REVIEW");

  // Admin approves listing -> PUBLISHED
  const approveRes = await reviewListingPost(
    makeJsonReq(
      `http://localhost:3000/api/admin/listings/${listingId}/review`,
      "POST",
      {
        decision: "APPROVE",
        validityType: "SHORT_14D",
        note: "Approved in backend E2E verification.",
      },
      adminCookie
    ),
    { params: Promise.resolve({ id: listingId }) }
  );
  assert.equal(approveRes.status, 200);

  // Free customer creates booking (proving Free accounts can book without paywall!)
  const bookingRes = await createBookingPost(
    makeJsonReq(
      "http://localhost:3000/api/bookings",
      "POST",
      {
        taskId: listingId,
        requirementsResponses: {
          topic: "Open Science Infrastructure in East Africa",
          wordCount: 2000,
          citationStyle: "APA 7th",
          instructions: "Include actionable policy matrix.",
        },
      },
      customerCookie
    )
  );
  assert.equal(bookingRes.status, 201);
  const { data: bookingData } = await bookingRes.json();
  const bookingRef = bookingData.booking.bookingRef;
  assert.equal(bookingData.booking.totalPayable, 4400);

  // Upload private customer brief file & check IDOR protection
  const uploadedFileIds: string[] = [];
  try {
    const uploadRes = await presignFilePost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/files/presign`,
        "POST",
        {
          fileName: "brief-notes.txt",
          mimeType: "text/plain",
          fileCategory: "CUSTOMER_BRIEF",
          contentText: "Confidential customer assignment requirements",
        },
        customerCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(uploadRes.status, 201);
    const { data: uploadData } = await uploadRes.json();
    uploadedFileIds.push(uploadData.file.id);

    assert.ok(
      uploadData.file.storageKey.startsWith(`${env.r2KeyPrefix}/bookings/`),
      `Expected storageKey under ${env.r2KeyPrefix}/bookings/, got ${uploadData.file.storageKey}`
    );
    assert.equal(
      uploadData.file.storageProvider,
      hasR2Config() ? "R2" : "LOCAL"
    );
    assert.ok(uploadData.downloadUrl.startsWith(`/api/files/${uploadData.file.id}?`));
    assert.ok(!uploadData.downloadUrl.includes("r2.dev"));

    const unauthorizedDownload = await downloadFileGet(
      makeJsonReq(
        `http://localhost:3000/api/files/${uploadData.file.id}`,
        "GET",
        undefined,
        otherCookie
      ),
      { params: Promise.resolve({ fileId: uploadData.file.id }) }
    );
    assert.equal(unauthorizedDownload.status, 403);

    const authorizedDownload = await downloadFileGet(
      makeJsonReq(
        `http://localhost:3000/api/files/${uploadData.file.id}`,
        "GET",
        undefined,
        creatorCookie
      ),
      { params: Promise.resolve({ fileId: uploadData.file.id }) }
    );
    assert.equal(authorizedDownload.status, 200);
    assert.equal(
      authorizedDownload.headers.get("x-content-type-options"),
      "nosniff"
    );
    assert.equal(
      authorizedDownload.headers.get("cache-control"),
      "private, no-store"
    );

    // Initiate IntaSend checkout
    const checkoutRes = await checkoutBookingPost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/checkout`,
        "POST",
        { channel: "MPESA_STK", phone: "0744500005" },
        customerCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(checkoutRes.status, 201);
    const { data: checkoutData } = await checkoutRes.json();
    const apiRef = checkoutData.transaction.apiRef;

    // Reject wrong IntaSend webhook challenge
    const badWebhook = await intaSendWebhookPost(
      makeJsonReq("http://localhost:3000/api/webhooks/intasend", "POST", {
        api_ref: apiRef,
        state: "COMPLETE",
        value: 4400,
        currency: "KES",
        challenge: "wrong-challenge",
      })
    );
    assert.equal(badWebhook.status, 401);

    // Reject amount tamper
    const tamperWebhook = await intaSendWebhookPost(
      makeJsonReq("http://localhost:3000/api/webhooks/intasend", "POST", {
        api_ref: apiRef,
        state: "COMPLETE",
        value: 100,
        currency: "KES",
        challenge: env.intasendWebhookChallenge,
      })
    );
    assert.equal(tamperWebhook.status, 400);

    // Valid IntaSend webhook completes booking escrow
    const validWebhook = await intaSendWebhookPost(
      makeJsonReq("http://localhost:3000/api/webhooks/intasend", "POST", {
        api_ref: apiRef,
        invoice_id: `INV-${apiRef}`,
        state: "COMPLETE",
        value: 4400,
        currency: "KES",
        challenge: env.intasendWebhookChallenge,
      })
    );
    assert.equal(validWebhook.status, 200);

    // Duplicate webhook replay must be idempotent
    const replayWebhook = await intaSendWebhookPost(
      makeJsonReq("http://localhost:3000/api/webhooks/intasend", "POST", {
        api_ref: apiRef,
        invoice_id: `INV-${apiRef}`,
        state: "COMPLETE",
        value: 4400,
        currency: "KES",
        challenge: env.intasendWebhookChallenge,
      })
    );
    assert.equal(replayWebhook.status, 200);
    const replayJson = await replayWebhook.json();
    assert.equal(replayJson.data.idempotent, true);

    // Expire the listing NOW -> prove active IN_PROGRESS booking is NOT invalidated!
    const expireRes = await lifecycleListingPost(
      makeJsonReq(
        `http://localhost:3000/api/admin/listings/${listingId}/lifecycle`,
        "POST",
        { action: "EXPIRE", reason: "Testing listing vs booking deadline separation" },
        adminCookie
      ),
      { params: Promise.resolve({ id: listingId }) }
    );
    assert.equal(expireRes.status, 200);
    const expireJson = await expireRes.json();
    assert.equal(expireJson.data.confirmedBookingsPreserved, 1);

    // Creator still delivers cleanly despite expired listing
    const deliver1 = await deliverBookingPost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/deliver`,
        "POST",
        { deliverySummary: "Attached complete 2,000-word brief with APA 7th references." },
        creatorCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(deliver1.status, 200);

    // Customer requests revision (#1 of 1)
    const rev1 = await revisionBookingPost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/revision`,
        "POST",
        {
          reason: "Please expand the Kenya Open Data section by one paragraph.",
          checklist: ["Expand Open Data section"],
        },
        customerCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(rev1.status, 201);

    // Creator delivers updated work
    const deliver2 = await deliverBookingPost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/deliver`,
        "POST",
        { deliverySummary: "Updated section added as requested." },
        creatorCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(deliver2.status, 200);

    // Customer completes booking -> releases creator escrow to AVAILABLE
    const completeRes = await completeBookingPost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/complete`,
        "POST",
        { rating: 5, comment: "Excellent responsiveness and policy depth." },
        customerCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(completeRes.status, 200);

    const ledger = await db.creatorEarningsLedger.findFirst({
      where: { booking: { bookingRef } },
    });
    assert.equal(ledger?.status, "AVAILABLE");
    assert.equal(ledger?.netAmount, 4000);
  } finally {
    for (const fileId of uploadedFileIds) {
      await deleteFileDelete(
        makeJsonReq(
          `http://localhost:3000/api/files/${fileId}`,
          "DELETE",
          undefined,
          adminCookie
        ),
        { params: Promise.resolve({ fileId }) }
      ).catch(() => undefined);
    }
  }
});

test("6. Private Booking File Storage: MIME/XSS Rejection, 4 MB Limit, Lifecycle-Locked Deletion, Revision/Dispute Linking & Admin Tribunal", async () => {
  const adminLogin = await loginPost(
    makeJsonReq("http://localhost:3000/api/auth/login", "POST", {
      email: "admin@tovolana.com",
      password: "Password123!",
    })
  );
  const adminCookie = extractCookieValue(adminLogin.headers.get("set-cookie"));

  const creatorLogin = await loginPost(
    makeJsonReq("http://localhost:3000/api/auth/login", "POST", {
      email: "creator@tovolana.com",
      password: "Password123!",
    })
  );
  const creatorCookie = extractCookieValue(creatorLogin.headers.get("set-cookie"));

  const customerLogin = await loginPost(
    makeJsonReq("http://localhost:3000/api/auth/login", "POST", {
      email: "free.customer@tovolana.com",
      password: "Password123!",
    })
  );
  const customerCookie = extractCookieValue(
    customerLogin.headers.get("set-cookie")
  );

  const [category, creatorUser] = await Promise.all([
    db.category.findFirstOrThrow({
      where: { slug: "research-papers" },
    }),
    db.user.findUniqueOrThrow({
      where: { email: "creator@tovolana.com" },
      select: { id: true },
    }),
  ]);

  const testStartedAt = new Date();
  const createdListingIds: string[] = [];
  const createdBookingIds: string[] = [];
  const createdBookingRefs: string[] = [];
  const createdFileIds: string[] = [];
  const legacyDirName = `__test-backend-legacy-${crypto.randomBytes(6).toString("hex")}`;
  const legacyDirPath = path.resolve(process.cwd(), "uploads", legacyDirName);

  try {
    const createRes = await createTaskPost(
      makeJsonReq(
        "http://localhost:3000/api/tasks",
        "POST",
        {
          title: "R2 File Vault & Tribunal Verification Package",
          shortDescription:
            "Automated test listing for private R2 file vault, revision, and dispute checks.",
          fullDescription:
            "Verifies private R2 storage isolation, XSS rejection, 4 MB limits, lifecycle deletion locks, and dispute evidence.",
          serviceType: "Policy Brief",
          categoryId: category.id,
          pricingType: "FIXED",
          basePrice: 3000,
          deliveryTurnaroundDays: 3,
          maxRevisions: 2,
          manualAcceptanceRequired: false,
          validityType: "SHORT_14D",
          deliverablesSummary: ["Draft report"],
          revisionPolicy: "2 revisions included.",
          cancellationPolicy: "Standard escrow rules apply.",
          submitMode: "SUBMIT_REVIEW",
        },
        creatorCookie
      )
    );
    assert.equal(createRes.status, 201);
    const { data: createdListingData } = await createRes.json();
    const listingId = createdListingData.listing.id;
    createdListingIds.push(listingId);

    const approveRes = await reviewListingPost(
      makeJsonReq(
        `http://localhost:3000/api/admin/listings/${listingId}/review`,
        "POST",
        {
          decision: "APPROVE",
          validityType: "SHORT_14D",
          note: "Approved for Task 4 storage verification.",
        },
        adminCookie
      ),
      { params: Promise.resolve({ id: listingId }) }
    );
    assert.equal(approveRes.status, 200);

    const bookingARes = await createBookingPost(
      makeJsonReq(
        "http://localhost:3000/api/bookings",
        "POST",
        {
          taskId: listingId,
          requirementsResponses: {
            topic: "Private R2 File Lifecycle Verification",
            wordCount: 1500,
            citationStyle: "APA 7th",
          },
        },
        customerCookie
      )
    );
    assert.equal(bookingARes.status, 201);
    const { data: bookingAData } = await bookingARes.json();
    const bookingRef = bookingAData.booking.bookingRef;
    const bookingId = bookingAData.booking.id;
    const customerId = bookingAData.booking.customerId;
    createdBookingIds.push(bookingId);
    createdBookingRefs.push(bookingRef);

    const bookingBRes = await createBookingPost(
      makeJsonReq(
        "http://localhost:3000/api/bookings",
        "POST",
        {
          taskId: listingId,
          requirementsResponses: {
            topic: "Cross-Booking IDOR Control Booking",
            wordCount: 1000,
            citationStyle: "APA 7th",
          },
        },
        customerCookie
      )
    );
    assert.equal(bookingBRes.status, 201);
    const { data: bookingBData } = await bookingBRes.json();
    const otherBookingRef = bookingBData.booking.bookingRef;
    createdBookingIds.push(bookingBData.booking.id);
    createdBookingRefs.push(otherBookingRef);

    // 0. Reject malformed JSON, empty contentBase64, non-ASCII mimeType & huge Content-Length
    const malformedJsonRes = await presignFilePost(
      new NextRequest(
        new URL(
          `http://localhost:3000/api/bookings/${bookingRef}/files/presign`,
          "http://localhost:3000"
        ),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: customerCookie,
          },
          body: "{malformed",
        }
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(malformedJsonRes.status, 400);
    const malformedJson = await malformedJsonRes.json();
    assert.equal(malformedJson.error.code, "BAD_REQUEST");

    const emptyBase64Res = await presignFilePost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/files/presign`,
        "POST",
        {
          fileName: "empty.txt",
          mimeType: "text/plain",
          fileCategory: "CUSTOMER_BRIEF",
          contentBase64: "",
        },
        customerCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(emptyBase64Res.status, 400);
    const emptyBase64Json = await emptyBase64Res.json();
    assert.equal(emptyBase64Json.error.code, "VALIDATION_ERROR");

    const dataUriBase64Res = await presignFilePost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/files/presign`,
        "POST",
        {
          fileName: "data-uri.txt",
          mimeType: "text/plain",
          fileCategory: "CUSTOMER_BRIEF",
          contentBase64: "data:text/plain;base64,SGVsbG8=",
        },
        customerCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(dataUriBase64Res.status, 400);
    const dataUriBase64Json = await dataUriBase64Res.json();
    assert.equal(dataUriBase64Json.error.code, "VALIDATION_ERROR");

    const corruptedBase64Res = await presignFilePost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/files/presign`,
        "POST",
        {
          fileName: "corrupted.txt",
          mimeType: "text/plain",
          fileCategory: "CUSTOMER_BRIEF",
          contentBase64: "not-valid-base64!!!",
        },
        customerCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(corruptedBase64Res.status, 400);
    const corruptedBase64Json = await corruptedBase64Res.json();
    assert.equal(corruptedBase64Json.error.code, "VALIDATION_ERROR");

    const malformedRevJsonRes = await revisionBookingPost(
      new NextRequest(
        new URL(
          `http://localhost:3000/api/bookings/${bookingRef}/revision`,
          "http://localhost:3000"
        ),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: customerCookie,
          },
          body: "{malformed",
        }
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(malformedRevJsonRes.status, 400);
    const malformedRevJson = await malformedRevJsonRes.json();
    assert.equal(malformedRevJson.error.code, "BAD_REQUEST");

    const malformedDisputeJsonRes = await disputeBookingPost(
      new NextRequest(
        new URL(
          `http://localhost:3000/api/bookings/${bookingRef}/dispute`,
          "http://localhost:3000"
        ),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: customerCookie,
          },
          body: "{malformed",
        }
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(malformedDisputeJsonRes.status, 400);
    const malformedDisputeJson = await malformedDisputeJsonRes.json();
    assert.equal(malformedDisputeJson.error.code, "BAD_REQUEST");

    // Role-per-category enforcement on active booking
    const customerDeliverableRes = await presignFilePost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/files/presign`,
        "POST",
        {
          fileName: "spoofed-deliverable.txt",
          mimeType: "text/plain",
          fileCategory: "CREATOR_DELIVERABLE",
          contentText: "Customer cannot upload creator deliverable",
        },
        customerCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(customerDeliverableRes.status, 403);
    assert.equal((await customerDeliverableRes.json()).error.code, "FORBIDDEN");

    const creatorBriefRes = await presignFilePost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/files/presign`,
        "POST",
        {
          fileName: "spoofed-brief.txt",
          mimeType: "text/plain",
          fileCategory: "CUSTOMER_BRIEF",
          contentText: "Creator cannot upload customer brief",
        },
        creatorCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(creatorBriefRes.status, 403);
    assert.equal((await creatorBriefRes.json()).error.code, "FORBIDDEN");

    const creatorRevAttachRes = await presignFilePost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/files/presign`,
        "POST",
        {
          fileName: "spoofed-rev.txt",
          mimeType: "text/plain",
          fileCategory: "REVISION_ATTACHMENT",
          contentText: "Creator cannot upload customer revision attachment",
        },
        creatorCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(creatorRevAttachRes.status, 403);
    assert.equal((await creatorRevAttachRes.json()).error.code, "FORBIDDEN");

    // Case-insensitive multipart/form-data Content-Type handling
    const boundary = "----TovolanaMixedCaseBoundary123";
    const mixedCaseMultipartBody = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="mixed-case.txt"',
      "Content-Type: text/plain",
      "",
      "Mixed case multipart header check",
      `--${boundary}`,
      'Content-Disposition: form-data; name="fileCategory"',
      "",
      "CUSTOMER_BRIEF",
      `--${boundary}--`,
      "",
    ].join("\r\n");
    const mixedCaseMultipartRes = await presignFilePost(
      new NextRequest(
        new URL(
          `http://localhost:3000/api/bookings/${bookingRef}/files/presign`,
          "http://localhost:3000"
        ),
        {
          method: "POST",
          headers: {
            "Content-Type": `MULTIPART/FORM-DATA; boundary=${boundary}`,
            cookie: customerCookie,
          },
          body: mixedCaseMultipartBody,
        }
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(mixedCaseMultipartRes.status, 201);
    const { data: mixedCaseMultipartData } = await mixedCaseMultipartRes.json();
    createdFileIds.push(mixedCaseMultipartData.file.id);

    const nonAsciiMimeRes = await presignFilePost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/files/presign`,
        "POST",
        {
          fileName: "notes.txt",
          mimeType: "text/plain; charset=ü",
          fileCategory: "CUSTOMER_BRIEF",
          contentText: "Non-ASCII charset param should fail",
        },
        customerCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(nonAsciiMimeRes.status, 400);
    const nonAsciiMimeJson = await nonAsciiMimeRes.json();
    assert.equal(nonAsciiMimeJson.error.code, "UNSUPPORTED_FILE_TYPE");

    const oversizedHeaderRes = await presignFilePost(
      new NextRequest(
        new URL(
          `http://localhost:3000/api/bookings/${bookingRef}/files/presign`,
          "http://localhost:3000"
        ),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": String(
              MAX_BROWSER_UPLOAD_BYTES + 2 * 1024 * 1024 + 1
            ),
            cookie: customerCookie,
          },
          body: JSON.stringify({
            fileName: "small.txt",
            mimeType: "text/plain",
            contentText: "hi",
          }),
        }
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(oversizedHeaderRes.status, 400);
    const oversizedHeaderJson = await oversizedHeaderRes.json();
    assert.equal(oversizedHeaderJson.error.code, "FILE_TOO_LARGE");

    // 1. Reject SVG/HTML active XSS payloads (JSON + Multipart)
    const svgRes = await presignFilePost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/files/presign`,
        "POST",
        {
          fileName: "diagram.svg",
          mimeType: "image/svg+xml",
          fileCategory: "CUSTOMER_BRIEF",
          contentText: "<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>",
        },
        customerCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(svgRes.status, 400);
    const svgJson = await svgRes.json();
    assert.equal(svgJson.error.code, "UNSUPPORTED_FILE_TYPE");

    const htmlRes = await presignFilePost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/files/presign`,
        "POST",
        {
          fileName: "payload.html.",
          mimeType: "text/plain",
          fileCategory: "CUSTOMER_BRIEF",
          contentText: "<script>alert(1)</script>",
        },
        customerCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(htmlRes.status, 400);
    const htmlJson = await htmlRes.json();
    assert.equal(htmlJson.error.code, "UNSUPPORTED_FILE_TYPE");

    const svgForm = new FormData();
    svgForm.append(
      "file",
      new File(["<svg/>"], "xss.svg", { type: "image/svg+xml" })
    );
    svgForm.append("fileCategory", "CUSTOMER_BRIEF");
    const svgMultipartRes = await presignFilePost(
      makeFormReq(
        `http://localhost:3000/api/bookings/${bookingRef}/files/presign`,
        svgForm,
        customerCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(svgMultipartRes.status, 400);
    const svgMultipartJson = await svgMultipartRes.json();
    assert.equal(svgMultipartJson.error.code, "UNSUPPORTED_FILE_TYPE");

    // 2. Reject > 4 MB payloads (JSON base64, JSON text, Multipart)
    const overSizeBase64 = Buffer.alloc(
      MAX_BROWSER_UPLOAD_BYTES + 1,
      65
    ).toString("base64");
    const bigBase64Res = await presignFilePost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/files/presign`,
        "POST",
        {
          fileName: "oversized.txt",
          mimeType: "text/plain",
          fileCategory: "CUSTOMER_BRIEF",
          contentBase64: overSizeBase64,
        },
        customerCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(bigBase64Res.status, 400);
    const bigBase64Json = await bigBase64Res.json();
    assert.equal(bigBase64Json.error.code, "FILE_TOO_LARGE");

    const bigTextRes = await presignFilePost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/files/presign`,
        "POST",
        {
          fileName: "oversized-text.txt",
          mimeType: "text/plain",
          fileCategory: "CUSTOMER_BRIEF",
          contentText: "x".repeat(MAX_BROWSER_UPLOAD_BYTES + 1),
        },
        customerCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(bigTextRes.status, 400);
    const bigTextJson = await bigTextRes.json();
    assert.equal(bigTextJson.error.code, "FILE_TOO_LARGE");

    const bigForm = new FormData();
    bigForm.append(
      "file",
      new File(
        [new Uint8Array(MAX_BROWSER_UPLOAD_BYTES + 1)],
        "oversized-multipart.txt",
        { type: "text/plain" }
      )
    );
    bigForm.append("fileCategory", "CUSTOMER_BRIEF");
    const bigFormRes = await presignFilePost(
      makeFormReq(
        `http://localhost:3000/api/bookings/${bookingRef}/files/presign`,
        bigForm,
        customerCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(bigFormRes.status, 400);
    const bigFormJson = await bigFormRes.json();
    assert.equal(bigFormJson.error.code, "FILE_TOO_LARGE");

    // 3. Valid upload with sanitized Content-Disposition + nosniff + pre-delivery delete
    const tempUploadRes = await presignFilePost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/files/presign`,
        "POST",
        {
          fileName: 'temp "brief" \\ notes.txt',
          mimeType: "text/plain",
          fileCategory: "CUSTOMER_BRIEF",
          contentBase64: Buffer.from("Temporary customer brief", "utf8").toString(
            "base64"
          ),
        },
        customerCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(tempUploadRes.status, 201);
    const { data: tempUploadData } = await tempUploadRes.json();
    const tempFileId = tempUploadData.file.id;
    createdFileIds.push(tempFileId);

    assert.ok(
      tempUploadData.file.storageKey.startsWith(
        `${env.r2KeyPrefix}/bookings/${bookingId}/`
      )
    );
    assert.equal(
      tempUploadData.file.storageProvider,
      hasR2Config() ? "R2" : "LOCAL"
    );
    if (hasR2Config()) {
      assert.equal(tempUploadData.file.bucket, env.r2BucketName);
      assert.ok(tempUploadData.file.etag);
    }
    assert.ok(tempUploadData.downloadUrl.startsWith(`/api/files/${tempFileId}?`));
    assert.ok(!tempUploadData.downloadUrl.includes("r2.dev"));

    const tempDlRes = await downloadFileGet(
      makeJsonReq(
        `http://localhost:3000/api/files/${tempFileId}`,
        "GET",
        undefined,
        customerCookie
      ),
      { params: Promise.resolve({ fileId: tempFileId }) }
    );
    assert.equal(tempDlRes.status, 200);
    assert.equal(tempDlRes.headers.get("x-content-type-options"), "nosniff");
    assert.equal(tempDlRes.headers.get("cache-control"), "private, no-store");
    const disposition = tempDlRes.headers.get("content-disposition") || "";
    assert.ok(disposition.startsWith("attachment;"));
    assert.ok(!disposition.includes("\r") && !disposition.includes("\n"));
    const quotedMatch = disposition.match(/filename="([^"]*)"/);
    assert.ok(quotedMatch);
    assert.ok(!quotedMatch[1].includes("\\"));
    assert.equal(await tempDlRes.text(), "Temporary customer brief");

    // Non-uploader booking participant (creator) CANNOT delete customer's file -> 403
    const creatorDelTemp = await deleteFileDelete(
      makeJsonReq(
        `http://localhost:3000/api/files/${tempFileId}`,
        "DELETE",
        undefined,
        creatorCookie
      ),
      { params: Promise.resolve({ fileId: tempFileId }) }
    );
    assert.equal(creatorDelTemp.status, 403);
    const creatorDelTempJson = await creatorDelTemp.json();
    assert.equal(creatorDelTempJson.error.code, "FORBIDDEN");

    // Original uploader (customer) CAN delete temporary CUSTOMER_BRIEF before completion
    const customerDelTemp = await deleteFileDelete(
      makeJsonReq(
        `http://localhost:3000/api/files/${tempFileId}`,
        "DELETE",
        undefined,
        customerCookie
      ),
      { params: Promise.resolve({ fileId: tempFileId }) }
    );
    assert.equal(customerDelTemp.status, 200);
    const customerDelTempJson = await customerDelTemp.json();
    assert.equal(customerDelTempJson.data.deletedId, tempFileId);

    const afterDelGet = await downloadFileGet(
      makeJsonReq(
        `http://localhost:3000/api/files/${tempFileId}`,
        "GET",
        undefined,
        customerCookie
      ),
      { params: Promise.resolve({ fileId: tempFileId }) }
    );
    assert.equal(afterDelGet.status, 404);

    // 4. Legacy LOCAL storageProvider row works on GET and DELETE even when R2 is configured
    const legacyKey = `${legacyDirName}/legacy-brief.txt`;
    await fs.mkdir(legacyDirPath, { recursive: true });
    await fs.writeFile(
      path.join(legacyDirPath, "legacy-brief.txt"),
      "legacy disk bytes",
      "utf8"
    );
    const legacyRow = await db.bookingFile.create({
      data: {
        bookingId: bookingBData.booking.id,
        uploaderId: customerId,
        fileCategory: "CUSTOMER_BRIEF",
        fileName: "legacy-brief.txt",
        mimeType: "text/plain",
        sizeBytes: Buffer.byteLength("legacy disk bytes", "utf8"),
        storageKey: legacyKey,
        storageProvider: "LOCAL",
      },
    });
    createdFileIds.push(legacyRow.id);

    const legacyGet = await downloadFileGet(
      makeJsonReq(
        `http://localhost:3000/api/files/${legacyRow.id}`,
        "GET",
        undefined,
        customerCookie
      ),
      { params: Promise.resolve({ fileId: legacyRow.id }) }
    );
    assert.equal(legacyGet.status, 200);
    assert.equal(await legacyGet.text(), "legacy disk bytes");

    const legacyDelete = await deleteFileDelete(
      makeJsonReq(
        `http://localhost:3000/api/files/${legacyRow.id}`,
        "DELETE",
        undefined,
        customerCookie
      ),
      { params: Promise.resolve({ fileId: legacyRow.id }) }
    );
    assert.equal(legacyDelete.status, 200);

    // 5. Retention > 24h lock blocks non-admin deletion with 409
    const agedUploadRes = await presignFilePost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${otherBookingRef}/files/presign`,
        "POST",
        {
          fileName: "aged-brief.txt",
          mimeType: "text/plain",
          fileCategory: "CUSTOMER_BRIEF",
          contentText: "Aged brief content",
        },
        customerCookie
      ),
      { params: Promise.resolve({ ref: otherBookingRef }) }
    );
    assert.equal(agedUploadRes.status, 201);
    const { data: agedUploadData } = await agedUploadRes.json();
    createdFileIds.push(agedUploadData.file.id);

    await db.bookingFile.update({
      where: { id: agedUploadData.file.id },
      data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });

    const agedDelAttempt = await deleteFileDelete(
      makeJsonReq(
        `http://localhost:3000/api/files/${agedUploadData.file.id}`,
        "DELETE",
        undefined,
        customerCookie
      ),
      { params: Promise.resolve({ fileId: agedUploadData.file.id }) }
    );
    assert.equal(agedDelAttempt.status, 409);
    const agedDelJson = await agedDelAttempt.json();
    assert.equal(agedDelJson.error.code, "FILE_LOCKED_BY_BOOKING_STATUS");

    // 6. Pay escrow on bookingA -> IN_PROGRESS -> Creator uploads & delivers deliverable
    const checkoutRes = await checkoutBookingPost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/checkout`,
        "POST",
        { channel: "MPESA_STK", phone: "0744500005" },
        customerCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(checkoutRes.status, 201);
    const { data: checkoutData } = await checkoutRes.json();

    const webhookRes = await intaSendWebhookPost(
      makeJsonReq("http://localhost:3000/api/webhooks/intasend", "POST", {
        api_ref: checkoutData.transaction.apiRef,
        invoice_id: `INV-${checkoutData.transaction.apiRef}`,
        state: "COMPLETE",
        value: bookingAData.booking.totalPayable,
        currency: "KES",
        challenge: env.intasendWebhookChallenge,
      })
    );
    assert.equal(webhookRes.status, 200);

    const delivForm = new FormData();
    delivForm.append(
      "file",
      new File(["Deliverable v1 payload"], "deliverable-v1.txt", {
        type: "text/plain",
      })
    );
    delivForm.append("fileCategory", "CREATOR_DELIVERABLE");
    const delivUploadRes = await presignFilePost(
      makeFormReq(
        `http://localhost:3000/api/bookings/${bookingRef}/files/presign`,
        delivForm,
        creatorCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(delivUploadRes.status, 201);
    const { data: delivUploadData } = await delivUploadRes.json();
    const deliverableId = delivUploadData.file.id;
    createdFileIds.push(deliverableId);

    const deliverRes = await deliverBookingPost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/deliver`,
        "POST",
        { deliverySummary: "Delivered draft report for Task 4 verification." },
        creatorCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(deliverRes.status, 200);

    // Creator CANNOT delete CREATOR_DELIVERABLE once booking is DELIVERED -> 409
    const lockedDeliverableDel = await deleteFileDelete(
      makeJsonReq(
        `http://localhost:3000/api/files/${deliverableId}`,
        "DELETE",
        undefined,
        creatorCookie
      ),
      { params: Promise.resolve({ fileId: deliverableId }) }
    );
    assert.equal(lockedDeliverableDel.status, 409);
    const lockedDelivJson = await lockedDeliverableDel.json();
    assert.equal(lockedDelivJson.error.code, "FILE_LOCKED_BY_BOOKING_STATUS");

    // 7. Revision attachment linking & Cross-Booking IDOR prevention
    const otherBookingUploadRes = await presignFilePost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${otherBookingRef}/files/presign`,
        "POST",
        {
          fileName: "other-booking.txt",
          mimeType: "text/plain",
          fileCategory: "CUSTOMER_BRIEF",
          contentText: "Belongs to booking B",
        },
        customerCookie
      ),
      { params: Promise.resolve({ ref: otherBookingRef }) }
    );
    assert.equal(otherBookingUploadRes.status, 201);
    const { data: otherBookingUploadData } = await otherBookingUploadRes.json();
    const crossBookingFileId = otherBookingUploadData.file.id;
    createdFileIds.push(crossBookingFileId);

    const revAttachUploadRes = await presignFilePost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/files/presign`,
        "POST",
        {
          fileName: "revision-markup.txt",
          mimeType: "text/plain",
          fileCategory: "REVISION_ATTACHMENT",
          contentText: "Please update Section 2.",
        },
        customerCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(revAttachUploadRes.status, 201);
    const { data: revAttachData } = await revAttachUploadRes.json();
    const revAttachmentId = revAttachData.file.id;
    createdFileIds.push(revAttachmentId);

    // Cross-booking file in attachmentFileIds must fail and rollback
    const badRevCrossBooking = await revisionBookingPost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/revision`,
        "POST",
        {
          reason: "Attempt cross-booking attachment link should fail.",
          checklist: ["Should rollback"],
          attachmentFileIds: [crossBookingFileId],
        },
        customerCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(badRevCrossBooking.status, 400);

    // File uploaded by another user (creator deliverable) in attachmentFileIds must fail -> 403
    const badRevOtherUploader = await revisionBookingPost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/revision`,
        "POST",
        {
          reason: "Attempt attaching creator deliverable should fail.",
          checklist: ["Should rollback"],
          attachmentFileIds: [deliverableId],
        },
        customerCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(badRevOtherUploader.status, 403);

    // Valid revision with duplicate attachmentFileIds deduplicates & links revisionId
    const validRevRes = await revisionBookingPost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/revision`,
        "POST",
        {
          reason: "Please expand Section 2 using the attached markup notes.",
          checklist: ["Expand Section 2"],
          attachmentFileIds: [revAttachmentId, revAttachmentId],
        },
        customerCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(validRevRes.status, 201);
    const { data: validRevData } = await validRevRes.json();
    const linkedRevFile = await db.bookingFile.findUnique({
      where: { id: revAttachmentId },
    });
    assert.equal(linkedRevFile?.revisionId, validRevData.revision.id);

    // Customer CANNOT delete a REVISION_ATTACHMENT once linked to a BookingRevision -> 409
    const lockedRevAttachmentDel = await deleteFileDelete(
      makeJsonReq(
        `http://localhost:3000/api/files/${revAttachmentId}`,
        "DELETE",
        undefined,
        customerCookie
      ),
      { params: Promise.resolve({ fileId: revAttachmentId }) }
    );
    assert.equal(lockedRevAttachmentDel.status, 409);
    const lockedRevAttachmentJson = await lockedRevAttachmentDel.json();
    assert.equal(
      lockedRevAttachmentJson.error.code,
      "FILE_LOCKED_BY_BOOKING_STATUS"
    );

    // Presign with cross-booking revisionId must be rejected -> 400
    const crossRevPresign = await presignFilePost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${otherBookingRef}/files/presign`,
        "POST",
        {
          fileName: "cross-rev.txt",
          mimeType: "text/plain",
          fileCategory: "REVISION_ATTACHMENT",
          revisionId: validRevData.revision.id,
          contentText: "Should fail cross-booking check",
        },
        customerCookie
      ),
      { params: Promise.resolve({ ref: otherBookingRef }) }
    );
    assert.equal(crossRevPresign.status, 400);

    // Presign with matching booking revisionId succeeds
    const validRevPresign = await presignFilePost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/files/presign`,
        "POST",
        {
          fileName: "direct-rev-note.txt",
          mimeType: "text/plain",
          fileCategory: "REVISION_ATTACHMENT",
          revisionId: validRevData.revision.id,
          contentText: "Directly linked revision note",
        },
        customerCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(validRevPresign.status, 201);
    const { data: validRevPresignData } = await validRevPresign.json();
    createdFileIds.push(validRevPresignData.file.id);
    assert.equal(validRevPresignData.file.revisionId, validRevData.revision.id);

    // Admin CAN delete a revision-linked attachment -> 200
    const adminDelRevAttachment = await deleteFileDelete(
      makeJsonReq(
        `http://localhost:3000/api/files/${validRevPresignData.file.id}`,
        "DELETE",
        undefined,
        adminCookie
      ),
      { params: Promise.resolve({ fileId: validRevPresignData.file.id }) }
    );
    assert.equal(adminDelRevAttachment.status, 200);

    // 8. Re-deliver -> Dispute evidence linking -> Lock on DISPUTED -> Admin Tribunal overview -> Admin delete
    const reDeliverRes = await deliverBookingPost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/deliver`,
        "POST",
        { deliverySummary: "Updated draft submitted for review." },
        creatorCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(reDeliverRes.status, 200);

    const disputeEvidenceRes = await presignFilePost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/files/presign`,
        "POST",
        {
          fileName: "dispute-evidence.txt",
          mimeType: "text/plain",
          fileCategory: "DISPUTE_EVIDENCE",
          contentText: "Comparison log for tribunal review.",
        },
        customerCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(disputeEvidenceRes.status, 201);
    const { data: disputeEvidenceData } = await disputeEvidenceRes.json();
    const disputeFileId = disputeEvidenceData.file.id;
    createdFileIds.push(disputeFileId);

    // Cannot re-bind a file already linked to a revision -> 409
    const conflictingDisputeRes = await disputeBookingPost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/dispute`,
        "POST",
        {
          action: "DISPUTE",
          reason: "Conflicting attachment test",
          details: "Trying to attach a file already bound to a revision.",
          attachmentFileIds: [revAttachmentId],
        },
        customerCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(conflictingDisputeRes.status, 409);

    const openDisputeRes = await disputeBookingPost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/dispute`,
        "POST",
        {
          action: "DISPUTE",
          reason: "Missing required methodology section",
          details: "Attached comparison log showing missing empirical section.",
          attachmentFileIds: [disputeFileId],
        },
        customerCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(openDisputeRes.status, 201);
    const { data: openDisputeData } = await openDisputeRes.json();
    const linkedDisputeFile = await db.bookingFile.findUnique({
      where: { id: disputeFileId },
    });
    assert.equal(linkedDisputeFile?.disputeId, openDisputeData.dispute.id);

    // Presign passing both revisionId and disputeId simultaneously -> 400
    const bothRefsPresign = await presignFilePost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/files/presign`,
        "POST",
        {
          fileName: "both-refs.txt",
          mimeType: "text/plain",
          fileCategory: "DISPUTE_EVIDENCE",
          revisionId: validRevData.revision.id,
          disputeId: openDisputeData.dispute.id,
          contentText: "Should reject both revisionId and disputeId",
        },
        customerCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(bothRefsPresign.status, 400);
    const bothRefsJson = await bothRefsPresign.json();
    assert.equal(bothRefsJson.error.code, "VALIDATION_ERROR");

    // Presign with cross-booking disputeId must fail -> 400
    const crossDisputePresign = await presignFilePost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${otherBookingRef}/files/presign`,
        "POST",
        {
          fileName: "cross-dispute.txt",
          mimeType: "text/plain",
          fileCategory: "DISPUTE_EVIDENCE",
          disputeId: openDisputeData.dispute.id,
          contentText: "Should fail cross-booking dispute check",
        },
        customerCookie
      ),
      { params: Promise.resolve({ ref: otherBookingRef }) }
    );
    assert.equal(crossDisputePresign.status, 400);

    // Non-admin deletion blocked while DISPUTED -> 409
    const disputedCustomerDel = await deleteFileDelete(
      makeJsonReq(
        `http://localhost:3000/api/files/${disputeFileId}`,
        "DELETE",
        undefined,
        customerCookie
      ),
      { params: Promise.resolve({ fileId: disputeFileId }) }
    );
    assert.equal(disputedCustomerDel.status, 409);
    const disputedDelJson = await disputedCustomerDel.json();
    assert.equal(disputedDelJson.error.code, "FILE_LOCKED_BY_BOOKING_STATUS");

    // During DISPUTED: creator CAN upload DISPUTE_EVIDENCE counter-evidence -> 201,
    // while non-DISPUTE_EVIDENCE categories are locked -> 409
    const creatorDisputeCounterRes = await presignFilePost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/files/presign`,
        "POST",
        {
          fileName: "creator-counter-evidence.txt",
          mimeType: "text/plain",
          fileCategory: "DISPUTE_EVIDENCE",
          disputeId: openDisputeData.dispute.id,
          contentText: "Creator counter-evidence log for tribunal review.",
        },
        creatorCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(creatorDisputeCounterRes.status, 201);
    const { data: creatorDisputeCounterData } =
      await creatorDisputeCounterRes.json();
    createdFileIds.push(creatorDisputeCounterData.file.id);

    const disputedBriefUploadRes = await presignFilePost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/files/presign`,
        "POST",
        {
          fileName: "late-brief.txt",
          mimeType: "text/plain",
          fileCategory: "CUSTOMER_BRIEF",
          contentText: "Blocked during DISPUTED",
        },
        customerCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(disputedBriefUploadRes.status, 409);
    assert.equal(
      (await disputedBriefUploadRes.json()).error.code,
      "FILE_LOCKED_BY_BOOKING_STATUS"
    );

    const disputedDelivUploadRes = await presignFilePost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/files/presign`,
        "POST",
        {
          fileName: "late-deliverable.txt",
          mimeType: "text/plain",
          fileCategory: "CREATOR_DELIVERABLE",
          contentText: "Blocked during DISPUTED",
        },
        creatorCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(disputedDelivUploadRes.status, 409);
    assert.equal(
      (await disputedDelivUploadRes.json()).error.code,
      "FILE_LOCKED_BY_BOOKING_STATUS"
    );

    const disputedRevUploadRes = await presignFilePost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/files/presign`,
        "POST",
        {
          fileName: "late-rev.txt",
          mimeType: "text/plain",
          fileCategory: "REVISION_ATTACHMENT",
          contentText: "Blocked during DISPUTED",
        },
        customerCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(disputedRevUploadRes.status, 409);
    assert.equal(
      (await disputedRevUploadRes.json()).error.code,
      "FILE_LOCKED_BY_BOOKING_STATUS"
    );

    // Admin overview includes openDisputes[].booking.files with uploader metadata and no raw R2 public URLs
    const overviewRes = await adminOverviewGet(
      makeJsonReq(
        "http://localhost:3000/api/admin/overview",
        "GET",
        undefined,
        adminCookie
      )
    );
    assert.equal(overviewRes.status, 200);
    const overviewJson = await overviewRes.json();
    const matchedDispute = overviewJson.data.openDisputes.find(
      (d: { id: string }) => d.id === openDisputeData.dispute.id
    );
    assert.ok(matchedDispute, "Expected dispute in admin overview openDisputes");
    assert.ok(Array.isArray(matchedDispute.booking.files));
    const tribunalFileIds = matchedDispute.booking.files.map(
      (f: { id: string }) => f.id
    );
    assert.ok(tribunalFileIds.includes(disputeFileId));
    assert.ok(tribunalFileIds.includes(deliverableId));
    for (const f of matchedDispute.booking.files as Array<{
      uploader?: { id: string; name: string };
      publicUrl?: string;
    }>) {
      assert.ok(f.uploader?.id && f.uploader?.name);
      assert.equal(f.publicUrl, undefined);
      assert.ok(!JSON.stringify(f).includes("r2.dev"));
    }

    // Admin CAN delete locked deliverable cleanly
    const adminDelDeliverable = await deleteFileDelete(
      makeJsonReq(
        `http://localhost:3000/api/files/${deliverableId}`,
        "DELETE",
        undefined,
        adminCookie
      ),
      { params: Promise.resolve({ fileId: deliverableId }) }
    );
    assert.equal(adminDelDeliverable.status, 200);
    const adminDelJson = await adminDelDeliverable.json();
    assert.equal(adminDelJson.data.deletedId, deliverableId);
    assert.equal(
      await db.bookingFile.findUnique({ where: { id: deliverableId } }),
      null
    );

    // 9. Terminal closed bookings (COMPLETED, REFUNDED, CANCELLED) block ALL non-admin uploads -> 409
    for (const terminalStatus of ["COMPLETED", "REFUNDED", "CANCELLED"] as const) {
      await db.booking.update({
        where: { id: bookingBData.booking.id },
        data: { status: terminalStatus },
      });

      const closedCustomerUpload = await presignFilePost(
        makeJsonReq(
          `http://localhost:3000/api/bookings/${otherBookingRef}/files/presign`,
          "POST",
          {
            fileName: `closed-${terminalStatus.toLowerCase()}.txt`,
            mimeType: "text/plain",
            fileCategory: "CUSTOMER_BRIEF",
            contentText: `Should fail in ${terminalStatus}`,
          },
          customerCookie
        ),
        { params: Promise.resolve({ ref: otherBookingRef }) }
      );
      assert.equal(closedCustomerUpload.status, 409);
      assert.equal(
        (await closedCustomerUpload.json()).error.code,
        "FILE_LOCKED_BY_BOOKING_STATUS"
      );

      const closedEvidenceUpload = await presignFilePost(
        makeJsonReq(
          `http://localhost:3000/api/bookings/${otherBookingRef}/files/presign`,
          "POST",
          {
            fileName: `closed-evidence-${terminalStatus.toLowerCase()}.txt`,
            mimeType: "text/plain",
            fileCategory: "DISPUTE_EVIDENCE",
            contentText: `Dispute evidence also blocked in ${terminalStatus}`,
          },
          creatorCookie
        ),
        { params: Promise.resolve({ ref: otherBookingRef }) }
      );
      assert.equal(closedEvidenceUpload.status, 409);
      assert.equal(
        (await closedEvidenceUpload.json()).error.code,
        "FILE_LOCKED_BY_BOOKING_STATUS"
      );
    }
  } finally {
    for (const fileId of createdFileIds) {
      await deleteFileDelete(
        makeJsonReq(
          `http://localhost:3000/api/files/${fileId}`,
          "DELETE",
          undefined,
          adminCookie
        ),
        { params: Promise.resolve({ fileId }) }
      ).catch(() => undefined);
    }
    await fs.rm(legacyDirPath, { recursive: true, force: true }).catch(() => undefined);
    if (createdBookingIds.length > 0) {
      await db.refundRecord
        .deleteMany({ where: { bookingId: { in: createdBookingIds } } })
        .catch(() => undefined);
      await db.paymentTransaction
        .deleteMany({ where: { bookingId: { in: createdBookingIds } } })
        .catch(() => undefined);
      await db.creatorEarningsLedger
        .deleteMany({ where: { bookingId: { in: createdBookingIds } } })
        .catch(() => undefined);
      await db.booking
        .deleteMany({ where: { id: { in: createdBookingIds } } })
        .catch(() => undefined);
    }
    if (createdListingIds.length > 0) {
      await db.adminAuditLog
        .deleteMany({
          where: {
            targetType: "TaskListing",
            targetId: { in: createdListingIds },
          },
        })
        .catch(() => undefined);
      await db.notificationOutbox
        .deleteMany({
          where: {
            userId: creatorUser.id,
            eventType: "LISTING_APPROVE",
            createdAt: { gte: testStartedAt },
            body: { contains: "R2 File Vault & Tribunal Verification Package" },
          },
        })
        .catch(() => undefined);
      await db.taskListing
        .deleteMany({ where: { id: { in: createdListingIds } } })
        .catch(() => undefined);
    }
    for (const ref of createdBookingRefs) {
      await db.notificationOutbox
        .deleteMany({ where: { linkUrl: { endsWith: `/${ref}` } } })
        .catch(() => undefined);
    }
  }
});

test("7. Public Media Upload/Delete (/api/media/*), Raw Fallback, Portfolio Attachment Validation & Avatar Serialization", async () => {
  const adminLogin = await loginPost(
    makeJsonReq("http://localhost:3000/api/auth/login", "POST", {
      email: "admin@tovolana.com",
      password: "Password123!",
    })
  );
  const adminCookie = extractCookieValue(adminLogin.headers.get("set-cookie"));

  const creatorLogin = await loginPost(
    makeJsonReq("http://localhost:3000/api/auth/login", "POST", {
      email: "creator@tovolana.com",
      password: "Password123!",
    })
  );
  const creatorCookie = extractCookieValue(creatorLogin.headers.get("set-cookie"));

  const customerLogin = await loginPost(
    makeJsonReq("http://localhost:3000/api/auth/login", "POST", {
      email: "free.customer@tovolana.com",
      password: "Password123!",
    })
  );
  const customerCookie = extractCookieValue(
    customerLogin.headers.get("set-cookie")
  );

  const applicantLogin = await loginPost(
    makeJsonReq("http://localhost:3000/api/auth/login", "POST", {
      email: "applicant@tovolana.com",
      password: "Password123!",
    })
  );
  const applicantCookie = extractCookieValue(
    applicantLogin.headers.get("set-cookie")
  );

  const [adminUser, customerUser, creatorUser] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { email: "admin@tovolana.com" },
      select: { id: true },
    }),
    db.user.findUniqueOrThrow({
      where: { email: "free.customer@tovolana.com" },
      select: { id: true, avatarUrl: true },
    }),
    db.user.findUniqueOrThrow({
      where: { email: "creator@tovolana.com" },
      include: { creatorProfile: true },
    }),
  ]);
  assert.ok(creatorUser.creatorProfile);

  const testStartedAt = new Date();
  const origCustomerAvatar = customerUser.avatarUrl;
  const origCreatorAvatar = creatorUser.avatarUrl;
  const origPortfolioSamples = creatorUser.creatorProfile.portfolioSamples;

  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  const pngBuffer = Buffer.from(pngBase64, "base64");
  const pdfBuffer = Buffer.from(
    "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n",
    "utf8"
  );

  const createdAssetIds: string[] = [];
  const localCleanupPaths: string[] = [];
  const createdListingIds: string[] = [];
  const createdBookingIds: string[] = [];
  const createdBookingRefs: string[] = [];
  const createdBookingFileIds: string[] = [];

  try {
    // 1. Unauthenticated upload rejected 401
    const unauthRes = await mediaUploadPost(
      makeJsonReq("http://localhost:3000/api/media/upload", "POST", {
        fileName: "avatar.png",
        mimeType: "image/png",
        purpose: "USER_AVATAR",
        contentBase64: pngBase64,
      })
    );
    assert.equal(unauthRes.status, 401);

    // 2. Authenticated USER_AVATAR PNG upload (JSON base64) -> 201 + DB & /api/settings + /api/media/[id]/raw
    const avatar1Res = await mediaUploadPost(
      makeJsonReq(
        "http://localhost:3000/api/media/upload",
        "POST",
        {
          fileName: "avatar-one.png",
          mimeType: "image/png",
          purpose: "USER_AVATAR",
          contentBase64: pngBase64,
        },
        customerCookie
      )
    );
    assert.equal(avatar1Res.status, 201);
    const { data: avatar1Data } = await avatar1Res.json();
    const asset1 = avatar1Data.asset;
    createdAssetIds.push(asset1.id);

    assert.equal(asset1.purpose, "USER_AVATAR");
    assert.ok(
      asset1.storageKey.startsWith(
        `${env.r2KeyPrefix}/media/avatars/${customerUser.id}/`
      )
    );
    assert.equal(asset1.storageProvider, hasR2Config() ? "R2" : "LOCAL");
    assert.ok(typeof avatar1Data.publicUrl === "string" && avatar1Data.publicUrl.length > 0);
    assert.equal(asset1.publicUrl, avatar1Data.publicUrl);

    const dbCustomerAfter1 = await db.user.findUnique({
      where: { id: customerUser.id },
      select: { avatarUrl: true },
    });
    assert.equal(dbCustomerAfter1?.avatarUrl, avatar1Data.publicUrl);

    const settings1Res = await settingsGet(
      makeJsonReq(
        "http://localhost:3000/api/settings",
        "GET",
        undefined,
        customerCookie
      )
    );
    assert.equal(settings1Res.status, 200);
    const settings1Json = await settings1Res.json();
    assert.equal(settings1Json.data.user.avatarUrl, avatar1Data.publicUrl);

    const raw1Res = await mediaRawGet(
      makeJsonReq(`http://localhost:3000/api/media/${asset1.id}/raw`, "GET"),
      { params: Promise.resolve({ id: asset1.id }) }
    );
    if (
      asset1.storageProvider === "R2" &&
      (asset1.publicUrl.startsWith("https://") ||
        asset1.publicUrl.startsWith("http://"))
    ) {
      assert.equal(raw1Res.status, 307);
      assert.equal(raw1Res.headers.get("location"), asset1.publicUrl);
    } else {
      assert.equal(raw1Res.status, 200);
      assert.equal(raw1Res.headers.get("x-content-type-options"), "nosniff");
      assert.equal(raw1Res.headers.get("cache-control"), "public, max-age=3600");
      assert.deepEqual(Buffer.from(await raw1Res.arrayBuffer()), pngBuffer);
    }

    // 3. Re-uploading second USER_AVATAR via multipart/form-data replaces previous avatar cleanly
    const avatar2Form = new FormData();
    avatar2Form.append(
      "file",
      new File([pngBuffer], "avatar-two.png", { type: "image/png" })
    );
    avatar2Form.append("purpose", "USER_AVATAR");
    const avatar2Res = await mediaUploadPost(
      makeFormReq(
        "http://localhost:3000/api/media/upload",
        avatar2Form,
        customerCookie
      )
    );
    assert.equal(avatar2Res.status, 201);
    const { data: avatar2Data } = await avatar2Res.json();
    const asset2 = avatar2Data.asset;
    createdAssetIds.push(asset2.id);

    assert.notEqual(asset2.id, asset1.id);
    assert.equal(
      await db.mediaAsset.findUnique({ where: { id: asset1.id } }),
      null
    );
    await assert.rejects(() =>
      asset1.storageProvider === "LOCAL"
        ? readPublicLocalMedia(asset1.storageKey)
        : readPrivateFile(asset1.storageKey, asset1.storageProvider)
    );

    const dbCustomerAfter2 = await db.user.findUnique({
      where: { id: customerUser.id },
      select: { avatarUrl: true },
    });
    assert.equal(dbCustomerAfter2?.avatarUrl, avatar2Data.publicUrl);

    // 4. Reject SVG XSS, MIME-extension mismatch, non-ASCII MIME, empty base64, malformed JSON, >4MB size, & unauthorized purposes
    const svgRes = await mediaUploadPost(
      makeJsonReq(
        "http://localhost:3000/api/media/upload",
        "POST",
        {
          fileName: "avatar.svg",
          mimeType: "image/svg+xml",
          purpose: "USER_AVATAR",
          contentBase64: Buffer.from("<svg><script>alert(1)</script></svg>").toString("base64"),
        },
        customerCookie
      )
    );
    assert.equal(svgRes.status, 400);
    assert.equal((await svgRes.json()).error.code, "UNSUPPORTED_FILE_TYPE");

    const mismatchRes = await mediaUploadPost(
      makeJsonReq(
        "http://localhost:3000/api/media/upload",
        "POST",
        {
          fileName: "fake-avatar.jpg",
          mimeType: "image/png",
          purpose: "USER_AVATAR",
          contentBase64: pngBase64,
        },
        customerCookie
      )
    );
    assert.equal(mismatchRes.status, 400);
    assert.equal((await mismatchRes.json()).error.code, "UNSUPPORTED_FILE_TYPE");

    const nonAsciiRes = await mediaUploadPost(
      makeJsonReq(
        "http://localhost:3000/api/media/upload",
        "POST",
        {
          fileName: "avatar.png",
          mimeType: "image/png; charset=ü",
          purpose: "USER_AVATAR",
          contentBase64: pngBase64,
        },
        customerCookie
      )
    );
    assert.equal(nonAsciiRes.status, 400);
    assert.equal((await nonAsciiRes.json()).error.code, "UNSUPPORTED_FILE_TYPE");

    const emptyB64Res = await mediaUploadPost(
      makeJsonReq(
        "http://localhost:3000/api/media/upload",
        "POST",
        {
          fileName: "empty.png",
          mimeType: "image/png",
          purpose: "USER_AVATAR",
          contentBase64: "   ",
        },
        customerCookie
      )
    );
    assert.equal(emptyB64Res.status, 400);
    assert.equal((await emptyB64Res.json()).error.code, "VALIDATION_ERROR");

    const invalidB64Res = await mediaUploadPost(
      makeJsonReq(
        "http://localhost:3000/api/media/upload",
        "POST",
        {
          fileName: "corrupt.png",
          mimeType: "image/png",
          purpose: "USER_AVATAR",
          contentBase64: "not-valid-base64!",
        },
        customerCookie
      )
    );
    assert.equal(invalidB64Res.status, 400);
    assert.equal((await invalidB64Res.json()).error.code, "VALIDATION_ERROR");

    const dataUriB64Res = await mediaUploadPost(
      makeJsonReq(
        "http://localhost:3000/api/media/upload",
        "POST",
        {
          fileName: "prefixed.png",
          mimeType: "image/png",
          purpose: "USER_AVATAR",
          contentBase64: `data:image/png;base64,${pngBase64}`,
        },
        customerCookie
      )
    );
    assert.equal(dataUriB64Res.status, 400);
    assert.equal((await dataUriB64Res.json()).error.code, "VALIDATION_ERROR");

    const malformedRes = await mediaUploadPost(
      new NextRequest(
        new URL("http://localhost:3000/api/media/upload", "http://localhost:3000"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: customerCookie,
          },
          body: "{bad-json",
        }
      )
    );
    assert.equal(malformedRes.status, 400);
    assert.equal((await malformedRes.json()).error.code, "BAD_REQUEST");

    const oversizedHeaderRes = await mediaUploadPost(
      new NextRequest(
        new URL("http://localhost:3000/api/media/upload", "http://localhost:3000"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": String(6 * 1024 * 1024 + 1),
            cookie: customerCookie,
          },
          body: JSON.stringify({
            fileName: "tiny.png",
            mimeType: "image/png",
            purpose: "USER_AVATAR",
            contentBase64: pngBase64,
          }),
        }
      )
    );
    assert.equal(oversizedHeaderRes.status, 400);
    assert.equal((await oversizedHeaderRes.json()).error.code, "FILE_TOO_LARGE");

    const bigBase64Res = await mediaUploadPost(
      makeJsonReq(
        "http://localhost:3000/api/media/upload",
        "POST",
        {
          fileName: "huge.png",
          mimeType: "image/png",
          purpose: "USER_AVATAR",
          contentBase64: Buffer.alloc(MAX_BROWSER_UPLOAD_BYTES + 1, 65).toString("base64"),
        },
        customerCookie
      )
    );
    assert.equal(bigBase64Res.status, 400);
    assert.equal((await bigBase64Res.json()).error.code, "FILE_TOO_LARGE");

    const nonAdminEditorialRes = await mediaUploadPost(
      makeJsonReq(
        "http://localhost:3000/api/media/upload",
        "POST",
        {
          fileName: "hero.png",
          mimeType: "image/png",
          purpose: "EDITORIAL_ASSET",
          contentBase64: pngBase64,
        },
        customerCookie
      )
    );
    assert.equal(nonAdminEditorialRes.status, 403);

    const nonCreatorPortfolioRes = await mediaUploadPost(
      makeJsonReq(
        "http://localhost:3000/api/media/upload",
        "POST",
        {
          fileName: "sample.pdf",
          mimeType: "application/pdf",
          purpose: "CREATOR_PORTFOLIO_DOCUMENT",
          contentBase64: pdfBuffer.toString("base64"),
        },
        customerCookie
      )
    );
    assert.equal(nonCreatorPortfolioRes.status, 403);

    const applicantPortfolioRes = await mediaUploadPost(
      makeJsonReq(
        "http://localhost:3000/api/media/upload",
        "POST",
        {
          fileName: "sample.png",
          mimeType: "image/png",
          purpose: "CREATOR_PORTFOLIO_IMAGE",
          contentBase64: pngBase64,
        },
        applicantCookie
      )
    );
    assert.equal(applicantPortfolioRes.status, 403);

    const adminEditorialRes = await mediaUploadPost(
      makeJsonReq(
        "http://localhost:3000/api/media/upload",
        "POST",
        {
          fileName: "editorial-hero.png",
          mimeType: "image/png",
          purpose: "EDITORIAL_ASSET",
          contentBase64: pngBase64,
        },
        adminCookie
      )
    );
    assert.equal(adminEditorialRes.status, 201);
    const { data: editorialData } = await adminEditorialRes.json();
    createdAssetIds.push(editorialData.asset.id);
    assert.ok(
      editorialData.asset.storageKey.startsWith(
        `${env.r2KeyPrefix}/media/editorial/`
      )
    );

    // 5. Non-owner DELETE -> 403; Owner DELETE -> 200, removes object + DB row, resets avatarUrl to null
    const nonOwnerDelRes = await mediaDelete(
      makeJsonReq(
        `http://localhost:3000/api/media/${asset2.id}`,
        "DELETE",
        undefined,
        creatorCookie
      ),
      { params: Promise.resolve({ id: asset2.id }) }
    );
    assert.equal(nonOwnerDelRes.status, 403);

    const ownerDelRes = await mediaDelete(
      makeJsonReq(
        `http://localhost:3000/api/media/${asset2.id}`,
        "DELETE",
        undefined,
        customerCookie
      ),
      { params: Promise.resolve({ id: asset2.id }) }
    );
    assert.equal(ownerDelRes.status, 200);
    assert.equal((await ownerDelRes.json()).data.deletedId, asset2.id);
    assert.equal(
      await db.mediaAsset.findUnique({ where: { id: asset2.id } }),
      null
    );
    await assert.rejects(() =>
      asset2.storageProvider === "LOCAL"
        ? readPublicLocalMedia(asset2.storageKey)
        : readPrivateFile(asset2.storageKey, asset2.storageProvider)
    );

    const dbCustomerCleared = await db.user.findUnique({
      where: { id: customerUser.id },
      select: { avatarUrl: true },
    });
    assert.equal(dbCustomerCleared?.avatarUrl, null);

    const settingsClearedRes = await settingsGet(
      makeJsonReq(
        "http://localhost:3000/api/settings",
        "GET",
        undefined,
        customerCookie
      )
    );
    assert.equal(settingsClearedRes.status, 200);
    assert.equal((await settingsClearedRes.json()).data.user.avatarUrl, null);

    const repeatDelRes = await mediaDelete(
      makeJsonReq(
        `http://localhost:3000/api/media/${asset2.id}`,
        "DELETE",
        undefined,
        customerCookie
      ),
      { params: Promise.resolve({ id: asset2.id }) }
    );
    assert.equal(repeatDelRes.status, 404);

    // Deleting a non-active USER_AVATAR must preserve an existing external User.avatarUrl
    const nonActiveAvatarRes = await mediaUploadPost(
      makeJsonReq(
        "http://localhost:3000/api/media/upload",
        "POST",
        {
          fileName: "non-active-avatar.png",
          mimeType: "image/png",
          purpose: "USER_AVATAR",
          contentBase64: pngBase64,
        },
        customerCookie
      )
    );
    assert.equal(nonActiveAvatarRes.status, 201);
    const { data: nonActiveAvatarData } = await nonActiveAvatarRes.json();
    createdAssetIds.push(nonActiveAvatarData.asset.id);

    const externalGoogleAvatar =
      "https://lh3.googleusercontent.com/test-external-avatar";
    await db.user.update({
      where: { id: customerUser.id },
      data: { avatarUrl: externalGoogleAvatar },
    });

    const delNonActiveRes = await mediaDelete(
      makeJsonReq(
        `http://localhost:3000/api/media/${nonActiveAvatarData.asset.id}`,
        "DELETE",
        undefined,
        customerCookie
      ),
      { params: Promise.resolve({ id: nonActiveAvatarData.asset.id }) }
    );
    assert.equal(delNonActiveRes.status, 200);
    const customerWithExternalAvatar = await db.user.findUnique({
      where: { id: customerUser.id },
      select: { avatarUrl: true },
    });
    assert.equal(customerWithExternalAvatar?.avatarUrl, externalGoogleAvatar);
    await db.user.update({
      where: { id: customerUser.id },
      data: { avatarUrl: null },
    });

    // 6. Offline LOCAL /api/media/[id]/raw streaming (image inline, docx attachment, active MIME neutralized, no redirect loop)
    const publicLocalRoot = path.resolve(process.cwd(), "uploads", "_public");
    const localPngKey = createMediaStorageKey(
      "general",
      `local-test-${crypto.randomBytes(4).toString("hex")}`,
      "offline-img.png"
    );
    const localPngPath = path.resolve(publicLocalRoot, localPngKey);
    await fs.mkdir(path.dirname(localPngPath), { recursive: true });
    await fs.writeFile(localPngPath, pngBuffer);
    localCleanupPaths.push(localPngPath);

    const localPngRow = await db.mediaAsset.create({
      data: {
        ownerId: customerUser.id,
        purpose: MediaAssetPurpose.GENERAL,
        fileName: "offline-img.png",
        mimeType: "image/png",
        sizeBytes: pngBuffer.byteLength,
        storageProvider: "LOCAL",
        storageKey: localPngKey,
        publicUrl: null,
      },
    });
    createdAssetIds.push(localPngRow.id);
    await db.mediaAsset.update({
      where: { id: localPngRow.id },
      data: { publicUrl: `/api/media/${localPngRow.id}/raw` },
    });

    const localPngRawRes = await mediaRawGet(
      makeJsonReq(`http://localhost:3000/api/media/${localPngRow.id}/raw`, "GET"),
      { params: Promise.resolve({ id: localPngRow.id }) }
    );
    assert.equal(localPngRawRes.status, 200);
    assert.equal(localPngRawRes.headers.get("x-content-type-options"), "nosniff");
    assert.equal(
      localPngRawRes.headers.get("cache-control"),
      "public, max-age=3600"
    );
    assert.equal(localPngRawRes.headers.get("content-type"), "image/png");
    assert.ok(
      (localPngRawRes.headers.get("content-disposition") || "").startsWith(
        "inline;"
      )
    );
    assert.deepEqual(Buffer.from(await localPngRawRes.arrayBuffer()), pngBuffer);

    const localDocxKey = createMediaStorageKey(
      "portfolios",
      `local-test-${crypto.randomBytes(4).toString("hex")}`,
      "sample-draft.docx"
    );
    const localDocxPath = path.resolve(publicLocalRoot, localDocxKey);
    await fs.mkdir(path.dirname(localDocxPath), { recursive: true });
    await fs.writeFile(localDocxPath, Buffer.from("PK\x03\x04docx-bytes"));
    localCleanupPaths.push(localDocxPath);

    const localDocxRow = await db.mediaAsset.create({
      data: {
        ownerId: creatorUser.id,
        purpose: MediaAssetPurpose.CREATOR_PORTFOLIO_DOCUMENT,
        fileName: 'sample "v1" \\ draft.docx',
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sizeBytes: 14,
        storageProvider: "LOCAL",
        storageKey: localDocxKey,
        publicUrl: `/api/media/placeholder/raw`,
      },
    });
    createdAssetIds.push(localDocxRow.id);

    const localDocxRawRes = await mediaRawGet(
      makeJsonReq(`http://localhost:3000/api/media/${localDocxRow.id}/raw`, "GET"),
      { params: Promise.resolve({ id: localDocxRow.id }) }
    );
    assert.equal(localDocxRawRes.status, 200);
    assert.equal(localDocxRawRes.headers.get("x-content-type-options"), "nosniff");
    const docxDisp = localDocxRawRes.headers.get("content-disposition") || "";
    assert.ok(docxDisp.startsWith("attachment;"));
    assert.ok(!docxDisp.includes("\r") && !docxDisp.includes("\n"));

    // Unexpected active MIME in DB must be neutralized to application/octet-stream + attachment
    const localSvgKey = createMediaStorageKey(
      "general",
      `local-test-${crypto.randomBytes(4).toString("hex")}`,
      "tampered.svg"
    );
    const localSvgPath = path.resolve(publicLocalRoot, localSvgKey);
    await fs.mkdir(path.dirname(localSvgPath), { recursive: true });
    await fs.writeFile(localSvgPath, Buffer.from("<svg/>", "utf8"));
    localCleanupPaths.push(localSvgPath);

    const localSvgRow = await db.mediaAsset.create({
      data: {
        ownerId: customerUser.id,
        purpose: MediaAssetPurpose.GENERAL,
        fileName: "tampered.svg",
        mimeType: "image/svg+xml",
        sizeBytes: 6,
        storageProvider: "LOCAL",
        storageKey: localSvgKey,
        publicUrl: null,
      },
    });
    createdAssetIds.push(localSvgRow.id);

    const localSvgRawRes = await mediaRawGet(
      makeJsonReq(`http://localhost:3000/api/media/${localSvgRow.id}/raw`, "GET"),
      { params: Promise.resolve({ id: localSvgRow.id }) }
    );
    assert.equal(localSvgRawRes.status, 200);
    assert.equal(
      localSvgRawRes.headers.get("content-type"),
      "application/octet-stream"
    );
    assert.ok(
      (localSvgRawRes.headers.get("content-disposition") || "").startsWith(
        "attachment;"
      )
    );

    if (hasR2Config()) {
      const missingR2Key = createMediaStorageKey(
        "general",
        `missing-r2-${crypto.randomBytes(4).toString("hex")}`,
        "missing.png"
      );
      const missingR2Row = await db.mediaAsset.create({
        data: {
          ownerId: customerUser.id,
          purpose: MediaAssetPurpose.GENERAL,
          fileName: "missing.png",
          mimeType: "image/png",
          sizeBytes: 10,
          storageProvider: "R2",
          storageKey: missingR2Key,
          publicUrl: null,
        },
      });
      createdAssetIds.push(missingR2Row.id);

      const missingR2RawRes = await mediaRawGet(
        makeJsonReq(
          `http://localhost:3000/api/media/${missingR2Row.id}/raw`,
          "GET"
        ),
        { params: Promise.resolve({ id: missingR2Row.id }) }
      );
      assert.equal(missingR2RawRes.status, 404);
      assert.equal((await missingR2RawRes.json()).error.code, "MEDIA_NOT_FOUND");
    }

    // 7. Creator avatar + CREATOR_PORTFOLIO_DOCUMENT PDF -> PATCH /api/creators-hub/profile + XSS/IDOR checks + serialization across APIs
    const creatorAvatarRes = await mediaUploadPost(
      makeJsonReq(
        "http://localhost:3000/api/media/upload",
        "POST",
        {
          fileName: "creator-avatar.png",
          mimeType: "image/png",
          purpose: "USER_AVATAR",
          contentBase64: pngBase64,
        },
        creatorCookie
      )
    );
    assert.equal(creatorAvatarRes.status, 201);
    const { data: creatorAvatarData } = await creatorAvatarRes.json();
    createdAssetIds.push(creatorAvatarData.asset.id);
    const creatorAvatarUrl = creatorAvatarData.publicUrl as string;

    const portfolioPdfRes = await mediaUploadPost(
      makeJsonReq(
        "http://localhost:3000/api/media/upload",
        "POST",
        {
          fileName: "writing-portfolio.pdf",
          mimeType: "application/pdf",
          purpose: "CREATOR_PORTFOLIO_DOCUMENT",
          contentBase64: pdfBuffer.toString("base64"),
        },
        creatorCookie
      )
    );
    assert.equal(portfolioPdfRes.status, 201);
    const { data: portfolioPdfData } = await portfolioPdfRes.json();
    createdAssetIds.push(portfolioPdfData.asset.id);
    assert.ok(
      portfolioPdfData.asset.storageKey.startsWith(
        `${env.r2KeyPrefix}/media/portfolios/${creatorUser.id}/`
      )
    );

    const foreignGeneralRes = await mediaUploadPost(
      makeJsonReq(
        "http://localhost:3000/api/media/upload",
        "POST",
        {
          fileName: "customer-doc.pdf",
          mimeType: "application/pdf",
          purpose: "GENERAL",
          contentBase64: pdfBuffer.toString("base64"),
        },
        customerCookie
      )
    );
    assert.equal(foreignGeneralRes.status, 201);
    const { data: foreignGeneralData } = await foreignGeneralRes.json();
    createdAssetIds.push(foreignGeneralData.asset.id);

    // Block javascript: and data: URLs in portfolioSamples -> 400
    const xssJsUrlRes = await creatorHubProfilePatch(
      makeJsonReq(
        "http://localhost:3000/api/creators-hub/profile",
        "PATCH",
        {
          portfolioSamples: [
            {
              title: "XSS Sample",
              category: "Research Papers",
              excerpt: "Attempting javascript scheme in portfolio attachmentUrl.",
              attachmentUrl: "javascript:alert(1)",
            },
          ],
        },
        creatorCookie
      )
    );
    assert.equal(xssJsUrlRes.status, 400);

    const xssDataUrlRes = await creatorHubProfilePatch(
      makeJsonReq(
        "http://localhost:3000/api/creators-hub/profile",
        "PATCH",
        {
          portfolioSamples: [
            {
              title: "XSS Data Sample",
              category: "Research Papers",
              excerpt: "Attempting data URI scheme in portfolio url field.",
              url: "data:text/html,<script>alert(1)</script>",
            },
          ],
        },
        creatorCookie
      )
    );
    assert.equal(xssDataUrlRes.status, 400);

    // Block foreign user's attachmentAssetId -> 403
    const foreignAssetAttachRes = await creatorHubProfilePatch(
      makeJsonReq(
        "http://localhost:3000/api/creators-hub/profile",
        "PATCH",
        {
          portfolioSamples: [
            {
              title: "Foreign Asset Attempt",
              category: "Research Papers",
              excerpt: "Attempting to attach another user's MediaAsset ID.",
              attachmentAssetId: foreignGeneralData.asset.id,
            },
          ],
        },
        creatorCookie
      )
    );
    assert.equal(foreignAssetAttachRes.status, 403);

    // Block attaching USER_AVATAR / non-portfolio asset purpose -> 400
    const avatarPortfolioAttachRes = await creatorHubProfilePatch(
      makeJsonReq(
        "http://localhost:3000/api/creators-hub/profile",
        "PATCH",
        {
          portfolioSamples: [
            {
              title: "Avatar Purpose Attempt",
              category: "Research Papers",
              excerpt: "Attempting to attach a USER_AVATAR MediaAsset ID.",
              attachmentAssetId: creatorAvatarData.asset.id,
            },
          ],
        },
        creatorCookie
      )
    );
    assert.equal(avatarPortfolioAttachRes.status, 400);
    assert.equal(
      (await avatarPortfolioAttachRes.json()).error.code,
      "INVALID_MEDIA_ASSET_PURPOSE"
    );

    // Valid portfolioSamples save with creator's PDF asset
    const validPortfolioSaveRes = await creatorHubProfilePatch(
      makeJsonReq(
        "http://localhost:3000/api/creators-hub/profile",
        "PATCH",
        {
          portfolioSamples: [
            {
              title: "Empirical Climate Finance Synthesis",
              category: "Research Papers",
              excerpt:
                "Full PDF portfolio sample uploaded through R2 media pipeline.",
              attachmentUrl: portfolioPdfData.publicUrl,
              attachmentName: "writing-portfolio.pdf",
              attachmentAssetId: portfolioPdfData.asset.id,
              mimeType: "application/pdf",
            },
          ],
        },
        creatorCookie
      )
    );
    assert.equal(validPortfolioSaveRes.status, 200);

    const hubProfileRes = await creatorHubProfileGet(
      makeJsonReq(
        "http://localhost:3000/api/creators-hub/profile",
        "GET",
        undefined,
        creatorCookie
      )
    );
    assert.equal(hubProfileRes.status, 200);
    const hubProfileJson = await hubProfileRes.json();
    assert.equal(
      hubProfileJson.data.creatorProfile.user.avatarUrl,
      creatorAvatarUrl
    );
    assert.equal(
      hubProfileJson.data.creatorProfile.portfolioSamples[0].attachmentAssetId,
      portfolioPdfData.asset.id
    );

    // Verify /api/tasks, /api/tasks/[slug], /api/creators/[username], /api/bookings/[ref] include avatarUrl
    const category = await db.category.findFirstOrThrow({
      where: { slug: "research-papers" },
    });
    const listCreateRes = await createTaskPost(
      makeJsonReq(
        "http://localhost:3000/api/tasks",
        "POST",
        {
          title: "Avatar Serialization Verification Package",
          shortDescription:
            "Temporary published listing to verify creator avatarUrl serialization.",
          fullDescription:
            "Verifies avatarUrl serialization across task list, task detail, creator profile, and booking detail APIs.",
          serviceType: "Policy Brief",
          categoryId: category.id,
          pricingType: "FIXED",
          basePrice: 2500,
          deliveryTurnaroundDays: 2,
          maxRevisions: 1,
          manualAcceptanceRequired: false,
          validityType: "SHORT_14D",
          deliverablesSummary: ["Brief PDF"],
          revisionPolicy: "1 revision included.",
          cancellationPolicy: "Standard escrow policy.",
          submitMode: "SUBMIT_REVIEW",
        },
        creatorCookie
      )
    );
    assert.equal(listCreateRes.status, 201);
    const { data: listCreateData } = await listCreateRes.json();
    const tempListingId = listCreateData.listing.id;
    const tempListingSlug = listCreateData.listing.slug;
    createdListingIds.push(tempListingId);

    const approveTempRes = await reviewListingPost(
      makeJsonReq(
        `http://localhost:3000/api/admin/listings/${tempListingId}/review`,
        "POST",
        {
          decision: "APPROVE",
          validityType: "SHORT_14D",
          note: "Approved for Test 7 serialization check.",
        },
        adminCookie
      ),
      { params: Promise.resolve({ id: tempListingId }) }
    );
    assert.equal(approveTempRes.status, 200);

    const tasksRes = await tasksListGet(
      makeJsonReq("http://localhost:3000/api/tasks", "GET")
    );
    assert.equal(tasksRes.status, 200);
    const tasksJson = await tasksRes.json();
    const matchedTask = tasksJson.data.tasks.find(
      (t: { id: string }) => t.id === tempListingId
    );
    assert.ok(matchedTask);
    assert.equal(matchedTask.creator.user.avatarUrl, creatorAvatarUrl);

    const taskDetailRes = await taskDetailGet(
      makeJsonReq(`http://localhost:3000/api/tasks/${tempListingSlug}`, "GET"),
      { params: Promise.resolve({ slug: tempListingSlug }) }
    );
    assert.equal(taskDetailRes.status, 200);
    const taskDetailJson = await taskDetailRes.json();
    assert.equal(
      taskDetailJson.data.task.creator.user.avatarUrl,
      creatorAvatarUrl
    );

    const publicCreatorRes = await publicCreatorGet(
      makeJsonReq(
        `http://localhost:3000/api/creators/${creatorUser.creatorProfile.username}`,
        "GET"
      ),
      { params: Promise.resolve({ username: creatorUser.creatorProfile.username }) }
    );
    assert.equal(publicCreatorRes.status, 200);
    const publicCreatorJson = await publicCreatorRes.json();
    assert.equal(
      publicCreatorJson.data.creator.user.avatarUrl,
      creatorAvatarUrl
    );

    // Verify PATCH /api/settings returns updated avatarUrl cleanly
    const creatorSettingsPatchRes = await settingsPatch(
      makeJsonReq(
        "http://localhost:3000/api/settings",
        "PATCH",
        { preferredLocale: "en-KE" },
        creatorCookie
      )
    );
    assert.equal(creatorSettingsPatchRes.status, 200);
    assert.equal(
      (await creatorSettingsPatchRes.json()).data.user.avatarUrl,
      creatorAvatarUrl
    );

    // Create a booking and check /api/bookings/[ref] serialization (avatars + storageProvider/revisionId/disputeId without publicUrl)
    const bookingRes = await createBookingPost(
      makeJsonReq(
        "http://localhost:3000/api/bookings",
        "POST",
        {
          taskId: tempListingId,
          requirementsResponses: {
            topic: "Avatar & File Metadata Serialization",
            wordCount: 1000,
          },
        },
        customerCookie
      )
    );
    assert.equal(bookingRes.status, 201);
    const { data: bookingCreated } = await bookingRes.json();
    const bookingRef = bookingCreated.booking.bookingRef as string;
    createdBookingIds.push(bookingCreated.booking.id);
    createdBookingRefs.push(bookingRef);

    const bookingFileRes = await presignFilePost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/files/presign`,
        "POST",
        {
          fileName: "booking-meta-check.txt",
          mimeType: "text/plain",
          fileCategory: "CUSTOMER_BRIEF",
          contentText: "Verify BookingFile fields without R2_PUBLIC_URL",
        },
        customerCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(bookingFileRes.status, 201);
    const { data: bookingFileData } = await bookingFileRes.json();
    createdBookingFileIds.push(bookingFileData.file.id);

    const creatorBookingFileRes = await presignFilePost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/files/presign`,
        "POST",
        {
          fileName: "creator-outline.txt",
          mimeType: "text/plain",
          fileCategory: "CREATOR_DELIVERABLE",
          contentText: "Creator outline attachment for avatar serialization check",
        },
        creatorCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(creatorBookingFileRes.status, 201);
    const { data: creatorBookingFileData } = await creatorBookingFileRes.json();
    createdBookingFileIds.push(creatorBookingFileData.file.id);

    const creatorMsgRes = await bookingMessagePost(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}/messages`,
        "POST",
        { body: "Creator note verifying sender avatarUrl serialization." },
        creatorCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(creatorMsgRes.status, 201);

    const bookingDetailRes = await bookingDetailGet(
      makeJsonReq(
        `http://localhost:3000/api/bookings/${bookingRef}`,
        "GET",
        undefined,
        customerCookie
      ),
      { params: Promise.resolve({ ref: bookingRef }) }
    );
    assert.equal(bookingDetailRes.status, 200);
    const bookingDetailJson = await bookingDetailRes.json();
    const b = bookingDetailJson.data.booking;
    assert.equal(b.creator.user.avatarUrl, creatorAvatarUrl);
    assert.equal(b.customer.avatarUrl, null);
    assert.equal(b.files.length, 2);
    for (const bf of b.files as Array<{
      storageProvider: string;
      revisionId: string | null;
      disputeId: string | null;
      publicUrl?: string;
      uploader: { id: string; avatarUrl: string | null };
    }>) {
      assert.equal(bf.storageProvider, hasR2Config() ? "R2" : "LOCAL");
      assert.ok("revisionId" in bf);
      assert.ok("disputeId" in bf);
      assert.equal(bf.publicUrl, undefined);
      assert.ok("avatarUrl" in bf.uploader);
    }
    assert.ok(
      b.files.some(
        (bf: { uploader: { avatarUrl: string | null } }) =>
          bf.uploader.avatarUrl === creatorAvatarUrl
      )
    );
    assert.ok(
      b.messages.some(
        (m: { sender: { avatarUrl: string | null } }) =>
          m.sender.avatarUrl === creatorAvatarUrl
      )
    );
    assert.ok(
      !JSON.stringify(
        b.files.map(
          (bf: { uploader: { id: string; avatarUrl: string | null } }) => ({
            ...bf,
            uploader: { ...bf.uploader, avatarUrl: null },
          })
        )
      ).includes("r2.dev")
    );
  } finally {
    for (const fileId of createdBookingFileIds) {
      await deleteFileDelete(
        makeJsonReq(
          `http://localhost:3000/api/files/${fileId}`,
          "DELETE",
          undefined,
          adminCookie
        ),
        { params: Promise.resolve({ fileId }) }
      ).catch(() => undefined);
    }
    for (const assetId of createdAssetIds) {
      const row = await db.mediaAsset
        .findUnique({ where: { id: assetId } })
        .catch(() => null);
      if (row) {
        await deleteStoredObject(row.storageKey, row.storageProvider).catch(
          () => undefined
        );
        await db.mediaAsset
          .delete({ where: { id: row.id } })
          .catch(() => undefined);
      }
    }
    for (const p of localCleanupPaths) {
      await fs
        .rm(path.dirname(p), { recursive: true, force: true })
        .catch(() => undefined);
    }
    const prefix = getR2KeyPrefix();
    const publicLocalRoot = path.resolve(process.cwd(), "uploads", "_public");
    const mediaFolders = ["avatars", "editorial", "portfolios", "general"];
    for (const folder of mediaFolders) {
      for (const uid of [customerUser.id, creatorUser.id, adminUser.id]) {
        await fs
          .rm(path.resolve(publicLocalRoot, prefix, "media", folder, uid), {
            recursive: true,
            force: true,
          })
          .catch(() => undefined);
      }
      await fs
        .rmdir(path.resolve(publicLocalRoot, prefix, "media", folder))
        .catch(() => undefined);
    }
    for (const dir of [
      path.resolve(publicLocalRoot, prefix, "media"),
      path.resolve(publicLocalRoot, prefix),
      publicLocalRoot,
    ]) {
      await fs.rmdir(dir).catch(() => undefined);
    }

    await db.user
      .update({
        where: { id: customerUser.id },
        data: { avatarUrl: origCustomerAvatar },
      })
      .catch(() => undefined);
    await db.user
      .update({
        where: { id: creatorUser.id },
        data: { avatarUrl: origCreatorAvatar },
      })
      .catch(() => undefined);
    await db.creatorProfile
      .update({
        where: { id: creatorUser.creatorProfile.id },
        data: {
          portfolioSamples:
            origPortfolioSamples === null
              ? Prisma.JsonNull
              : (origPortfolioSamples as Prisma.InputJsonValue),
        },
      })
      .catch(() => undefined);

    if (createdBookingIds.length > 0) {
      await db.booking
        .deleteMany({ where: { id: { in: createdBookingIds } } })
        .catch(() => undefined);
    }
    for (const ref of createdBookingRefs) {
      await db.notificationOutbox
        .deleteMany({ where: { linkUrl: { endsWith: `/${ref}` } } })
        .catch(() => undefined);
    }
    if (createdListingIds.length > 0) {
      await db.adminAuditLog
        .deleteMany({
          where: {
            targetType: "TaskListing",
            targetId: { in: createdListingIds },
          },
        })
        .catch(() => undefined);
      await db.notificationOutbox
        .deleteMany({
          where: {
            userId: creatorUser.id,
            eventType: "LISTING_APPROVE",
            createdAt: { gte: testStartedAt },
            body: { contains: "Avatar Serialization Verification Package" },
          },
        })
        .catch(() => undefined);
      await db.taskListing
        .deleteMany({ where: { id: { in: createdListingIds } } })
        .catch(() => undefined);
    }
  }
});

test("Monetization Engine E2E: OpenBrief Bidding, Live Rank Promotion, Connects Bundle Purchase & Bid Award Checkout", async () => {
  const { POST: briefsPost, GET: briefsGet } = await import(
    "../app/api/bidding/briefs/route"
  );
  const {
    POST: submitBidPost,
    PATCH: boostBidPatch,
    GET: bidsGet,
  } = await import("../app/api/bidding/briefs/[id]/bids/route");
  const { POST: awardBidPost } = await import(
    "../app/api/bidding/briefs/[id]/award/route"
  );
  const { GET: connectsGet, POST: connectsPost } = await import(
    "../app/api/creators-hub/connects/route"
  );

  const testStartedAt = new Date();
  let createdBriefId: string | null = null;
  let createdBriefRef: string | null = null;
  let createdBookingId: string | null = null;
  let createdBookingRef: string | null = null;
  let createdBackingListingId: string | null = null;
  let paymentApiRef: string | null = null;

  const clientLogin = await loginPost(
    makeJsonReq("http://localhost:3000/api/auth/login", "POST", {
      email: "pro.customer@tovolana.com",
      password: "Password123!",
    })
  );
  assert.equal(clientLogin.status, 200);
  const clientCookie = extractCookieValue(clientLogin.headers.get("set-cookie"));

  const c1Login = await loginPost(
    makeJsonReq("http://localhost:3000/api/auth/login", "POST", {
      email: "creator@tovolana.com",
      password: "Password123!",
    })
  );
  assert.equal(c1Login.status, 200);
  const creator1Cookie = extractCookieValue(c1Login.headers.get("set-cookie"));

  const c2Login = await loginPost(
    makeJsonReq("http://localhost:3000/api/auth/login", "POST", {
      email: "creator2@tovolana.com",
      password: "Password123!",
    })
  );
  assert.equal(c2Login.status, 200);
  const creator2Cookie = extractCookieValue(c2Login.headers.get("set-cookie"));

  const creator1User = await db.user.findUniqueOrThrow({
    where: { email: "creator@tovolana.com" },
    include: { creatorProfile: true },
  });
  const creator2User = await db.user.findUniqueOrThrow({
    where: { email: "creator2@tovolana.com" },
    include: { creatorProfile: true },
  });
  assert.ok(creator1User.creatorProfile && creator2User.creatorProfile);

  const origC1 = {
    connectsBalance: creator1User.creatorProfile.connectsBalance,
    totalConnectsSpent: creator1User.creatorProfile.totalConnectsSpent,
    creatorTier: creator1User.creatorProfile.creatorTier,
    availableNowBadgeUntil: creator1User.creatorProfile.availableNowBadgeUntil,
    featuredProfileUntil: creator1User.creatorProfile.featuredProfileUntil,
    creatorPlusUntil: creator1User.creatorProfile.creatorPlusUntil,
    profileCompletenessScore:
      creator1User.creatorProfile.profileCompletenessScore,
  };
  const origC2 = {
    connectsBalance: creator2User.creatorProfile.connectsBalance,
    totalConnectsSpent: creator2User.creatorProfile.totalConnectsSpent,
    creatorTier: creator2User.creatorProfile.creatorTier,
    availableNowBadgeUntil: creator2User.creatorProfile.availableNowBadgeUntil,
    featuredProfileUntil: creator2User.creatorProfile.featuredProfileUntil,
    creatorPlusUntil: creator2User.creatorProfile.creatorPlusUntil,
    profileCompletenessScore:
      creator2User.creatorProfile.profileCompletenessScore,
  };

  try {
    const activeCat = await db.category.findFirstOrThrow({
      where: { isActive: true },
    });

    // 1. Client posts an OpenBrief
    const briefRes = await briefsPost(
      makeJsonReq(
        "http://localhost:3000/api/bidding/briefs",
        "POST",
        {
          title: "E2E Empirical Synthesis on East African ESG Disclosures",
          categoryId: activeCat.id,
          description:
            "Requires systematic literature review of 20 peer-reviewed sources covering Article 6.4 registries and corporate ESG reporting.",
          budgetMin: 6500,
          budgetMax: 9500,
          deadlineDays: 4,
          isUrgent: false,
          isSealed: false,
          ndaRequired: false,
          allowTripwireOutline: true,
        },
        clientCookie
      )
    );
    assert.equal(briefRes.status, 201);
    const briefJson = await briefRes.json();
    const brief = briefJson.data.brief;
    createdBriefId = brief.id;
    createdBriefRef = brief.briefRef;
    assert.ok(brief.briefRef.startsWith("BRF-"));
    assert.ok(brief.requiredConnects >= 2);

    const listBriefsRes = await briefsGet(
      new NextRequest("http://localhost:3000/api/bidding/briefs?status=OPEN", {
        headers: { cookie: clientCookie },
      })
    );
    assert.equal(listBriefsRes.status, 200);
    const listBriefsJson = await listBriefsRes.json();
    assert.ok(
      listBriefsJson.data.briefs.some(
        (b: { id: string }) => b.id === createdBriefId
      )
    );

    // 2. Creator 2 buys Connects bundle (sandbox webhook) + activates Available Now boost
    const buyRes = await connectsPost(
      makeJsonReq(
        "http://localhost:3000/api/creators-hub/connects",
        "POST",
        {
          action: "BUY_BUNDLE",
          bundleId: "studio",
          channel: "MPESA_STK",
          autoCompleteSandbox: true,
        },
        creator2Cookie
      )
    );
    assert.equal(buyRes.status, 201);
    const buyJson = await buyRes.json();
    paymentApiRef = buyJson.data.transaction?.apiRef ?? null;
    assert.ok(paymentApiRef);

    if (!buyJson.data.credited) {
      const webhookRes = await intaSendWebhookPost(
        makeJsonReq("http://localhost:3000/api/webhooks/intasend", "POST", {
          api_ref: paymentApiRef,
          invoice_id:
            buyJson.data.transaction?.providerInvoiceId ??
            `SIM-${paymentApiRef}`,
          state: "COMPLETE",
          value: buyJson.data.bundle.priceKes,
          currency: "KES",
          challenge: env.intasendWebhookChallenge,
        })
      );
      assert.equal(webhookRes.status, 200);
    }

    const afterPurchaseRes = await connectsGet(
      new NextRequest("http://localhost:3000/api/creators-hub/connects", {
        headers: { cookie: creator2Cookie },
      })
    );
    assert.equal(afterPurchaseRes.status, 200);
    const afterPurchaseJson = await afterPurchaseRes.json();
    const addedConnects: number = buyJson.data.bundle.totalConnects;
    assert.equal(afterPurchaseJson.data.balance, origC2.connectsBalance + addedConnects);

    const boostProfileRes = await connectsPost(
      makeJsonReq(
        "http://localhost:3000/api/creators-hub/connects",
        "POST",
        {
          action: "ACTIVATE_BOOST",
          boostType: "AVAILABLE_NOW",
        },
        creator2Cookie
      )
    );
    assert.equal(boostProfileRes.status, 200);
    const boostProfileJson = await boostProfileRes.json();
    assert.ok(boostProfileJson.data.availableNowBadgeUntil);
    assert.equal(boostProfileJson.data.balance, origC2.connectsBalance + addedConnects - 5);

    const connectsStateRes = await connectsGet(
      new NextRequest("http://localhost:3000/api/creators-hub/connects", {
        headers: { cookie: creator2Cookie },
      })
    );
    assert.equal(connectsStateRes.status, 200);
    const connectsStateJson = await connectsStateRes.json();
    assert.equal(connectsStateJson.data.boosts.availableNowActive, true);
    assert.ok(connectsStateJson.data.transactions.length >= 2);

    // 3. Creator 1 & Creator 2 submit competing bids and verify deterministic ranking
    const bid1Res = await submitBidPost(
      makeJsonReq(
        `http://localhost:3000/api/bidding/briefs/${createdBriefId}/bids`,
        "POST",
        {
          proposedPrice: 8400,
          deliveryDays: 3,
          pitch:
            "Peer-review specialist offering an annotated methodology table and APA 7th synthesis.",
          boostConnects: 6,
          isSealed: false,
          isFeatured: false,
        },
        creator1Cookie
      ),
      { params: Promise.resolve({ id: createdBriefId! }) }
    );
    assert.equal(bid1Res.status, 201);
    const bid1Json = await bid1Res.json();
    const bid1Id: string = bid1Json.data.bid.id;
    assert.equal(bid1Json.data.rankPosition, 1);

    const bid2Res = await submitBidPost(
      makeJsonReq(
        `http://localhost:3000/api/bidding/briefs/${createdBriefId}/bids`,
        "POST",
        {
          proposedPrice: 7800,
          deliveryDays: 3,
          pitch:
            "Quantitative ESG policy analyst with empirical East African disclosure benchmarks.",
          boostConnects: 0,
          isSealed: false,
          isFeatured: false,
        },
        creator2Cookie
      ),
      { params: Promise.resolve({ id: createdBriefId! }) }
    );
    assert.equal(bid2Res.status, 201);
    const bid2Json = await bid2Res.json();
    const bid2Id: string = bid2Json.data.bid.id;
    assert.equal(bid2Json.data.rankPosition, 2);
    assert.equal(bid2Json.data.totalBidders, 2);
    const neededForRank1: number = bid2Json.data.connectsNeededForRank1;
    assert.ok(neededForRank1 > 0);

    // 4. Creator 2 promotes rank using Connects and overtakes #1
    const promoteRes = await boostBidPatch(
      makeJsonReq(
        `http://localhost:3000/api/bidding/briefs/${createdBriefId}/bids`,
        "PATCH",
        {
          addBoostConnects: neededForRank1 + 4,
          enableFeatured: true,
        },
        creator2Cookie
      ),
      { params: Promise.resolve({ id: createdBriefId! }) }
    );
    assert.equal(promoteRes.status, 200);
    const promoteJson = await promoteRes.json();
    assert.equal(promoteJson.data.rankPosition, 1);
    assert.equal(promoteJson.data.bid.isFeatured, true);

    const rankedCheckRes = await bidsGet(
      new NextRequest(
        `http://localhost:3000/api/bidding/briefs/${createdBriefId}/bids`,
        { headers: { cookie: clientCookie } }
      ),
      { params: Promise.resolve({ id: createdBriefId! }) }
    );
    assert.equal(rankedCheckRes.status, 200);
    const rankedCheckJson = await rankedCheckRes.json();
    assert.equal(rankedCheckJson.data.bids[0].id, bid2Id);
    assert.equal(rankedCheckJson.data.bids[1].id, bid1Id);

    // 5. Client awards winning bid with TRIPWIRE_OUTLINE (KES 490) + originality_report bump
    const awardRes = await awardBidPost(
      makeJsonReq(
        `http://localhost:3000/api/bidding/briefs/${createdBriefId}/award`,
        "POST",
        {
          bidId: bid2Id,
          checkoutMode: "TRIPWIRE_OUTLINE",
          selectedAddOns: ["originality_report"],
        },
        clientCookie
      ),
      { params: Promise.resolve({ id: createdBriefId! }) }
    );
    assert.equal(awardRes.status, 201);
    const awardJson = await awardRes.json();
    createdBookingId = awardJson.data.booking.id;
    createdBookingRef = awardJson.data.booking.bookingRef;
    createdBackingListingId = awardJson.data.booking.taskId;

    assert.equal(awardJson.data.booking.totalPayable, 490);
    assert.equal(awardJson.data.booking.checkoutMode, "TRIPWIRE_OUTLINE");
    assert.equal(awardJson.data.booking.addOnsTotal, 450);
    assert.equal(awardJson.data.brief.status, "AWARDED");

    const backingListing = await db.taskListing.findUnique({
      where: { id: createdBackingListingId! },
    });
    assert.equal(backingListing?.status, "DRAFT");

    const [wonBid, declinedBid] = await Promise.all([
      db.taskBid.findUnique({ where: { id: bid2Id } }),
      db.taskBid.findUnique({ where: { id: bid1Id } }),
    ]);
    assert.equal(wonBid?.status, "ACCEPTED");
    assert.equal(declinedBid?.status, "DECLINED");
  } finally {
    if (createdBookingRef) {
      await db.notificationOutbox
        .deleteMany({ where: { linkUrl: { endsWith: `/${createdBookingRef}` } } })
        .catch(() => undefined);
    }
    if (createdBriefRef) {
      await db.notificationOutbox
        .deleteMany({
          where: {
            createdAt: { gte: testStartedAt },
            title: { contains: createdBriefRef },
          },
        })
        .catch(() => undefined);
    }
    if (createdBriefId) {
      await db.notificationOutbox
        .deleteMany({
          where: {
            createdAt: { gte: testStartedAt },
            linkUrl: { endsWith: `/${createdBriefId}` },
          },
        })
        .catch(() => undefined);
    }
    await db.notificationOutbox
      .deleteMany({
        where: {
          userId: creator2User.id,
          eventType: "CONNECTS_CREDITED",
          createdAt: { gte: testStartedAt },
        },
      })
      .catch(() => undefined);
    await db.connectsTransaction
      .deleteMany({
        where: {
          creatorProfileId: {
            in: [
              creator1User.creatorProfile!.id,
              creator2User.creatorProfile!.id,
            ],
          },
          createdAt: { gte: testStartedAt },
        },
      })
      .catch(() => undefined);
    if (paymentApiRef) {
      await db.paymentTransaction
        .deleteMany({ where: { apiRef: paymentApiRef } })
        .catch(() => undefined);
    }
    if (createdBookingId) {
      await db.booking
        .deleteMany({ where: { id: createdBookingId } })
        .catch(() => undefined);
    }
    if (createdBriefId) {
      await db.taskBid
        .deleteMany({ where: { openBriefId: createdBriefId } })
        .catch(() => undefined);
      await db.openBrief
        .deleteMany({ where: { id: createdBriefId } })
        .catch(() => undefined);
    }
    if (createdBackingListingId) {
      await db.taskListing
        .deleteMany({ where: { id: createdBackingListingId } })
        .catch(() => undefined);
    }
    await db.creatorProfile
      .update({ where: { id: creator1User.creatorProfile!.id }, data: origC1 })
      .catch(() => undefined);
    await db.creatorProfile
      .update({ where: { id: creator2User.creatorProfile!.id }, data: origC2 })
      .catch(() => undefined);
  }
});

after(async () => {
  await closeRedisConnection();
  await closeDbConnections();
});
