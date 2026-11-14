import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handleApiError, ok } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    await requireRole("ADMIN", request);
    const now = new Date();
    const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      proUsers,
      approvedCreators,
      pendingAssessments,
      moderationQueue,
      expiringSoonListings,
      archivedVaultListings,
      expiredListings,
      activeBookings,
      openDisputes,
      completedTransactions,
      auditLogs,
      platformConfig,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { membershipTier: "PRO" } }),
      db.creatorProfile.count({ where: { applicationStatus: "APPROVED" } }),
      db.creatorAssessmentAttempt.findMany({
        where: { autoDecision: "UNDER_REVIEW" },
        include: {
          creatorProfile: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
          config: { select: { title: true, minWords: true, maxWords: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.taskListing.findMany({
        where: { status: { in: ["PENDING_REVIEW", "CHANGES_REQUESTED"] } },
        include: {
          category: { select: { id: true, name: true } },
          creator: { select: { id: true, username: true, displayName: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      db.taskListing.findMany({
        where: { status: "PUBLISHED", validUntil: { lte: soon, gt: now } },
        include: { category: true, creator: true },
      }),
      db.taskListing.findMany({
        where: { status: "ARCHIVED" },
        include: { category: true, creator: true, _count: { select: { bookings: true } } },
        orderBy: { updatedAt: "desc" },
      }),
      db.taskListing.findMany({
        where: { status: "EXPIRED" },
        include: { category: true, creator: true, _count: { select: { bookings: true } } },
        orderBy: { validUntil: "desc" },
      }),
      db.booking.findMany({
        include: {
          customer: { select: { id: true, name: true, email: true } },
          creator: { select: { id: true, displayName: true, username: true } },
          task: { select: { id: true, title: true, status: true, validUntil: true } },
          dispute: true,
        },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
      db.dispute.findMany({
        where: { status: { in: ["OPEN", "UNDER_REVIEW"] } },
        include: {
          booking: {
            include: {
              customer: { select: { id: true, name: true, email: true } },
              creator: { select: { id: true, displayName: true, username: true } },
            },
          },
          openedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.paymentTransaction.aggregate({
        where: { status: "COMPLETE" },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      db.adminAuditLog.findMany({
        include: { actorAdmin: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      db.platformConfig.findUnique({ where: { id: "global" } }),
    ]);

    return ok({
      metrics: {
        totalUsers,
        proUsers,
        approvedCreators,
        pendingAssessmentsCount: pendingAssessments.length,
        moderationQueueCount: moderationQueue.length,
        openDisputesCount: openDisputes.length,
        totalCompletedGmv: completedTransactions._sum.amount ?? 0,
        completedTransactionsCount: completedTransactions._count._all,
      },
      pendingAssessments,
      moderationQueue,
      expiringSoonListings,
      archivedVaultListings,
      expiredListings,
      activeBookings,
      openDisputes,
      auditLogs,
      platformConfig,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
