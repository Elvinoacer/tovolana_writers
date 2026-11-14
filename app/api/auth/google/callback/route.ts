import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  buildSessionCookieHeader,
  sanitizeCallbackUrl,
  signSessionToken,
} from "@/lib/auth";
import { env, hasGoogleOAuthKeys } from "@/lib/env";

function verifyOAuthState(
  state: string | null
): { callbackUrl: string; nonce: string } | null {
  if (!state) return null;
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expected = crypto
    .createHmac("sha256", env.authSecret)
    .update(encoded)
    .digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const stateParam = request.nextUrl.searchParams.get("state");
  const parsedState = verifyOAuthState(stateParam);
  const callbackUrl = sanitizeCallbackUrl(parsedState?.callbackUrl);

  if (!code || !parsedState) {
    return NextResponse.redirect(
      new URL(`/auth?error=google_oauth_state_invalid`, request.url)
    );
  }

  let googleSub: string;
  let email: string;
  let name: string;
  let avatarUrl: string | null = null;
  let accessToken: string | null = null;
  let refreshToken: string | null = null;

  if (hasGoogleOAuthKeys() && code !== "sandbox_google_oauth_code") {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.googleClientId,
        client_secret: env.googleClientSecret,
        redirect_uri: env.googleRedirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(
        new URL(`/auth?error=google_token_exchange_failed`, request.url)
      );
    }

    const tokenJson = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
    };
    accessToken = tokenJson.access_token;
    refreshToken = tokenJson.refresh_token ?? null;

    const userRes = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!userRes.ok) {
      return NextResponse.redirect(
        new URL(`/auth?error=google_userinfo_failed`, request.url)
      );
    }

    const profile = (await userRes.json()) as {
      sub: string;
      email: string;
      name?: string;
      picture?: string;
    };
    googleSub = profile.sub;
    email = profile.email.toLowerCase();
    name = profile.name || email.split("@")[0];
    avatarUrl = profile.picture ?? null;
  } else {
    // Sandbox OAuth mode (when live Google OAuth keys are not yet configured)
    if (hasGoogleOAuthKeys()) {
      return NextResponse.redirect(
        new URL(`/auth?error=google_invalid_code`, request.url)
      );
    }
    const simEmail = (
      request.nextUrl.searchParams.get("sandbox_email") ||
      "google.writer@tovolana.com"
    )
      .trim()
      .toLowerCase();
    email = simEmail;
    name =
      request.nextUrl.searchParams.get("sandbox_name") || "Tovolana Google User";
    googleSub = `sandbox-${email}`;
  }

  let user = await db.user.findUnique({ where: { email } });
  if (!user) {
    user = await db.user.create({
      data: {
        email,
        name,
        avatarUrl,
        roles: ["CUSTOMER"],
        status: "ACTIVE",
        emailVerified: new Date(),
        membershipTier: "FREE",
        customerProfile: { create: {} },
      },
    });
  } else if (!user.emailVerified) {
    user = await db.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date(), avatarUrl: user.avatarUrl ?? avatarUrl },
    });
  }

  await db.authAccount.upsert({
    where: {
      provider_providerAccountId: {
        provider: "google",
        providerAccountId: googleSub,
      },
    },
    update: {
      userId: user.id,
      accessToken,
      refreshToken,
    },
    create: {
      userId: user.id,
      provider: "google",
      providerAccountId: googleSub,
      accessToken,
      refreshToken,
    },
  });

  if (user.status === "SUSPENDED") {
    return NextResponse.redirect(
      new URL(`/auth?error=account_suspended`, request.url)
    );
  }

  const sessionToken = signSessionToken(user.id);
  const redirectTarget = new URL(callbackUrl, request.url);
  const response = NextResponse.redirect(redirectTarget);
  response.headers.set("Set-Cookie", buildSessionCookieHeader(sessionToken));
  return response;
}
