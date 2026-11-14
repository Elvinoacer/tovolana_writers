import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminScope } from "@/lib/auth";
import { invalidateCachePrefix } from "@/lib/redis";
import { fail, handleApiError, ok } from "@/lib/http";

const updateCategorySchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().min(5).max(500).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  requirementsSchema: z.array(z.record(z.string(), z.unknown())).optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminScope("MODERATION_ADMIN", request);
    const { id } = await context.params;
    const body = updateCategorySchema.parse(await request.json());

    const existing = await db.category.findUnique({ where: { id } });
    if (!existing) return fail("NOT_FOUND", "Category not found.", 404);

    const updated = await db.$transaction(async (tx) => {
      const saved = await tx.category.update({
        where: { id },
        data: {
          name: body.name?.trim(),
          description: body.description?.trim(),
          sortOrder: body.sortOrder,
          isActive: body.isActive,
          requirementsSchema: body.requirementsSchema as
            | Prisma.InputJsonValue
            | undefined,
        },
      });

      await tx.adminAuditLog.create({
        data: {
          actorAdminId: admin.id,
          action: "CATEGORY_UPDATED",
          targetType: "Category",
          targetId: id,
          reason: `Updated category "${saved.name}"`,
          metadata: { isActive: saved.isActive, sortOrder: saved.sortOrder },
        },
      });

      return saved;
    });

    await invalidateCachePrefix("categories:");
    return ok({ category: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminScope("MODERATION_ADMIN", request);
    const { id } = await context.params;

    const category = await db.category.findUnique({
      where: { id },
      include: { _count: { select: { listings: true } } },
    });
    if (!category) return fail("NOT_FOUND", "Category not found.", 404);

    // PRD Section 4.1: A category MUST NOT be deleted if active or historical listings depend on it.
    if (category._count.listings > 0) {
      return fail(
        "CATEGORY_IN_USE",
        `Cannot delete category "${category.name}" because ${category._count.listings} active or historical listings depend on it. Deactivate it instead.`,
        409
      );
    }

    await db.category.delete({ where: { id } });
    await db.adminAuditLog.create({
      data: {
        actorAdminId: admin.id,
        action: "CATEGORY_DELETED",
        targetType: "Category",
        targetId: id,
        reason: `Deleted unused category "${category.name}"`,
      },
    });

    await invalidateCachePrefix("categories:");
    return ok({ deleted: true, id });
  } catch (err) {
    return handleApiError(err);
  }
}
