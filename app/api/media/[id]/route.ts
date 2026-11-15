import { NextRequest } from "next/server";
import { MediaAssetPurpose, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { deleteStoredObject } from "@/lib/storage";
import { fail, handleApiError, ok } from "@/lib/http";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await context.params;

    const asset = await db.mediaAsset.findUnique({
      where: { id },
    });

    if (!asset) {
      return fail("MEDIA_NOT_FOUND", "Media asset not found.", 404);
    }

    const isAdmin = user.roles.includes("ADMIN");
    if (!isAdmin && asset.ownerId !== user.id) {
      return fail(
        "FORBIDDEN",
        "You do not have permission to delete this media asset.",
        403
      );
    }

    await deleteStoredObject(asset.storageKey, asset.storageProvider);

    try {
      await db.$transaction(async (tx) => {
        await tx.mediaAsset.delete({ where: { id: asset.id } });

        if (asset.purpose === MediaAssetPurpose.USER_AVATAR && asset.ownerId) {
          const [owner, remainingAvatar] = await Promise.all([
            tx.user.findUnique({
              where: { id: asset.ownerId },
              select: { id: true, avatarUrl: true },
            }),
            tx.mediaAsset.findFirst({
              where: {
                ownerId: asset.ownerId,
                purpose: MediaAssetPurpose.USER_AVATAR,
              },
              orderBy: { createdAt: "desc" },
              select: { id: true, publicUrl: true },
            }),
          ]);

          if (owner) {
            const matchesDeletedAsset =
              (Boolean(asset.publicUrl) &&
                owner.avatarUrl === asset.publicUrl) ||
              owner.avatarUrl === `/api/media/${asset.id}/raw`;
            if (matchesDeletedAsset) {
              await tx.user.update({
                where: { id: owner.id },
                data: {
                  avatarUrl: remainingAvatar
                    ? remainingAvatar.publicUrl ??
                      `/api/media/${remainingAvatar.id}/raw`
                    : null,
                },
              });
            }
          }
        }
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        return fail("MEDIA_NOT_FOUND", "Media asset not found.", 404);
      }
      throw err;
    }

    return ok({ deletedId: asset.id });
  } catch (err) {
    return handleApiError(err);
  }
}
