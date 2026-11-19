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
import { AuroraHeading } from "@/components/ui/AuroraPrimitives";
import { FlowSteps } from "@/components/ui/FlowGuide";

export const dynamic = "force-dynamic";

export default async function PoliciesPage() {
  const config = await db.platformConfig.findUnique({ where: { id: "global" } });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-reveal">
      <div className="editorial-card p-6 sm:p-8 ink-grid-bg border-sky-400/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-tech uppercase tracking-wider text-sky-300 font-semibold">
            Safety &amp; Rules
          </span>
          <AuroraHeading
            as="h1"
            className="text-3xl sm:text-4xl mt-1"
          >
            How We Keep Every Order Safe
          </AuroraHeading>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Simple rules so both clients and writers always know what to expect.
          </p>
        </div>
        <Link href="/explore" className="btn-primary px-5 py-2.5 text-xs shrink-0">
          Find a Writer
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <FlowSteps
        currentStep={2}
        goalLabel="Goal: Safe work delivered on time, fair pay for writers"
        steps={[
          { label: "1. Place Order", hint: "Share your instructions" },
          { label: "2. Payment Held", hint: "Safe until work arrives" },
          { label: "3. Check & Edit", hint: "Ask for free edits" },
          { label: "4. Approve & Pay", hint: "Writer gets paid" },
        ]}
      />

      {/* Listing end date vs your order deadline */}
      <section className="editorial-card p-6 sm:p-8 space-y-5">
        <h2 className="font-editorial text-2xl font-semibold text-white flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-sky-300" />
          Listing End Date vs. Your Order Deadline
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/[0.12] space-y-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-tech font-semibold text-slate-200 bg-white/[0.06] px-2.5 py-1 rounded-full border border-white/[0.14]">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Open Until Date
            </span>
            <p className="font-editorial text-lg font-semibold text-white">
              When new clients can order
            </p>
            <p className="text-xs text-slate-300 leading-relaxed">
              This is how long a writer keeps a service open for new orders
              (for example, 14 or 30 days).
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-sky-500/[0.09] border border-sky-400/35 space-y-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-tech font-semibold text-sky-200 bg-sky-500/20 px-2.5 py-1 rounded-full border border-sky-400/40">
              <Clock className="w-3.5 h-3.5 text-sky-300" />
              Your Order Deadline
            </span>
            <p className="font-editorial text-lg font-semibold text-white">
              Protected once you order
            </p>
            <p className="text-xs text-sky-100/90 leading-relaxed">
              Locked as soon as you pay.{" "}
              <strong className="text-white">
                Even if a service closes later, your writer still delivers your
                order on time.
              </strong>
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <section id="revisions" className="editorial-card p-6 space-y-3 border-teal-400/25">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-editorial text-xl font-semibold text-white flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-teal-300" />
              Free Edits &amp; History
            </h2>
            <span className="text-[11px] font-tech px-2.5 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-400/35">
              {config?.defaultRevisionLimit ?? 2} Free Edits Included
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {config?.revisionPolicyText}
          </p>
          <p className="text-[11px] text-slate-400 font-tech">
            Closed service recovery window: {config?.archiveRecoveryDays ?? 14} days
          </p>
        </section>

        <section className="editorial-card p-6 space-y-3 border-amber-400/25">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-editorial text-xl font-semibold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-300" />
              Safe Payments &amp; Cancellations
            </h2>
            <span className="text-[11px] font-tech px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/35">
              IntaSend Protected
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {config?.cancellationPolicyText}
          </p>
        </section>

        <section id="integrity" className="editorial-card p-6 space-y-3 border-sky-400/25">
          <h2 className="font-editorial text-xl font-semibold text-white flex items-center gap-2">
            <BookOpenCheck className="w-5 h-5 text-sky-300" />
            Original Work Promise
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {config?.academicIntegrityPolicy}
          </p>
        </section>

        <section className="editorial-card p-6 space-y-3">
          <h2 className="font-editorial text-xl font-semibold text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-violet-300" />
            Private Files
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Your instructions and finished files are kept private. Only you,
            your writer, and Support (if you ask for help) can see them.
          </p>
        </section>
      </div>
    </div>
  );
}
