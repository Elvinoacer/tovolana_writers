import { NextRequest } from "next/server";
import { processIntaSendWebhook } from "@/lib/intasend";
import { fail, handleApiError, ok } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const headerChallenge = request.headers.get("x-intasend-challenge");
    const challenge = payload?.challenge ?? headerChallenge;

    const result = await processIntaSendWebhook({
      ...payload,
      challenge,
    });

    return ok(result);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "INVALID_WEBHOOK_CHALLENGE") {
        return fail("UNAUTHORIZED_WEBHOOK", "Invalid IntaSend challenge.", 401);
      }
      if (err.message === "TRANSACTION_NOT_FOUND") {
        return fail("NOT_FOUND", "Payment transaction reference not found.", 404);
      }
      if (
        err.message.startsWith("AMOUNT_MISMATCH") ||
        err.message.startsWith("CURRENCY_MISMATCH")
      ) {
        return fail("PAYMENT_INTEGRITY_ERROR", err.message, 400);
      }
    }
    return handleApiError(err);
  }
}
