import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth, verifyPhoneOtp } from "@/lib/auth";
import { normalizeKenyanMsisdn } from "@/lib/intasend";
import { fail, handleApiError, ok } from "@/lib/http";

const verifyOtpSchema = z.object({
  phone: z.string().min(9).max(20),
  code: z.string().length(6),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = verifyOtpSchema.parse(await request.json());
    const phone = normalizeKenyanMsisdn(body.phone);

    const result = await verifyPhoneOtp(user.id, phone, body.code);
    if (!result.ok) {
      return fail(
        result.reason || "OTP_VERIFICATION_FAILED",
        "Invalid or expired OTP code.",
        400
      );
    }

    return ok({
      verified: true,
      phone,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
