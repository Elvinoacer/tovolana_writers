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

const STATUS_STYLES: Record<string, { chip: string; dot: string }> = {
  PUBLISHED: {
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  APPROVED: {
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  COMPLETED: {
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  COMPLETE: {
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  AVAILABLE: {
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  PAID: {
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  ACTIVE: {
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  IN_PROGRESS: {
    chip: "bg-blue-50 text-blue-900 border-blue-200",
    dot: "bg-blue-600",
  },
  DELIVERED: {
    chip: "bg-indigo-50 text-indigo-900 border-indigo-200",
    dot: "bg-indigo-600",
  },
  PENDING_REVIEW: {
    chip: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
  PENDING_PAYMENT: {
    chip: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
  PENDING_ESCROW: {
    chip: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
  UNDER_REVIEW: {
    chip: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
  PAID_AWAITING_ACCEPTANCE: {
    chip: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
  REVISION_REQUESTED: {
    chip: "bg-orange-50 text-orange-800 border-orange-200",
    dot: "bg-orange-500",
  },
  CHANGES_REQUESTED: {
    chip: "bg-orange-50 text-orange-800 border-orange-200",
    dot: "bg-orange-500",
  },
  EXPIRED: {
    chip: "bg-stone-100 text-stone-700 border-stone-300",
    dot: "bg-stone-500",
  },
  ARCHIVED: {
    chip: "bg-slate-100 text-slate-700 border-slate-300",
    dot: "bg-slate-500",
  },
  DRAFT: {
    chip: "bg-stone-100 text-stone-600 border-stone-200",
    dot: "bg-stone-400",
  },
  DISPUTED: {
    chip: "bg-rose-50 text-rose-800 border-rose-200",
    dot: "bg-rose-600",
  },
  OPEN: {
    chip: "bg-rose-50 text-rose-800 border-rose-200",
    dot: "bg-rose-600",
  },
  REJECTED: {
    chip: "bg-rose-50 text-rose-800 border-rose-200",
    dot: "bg-rose-600",
  },
  SUSPENDED: {
    chip: "bg-rose-50 text-rose-800 border-rose-200",
    dot: "bg-rose-600",
  },
  CANCELLED: {
    chip: "bg-stone-100 text-stone-600 border-stone-200",
    dot: "bg-stone-400",
  },
  REFUNDED: {
    chip: "bg-purple-50 text-purple-800 border-purple-200",
    dot: "bg-purple-600",
  },
};

export function StatusPill({ status }: { status: string }) {
  const tone = STATUS_STYLES[status] || {
    chip: "bg-stone-100 text-stone-700 border-stone-200",
    dot: "bg-stone-500",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border tracking-tight ${tone.chip}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function ProBadge({ label = "PRO" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
      <Crown className="w-3 h-3 text-amber-700" />
      {label}
    </span>
  );
}

export function VettedCreatorBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-200">
      <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
      Vetted Writer
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
      className="inline-flex items-center gap-1.5 text-[11px] text-stone-600 bg-stone-100/90 px-2.5 py-1 rounded-lg border border-stone-200 font-tech"
    >
      <Calendar className="w-3 h-3 text-stone-500 shrink-0" />
      <span>
        Valid <strong className="text-stone-800">{formatShortDate(validUntil)}</strong>
        {validityType
          ? ` · ${validityType
              .replace("STANDARD_", "")
              .replace("SHORT_", "")
              .replace("ADMIN_", "")}`
          : ""}
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
  const isCompleted =
    status === "COMPLETED" || status === "REFUNDED" || status === "CANCELLED";
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
      className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border font-tech ${tone}`}
    >
      <Clock className="w-3 h-3 shrink-0" />
      <span>
        Due <strong>{formatShortDate(d)}</strong>
        {!isCompleted && hoursLeft >= 0
          ? ` (${hoursLeft}h)`
          : !isCompleted && hoursLeft < 0
            ? " (Overdue)"
            : ""}
      </span>
    </div>
  );
}
