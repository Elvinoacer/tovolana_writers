import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  buildSessionCookieHeader,
  signSessionToken,
  verifyPassword,
} from "@/lib/auth";
import { checkRateLimit } from "@/lib/redis";
import { fail, handleApiError, ok } from "@/lib/http";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "local";
    const rl = await checkRateLimit("auth:login", ip, 25, 300);
    if (!rl.allowed) {
      return fail(
        "RATE_LIMITED",
        "Too many login attempts. Please wait before trying again.",
        429
      );
    }

    const body = loginSchema.parse(await request.json());
    const email = body.email.trim().toLowerCase();

    const user = await db.user.findUnique({
      where: { email },
      include: {
        customerProfile: true,
        creatorProfile: true,
      },
    });

    if (
      !user ||
      !user.passwordHash ||
      !verifyPassword(body.password, user.passwordHash)
    ) {
      return fail(
        "INVALID_CREDENTIALS",
        "Invalid email address or password.",
        401
      );
    }

    if (user.status === "SUSPENDED") {
      return fail(
        "ACCOUNT_SUSPENDED",
        "Your account is currently suspended.",
        403
      );
    }

    const sessionToken = signSessionToken(user.id);
    return ok(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          roles: user.roles,
          adminScopes: user.adminScopes,
          membershipTier: user.membershipTier,
          proExpiresAt: user.proExpiresAt,
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified,
          creatorProfile: user.creatorProfile,
        },
      },
      200,
      { "Set-Cookie": buildSessionCookieHeader(sessionToken) }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
