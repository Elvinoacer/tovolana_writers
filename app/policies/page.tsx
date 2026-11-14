import React from "react";
import { BookOpenCheck, CalendarClock, Lock, RefreshCw, ShieldAlert } from "lucide-react";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PoliciesPage() {
  const config = await db.platformConfig.findUnique({ where: { id: "global" } });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="border-b border-[#e6e0d4] pb-6 space-y-2">
        <p className="text-xs font-tech uppercase tracking-wider text-[#1e3a8a]">
          Governance &amp; Policies (Screen 1.7)
        </p>
        <h1 className="font-editorial text-3xl sm:text-4xl font-semibold">
          Platform Policies, Deadlines &amp; Academic Integrity
        </h1>
        <p className="text-sm text-stone-600">
          Transparent operating rules governing every booking, listing lifecycle,
          payment escrow, and revision round on Tovolana Writers.
        </p>
      </div>

      <div className="space-y-6">
        <section className="editorial-card p-6 space-y-2.5">
          <h2 className="font-editorial text-xl font-semibold flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-[#1e3a8a]" />
            Listing Validity vs. Booking Delivery Deadlines
          </h2>
          <p className="text-sm text-stone-700 leading-relaxed">
            Every published service displays a <strong>Valid Until</strong>{" "}
            date (Standard 30 days, Short 14 days, or Administrator Custom)
            governing when new customers can book that listing.{" "}
            <strong>
              A listing expiring NEVER cancels, shortens, or invalidates an
              already-confirmed booking.
            </strong>{" "}
            Confirmed orders remain locked to their{" "}
            <strong>Delivery Deadline</strong> through delivery, revision, and
            completion.
          </p>
        </section>

        <section id="revisions" className="editorial-card p-6 space-y-2.5">
          <h2 className="font-editorial text-xl font-semibold flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-teal-700" />
            Revision Policy &amp; Archive Recovery
          </h2>
          <p className="text-sm text-stone-700 leading-relaxed">
            {config?.revisionPolicyText}
          </p>
          <p className="text-xs text-stone-500 font-tech pt-1">
            Default revision quota: {config?.defaultRevisionLimit ?? 2} rounds ·
            Listing Archive Vault recovery window:{" "}
            {config?.archiveRecoveryDays ?? 14} days.
          </p>
        </section>

        <section className="editorial-card p-6 space-y-2.5">
          <h2 className="font-editorial text-xl font-semibold flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-700" />
            Cancellation, Escrow &amp; Dispute Resolution
          </h2>
          <p className="text-sm text-stone-700 leading-relaxed">
            {config?.cancellationPolicyText}
          </p>
          <p className="text-xs text-stone-600 pt-1">
            All payments settle via verified IntaSend M-Pesa STK Push or Card
            Checkout into escrow. Creators cannot alter agreed booking prices or
            mark unpaid bookings as paid.
          </p>
        </section>

        <section id="integrity" className="editorial-card p-6 space-y-2.5">
          <h2 className="font-editorial text-xl font-semibold flex items-center gap-2">
            <BookOpenCheck className="w-5 h-5 text-[#1e3a8a]" />
            Academic Integrity Charter
          </h2>
          <p className="text-sm text-stone-700 leading-relaxed">
            {config?.academicIntegrityPolicy}
          </p>
        </section>

        <section className="editorial-card p-6 space-y-2.5">
          <h2 className="font-editorial text-xl font-semibold flex items-center gap-2">
            <Lock className="w-5 h-5 text-stone-700" />
            Private Attachments &amp; Privacy Protection
          </h2>
          <p className="text-sm text-stone-700 leading-relaxed">
            Assignment briefs, customer uploads, and creator deliverables are
            stored privately and served exclusively via participant-verified
            access checks and short-lived HMAC-signed URLs.
          </p>
        </section>
      </div>
    </div>
  );
}
