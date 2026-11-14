import crypto from "crypto";
import { cookies } from "next/headers";
import type { AdminScope, UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, "hex");
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export function signSessionToken(userId: string): string {
  const payload = JSON.stringify({
    userId,
    exp: Date.now() + SESSION_TTL_MS,
  });
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", env.authSecret)
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifySessionToken(
  token: string | undefined | null
): { userId: string; exp: number } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  const expectedSig = crypto
    .createHmac("sha256", env.authSecret)
    .update(payloadB64)
    .digest("base64url");

  const sigBuf = Buffer.from(sigB64);
  const expectedBuf = Buffer.from(expectedSig);
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    ) as { userId?: string; exp?: number };
    if (!parsed.userId || !parsed.exp || Date.now() > parsed.exp) {
      return null;
    }
    return { userId: parsed.userId, exp: parsed.exp };
  } catch {
    return null;
  }
}

export function extractSessionTokenFromCookieHeader(
  cookieHeader: string | null | undefined
): string | null {
  if (!cookieHeader) return null;
  const cookieName = env.sessionCookieName;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const part of parts) {
    if (part.startsWith(`${cookieName}=`)) {
      return decodeURIComponent(part.slice(cookieName.length + 1));
    }
  }
  return null;
}

export function buildSessionCookieHeader(token: string): string {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${env.sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function buildClearSessionCookieHeader(): string {
  return `${env.sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function getCurrentUser(request?: Request) {
  let token: string | null | undefined = null;

  if (request) {
    token = extractSessionTokenFromCookieHeader(request.headers.get("cookie"));
    if (!token) {
      const authHeader = request.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.slice(7).trim();
      }
    }
  } else {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(env.sessionCookieName)?.value ?? null;
    } catch {
      token = null;
    }
  }

  const verified = verifySessionToken(token);
  if (!verified) return null;

  const user = await db.user.findUnique({
    where: { id: verified.userId },
    include: {
      customerProfile: true,
      creatorProfile: true,
    },
  });

  if (!user) return null;

  // Enforce automatic Pro expiry fallback cleanly to FREE without losing history
  if (
    user.membershipTier === "PRO" &&
    user.proExpiresAt &&
    user.proExpiresAt.getTime() <= Date.now()
  ) {
    return db.user.update({
      where: { id: user.id },
      data: { membershipTier: "FREE" },
      include: {
        customerProfile: true,
        creatorProfile: true,
      },
    });
  }

  return user;
}

export type AuthenticatedUser = NonNullable<
  Awaited<ReturnType<typeof getCurrentUser>>
>;

export async function requireAuth(
  request?: Request
): Promise<AuthenticatedUser> {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new AuthError("UNAUTHORIZED", "Authentication required.", 401);
  }
  if (user.status === "SUSPENDED") {
    throw new AuthError(
      "ACCOUNT_SUSPENDED",
      "Your account is currently suspended. Contact platform support.",
      403
    );
  }
  return user;
}

export async function requireRole(
  role: UserRole,
  request?: Request
): Promise<AuthenticatedUser> {
  const user = await requireAuth(request);
  if (!user.roles.includes(role)) {
    throw new AuthError(
      "FORBIDDEN",
      `This action requires the ${role} role.`,
      403
    );
  }
  return user;
}

export async function requireAdminScope(
  scope: AdminScope,
  request?: Request
): Promise<AuthenticatedUser> {
  const user = await requireRole("ADMIN", request);
  if (
    !user.adminScopes.includes("SUPER_ADMIN") &&
    !user.adminScopes.includes(scope)
  ) {
    throw new AuthError(
      "INSUFFICIENT_ADMIN_SCOPE",
      `Administrator scope ${scope} is required.`,
      403
    );
  }
  return user;
}

export function hashToken(raw: string): string {
  return crypto
    .createHash("sha256")
    .update(`${raw}:${env.authSecret}`)
    .digest("hex");
}

export async function createEmailVerificationToken(
  userId: string,
  email: string
): Promise<string> {
  const rawToken = crypto.randomBytes(24).toString("hex");
  const tokenHash = hashToken(rawToken);
  await db.verificationToken.create({
    data: {
      userId,
      identifier: email.toLowerCase(),
      tokenHash,
      type: "EMAIL_VERIFY",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  return rawToken;
}

export async function consumeEmailVerificationToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const record = await db.verificationToken.findUnique({
    where: { tokenHash },
  });
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    return null;
  }

  await db.$transaction(async (tx) => {
    await tx.verificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    if (record.userId) {
      await tx.user.update({
        where: { id: record.userId },
        data: { emailVerified: new Date() },
      });
    }
  });

  return record;
}

export async function createPhoneOtp(
  userId: string,
  phone: string,
  purpose: string = "PHONE_VERIFY"
): Promise<{ code: string; expiresAt: Date }> {
  const code = String(crypto.randomInt(100000, 999999));
  const codeHash = hashToken(`${userId}:${phone}:${code}`);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.otpVerification.create({
    data: {
      userId,
      phone,
      codeHash,
      purpose,
      expiresAt,
    },
  });

  return { code, expiresAt };
}

export async function verifyPhoneOtp(
  userId: string,
  phone: string,
  code: string
): Promise<{ ok: boolean; reason?: string }> {
  const latest = await db.otpVerification.findFirst({
    where: {
      userId,
      phone,
      verifiedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!latest) {
    return { ok: false, reason: "OTP_NOT_FOUND" };
  }
  if (latest.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "OTP_EXPIRED" };
  }
  if (latest.attempts >= latest.maxAttempts) {
    return { ok: false, reason: "OTP_MAX_ATTEMPTS" };
  }

  const candidateHash = hashToken(`${userId}:${phone}:${code.trim()}`);
  const matches = crypto.timingSafeEqual(
    Buffer.from(candidateHash, "hex"),
    Buffer.from(latest.codeHash, "hex")
  );

  if (!matches) {
    await db.otpVerification.update({
      where: { id: latest.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: "OTP_INVALID" };
  }

  await db.$transaction([
    db.otpVerification.update({
      where: { id: latest.id },
      data: { verifiedAt: new Date() },
    }),
    db.user.update({
      where: { id: userId },
      data: { phone, phoneVerified: new Date() },
    }),
  ]);

  return { ok: true };
}

export class AuthError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function sanitizeCallbackUrl(url: string | null | undefined): string {
  if (!url) return "/dashboard";
  if (url.startsWith("/") && !url.startsWith("//")) {
    return url;
  }
  return "/dashboard";
}
