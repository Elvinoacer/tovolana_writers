import { NextRequest } from "next/server";
import { isAuthorizedCronOrAdmin } from "@/lib/cron";
import { processPendingNotificationOutbox } from "@/lib/notifications";
import { fail, handleApiError, ok } from "@/lib/http";

async function handleOutbox(request: NextRequest) {
  try {
    if (!(await isAuthorizedCronOrAdmin(request))) {
      return fail("UNAUTHORIZED", "Valid CRON_SECRET or Admin required.", 401);
    }

    const summary = await processPendingNotificationOutbox(50);
    return ok(summary);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET(request: NextRequest) {
  return handleOutbox(request);
}

export async function POST(request: NextRequest) {
  return handleOutbox(request);
}
