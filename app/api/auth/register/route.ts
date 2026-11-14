import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  buildSessionCookieHeader,
  createEmailVerificationToken,
  hashPassword,
  signSessionToken,
} from "@/lib/auth";
import { checkRateLimit } from "@/lib/redis";
import { enqueueNotification } from "@/lib/notifications";
import { env } from "@/lib/env";
import { fail, handleApiError, ok } from "@/lib/http";

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(80),
  password: z.string().min(8).max(128),
  phone: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "local";
    const rl = await checkRateLimit("auth:register", ip, 15, 300);
    if (!rl.allowed) {
      return fail(
        "RATE_LIMITED",
        "Too many registration attempts. Please try again shortly.",
        429
      );
    }

    const body = registerSchema.parse(await request.json());
    const email = body.email.trim().toLowerCase();

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return fail(
        "EMAIL_EXISTS",
        "An account with this email address already exists.",
        409
      );
    }

    const passwordHash = hashPassword(body.password);
    const user = await db.user.create({
      data: {
        email,
        name: body.name.trim(),
        phone: body.phone?.trim() || null,
        passwordHash,
        roles: ["CUSTOMER"],
        status: "ACTIVE",
        membershipTier: "FREE",
        customerProfile: { create: {} },
        authAccounts: {
          create: {
            provider: "credentials",
            providerAccountId: email,
          },
        },
      },
      include: {
        customerProfile: true,
        creatorProfile: true,
      },
    });

    const verificationToken = await createEmailVerificationToken(user.id, email);

    await enqueueNotification({
      userId: user.id,
      eventType: "WELCOME_EMAIL_VERIFY",
      title: "Verify your Tovolana Writers email",
      body: `Welcome, ${user.name}! Confirm your email address using link ${env.appUrl}/api/auth/verify-email?token=${verificationToken}`,
      linkUrl: `/auth/verify?token=${verificationToken}`,
      payload: { token: verificationToken },
    });

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
        },
        verificationPreviewToken:
          process.env.NODE_ENV !== "production" ? verificationToken : undefined,
      },
      201,
      { "Set-Cookie": buildSessionCookieHeader(sessionToken) }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
