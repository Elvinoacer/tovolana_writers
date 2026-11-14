import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { sanitizeCallbackUrl } from "@/lib/auth";
import { env, hasGoogleOAuthKeys } from "@/lib/env";

function signOAuthState(payload: { callbackUrl: string; nonce: string }): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sig = crypto
    .createHmac("sha256", env.authSecret)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export async function GET(request: NextRequest) {
  const callbackUrl = sanitizeCallbackUrl(
    request.nextUrl.searchParams.get("callbackUrl")
  );
  const nonce = crypto.randomBytes(12).toString("hex");
  const state = signOAuthState({ callbackUrl, nonce });

  if (hasGoogleOAuthKeys()) {
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", env.googleClientId);
    authUrl.searchParams.set("redirect_uri", env.googleRedirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "select_account");
    authUrl.searchParams.set("state", state);
    return NextResponse.redirect(authUrl);
  }

  // Sandbox OAuth fallback when live Google OAuth credentials haven't been pasted yet
  const simEmail =
    request.nextUrl.searchParams.get("email") || "google.writer@tovolana.com";
  const simName =
    request.nextUrl.searchParams.get("name") || "Tovolana Google User";
  const cb = new URL("/api/auth/google/callback", request.url);
  cb.searchParams.set("code", "sandbox_google_oauth_code");
  cb.searchParams.set("state", state);
  cb.searchParams.set("sandbox_email", simEmail);
  cb.searchParams.set("sandbox_name", simName);
  return NextResponse.redirect(cb);
}
