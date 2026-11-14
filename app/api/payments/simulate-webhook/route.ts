import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { processIntaSendWebhook } from "@/lib/intasend";
import { fail, handleApiError, ok } from "@/lib/http";

const simSchema = z.object({
  apiRef: z.string().min(3),
  state: z.enum(["COMPLETE", "FAILED"]).default("COMPLETE"),
});

export async function POST(request: NextRequest) {
  try {
    if (!env.intasendIsTest) {
      return fail(
        "SANDBOX_ONLY",
        "Webhook simulation is disabled when INTASEND_IS_TEST is false.",
        403
      );
    }

    const user = await requireAuth(request);
    const body = simSchema.parse(await request.json());

    const txRecord = await db.paymentTransaction.findUnique({
      where: { apiRef: body.apiRef },
    });
    if (!txRecord) {
      return fail("NOT_FOUND", "Transaction not found.", 404);
    }
    if (txRecord.userId !== user.id && !user.roles.includes("ADMIN")) {
      return fail("FORBIDDEN", "Not owner of this payment transaction.", 403);
    }

    const result = await processIntaSendWebhook({
      api_ref: txRecord.apiRef,
      invoice_id: txRecord.providerInvoiceId ?? `SIM-${txRecord.apiRef}`,
      state: body.state,
      value: txRecord.amount,
      currency: txRecord.currency,
      provider: txRecord.channel,
      challenge: env.intasendWebhookChallenge,
    });

    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
