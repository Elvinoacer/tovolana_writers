import React from "react";
import Image from "next/image";
import {
  Award,
  BookOpen,
  Briefcase,
  Check,
  CheckCircle2,
  Compass,
  Feather,
  FileSearch,
  FlaskConical,
  Lock,
  PenTool,
  Sparkles,
} from "lucide-react";

interface DisciplineVisualConfig {
  gradient: string;
  accentBg: string;
  accentText: string;
  patternStroke: string;
  tag: string;
}

const DISCIPLINE_THEMES: Record<string, DisciplineVisualConfig> = {
  "academic-writing": {
    gradient: "from-[#1e3a8a] via-[#1d4ed8] to-[#0f172a]",
    accentBg: "bg-blue-500/20",
    accentText: "text-blue-100",
    patternStroke: "#93c5fd",
    tag: "Scholarly Monograph",
  },
  "essays-and-assignments": {
    gradient: "from-[#0f766e] via-[#0d9488] to-[#134e4a]",
    accentBg: "bg-teal-400/20",
    accentText: "text-teal-50",
    patternStroke: "#5eead4",
    tag: "Structured Rhetoric",
  },
  "research-papers": {
    gradient: "from-[#312e81] via-[#4338ca] to-[#1e1b4b]",
    accentBg: "bg-indigo-400/20",
    accentText: "text-indigo-100",
    patternStroke: "#a5b4fc",
    tag: "Empirical Inquiry",
  },
  "articles-and-blog-writing": {
    gradient: "from-[#b45309] via-[#d97706] to-[#78350f]",
    accentBg: "bg-amber-300/20",
    accentText: "text-amber-50",
    patternStroke: "#fde68a",
    tag: "Editorial Voice",
  },
  "business-writing-and-proposals": {
    gradient: "from-[#0f172a] via-[#1e293b] to-[#1e3a8a]",
    accentBg: "bg-sky-400/20",
    accentText: "text-sky-100",
    patternStroke: "#7dd3fc",
    tag: "Executive Strategy",
  },
  "editing-and-proofreading": {
    gradient: "from-[#881337] via-[#be123c] to-[#4c0519]",
    accentBg: "bg-rose-400/20",
    accentText: "text-rose-100",
    patternStroke: "#fda4af",
    tag: "Precision Polish",
  },
};

function getTheme(slug: string): DisciplineVisualConfig {
  if (DISCIPLINE_THEMES[slug]) return DISCIPLINE_THEMES[slug];
  for (const [k, val] of Object.entries(DISCIPLINE_THEMES)) {
    if (slug.includes(k.split("-")[0])) return val;
  }
  return {
    gradient: "from-[#1e293b] via-[#334155] to-[#0f172a]",
    accentBg: "bg-stone-300/20",
    accentText: "text-stone-100",
    patternStroke: "#cbd5e1",
    tag: "Bespoke Craft",
  };
}

function DisciplineIcon({ slug }: { slug: string }) {
  const cls = "w-5 h-5";
  if (slug.includes("academic")) return <BookOpen className={cls} />;
  if (slug.includes("essay")) return <PenTool className={cls} />;
  if (slug.includes("research")) return <FlaskConical className={cls} />;
  if (slug.includes("article")) return <Feather className={cls} />;
  if (slug.includes("business")) return <Briefcase className={cls} />;
  if (slug.includes("editing")) return <FileSearch className={cls} />;
  return <Compass className={cls} />;
}

export function CategoryCoverArt({
  slug,
  name,
  heightClass = "h-28",
  children,
}: {
  slug: string;
  name: string;
  heightClass?: string;
  children?: React.ReactNode;
}) {
  const theme = getTheme(slug);

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br ${theme.gradient} ${heightClass} p-4 flex flex-col justify-between select-none`}
    >
      {/* Bespoke Geometric Plate SVG */}
      <svg
        aria-hidden="true"
        viewBox="0 0 240 120"
        className="absolute right-0 bottom-0 w-44 h-28 opacity-20 pointer-events-none transition-transform duration-500 group-hover:scale-110"
        fill="none"
      >
        <circle
          cx="185"
          cy="65"
          r="52"
          stroke={theme.patternStroke}
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <circle
          cx="185"
          cy="65"
          r="32"
          stroke={theme.patternStroke}
          strokeWidth="1.5"
        />
        <path
          d="M125 96 L225 22"
          stroke={theme.patternStroke}
          strokeWidth="1"
        />
        <rect
          x="160"
          y="40"
          width="50"
          height="50"
          rx="10"
          stroke={theme.patternStroke}
          strokeWidth="1.2"
          transform="rotate(14 185 65)"
        />
      </svg>

      <div className="relative z-10 flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${theme.accentBg} ${theme.accentText} backdrop-blur-md text-[11px] font-semibold tracking-tight`}
        >
          <DisciplineIcon slug={slug} />
          <span className="truncate max-w-[170px]">{name}</span>
        </span>
        <span className="text-[10px] font-tech uppercase tracking-wider text-white/75">
          {theme.tag}
        </span>
      </div>

      {children && <div className="relative z-10">{children}</div>}
    </div>
  );
}

const AVATAR_TONES = [
  "from-[#1e3a8a] to-[#3b82f6]",
  "from-[#0f766e] to-[#14b8a6]",
  "from-[#b45309] to-[#f59e0b]",
  "from-[#4338ca] to-[#6366f1]",
  "from-[#9f1239] to-[#e11d48]",
  "from-[#111827] to-[#4b5563]",
];

export function CreatorAvatar({
  name,
  username,
  available,
  size = "md",
}: {
  name: string;
  username?: string;
  available?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const seedStr = (username || name || "T").toLowerCase();
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash * 31 + seedStr.charCodeAt(i)) % 997;
  }
  const gradient = AVATAR_TONES[hash % AVATAR_TONES.length];
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  const dims =
    size === "lg"
      ? "w-16 h-16 text-xl rounded-2xl"
      : size === "sm"
        ? "w-7 h-7 text-[11px] rounded-full"
        : "w-9 h-9 text-xs rounded-xl";

  return (
    <div className="relative inline-flex shrink-0">
      <div
        className={`${dims} bg-gradient-to-br ${gradient} text-white font-editorial font-bold flex items-center justify-center shadow-sm ring-2 ring-white`}
      >
        {initials || "TW"}
      </div>
      {available !== undefined && (
        <span
          title={available ? "Accepting Bookings" : "At Capacity"}
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
            available ? "bg-emerald-500" : "bg-stone-400"
          }`}
        />
      )}
    </div>
  );
}

export function ScoreRing({
  score,
  max = 100,
  size = 86,
  strokeWidth = 7,
  label,
  sublabel,
  tone = "emerald",
}: {
  score: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  tone?: "emerald" | "blue" | "gold" | "rose";
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, score / max));
  const dash = circ * pct;

  const strokeColor =
    tone === "blue"
      ? "#1e3a8a"
      : tone === "gold"
        ? "#b45309"
        : tone === "rose"
          ? "#be123c"
          : "#0f766e";

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#e6e0d4"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 700ms cubic-bezier(0.16, 1, 0.3, 1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-tech text-sm font-bold text-[#111827] leading-none">
            {label ?? `${Math.round(score)}${max === 100 ? "%" : ""}`}
          </span>
        </div>
      </div>
      {sublabel && (
        <span className="text-[11px] font-medium text-stone-600 text-center leading-tight">
          {sublabel}
        </span>
      )}
    </div>
  );
}

const PIPELINE_STEPS = [
  { label: "Booked", short: "Booked" },
  { label: "Escrow", short: "Escrow" },
  { label: "In Progress", short: "Active" },
  { label: "Delivered", short: "Delivered" },
  { label: "Settled", short: "Done" },
];

export function getEscrowStepIndex(status: string): number {
  switch (status) {
    case "PENDING_PAYMENT":
      return 0;
    case "PAID_AWAITING_ACCEPTANCE":
      return 1;
    case "IN_PROGRESS":
    case "REVISION_REQUESTED":
      return 2;
    case "DELIVERED":
      return 3;
    case "COMPLETED":
      return 4;
    default:
      return 1;
  }
}

export function EscrowStepVisualizer({
  status,
  compact = false,
}: {
  status: string;
  compact?: boolean;
}) {
  const activeStep = getEscrowStepIndex(status);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-1">
        {PIPELINE_STEPS.map((step, idx) => {
          const done = idx < activeStep || (status === "COMPLETED" && idx === 4);
          const current = idx === activeStep && status !== "COMPLETED";
          return (
            <React.Fragment key={step.label}>
              <div className="flex flex-col items-center gap-1 min-w-0">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-tech font-bold border transition-all ${
                    done
                      ? "bg-[#0f766e] border-[#0f766e] text-white"
                      : current
                        ? "bg-[#1e3a8a] border-[#1e3a8a] text-white ring-4 ring-blue-100"
                        : "bg-[#faf7f2] border-[#e6e0d4] text-stone-400"
                  }`}
                >
                  {done ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                </div>
                {!compact && (
                  <span
                    className={`text-[10px] font-medium truncate ${
                      done || current ? "text-[#111827]" : "text-stone-400"
                    }`}
                  >
                    {step.short}
                  </span>
                )}
              </div>
              {idx < PIPELINE_STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 rounded-full ${
                    idx < activeStep ? "bg-[#0f766e]" : "bg-[#e6e0d4]"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

export function HeroManuscriptShowcase({
  creatorsCount,
  publishedCount,
  bookingsCount,
}: {
  creatorsCount: number;
  publishedCount: number;
  bookingsCount: number;
}) {
  return (
    <div className="relative animate-reveal stagger-2">
      <div className="editorial-card overflow-hidden bg-white p-2 sm:p-3">
        <div className="relative rounded-2xl overflow-hidden bg-[#faf7f2]">
          <Image
            src="/images/hero-atelier.svg"
            alt="Tovolana Writers vetted editorial manuscript and IntaSend escrow visual showcase"
            width={640}
            height={480}
            priority
            className="w-full h-auto block"
          />
        </div>

        {/* Visual Live Telemetry Strip */}
        <div className="grid grid-cols-3 gap-2 pt-2.5">
          <div className="rounded-xl bg-[#faf7f2] border border-[#e6e0d4] px-3 py-2.5 flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-[#0f766e] shrink-0">
              <Award className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="font-tech text-base font-bold text-[#111827] leading-none">
                {creatorsCount}
              </p>
              <p className="text-[11px] text-stone-500 truncate mt-1">
                Vetted Writers
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-[#faf7f2] border border-[#e6e0d4] px-3 py-2.5 flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-[#1e3a8a] shrink-0">
              <Sparkles className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="font-tech text-base font-bold text-[#111827] leading-none">
                {publishedCount}
              </p>
              <p className="text-[11px] text-stone-500 truncate mt-1">
                Active Services
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-[#faf7f2] border border-[#e6e0d4] px-3 py-2.5 flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-[#b45309] shrink-0">
              <Lock className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="font-tech text-base font-bold text-[#111827] leading-none">
                {bookingsCount}
              </p>
              <p className="text-[11px] text-stone-500 truncate mt-1">
                Escrow Orders
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Subtle Floating Guarantee Pill */}
      <div className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#111827] text-white text-xs font-medium shadow-lg absolute -bottom-3 left-5 animate-float-subtle">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        <span>Valid Until ≠ Delivery Deadline Guaranteed</span>
      </div>
    </div>
  );
}
