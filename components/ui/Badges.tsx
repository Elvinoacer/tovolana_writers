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
    chip: "bg-emerald-500/15 text-emerald-300 border-emerald-400/35",
    dot: "bg-emerald-400",
  },
  APPROVED: {
    chip: "bg-emerald-500/15 text-emerald-300 border-emerald-400/35",
    dot: "bg-emerald-400",
  },
  COMPLETED: {
    chip: "bg-emerald-500/15 text-emerald-300 border-emerald-400/35",
    dot: "bg-emerald-400",
  },
  COMPLETE: {
    chip: "bg-emerald-500/15 text-emerald-300 border-emerald-400/35",
    dot: "bg-emerald-400",
  },
  AVAILABLE: {
    chip: "bg-emerald-500/15 text-emerald-300 border-emerald-400/35",
    dot: "bg-emerald-400",
  },
  PAID: {
    chip: "bg-emerald-500/15 text-emerald-300 border-emerald-400/35",
    dot: "bg-emerald-400",
  },
  ACTIVE: {
    chip: "bg-emerald-500/15 text-emerald-300 border-emerald-400/35",
    dot: "bg-emerald-400",
  },
  IN_PROGRESS: {
    chip: "bg-sky-500/15 text-sky-300 border-sky-400/35",
    dot: "bg-sky-400",
  },
  DELIVERED: {
    chip: "bg-violet-500/15 text-violet-300 border-violet-400/35",
    dot: "bg-violet-400",
  },
  PENDING_REVIEW: {
    chip: "bg-amber-500/15 text-amber-300 border-amber-400/35",
    dot: "bg-amber-400",
  },
  PENDING_PAYMENT: {
    chip: "bg-amber-500/15 text-amber-300 border-amber-400/35",
    dot: "bg-amber-400",
  },
  PENDING_ESCROW: {
    chip: "bg-amber-500/15 text-amber-300 border-amber-400/35",
    dot: "bg-amber-400",
  },
  UNDER_REVIEW: {
    chip: "bg-amber-500/15 text-amber-300 border-amber-400/35",
    dot: "bg-amber-400",
  },
  PAID_AWAITING_ACCEPTANCE: {
    chip: "bg-amber-500/15 text-amber-300 border-amber-400/35",
    dot: "bg-amber-400",
  },
  REVISION_REQUESTED: {
    chip: "bg-orange-500/15 text-orange-300 border-orange-400/35",
    dot: "bg-orange-400",
  },
  CHANGES_REQUESTED: {
    chip: "bg-orange-500/15 text-orange-300 border-orange-400/35",
    dot: "bg-orange-400",
  },
  EXPIRED: {
    chip: "bg-white/[0.06] text-slate-300 border-white/15",
    dot: "bg-slate-400",
  },
  ARCHIVED: {
    chip: "bg-white/[0.06] text-slate-300 border-white/15",
    dot: "bg-slate-400",
  },
  DRAFT: {
    chip: "bg-white/[0.05] text-slate-300 border-white/15",
    dot: "bg-slate-400",
  },
  DISPUTED: {
    chip: "bg-rose-500/15 text-rose-300 border-rose-400/35",
    dot: "bg-rose-400",
  },
  OPEN: {
    chip: "bg-rose-500/15 text-rose-300 border-rose-400/35",
    dot: "bg-rose-400",
  },
  REJECTED: {
    chip: "bg-rose-500/15 text-rose-300 border-rose-400/35",
    dot: "bg-rose-400",
  },
  SUSPENDED: {
    chip: "bg-rose-500/15 text-rose-300 border-rose-400/35",
    dot: "bg-rose-400",
  },
  CANCELLED: {
    chip: "bg-white/[0.05] text-slate-400 border-white/15",
    dot: "bg-slate-500",
  },
  REFUNDED: {
    chip: "bg-purple-500/15 text-purple-300 border-purple-400/35",
    dot: "bg-purple-400",
  },
};

export const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Waiting for payment",
  PAID_AWAITING_ACCEPTANCE: "Waiting for writer",
  IN_PROGRESS: "Being written",
  DELIVERED: "Ready to check",
  REVISION_REQUESTED: "Edits requested",
  COMPLETED: "Done",
  CANCELLED: "Cancelled",
  DISPUTED: "Support reviewing",
  REFUNDED: "Refunded",
  PUBLISHED: "Live",
  PENDING_REVIEW: "Waiting for approval",
  CHANGES_REQUESTED: "Needs changes",
  DRAFT: "Draft",
  EXPIRED: "Closed",
  ARCHIVED: "Archived",
  SUSPENDED: "Paused",
  RETAINED_SOFT_DELETED: "Removed",
  APPROVED: "Approved",
  UNDER_REVIEW: "Being reviewed",
  ASSESSMENT_IN_PROGRESS: "Test in progress",
  NOT_APPLIED: "Not started",
  REJECTED: "Not approved",
  PENDING_ESCROW: "Held safely",
  AVAILABLE: "Ready to withdraw",
  REQUESTED: "Payout requested",
  PAID: "Paid",
  COMPLETE: "Paid",
  PENDING: "Pending",
  FAILED: "Failed",
  ACTIVE: "Active",
  OPEN: "Open",
  AWARDED: "Writer picked",
  RESOLVED_REFUND: "Refunded to client",
  RESOLVED_PARTIAL_SPLIT: "Split 50/50",
  RESOLVED_RELEASE_CREATOR: "Paid to writer",
  CLOSED: "Closed",
};

export function formatStatusLabel(status: string): string {
  if (STATUS_LABELS[status]) return STATUS_LABELS[status];
  const lower = status.replace(/_/g, " ").toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function formatFileCategory(category: string): string {
  switch (category) {
    case "CUSTOMER_BRIEF":
      return "Client file";
    case "CREATOR_DELIVERABLE":
      return "Finished work";
    case "REVISION_ATTACHMENT":
      return "Edit note file";
    case "DISPUTE_EVIDENCE":
      return "Support file";
    default:
      return "File";
  }
}

export function formatPaymentChannel(channel: string): string {
  if (channel === "MPESA_STK") return "M-Pesa";
  if (channel === "CARD") return "Card";
  return channel;
}

export function formatPaymentPurpose(purpose: string): string {
  switch (purpose) {
    case "BOOKING_ESCROW":
      return "Order payment";
    case "PRO_SUBSCRIPTION":
      return "Pro plan";
    case "CONNECTS_PURCHASE":
      return "Bid credits";
    case "CREATOR_BOOST":
      return "Profile boost";
    default:
      return "Payment";
  }
}

export function formatConnectTxType(type: string): string {
  switch (type) {
    case "INITIAL_GRANT":
      return "Welcome bonus";
    case "BUNDLE_PURCHASE":
      return "Bought pack";
    case "EARNINGS_SWAP":
      return "Swapped from earnings";
    case "BID_SUBMITTED":
      return "Applied to job";
    case "BID_BOOST_STAKE":
      return "Moved offer higher";
    case "BID_SEALED_UPGRADE":
      return "Private price";
    case "BID_FEATURED_UPGRADE":
      return "Highlighted offer";
    case "PROFILE_BOOST":
      return "Featured profile";
    case "AVAILABILITY_BADGE":
      return "Available badge";
    case "CREATOR_PLUS_UNLOCK":
      return "Writer Plus pass";
    case "REFUND":
      return "Refund";
    case "ADMIN_ADJUSTMENT":
      return "Admin update";
    default:
      return "Activity";
  }
}

export function formatRole(role: string): string {
  if (role === "CUSTOMER") return "Client";
  if (role === "CREATOR") return "Writer";
  if (role === "ADMIN") return "Admin";
  return role;
}

export function formatAdminScope(scope: string): string {
  switch (scope) {
    case "SUPER_ADMIN":
      return "Full Admin";
    case "MODERATION_ADMIN":
      return "Services & Writers";
    case "FINANCE_ADMIN":
      return "Payments";
    case "SUPPORT_ADMIN":
      return "Support";
    default:
      return scope;
  }
}

export function formatCreatorTier(tier: string | null | undefined): string {
  switch (tier) {
    case "ELITE":
      return "Top 5% Writer";
    case "TOP_RATED":
      return "Top Rated";
    case "RISING_TALENT":
      return "Rising Writer";
    default:
      return "Tested Writer";
  }
}

export function StatusPill({ status }: { status: string }) {
  const tone = STATUS_STYLES[status] || {
    chip: "bg-white/[0.07] text-slate-300 border-white/15",
    dot: "bg-slate-400",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border tracking-tight backdrop-blur-sm ${tone.chip}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
      {formatStatusLabel(status)}
    </span>
  );
}

export function ProBadge({ label = "PRO" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-400/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
      <Crown className="w-3 h-3 text-amber-300" />
      {label}
    </span>
  );
}

export function VettedCreatorBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-500/15 text-teal-300 border border-teal-400/35">
      <ShieldCheck className="w-3.5 h-3.5 text-teal-300" />
      Tested Writer
    </span>
  );
}

export function ListingValidityTag({
  validUntil,
}: {
  validUntil: string | Date | null | undefined;
  validityType?: string;
}) {
  return (
    <div
      title="Last day new clients can order. Active orders are never affected."
      className="inline-flex items-center gap-1.5 text-[11px] text-slate-300 bg-white/[0.05] px-2.5 py-1 rounded-lg border border-white/[0.12] font-tech"
    >
      <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
      <span>
        Open until <strong className="text-white">{formatShortDate(validUntil)}</strong>
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
    ? "bg-white/[0.05] text-slate-300 border-white/[0.12]"
    : hoursLeft < 0
      ? "bg-rose-500/15 text-rose-300 border-rose-400/35"
      : hoursLeft < 48
        ? "bg-amber-500/15 text-amber-300 border-amber-400/35"
        : "bg-sky-500/15 text-sky-300 border-sky-400/35";

  return (
    <div
      className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border font-tech ${tone}`}
    >
      <Clock className="w-3 h-3 shrink-0" />
      <span>
        Due <strong>{formatShortDate(d)}</strong>
        {!isCompleted && hoursLeft >= 0
          ? ` (${hoursLeft}h left)`
          : !isCompleted && hoursLeft < 0
            ? " (Late)"
            : ""}
      </span>
    </div>
  );
}
