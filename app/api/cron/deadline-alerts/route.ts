import { NextRequest } from "next/server";
import { isAuthorizedCronOrAdmin, runDeadlineAlertsSweep } from "@/lib/cron";
import { fail, handleApiError, ok } from "@/lib/http";

async function handleDeadlineAlerts(request: NextRequest) {
  try {
    if (!(await isAuthorizedCronOrAdmin(request))) {
      return fail("UNAUTHORIZED", "Valid CRON_SECRET or Admin required.", 401);
    }

    const summary = await runDeadlineAlertsSweep();
    return ok(summary);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET(request: NextRequest) {
  return handleDeadlineAlerts(request);
}

export async function POST(request: NextRequest) {
  return handleDeadlineAlerts(request);
}
