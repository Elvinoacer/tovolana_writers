import { NextRequest } from "next/server";
import { z } from "zod";
import { createPhoneOtp, requireAuth } from "@/lib/auth";
import { normalizeKenyanMsisdn } from "@/lib/intasend";
import { checkRateLimit } from "@/lib/redis";
import { enqueueNotification } from "@/lib/notifications";
import { fail, handleApiError, ok } from "@/lib/http";

const sendOtpSchema = z.object({
  phone: z.string().min(9).max(20),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = sendOtpSchema.parse(await request.json());
    const phone = normalizeKenyanMsisdn(body.phone);

    const rl = await checkRateLimit("otp:send", `${user.id}:${phone}`, 3, 600);
    if (!rl.allowed) {
      return fail(
        "OTP_RATE_LIMITED",
        "Maximum OTP requests reached for this number. Try again in 10 minutes.",
        429
      );
    }

    const { code, expiresAt } = await createPhoneOtp(user.id, phone);

    await enqueueNotification({
      userId: user.id,
      eventType: "PHONE_OTP_CODE",
      title: "Your Tovolana verification code",
      body: `Use verification code ${code} within 10 minutes to verify phone ${phone}.`,
      linkUrl: "/auth/verify",
      payload: { phone },
    });

    return ok({
      sent: true,
      phone,
      expiresAt,
      sandboxOtpPreview: process.env.NODE_ENV !== "production" ? code : undefined,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
