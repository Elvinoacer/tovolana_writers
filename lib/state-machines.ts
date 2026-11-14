import type { BookingStatus, ListingStatus, ValidityType } from "@prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

export function computeListingValidityDate(params: {
  validityType: ValidityType;
  customValidUntil?: Date | string | null;
  now?: Date;
}): Date {
  const now = params.now ?? new Date();
  if (params.validityType === "SHORT_14D") {
    return new Date(now.getTime() + 14 * DAY_MS);
  }
  if (params.validityType === "ADMIN_CUSTOM" && params.customValidUntil) {
    const parsed =
      typeof params.customValidUntil === "string"
        ? new Date(params.customValidUntil)
        : params.customValidUntil;
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= now.getTime()) {
      throw new Error("INVALID_CUSTOM_VALIDITY_DATE");
    }
    return parsed;
  }
  return new Date(now.getTime() + 30 * DAY_MS);
}

export function computeArchiveExpiryDate(
  archiveRecoveryDays: number = 14,
  now: Date = new Date()
): Date {
  return new Date(now.getTime() + archiveRecoveryDays * DAY_MS);
}

const ALLOWED_LISTING_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  DRAFT: ["PENDING_REVIEW", "PUBLISHED", "ARCHIVED", "RETAINED_SOFT_DELETED"],
  PENDING_REVIEW: [
    "PUBLISHED",
    "CHANGES_REQUESTED",
    "DRAFT",
    "ARCHIVED",
    "SUSPENDED",
  ],
  CHANGES_REQUESTED: ["PENDING_REVIEW", "DRAFT", "PUBLISHED", "ARCHIVED"],
  PUBLISHED: [
    "EXPIRED",
    "ARCHIVED",
    "SUSPENDED",
    "CHANGES_REQUESTED",
    "RETAINED_SOFT_DELETED",
  ],
  EXPIRED: ["ARCHIVED", "PUBLISHED", "RETAINED_SOFT_DELETED"],
  ARCHIVED: ["PUBLISHED", "DRAFT", "RETAINED_SOFT_DELETED"],
  SUSPENDED: ["PUBLISHED", "ARCHIVED", "RETAINED_SOFT_DELETED"],
  RETAINED_SOFT_DELETED: ["ARCHIVED"],
};

export function canTransitionListingStatus(
  from: ListingStatus,
  to: ListingStatus
): boolean {
  if (from === to) return true;
  return ALLOWED_LISTING_TRANSITIONS[from]?.includes(to) ?? false;
}

const ALLOWED_BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING_PAYMENT: ["PAID_AWAITING_ACCEPTANCE", "IN_PROGRESS", "CANCELLED"],
  PAID_AWAITING_ACCEPTANCE: [
    "IN_PROGRESS",
    "CANCELLED",
    "DISPUTED",
    "REFUNDED",
  ],
  IN_PROGRESS: ["DELIVERED", "CANCELLED", "DISPUTED", "REFUNDED"],
  DELIVERED: ["REVISION_REQUESTED", "COMPLETED", "DISPUTED", "REFUNDED"],
  REVISION_REQUESTED: ["DELIVERED", "COMPLETED", "DISPUTED", "REFUNDED"],
  COMPLETED: ["DISPUTED", "REFUNDED"],
  CANCELLED: ["REFUNDED"],
  DISPUTED: ["REFUNDED", "COMPLETED", "CANCELLED"],
  REFUNDED: [],
};

export function canTransitionBookingStatus(
  from: BookingStatus,
  to: BookingStatus
): boolean {
  if (from === to) return true;
  return ALLOWED_BOOKING_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * PRD Rule 2.0: Expiring or archiving a listing MUST NEVER invalidate
 * any confirmed or in-flight booking attached to that listing.
 */
export function isConfirmedBookingUnaffectedByListingExpiry(
  bookingStatus: BookingStatus
): boolean {
  return bookingStatus !== "PENDING_PAYMENT" && bookingStatus !== "CANCELLED";
}
