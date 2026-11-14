import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth";

export function ok<T>(data: T, status: number = 200, headers?: HeadersInit) {
  return NextResponse.json({ ok: true, data }, { status, headers });
}

export function fail(
  code: string,
  message: string,
  status: number = 400,
  details?: unknown
) {
  return NextResponse.json(
    { ok: false, error: { code, message, details } },
    { status }
  );
}

export function handleApiError(err: unknown) {
  if (err instanceof AuthError) {
    return fail(err.code, err.message, err.status);
  }
  if (err instanceof ZodError) {
    return fail("VALIDATION_ERROR", "Invalid request payload.", 400, err.issues);
  }
  if (err instanceof Error) {
    if (err.message === "RESOURCE_LOCKED") {
      return fail(
        "RESOURCE_LOCKED",
        "Another checkout or operation is already in progress. Please wait a few seconds.",
        409
      );
    }
    if (err.message.startsWith("INVALID_KENYAN_PHONE")) {
      return fail("INVALID_PHONE", err.message, 400);
    }
    if (err.message === "BOOKING_ALREADY_PAID") {
      return fail("ALREADY_PAID", "This booking is already paid.", 409);
    }
    if (err.message === "INVALID_CUSTOM_VALIDITY_DATE") {
      return fail(
        "INVALID_VALIDITY_DATE",
        "Custom validity date must be in the future.",
        400
      );
    }
  }
  console.error("[API_ERROR]", err);
  return fail("INTERNAL_ERROR", "An unexpected server error occurred.", 500);
}
