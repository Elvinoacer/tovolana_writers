import React from "react";
import Link from "next/link";
import { ArrowRight, Check, Target } from "lucide-react";

export type BannerTone = "blue" | "teal" | "amber" | "emerald" | "rose" | "stone";

const TONE_STYLES: Record<
  BannerTone,
  { wrap: string; dot: string; eyebrow: string; cta: string }
> = {
  blue: {
    wrap: "border-sky-400/35 bg-sky-500/[0.09] text-slate-100 shadow-[0_0_24px_-10px_rgba(56,189,248,0.3)]",
    dot: "bg-sky-400 shadow-[0_0_8px_#38bdf8]",
    eyebrow: "text-sky-300",
    cta: "bg-sky-500 text-slate-950 font-bold hover:bg-sky-400 shadow-[0_0_16px_rgba(56,189,248,0.4)]",
  },
  teal: {
    wrap: "border-teal-400/35 bg-teal-500/[0.09] text-slate-100 shadow-[0_0_24px_-10px_rgba(45,212,191,0.3)]",
    dot: "bg-teal-400 shadow-[0_0_8px_#2dd4bf]",
    eyebrow: "text-teal-300",
    cta: "bg-teal-400 text-slate-950 font-bold hover:bg-teal-300 shadow-[0_0_16px_rgba(45,212,191,0.4)]",
  },
  amber: {
    wrap: "border-amber-400/35 bg-amber-500/[0.09] text-slate-100 shadow-[0_0_24px_-10px_rgba(245,158,11,0.3)]",
    dot: "bg-amber-400 shadow-[0_0_8px_#fbbf24]",
    eyebrow: "text-amber-300",
    cta: "bg-amber-400 text-slate-950 font-bold hover:bg-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.4)]",
  },
  emerald: {
    wrap: "border-emerald-400/35 bg-emerald-500/[0.09] text-slate-100 shadow-[0_0_24px_-10px_rgba(16,185,129,0.3)]",
    dot: "bg-emerald-400 shadow-[0_0_8px_#34d399]",
    eyebrow: "text-emerald-300",
    cta: "bg-emerald-400 text-slate-950 font-bold hover:bg-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.4)]",
  },
  rose: {
    wrap: "border-rose-400/35 bg-rose-500/[0.09] text-slate-100 shadow-[0_0_24px_-10px_rgba(244,63,94,0.3)]",
    dot: "bg-rose-400 shadow-[0_0_8px_#fb7185]",
    eyebrow: "text-rose-300",
    cta: "bg-rose-500 text-white hover:bg-rose-400 shadow-[0_0_16px_rgba(244,63,94,0.4)]",
  },
  stone: {
    wrap: "border-white/[0.14] bg-white/[0.045] text-slate-100",
    dot: "bg-slate-400",
    eyebrow: "text-slate-300",
    cta: "bg-white/15 text-white hover:bg-white/25",
  },
};

export interface NextStepBannerProps {
  tone?: BannerTone;
  eyebrow?: string;
  now: string;
  next: string;
  goal?: string;
  actionLabel?: string;
  actionHref?: string;
}

/**
 * Shows the user what is happening right now, what to do next, and the end goal.
 */
export function NextStepBanner({
  tone = "blue",
  eyebrow = "Right now",
  now,
  next,
  goal,
  actionLabel,
  actionHref,
}: NextStepBannerProps) {
  const styles = TONE_STYLES[tone];

  return (
    <div
      className={`rounded-2xl border backdrop-blur-md p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${styles.wrap}`}
    >
      <div className="space-y-1.5 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
            <span className={`w-2 h-2 rounded-full shrink-0 ${styles.dot}`} />
            <span className={styles.eyebrow}>{eyebrow}</span>
          </span>
          {goal && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.07] border border-white/[0.12] px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
              <Target className="w-3 h-3 text-slate-400 shrink-0" />
              Goal: {goal}
            </span>
          )}
        </div>
        <p className="font-editorial text-base sm:text-lg font-semibold text-white leading-snug">
          {now}
        </p>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          <strong className="font-semibold text-white">Next:</strong> {next}
        </p>
      </div>

      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shrink-0 transition-all ${styles.cta}`}
        >
          <span>{actionLabel}</span>
          <ArrowRight className="w-4 h-4 shrink-0" />
        </Link>
      )}
    </div>
  );
}

export interface FlowStepItem {
  label: string;
  hint?: string;
}

export interface FlowStepsProps {
  steps: FlowStepItem[];
  currentStep: number;
  goalLabel?: string;
  accent?: "blue" | "teal";
}

/**
 * Displays a numbered multi-step journey so users see where they are and the end goal.
 */
export function FlowSteps({
  steps,
  currentStep,
  goalLabel,
  accent = "blue",
}: FlowStepsProps) {
  const activeBg =
    accent === "teal"
      ? "bg-teal-400 border-teal-300 text-slate-950 ring-4 ring-teal-400/20"
      : "bg-sky-400 border-sky-300 text-slate-950 ring-4 ring-sky-400/20";
  const doneBg = "bg-emerald-500 border-emerald-400 text-slate-950";
  const lineDone = "bg-gradient-to-r from-emerald-400 to-cyan-400";

  return (
    <div className="editorial-card p-4 sm:p-5 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0 flex-1">
          {steps.map((step, idx) => {
            const stepNum = idx + 1;
            const done = stepNum < currentStep;
            const current = stepNum === currentStep;
            return (
              <React.Fragment key={`${step.label}-${stepNum}`}>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`w-6 h-6 rounded-full border text-[11px] font-bold flex items-center justify-center shrink-0 transition-all ${
                      done
                        ? doneBg
                        : current
                          ? activeBg
                          : "bg-white/[0.05] border-white/[0.14] text-slate-400"
                    }`}
                  >
                    {done ? <Check className="w-3.5 h-3.5" /> : stepNum}
                  </span>
                  <div className="leading-tight">
                    <span
                      className={`text-xs font-semibold block whitespace-nowrap ${
                        done || current ? "text-white" : "text-slate-400"
                      }`}
                    >
                      {step.label}
                    </span>
                    {step.hint && (
                      <span className="text-[10px] text-slate-400 block whitespace-nowrap">
                        {step.hint}
                      </span>
                    )}
                  </div>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`h-0.5 min-w-[18px] flex-1 rounded-full ${
                      done ? lineDone : "bg-white/[0.1]"
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {goalLabel && (
          <span className="inline-flex items-center gap-1.5 self-start sm:self-center shrink-0 rounded-full bg-white/[0.06] border border-white/[0.12] px-3 py-1 text-[11px] font-medium text-slate-200">
            <Target className="w-3 h-3 text-teal-300 shrink-0" />
            {goalLabel}
          </span>
        )}
      </div>
    </div>
  );
}
