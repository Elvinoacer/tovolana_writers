import { NextRequest } from "next/server";
import {
  isAuthorizedCronOrAdmin,
  runDeadlineAlertsSweep,
  runListingsLifecycleSweep,
} from "@/lib/cron";
import { processPendingNotificationOutbox } from "@/lib/notifications";
import { fail, handleApiError, ok } from "@/lib/http";

async function handleUnifiedRun(request: NextRequest) {
  try {
    if (!(await isAuthorizedCronOrAdmin(request))) {
      return fail("UNAUTHORIZED", "Valid CRON_SECRET or Admin required.", 401);
    }

    const lifecycle = await runListingsLifecycleSweep();
    const deadlineAlerts = await runDeadlineAlertsSweep();
    const notificationsOutbox = await processPendingNotificationOutbox(50);

    return ok({
      lifecycle,
      deadlineAlerts,
      notificationsOutbox,
      executedAt: new Date().toISOString(),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET(request: NextRequest) {
  return handleUnifiedRun(request);
}

export async function POST(request: NextRequest) {
  return handleUnifiedRun(request);
}
