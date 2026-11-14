import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, ok } from "@/lib/http";

const registerDeviceSchema = z.object({
  token: z.string().min(10),
  platform: z.enum(["WEB", "IOS", "ANDROID"]).default("WEB"),
});

const markReadSchema = z.object({
  notificationId: z.string().optional(),
  markAll: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const notifications = await db.notificationOutbox.findMany({
      where: { userId: user.id, channel: "IN_APP" },
      orderBy: { createdAt: "desc" },
      take: 40,
    });
    const unreadCount = notifications.filter((n) => !n.readAt).length;
    return ok({ notifications, unreadCount });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = registerDeviceSchema.parse(await request.json());

    const token = await db.devicePushToken.upsert({
      where: { token: body.token },
      update: { userId: user.id, platform: body.platform, lastSeenAt: new Date() },
      create: { userId: user.id, token: body.token, platform: body.platform },
    });

    return ok({ deviceToken: token }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = markReadSchema.parse(await request.json());

    if (body.markAll) {
      await db.notificationOutbox.updateMany({
        where: { userId: user.id, channel: "IN_APP", readAt: null },
        data: { readAt: new Date() },
      });
    } else if (body.notificationId) {
      await db.notificationOutbox.updateMany({
        where: { id: body.notificationId, userId: user.id },
        data: { readAt: new Date() },
      });
    }

    return ok({ updated: true });
  } catch (err) {
    return handleApiError(err);
  }
}
