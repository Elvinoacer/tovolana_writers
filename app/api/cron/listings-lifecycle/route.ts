import { NextRequest } from "next/server";
import {
  isAuthorizedCronOrAdmin,
  runListingsLifecycleSweep,
} from "@/lib/cron";
import { fail, handleApiError, ok } from "@/lib/http";

async function handleLifecycleSweep(request: NextRequest) {
  try {
    if (!(await isAuthorizedCronOrAdmin(request))) {
      return fail("UNAUTHORIZED", "Valid CRON_SECRET or Admin required.", 401);
    }

    const summary = await runListingsLifecycleSweep();
    return ok(summary);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET(request: NextRequest) {
  return handleLifecycleSweep(request);
}

export async function POST(request: NextRequest) {
  return handleLifecycleSweep(request);
}
