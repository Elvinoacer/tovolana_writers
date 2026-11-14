import crypto from "crypto";
import nodemailer from "nodemailer";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env, hasFirebaseAdminKeys } from "@/lib/env";

export interface NotificationInput {
  userId: string;
  eventType: string;
  title: string;
  body: string;
  linkUrl?: string;
  payload?: Record<string, unknown>;
}

export async function enqueueNotificationInTx(
  tx: Prisma.TransactionClient,
  input: NotificationInput
) {
  const payloadJson = (input.payload ?? {}) as Prisma.InputJsonValue;

  await tx.notificationOutbox.createMany({
    data: [
      {
        userId: input.userId,
        channel: "IN_APP",
        eventType: input.eventType,
        title: input.title,
        body: input.body,
        linkUrl: input.linkUrl ?? null,
        payload: payloadJson,
        status: "SENT",
        sentAt: new Date(),
      },
      {
        userId: input.userId,
        channel: "EMAIL",
        eventType: input.eventType,
        title: input.title,
        body: input.body,
        linkUrl: input.linkUrl ?? null,
        payload: payloadJson,
        status: "PENDING",
      },
      {
        userId: input.userId,
        channel: "FCM_PUSH",
        eventType: input.eventType,
        title: input.title,
        body: input.body,
        linkUrl: input.linkUrl ?? null,
        payload: payloadJson,
        status: "PENDING",
      },
    ],
  });
}

export async function enqueueNotification(input: NotificationInput) {
  return db.$transaction(async (tx) => enqueueNotificationInTx(tx, input));
}

async function sendEmailMessage(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  if (env.resendApiKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.emailFrom,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`RESEND_ERROR: ${errBody}`);
    }
    return { provider: "RESEND" };
  }

  if (env.smtpHost && env.smtpUser && env.smtpPass) {
    const transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth: {
        user: env.smtpUser,
        pass: env.smtpPass,
      },
    });
    await transporter.sendMail({
      from: env.emailFrom,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    return { provider: "SMTP" };
  }

  return { provider: "SANDBOX_LOG" };
}

async function getFirebaseAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" })
  ).toString("base64url");
  const claim = Buffer.from(
    JSON.stringify({
      iss: env.firebaseClientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  ).toString("base64url");
  const unsigned = `${header}.${claim}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(unsigned);
  const signature = sign.sign(env.firebasePrivateKey, "base64url");
  const assertion = `${unsigned}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`FIREBASE_AUTH_FAILED: ${await tokenRes.text()}`);
  }
  const tokenJson = (await tokenRes.json()) as { access_token: string };
  return tokenJson.access_token;
}

async function sendFcmPushToUser(params: {
  tokens: string[];
  title: string;
  body: string;
  linkUrl?: string | null;
}) {
  if (!params.tokens.length || !hasFirebaseAdminKeys()) {
    return { provider: "SANDBOX_LOG", sentCount: params.tokens.length };
  }

  const accessToken = await getFirebaseAccessToken();
  for (const deviceToken of params.tokens) {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${env.firebaseProjectId}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: deviceToken,
            notification: { title: params.title, body: params.body },
            data: { linkUrl: params.linkUrl || "/dashboard" },
          },
        }),
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      if (errText.includes("UNREGISTERED") || errText.includes("NOT_FOUND")) {
        await db.devicePushToken
          .deleteMany({ where: { token: deviceToken } })
          .catch(() => {});
      } else {
        throw new Error(`FCM_ERROR: ${errText}`);
      }
    }
  }
  return { provider: "FCM_V1", sentCount: params.tokens.length };
}

export async function processPendingNotificationOutbox(limit: number = 50) {
  const now = new Date();
  const pending = await db.notificationOutbox.findMany({
    where: {
      status: "PENDING",
      nextAttemptAt: { lte: now },
      attempts: { lt: 5 },
    },
    include: {
      user: {
        include: { pushTokens: true },
      },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let sent = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      if (item.channel === "EMAIL") {
        await sendEmailMessage({
          to: item.user.email,
          subject: item.title,
          text: `${item.body}\n\nOpen: ${env.appUrl}${item.linkUrl || "/dashboard"}`,
          html: `<div style="font-family:sans-serif;max-width:560px"><h2>${item.title}</h2><p>${item.body}</p><p><a href="${env.appUrl}${item.linkUrl || "/dashboard"}">View on Tovolana Writers</a></p></div>`,
        });
      } else if (item.channel === "FCM_PUSH") {
        await sendFcmPushToUser({
          tokens: item.user.pushTokens.map((t) => t.token),
          title: item.title,
          body: item.body,
          linkUrl: item.linkUrl,
        });
      }

      await db.notificationOutbox.update({
        where: { id: item.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          attempts: { increment: 1 },
          lastError: null,
        },
      });
      sent += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "UNKNOWN_ERROR";
      const nextAttemptCount = item.attempts + 1;
      const backoffMs = Math.pow(2, nextAttemptCount) * 60 * 1000;
      await db.notificationOutbox.update({
        where: { id: item.id },
        data: {
          attempts: nextAttemptCount,
          lastError: message,
          status: nextAttemptCount >= item.maxAttempts ? "FAILED" : "PENDING",
          nextAttemptAt: new Date(Date.now() + backoffMs),
        },
      });
      failed += 1;
    }
  }

  return { processed: pending.length, sent, failed };
}
