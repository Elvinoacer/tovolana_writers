import React from "react";
import { Calendar, Clock, Crown, ShieldCheck } from "lucide-react";
import { getDeadlineHoursLeft } from "@/lib/pricing";

export function formatKes(amount: number, currency = "KES"): string {
  return `${currency} ${Math.round(amount).toLocaleString("en-KE")}`;
}

export function formatShortDate(date: string | Date | null | undefined): string {
  if (!date) return "N/A";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const STATUS_STYLES: Record<string, string> = {
  PUBLISHED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  APPROVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  COMPLETED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  COMPLETE: "bg-emerald-50 text-emerald-800 border-emerald-200",
  AVAILABLE: "bg-emerald-50 text-emerald-800 border-emerald-200",
  PAID: "bg-emerald-50 text-emerald-800 border-emerald-200",
  IN_PROGRESS: "bg-blue-50 text-blue-900 border-blue-200",
  DELIVERED: "bg-indigo-50 text-indigo-900 border-indigo-200",
  PENDING_REVIEW: "bg-amber-50 text-amber-800 border-amber-200",
  PENDING_PAYMENT: "bg-amber-50 text-amber-800 border-amber-200",
  PENDING_ESCROW: "bg-amber-50 text-amber-800 border-amber-200",
  UNDER_REVIEW: "bg-amber-50 text-amber-800 border-amber-200",
  PAID_AWAITING_ACCEPTANCE: "bg-amber-50 text-amber-800 border-amber-200",
  REVISION_REQUESTED: "bg-orange-50 text-orange-800 border-orange-200",
  CHANGES_REQUESTED: "bg-orange-50 text-orange-800 border-orange-200",
  EXPIRED: "bg-stone-100 text-stone-700 border-stone-300",
  ARCHIVED: "bg-slate-100 text-slate-700 border-slate-300",
  DRAFT: "bg-stone-100 text-stone-600 border-stone-200",
  DISPUTED: "bg-rose-50 text-rose-800 border-rose-200",
  OPEN: "bg-rose-50 text-rose-800 border-rose-200",
  REJECTED: "bg-rose-50 text-rose-800 border-rose-200",
  SUSPENDED: "bg-rose-50 text-rose-800 border-rose-200",
  CANCELLED: "bg-stone-100 text-stone-600 border-stone-200",
  REFUNDED: "bg-purple-50 text-purple-800 border-purple-200",
};

export function StatusPill({ status }: { status: string }) {
  const cls =
    STATUS_STYLES[status] || "bg-stone-100 text-stone-700 border-stone-200";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function ProBadge({ label = "PRO" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
      <Crown className="w-3 h-3 text-amber-700" />
      {label}
    </span>
  );
}

export function VettedCreatorBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-800 border border-teal-200">
      <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
      Assessment-Vetted Creator
    </span>
  );
}

export function ListingValidityTag({
  validUntil,
  validityType,
}: {
  validUntil: string | Date | null | undefined;
  validityType?: string;
}) {
  return (
    <div
      title="Listing validity controls public discovery window only; confirmed bookings remain protected until their own delivery deadline."
      className="inline-flex items-center gap-1.5 text-xs text-stone-600 bg-stone-100 px-2.5 py-1 rounded-md border border-stone-200 font-tech"
    >
      <Calendar className="w-3.5 h-3.5 text-stone-500" />
      <span>
        Valid Until: <strong>{formatShortDate(validUntil)}</strong>
        {validityType ? ` (${validityType.replace("STANDARD_", "").replace("SHORT_", "").replace("ADMIN_", "")})` : ""}
      </span>
    </div>
  );
}

export function BookingDeadlineTag({
  deadline,
  status,
}: {
  deadline: string | Date;
  status: string;
}) {
  const d = typeof deadline === "string" ? new Date(deadline) : deadline;
  const isCompleted = status === "COMPLETED" || status === "REFUNDED" || status === "CANCELLED";
  const hoursLeft = getDeadlineHoursLeft(d);

  const tone = isCompleted
    ? "bg-stone-100 text-stone-700 border-stone-200"
    : hoursLeft < 0
      ? "bg-rose-50 text-rose-800 border-rose-200"
      : hoursLeft < 48
        ? "bg-amber-50 text-amber-800 border-amber-200"
        : "bg-blue-50 text-blue-900 border-blue-200";

  return (
    <div
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border font-tech ${tone}`}
    >
      <Clock className="w-3.5 h-3.5" />
      <span>
        Delivery Due: <strong>{formatShortDate(d)}</strong>
        {!isCompleted && hoursLeft >= 0 ? ` (${hoursLeft}h left)` : !isCompleted && hoursLeft < 0 ? " (Overdue)" : ""}
      </span>
    </div>
  );
}
