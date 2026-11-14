import { NextRequest } from "next/server";
import { z } from "zod";
import {
  consumeEmailVerificationToken,
  createEmailVerificationToken,
  requireAuth,
} from "@/lib/auth";
import { enqueueNotification } from "@/lib/notifications";
import { env } from "@/lib/env";
import { fail, handleApiError, ok } from "@/lib/http";

const verifySchema = z.object({
  token: z.string().min(8),
});

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    if (!token) {
      return fail("MISSING_TOKEN", "Verification token is required.", 400);
    }
    const verified = await consumeEmailVerificationToken(token);
    if (!verified) {
      return fail(
        "INVALID_OR_EXPIRED_TOKEN",
        "This verification token is invalid or has already expired.",
        400
      );
    }
    return ok({ verified: true, email: verified.identifier });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body && typeof body.token === "string") {
      const parsed = verifySchema.parse(body);
      const verified = await consumeEmailVerificationToken(parsed.token);
      if (!verified) {
        return fail(
          "INVALID_OR_EXPIRED_TOKEN",
          "Verification token invalid or expired.",
          400
        );
      }
      return ok({ verified: true, email: verified.identifier });
    }

    // Re-send verification email for authenticated user
    const user = await requireAuth(request);
    const token = await createEmailVerificationToken(user.id, user.email);
    await enqueueNotification({
      userId: user.id,
      eventType: "EMAIL_VERIFY_RESEND",
      title: "Verify your email address",
      body: `Click here to confirm your email address: ${env.appUrl}/auth/verify?token=${token}`,
      linkUrl: `/auth/verify?token=${token}`,
      payload: { token },
    });

    return ok({
      sent: true,
      verificationPreviewToken:
        process.env.NODE_ENV !== "production" ? token : undefined,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
