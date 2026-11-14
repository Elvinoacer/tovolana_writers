import { buildClearSessionCookieHeader } from "@/lib/auth";
import { ok } from "@/lib/http";

export async function POST() {
  return ok(
    { loggedOut: true },
    200,
    { "Set-Cookie": buildClearSessionCookieHeader() }
  );
}
