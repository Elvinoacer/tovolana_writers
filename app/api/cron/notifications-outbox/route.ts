import crypto from "crypto";
import { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";
import { processPendingNotificationOutbox } from "@/lib/notifications";
import { fail, handleApiError, ok } from "@/lib/http";

function verifyCronSecret(request: NextRequest): boolean {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7).trim();
  const a = crypto.createHash("sha256").update(token).digest();
  const b = crypto.createHash("sha256").update(env.cronSecret).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  return handleOutbox(request);
}

export async function POST(request: NextRequest) {
  return handleOutbox(request);
}

async function handleOutbox(request: NextRequest) {
  try {
    if (!verifyCronSecret(request)) {
      const user = await getCurrentUser(request);
      if (!user || !user.roles.includes("ADMIN")) {
        return fail("UNAUTHORIZED", "Valid CRON_SECRET or Admin required.", 401);
      }
    }

    const summary = await processPendingNotificationOutbox(50);
    return ok(summary);
  } catch (err) {
    return handleApiError(err);
  }
}
