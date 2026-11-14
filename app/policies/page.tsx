import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Calendar,
  CalendarClock,
  Clock,
  Lock,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PoliciesPage() {
  const config = await db.platformConfig.findUnique({ where: { id: "global" } });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-reveal">
      <div className="editorial-card p-6 sm:p-8 bg-white ink-grid-bg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-tech uppercase tracking-wider text-[#1e3a8a]">
            Trust &amp; Governance
          </span>
          <h1 className="font-editorial text-3xl sm:text-4xl font-semibold mt-1 text-[#111827]">
            Platform Rules &amp; Escrow Guarantees
          </h1>
        </div>
        <Link href="/explore" className="btn-primary px-5 py-2.5 text-xs shrink-0">
          Explore Services
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Visual Split Diagram: Valid Until vs Delivery Deadline */}
      <section className="editorial-card p-6 sm:p-8 bg-white space-y-5">
        <h2 className="font-editorial text-2xl font-semibold flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-[#1e3a8a]" />
          Two Independent Clocks
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-[#faf7f2] border border-[#e6e0d4] space-y-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-tech font-semibold text-stone-700 bg-white px-2.5 py-1 rounded-full border border-stone-200">
              <Calendar className="w-3.5 h-3.5 text-stone-500" />
              Listing Valid Until
            </span>
            <p className="font-editorial text-lg font-semibold text-[#111827]">
              Public Discovery Window
            </p>
            <p className="text-xs text-stone-600 leading-relaxed">
              Standard 30d, Short 14d, or Custom window controlling whether{" "}
              <em>new</em> bookings can be placed.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-tech font-semibold text-[#1e3a8a] bg-white px-2.5 py-1 rounded-full border border-blue-200">
              <Clock className="w-3.5 h-3.5 text-[#1e3a8a]" />
              Booking Delivery Deadline
            </span>
            <p className="font-editorial text-lg font-semibold text-[#111827]">
              Confirmed Work Protection
            </p>
            <p className="text-xs text-blue-950/85 leading-relaxed">
              Locked on checkout.{" "}
              <strong>
                An expired listing never cancels or shortens an already-confirmed
                booking.
              </strong>
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <section id="revisions" className="editorial-card p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-editorial text-xl font-semibold flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-[#0f766e]" />
              Revisions &amp; Archive
            </h2>
            <span className="text-[11px] font-tech px-2.5 py-0.5 rounded-full bg-teal-50 text-[#0f766e] border border-teal-200">
              {config?.defaultRevisionLimit ?? 2} Rounds Default
            </span>
          </div>
          <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
            {config?.revisionPolicyText}
          </p>
          <p className="text-[11px] text-stone-500 font-tech">
            Archive recovery window: {config?.archiveRecoveryDays ?? 14} days
          </p>
        </section>

        <section className="editorial-card p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-editorial text-xl font-semibold flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-700" />
              Escrow &amp; Cancellations
            </h2>
            <span className="text-[11px] font-tech px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
              IntaSend Verified
            </span>
          </div>
          <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
            {config?.cancellationPolicyText}
          </p>
        </section>

        <section id="integrity" className="editorial-card p-6 space-y-3">
          <h2 className="font-editorial text-xl font-semibold flex items-center gap-2">
            <BookOpenCheck className="w-5 h-5 text-[#1e3a8a]" />
            Academic Integrity Charter
          </h2>
          <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
            {config?.academicIntegrityPolicy}
          </p>
        </section>

        <section className="editorial-card p-6 space-y-3">
          <h2 className="font-editorial text-xl font-semibold flex items-center gap-2">
            <Lock className="w-5 h-5 text-stone-700" />
            Signed Attachment Vault
          </h2>
          <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
            Customer briefs and creator deliverables stay isolated behind
            participant authorization checks and short-lived HMAC-signed URLs.
          </p>
        </section>
      </div>
    </div>
  );
}
