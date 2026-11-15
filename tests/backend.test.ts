import "dotenv/config";
import test, { after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
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
  const gCbRes = await googleCallbackGet(new NextRequest(loc));
  assert.equal(gCbRes.status, 307);
  assert.ok(gCbRes.headers.get("set-cookie")?.includes(env.sessionCookieName));
  assert.ok(gCbRes.headers.get("location")?.endsWith("/explore"));
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

  const category = await db.category.findFirstOrThrow({
    where: { slug: "research-papers" },
  });

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

  const createdFileIds: string[] = [];
  const legacyDirName = `__test-backend-legacy-${crypto.randomBytes(6).toString("hex")}`;
  const legacyDirPath = path.resolve(process.cwd(), "uploads", legacyDirName);

  try {
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
  }
});

after(async () => {
  await closeRedisConnection();
  await closeDbConnections();
});
