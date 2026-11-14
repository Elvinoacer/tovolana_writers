import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminScope } from "@/lib/auth";
import { cacheGetOrSet, invalidateCachePrefix } from "@/lib/redis";
import { fail, handleApiError, ok } from "@/lib/http";

const createCategorySchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(80).optional(),
  description: z.string().min(5).max(500),
  sortOrder: z.number().int().min(0).optional(),
  requirementsSchema: z.array(z.record(z.string(), z.unknown())).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const includeInactive =
      request.nextUrl.searchParams.get("includeInactive") === "true";

    const categories = includeInactive
      ? await db.category.findMany({
          orderBy: { sortOrder: "asc" },
          include: { _count: { select: { listings: true } } },
        })
      : await cacheGetOrSet("categories:active", 300, async () =>
          db.category.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            include: {
              _count: {
                select: {
                  listings: { where: { status: "PUBLISHED" } },
                },
              },
            },
          })
        );

    return ok({ categories });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminScope("MODERATION_ADMIN", request);
    const body = createCategorySchema.parse(await request.json());

    const slug = (
      body.slug ||
      body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    ).toLowerCase();

    const existing = await db.category.findFirst({
      where: { OR: [{ slug }, { name: body.name }] },
    });
    if (existing) {
      return fail(
        "CATEGORY_EXISTS",
        "A category with this name or slug already exists.",
        409
      );
    }

    const category = await db.category.create({
      data: {
        name: body.name.trim(),
        slug,
        description: body.description.trim(),
        sortOrder: body.sortOrder ?? 10,
        requirementsSchema: (body.requirementsSchema ??
          []) as Prisma.InputJsonValue,
      },
    });

    await db.adminAuditLog.create({
      data: {
        actorAdminId: admin.id,
        action: "CATEGORY_CREATED",
        targetType: "Category",
        targetId: category.id,
        reason: `Created category "${category.name}"`,
        metadata: { slug: category.slug },
      },
    });

    await invalidateCachePrefix("categories:");
    return ok({ category }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
