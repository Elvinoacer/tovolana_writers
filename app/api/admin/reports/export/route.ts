import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handleApiError, ok } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    await requireRole("ADMIN", request);
    const format = request.nextUrl.searchParams.get("format") || "json";

    const [
      bookingsByStatus,
      categories,
      completedPayments,
      recentBookings,
      creatorStats,
    ] = await Promise.all([
      db.booking.groupBy({
        by: ["status"],
        _count: { _all: true },
        _sum: { totalPayable: true, serviceFee: true },
      }),
      db.category.findMany({
        include: { _count: { select: { listings: true } } },
        orderBy: { sortOrder: "asc" },
      }),
      db.paymentTransaction.findMany({
        where: { status: "COMPLETE" },
        orderBy: { paidAt: "desc" },
      }),
      db.booking.findMany({
        include: {
          customer: { select: { name: true, email: true, membershipTier: true } },
          creator: { select: { displayName: true, username: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.creatorProfile.findMany({
        where: { applicationStatus: "APPROVED" },
        orderBy: { completedBookingsCount: "desc" },
        select: {
          displayName: true,
          username: true,
          ratingAverage: true,
          completedBookingsCount: true,
          assessmentScore: true,
        },
      }),
    ]);

    if (format === "csv") {
      const header = [
        "BookingRef",
        "TaskTitle",
        "CustomerEmail",
        "CustomerTier",
        "CreatorUsername",
        "Status",
        "ListedPrice",
        "ServiceFee",
        "ProDiscount",
        "TotalPayable",
        "Currency",
        "DeliveryDeadline",
        "CreatedAt",
      ].join(",");

      const escapeCsv = (val: unknown) =>
        `"${String(val ?? "").replace(/"/g, '""')}"`;

      const lines = recentBookings.map((b) =>
        [
          escapeCsv(b.bookingRef),
          escapeCsv(b.taskTitleSnapshot),
          escapeCsv(b.customer.email),
          escapeCsv(b.customer.membershipTier),
          escapeCsv(b.creator?.username || "admin"),
          escapeCsv(b.status),
          b.listedPrice,
          b.serviceFee,
          b.proDiscount,
          b.totalPayable,
          escapeCsv(b.currency),
          escapeCsv(b.agreedDeliveryDeadline.toISOString()),
          escapeCsv(b.createdAt.toISOString()),
        ].join(",")
      );

      return new NextResponse([header, ...lines].join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="tovolana-bookings-report.csv"`,
        },
      });
    }

    const totalRevenue = completedPayments.reduce((s, p) => s + p.amount, 0);
    return ok({
      summary: {
        totalBookings: recentBookings.length,
        totalCompletedRevenue: totalRevenue,
        bookingFeesCollected: recentBookings.reduce(
          (s, b) => s + b.serviceFee,
          0
        ),
        proDiscountsGranted: recentBookings.reduce(
          (s, b) => s + b.proDiscount,
          0
        ),
      },
      bookingsByStatus,
      categories,
      creatorStats,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
