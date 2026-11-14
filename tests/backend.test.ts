import "dotenv/config";
import test, { after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { closeDbConnections, db } from "@/lib/db";
import { closeRedisConnection } from "@/lib/redis";
import { env } from "@/lib/env";
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
import { POST as completeBookingPost } from "@/app/api/bookings/[ref]/complete/route";
import { POST as presignFilePost } from "@/app/api/bookings/[ref]/files/presign/route";
import { GET as downloadFileGet } from "@/app/api/files/[fileId]/route";
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
});

after(async () => {
  await closeRedisConnection();
  await closeDbConnections();
});
