import React from "react";
import Image from "next/image";
import { isAllowedNextImageSrc } from "@/lib/upload-constants";
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
  photoSrc: string;
  tag: string;
}

const DISCIPLINE_THEMES: Record<string, DisciplineVisualConfig> = {
  "academic-writing": {
    gradient: "from-[#1e3a8a]/80 via-[#312e81]/55 to-[#060a12]/92",
    accentBg: "bg-slate-950/65 border border-violet-400/35",
    accentText: "text-violet-200",
    patternStroke: "#c084fc",
    photoSrc: "/images/photos/cat-academic.jpg",
    tag: "Academic",
  },
  "essays-and-assignments": {
    gradient: "from-[#065f46]/75 via-[#047857]/45 to-[#060a12]/92",
    accentBg: "bg-slate-950/65 border border-emerald-400/35",
    accentText: "text-emerald-200",
    patternStroke: "#34d399",
    photoSrc: "/images/photos/cat-essays.jpg",
    tag: "Essays",
  },
  "research-papers": {
    gradient: "from-[#0e7490]/80 via-[#0f766e]/50 to-[#060a12]/92",
    accentBg: "bg-slate-950/65 border border-cyan-400/35",
    accentText: "text-cyan-200",
    patternStroke: "#2dd4bf",
    photoSrc: "/images/photos/cat-research.jpg",
    tag: "Research",
  },
  "articles-and-blog-writing": {
    gradient: "from-[#92400e]/75 via-[#b45309]/45 to-[#060a12]/92",
    accentBg: "bg-slate-950/65 border border-amber-400/35",
    accentText: "text-amber-200",
    patternStroke: "#fbbf24",
    photoSrc: "/images/photos/cat-articles.jpg",
    tag: "Articles",
  },
  "business-writing-and-proposals": {
    gradient: "from-[#075985]/80 via-[#1e3a8a]/55 to-[#060a12]/92",
    accentBg: "bg-slate-950/65 border border-sky-400/35",
    accentText: "text-sky-200",
    patternStroke: "#38bdf8",
    photoSrc: "/images/photos/cat-business.jpg",
    tag: "Business",
  },
  "editing-and-proofreading": {
    gradient: "from-[#881337]/75 via-[#be123c]/45 to-[#060a12]/92",
    accentBg: "bg-slate-950/65 border border-rose-400/35",
    accentText: "text-rose-200",
    patternStroke: "#fb7185",
    photoSrc: "/images/photos/cat-editing.jpg",
    tag: "Editing",
  },
  "other-services": {
    gradient: "from-[#1e293b]/75 via-[#0f172a]/55 to-[#060a12]/92",
    accentBg: "bg-slate-950/65 border border-white/25",
    accentText: "text-slate-100",
    patternStroke: "#94a3b8",
    photoSrc: "/images/photos/cat-other.jpg",
    tag: "Other",
  },
};

function getTheme(slug: string): DisciplineVisualConfig {
  if (DISCIPLINE_THEMES[slug]) return DISCIPLINE_THEMES[slug];
  for (const [k, val] of Object.entries(DISCIPLINE_THEMES)) {
    if (slug.includes(k.split("-")[0])) return val;
  }
  return DISCIPLINE_THEMES["other-services"];
}

export function getCategoryPhotoSrc(slug: string): string {
  return getTheme(slug).photoSrc;
}

function DisciplineIcon({ slug }: { slug: string }) {
  const cls = "w-4 h-4";
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
  heightClass = "h-36",
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
      className={`relative overflow-hidden bg-[#060a12] ${heightClass} p-4 flex flex-col justify-between select-none`}
    >
      <Image
        src={theme.photoSrc}
        alt={`${name} writing studio photography`}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 420px"
        className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
      />

      <div
        aria-hidden="true"
        className={`absolute inset-0 bg-gradient-to-t ${theme.gradient}`}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/15 to-black/75"
      />

      <div className="relative z-10 flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${theme.accentBg} ${theme.accentText} backdrop-blur-md text-[11px] font-semibold tracking-tight shadow-xs`}
        >
          <DisciplineIcon slug={slug} />
          <span className="truncate max-w-[180px]">{name}</span>
        </span>
      </div>

      {children && <div className="relative z-10">{children}</div>}
    </div>
  );
}

const AVATAR_BG_TONES = [
  "bg-[#0d9488]",
  "bg-[#4f46e5]",
  "bg-[#0284c7]",
  "bg-[#7c3aed]",
  "bg-[#b45309]",
];

function getMonogramInitials(name: string): string {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "TV";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function CreatorAvatar({
  name,
  username,
  avatarUrl,
  available,
  size = "md",
}: {
  name: string;
  username?: string;
  avatarUrl?: string | null;
  available?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const seedStr = (username || name || "T").toLowerCase();
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash * 31 + seedStr.charCodeAt(i)) % 997;
  }
  const bgTone = AVATAR_BG_TONES[hash % AVATAR_BG_TONES.length];

  const dims =
    size === "lg"
      ? "w-16 h-16 rounded-2xl"
      : size === "sm"
        ? "w-8 h-8 rounded-full"
        : "w-10 h-10 rounded-xl";
  const textSize =
    size === "lg" ? "text-lg" : size === "sm" ? "text-[11px]" : "text-xs";
  const imgSize = size === "lg" ? 64 : size === "sm" ? 32 : 40;

  const trimmedAvatarUrl = avatarUrl?.trim() || "";
  const hasAvatarImage = isAllowedNextImageSrc(trimmedAvatarUrl);

  return (
    <div className="relative inline-flex shrink-0">
      <div
        className={`${dims} relative overflow-hidden ${bgTone} shadow-sm ring-2 ring-white/25 flex items-center justify-center`}
      >
        {hasAvatarImage ? (
          <Image
            src={trimmedAvatarUrl}
            alt={name}
            width={imgSize}
            height={imgSize}
            unoptimized={Boolean(trimmedAvatarUrl.startsWith("/api/"))}
            className="w-full h-full object-cover"
          />
        ) : (
          <span
            aria-label={name}
            className={`font-tech font-semibold tracking-wider text-white select-none leading-none ${textSize}`}
          >
            {getMonogramInitials(name)}
          </span>
        )}
      </div>
      {available !== undefined && (
        <span
          title={available ? "Available" : "Busy right now"}
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#060a12] ${
            available
              ? "bg-emerald-400 shadow-[0_0_8px_#34d399]"
              : "bg-slate-500"
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
      ? "#38bdf8"
      : tone === "gold"
        ? "#fbbf24"
        : tone === "rose"
          ? "#fb7185"
          : "#2dd4bf";

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
            stroke="rgba(255, 255, 255, 0.12)"
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
          <span className="font-tech text-sm font-bold text-white leading-none">
            {label ?? `${Math.round(score)}${max === 100 ? "%" : ""}`}
          </span>
        </div>
      </div>
      {sublabel && (
        <span className="text-[11px] font-medium text-slate-400 text-center leading-tight">
          {sublabel}
        </span>
      )}
    </div>
  );
}

const PIPELINE_STEPS = [
  { label: "Ordered", short: "Ordered" },
  { label: "Paid", short: "Paid" },
  { label: "Writing", short: "Writing" },
  { label: "Check work", short: "Review" },
  { label: "Done", short: "Done" },
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
  if (status === "CANCELLED" || status === "REFUNDED" || status === "DISPUTED") {
    const label =
      status === "CANCELLED"
        ? "Order cancelled — no further steps."
        : status === "REFUNDED"
          ? "Order refunded to client."
          : "Payment paused — our support team is reviewing this order.";
    const tone =
      status === "DISPUTED"
        ? "bg-rose-500/15 border-rose-400/35 text-rose-200"
        : status === "REFUNDED"
          ? "bg-purple-500/15 border-purple-400/35 text-purple-200"
          : "bg-white/[0.06] border-white/[0.14] text-slate-300";

    return (
      <div className={`w-full rounded-xl border px-3 py-2 text-xs font-medium ${tone}`}>
        {label}
      </div>
    );
  }

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
                      ? "bg-emerald-500 border-emerald-400 text-slate-950"
                      : current
                        ? "bg-sky-400 border-sky-300 text-slate-950 ring-4 ring-sky-400/20"
                        : "bg-white/[0.05] border-white/[0.15] text-slate-400"
                  }`}
                >
                  {done ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                </div>
                {!compact && (
                  <span
                    className={`text-[10px] font-medium truncate ${
                      done || current ? "text-white" : "text-slate-400"
                    }`}
                  >
                    {step.short}
                  </span>
                )}
              </div>
              {idx < PIPELINE_STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 rounded-full ${
                    idx < activeStep ? "bg-emerald-400" : "bg-white/[0.12]"
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
      <div className="editorial-card overflow-hidden p-2 sm:p-3">
        <div className="relative rounded-2xl overflow-hidden bg-[#071019] aspect-[4/3]">
          <Image
            src="/images/photos/hero-nature-desk.jpg"
            alt="Tovolana Writers workspace with laptop and notes"
            fill
            sizes="(max-width: 768px) 100vw, 600px"
            priority
            className="object-cover"
          />
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2.5">
          <div className="rounded-xl bg-white/[0.045] border border-white/[0.11] px-3 py-2.5 flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-teal-500/15 border border-teal-400/35 flex items-center justify-center text-teal-300 shrink-0">
              <Award className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="font-tech text-base font-bold text-white leading-none">
                {creatorsCount}
              </p>
              <p className="text-[11px] text-slate-400 truncate mt-1">
                Tested Writers
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-white/[0.045] border border-white/[0.11] px-3 py-2.5 flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-400/35 flex items-center justify-center text-sky-300 shrink-0">
              <Sparkles className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="font-tech text-base font-bold text-white leading-none">
                {publishedCount}
              </p>
              <p className="text-[11px] text-slate-400 truncate mt-1">
                Ready Services
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-white/[0.045] border border-white/[0.11] px-3 py-2.5 flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-400/35 flex items-center justify-center text-amber-300 shrink-0">
              <Lock className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="font-tech text-base font-bold text-white leading-none">
                {bookingsCount}
              </p>
              <p className="text-[11px] text-slate-400 truncate mt-1">
                Protected Orders
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#0a1220]/90 border border-teal-400/35 text-white text-xs font-medium shadow-lg backdrop-blur-md absolute -bottom-3 left-5 animate-float-subtle">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        <span>Your payment stays safe until you approve</span>
      </div>
    </div>
  );
}
