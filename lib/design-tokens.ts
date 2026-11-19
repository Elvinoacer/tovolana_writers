export type HudThemeKey =
  | "cyan"
  | "violet"
  | "amber"
  | "sky"
  | "emerald"
  | "rose"
  | "neutral";

export const HUD_THEME_CYCLE: HudThemeKey[] = [
  "cyan",
  "violet",
  "amber",
  "sky",
  "emerald",
  "rose",
];

export const CATEGORY_HUD_THEME: Record<string, HudThemeKey> = {
  "research-papers": "cyan",
  "academic-writing": "violet",
  "articles-and-blog-writing": "amber",
  "business-writing-and-proposals": "sky",
  "essays-and-assignments": "emerald",
  "editing-and-proofreading": "rose",
  "other-services": "cyan",
};

export interface HudAccentPalette {
  accent: string;
  bright: string;
  glow: string;
  secondary: string;
  secondaryGlow: string;
  avatarBg: string;
}

export const HUD_ACCENT_HEX: Record<HudThemeKey, HudAccentPalette> = {
  cyan: {
    accent: "#2dd4bf",
    bright: "#67f5e1",
    glow: "rgba(45, 212, 191, 0.55)",
    secondary: "#38bdf8",
    secondaryGlow: "rgba(56, 189, 248, 0.38)",
    avatarBg: "#0d7f76",
  },
  violet: {
    accent: "#a855f7",
    bright: "#e9d5ff",
    glow: "rgba(192, 132, 252, 0.55)",
    secondary: "#2dd4bf",
    secondaryGlow: "rgba(45, 212, 191, 0.36)",
    avatarBg: "#6d28d9",
  },
  amber: {
    accent: "#f59e0b",
    bright: "#fde68a",
    glow: "rgba(251, 191, 36, 0.52)",
    secondary: "#2dd4bf",
    secondaryGlow: "rgba(45, 212, 191, 0.42)",
    avatarBg: "#1d4ed8",
  },
  sky: {
    accent: "#38bdf8",
    bright: "#bae6fd",
    glow: "rgba(56, 189, 248, 0.55)",
    secondary: "#2dd4bf",
    secondaryGlow: "rgba(45, 212, 191, 0.36)",
    avatarBg: "#1e40af",
  },
  emerald: {
    accent: "#10b981",
    bright: "#a7f3d0",
    glow: "rgba(52, 211, 153, 0.55)",
    secondary: "#2dd4bf",
    secondaryGlow: "rgba(45, 212, 191, 0.38)",
    avatarBg: "#047857",
  },
  rose: {
    accent: "#fb7185",
    bright: "#fecdd3",
    glow: "rgba(251, 113, 133, 0.52)",
    secondary: "#c084fc",
    secondaryGlow: "rgba(192, 132, 252, 0.36)",
    avatarBg: "#9f1239",
  },
  neutral: {
    accent: "#94a3b8",
    bright: "#e2e8f0",
    glow: "rgba(148, 163, 184, 0.35)",
    secondary: "#38bdf8",
    secondaryGlow: "rgba(56, 189, 248, 0.24)",
    avatarBg: "#334155",
  },
};

/**
 * Resolves the HUD theme variant for a service card from its category slug,
 * rotating cleanly across adjacent cards when an explicit gallery index is passed.
 */
export function getCardHudTheme(
  categorySlug: string,
  index?: number
): HudThemeKey {
  const mapped = CATEGORY_HUD_THEME[categorySlug];
  if (mapped && index === undefined) {
    return mapped;
  }
  if (index !== undefined) {
    return HUD_THEME_CYCLE[index % HUD_THEME_CYCLE.length];
  }
  return "cyan";
}
