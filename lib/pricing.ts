export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isUserProActive(
  membershipTier: string | null | undefined,
  proExpiresAt: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (membershipTier !== "PRO") return false;
  if (!proExpiresAt) return true;
  const expiry =
    typeof proExpiresAt === "string" ? new Date(proExpiresAt) : proExpiresAt;
  return expiry.getTime() > now.getTime();
}

export function isFutureTimestamp(
  value: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!value) return false;
  const parsed = typeof value === "string" ? new Date(value) : value;
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() > now.getTime();
}

export function getDeadlineHoursLeft(value: Date | string): number {
  const parsed = typeof value === "string" ? new Date(value) : value;
  return Math.round((parsed.getTime() - Date.now()) / (1000 * 60 * 60));
}

export const TRIPWIRE_OUTLINE_PRICE_KES = 490;
export const MILESTONE_SPLIT_RATIO = 0.25;
export const EARNINGS_TO_CONNECT_RATE_KES = 15;
export const BID_SEALED_CONNECTS_COST = 4;
export const BID_FEATURED_CONNECTS_COST = 3;

export const BOOST_CONNECTS_COSTS = {
  AVAILABLE_NOW: 5,
  FEATURED_PROFILE: 15,
  CREATOR_PLUS: 60,
} as const;

export type CheckoutMode =
  | "FULL_ESCROW"
  | "TRIPWIRE_OUTLINE"
  | "MILESTONE_SPLIT";

export interface CheckoutAddOnConfig {
  id: string;
  label: string;
  description: string;
  pricingKind: "FLAT" | "PERCENTAGE";
  value: number;
  badge?: string;
}

export const CLIENT_CHECKOUT_ADDONS: CheckoutAddOnConfig[] = [
  {
    id: "originality_report",
    label: "Originality & AI-Free Authenticity Report",
    description:
      "Official similarity & human-authorship verification PDF bundled with final delivery.",
    pricingKind: "FLAT",
    value: 450,
    badge: "Most Selected",
  },
  {
    id: "executive_summary",
    label: "1-Page Executive Summary & Key Takeaways",
    description:
      "Distilled board-ready brief highlighting core arguments, data points, and citations.",
    pricingKind: "FLAT",
    value: 850,
  },
  {
    id: "nda_sealed",
    label: "Strict NDA & Sealed Confidential Workspace",
    description:
      "Locks non-disclosure terms and keeps project files & briefs excluded from samples.",
    pricingKind: "FLAT",
    value: 600,
  },
  {
    id: "elite_writer",
    label: "Top 5% Elite Writer Guarantee",
    description:
      "Routes priority quality review and assigns top-decile rubric & rating specialists.",
    pricingKind: "PERCENTAGE",
    value: 15,
    badge: "Top Rated",
  },
  {
    id: "priority_rush",
    label: "Priority Express Rush Turnaround",
    description:
      "Halves standard delivery turnaround window with urgent milestone SLA alerts.",
    pricingKind: "PERCENTAGE",
    value: 20,
    badge: "Fastest",
  },
];

export function calculateAddOnsTotal(
  basePrice: number,
  selectedAddOnIds: string[] = []
): {
  addOnsTotal: number;
  itemized: Array<{ id: string; label: string; amount: number }>;
} {
  const uniqueIds = [...new Set(selectedAddOnIds)];
  const itemized: Array<{ id: string; label: string; amount: number }> = [];

  for (const id of uniqueIds) {
    const addon = CLIENT_CHECKOUT_ADDONS.find((item) => item.id === id);
    if (!addon) continue;
    const amount =
      addon.pricingKind === "FLAT"
        ? roundCurrency(addon.value)
        : roundCurrency(Math.max(0, basePrice) * (addon.value / 100));
    itemized.push({ id: addon.id, label: addon.label, amount });
  }

  const addOnsTotal = roundCurrency(
    itemized.reduce((sum, item) => sum + item.amount, 0)
  );
  return { addOnsTotal, itemized };
}

export interface BookingPricingInput {
  listedPrice: number;
  extraCharges?: number;
  addOnsTotal?: number;
  standardServiceFeePct: number;
  proFeeDiscountPct: number;
  serviceFeePctOverride?: number | null;
  userIsPro: boolean;
  checkoutMode?: CheckoutMode;
  creatorCommissionPct?: number;
}

export interface BookingPricingBreakdown {
  listedPrice: number;
  extraCharges: number;
  addOnsTotal: number;
  baseSubtotal: number;
  rawServiceFee: number;
  proDiscount: number;
  serviceFee: number;
  fullOrderTotal: number;
  totalPayable: number;
  remainingBalance: number;
  creatorCommission: number;
  creatorNetAmount: number;
  effectiveFeePct: number;
  checkoutMode: CheckoutMode;
}

export function calculateBookingPricing(
  input: BookingPricingInput
): BookingPricingBreakdown {
  const listedPrice = roundCurrency(Math.max(0, input.listedPrice));
  const extraCharges = roundCurrency(Math.max(0, input.extraCharges ?? 0));
  const addOnsTotal = roundCurrency(Math.max(0, input.addOnsTotal ?? 0));
  const baseSubtotal = roundCurrency(listedPrice + extraCharges);
  const checkoutMode: CheckoutMode = input.checkoutMode ?? "FULL_ESCROW";

  const feePct =
    input.serviceFeePctOverride !== null &&
    input.serviceFeePctOverride !== undefined
      ? input.serviceFeePctOverride
      : input.standardServiceFeePct;

  const rawServiceFee = roundCurrency(baseSubtotal * (feePct / 100));
  const proDiscount = input.userIsPro
    ? roundCurrency(rawServiceFee * (input.proFeeDiscountPct / 100))
    : 0;
  const fullServiceFee = roundCurrency(Math.max(0, rawServiceFee - proDiscount));
  const fullOrderTotal = roundCurrency(
    baseSubtotal + addOnsTotal + fullServiceFee
  );

  const commissionPct = Math.max(0, Math.min(50, input.creatorCommissionPct ?? 0));

  if (checkoutMode === "TRIPWIRE_OUTLINE") {
    const tripwireFee = roundCurrency(
      TRIPWIRE_OUTLINE_PRICE_KES * (input.userIsPro ? 0.05 : 0.1)
    );
    const tripwireCreatorNet = roundCurrency(
      TRIPWIRE_OUTLINE_PRICE_KES - tripwireFee
    );
    return {
      listedPrice,
      extraCharges,
      addOnsTotal,
      baseSubtotal,
      rawServiceFee,
      proDiscount,
      serviceFee: tripwireFee,
      fullOrderTotal,
      totalPayable: TRIPWIRE_OUTLINE_PRICE_KES,
      remainingBalance: roundCurrency(
        Math.max(0, fullOrderTotal - TRIPWIRE_OUTLINE_PRICE_KES)
      ),
      creatorCommission: tripwireFee,
      creatorNetAmount: tripwireCreatorNet,
      effectiveFeePct: feePct,
      checkoutMode,
    };
  }

  if (checkoutMode === "MILESTONE_SPLIT") {
    const dueNow = roundCurrency(fullOrderTotal * MILESTONE_SPLIT_RATIO);
    const depositServiceFee = roundCurrency(
      fullServiceFee * MILESTONE_SPLIT_RATIO
    );
    const depositBase = roundCurrency(baseSubtotal * MILESTONE_SPLIT_RATIO);
    const creatorCommission = roundCurrency(
      depositBase * (commissionPct / 100)
    );
    const creatorNetAmount = roundCurrency(
      Math.max(0, depositBase - creatorCommission)
    );
    return {
      listedPrice,
      extraCharges,
      addOnsTotal,
      baseSubtotal,
      rawServiceFee,
      proDiscount,
      serviceFee: depositServiceFee,
      fullOrderTotal,
      totalPayable: dueNow,
      remainingBalance: roundCurrency(Math.max(0, fullOrderTotal - dueNow)),
      creatorCommission,
      creatorNetAmount,
      effectiveFeePct: feePct,
      checkoutMode,
    };
  }

  const creatorCommission = roundCurrency(
    baseSubtotal * (commissionPct / 100)
  );
  const creatorNetAmount = roundCurrency(
    Math.max(0, baseSubtotal - creatorCommission)
  );

  return {
    listedPrice,
    extraCharges,
    addOnsTotal,
    baseSubtotal,
    rawServiceFee,
    proDiscount,
    serviceFee: fullServiceFee,
    fullOrderTotal,
    totalPayable: fullOrderTotal,
    remainingBalance: 0,
    creatorCommission,
    creatorNetAmount,
    effectiveFeePct: feePct,
    checkoutMode,
  };
}

export interface ConnectsBundle {
  id: "starter" | "growth" | "studio" | "agency";
  name: string;
  baseConnects: number;
  bonusConnects: number;
  totalConnects: number;
  priceKes: number;
  badge?: string;
  tagline: string;
}

export const CONNECTS_BUNDLES: ConnectsBundle[] = [
  {
    id: "starter",
    name: "Starter Pack",
    baseConnects: 20,
    bonusConnects: 0,
    totalConnects: 20,
    priceKes: 400,
    tagline: "Test 3–5 targeted bids & activate 1 availability pulse.",
  },
  {
    id: "growth",
    name: "Growth Pack",
    baseConnects: 60,
    bonusConnects: 5,
    totalConnects: 65,
    priceKes: 1000,
    badge: "Most Popular",
    tagline: "Win #1 boosted slots across high-budget briefs + Sealed bids.",
  },
  {
    id: "studio",
    name: "Studio Pro Pack",
    baseConnects: 150,
    bonusConnects: 25,
    totalConnects: 175,
    priceKes: 2200,
    badge: "Best Value",
    tagline: "Covers Creator Plus Pass (60⚡) + Featured Spotlight + 20 bids.",
  },
  {
    id: "agency",
    name: "Agency Power Pack",
    baseConnects: 400,
    bonusConnects: 80,
    totalConnects: 480,
    priceKes: 5000,
    tagline: "Dominate Top-3 auction placements all month at KES 10.4/Connect.",
  },
];

export function calculateRequiredConnectsForBrief(
  budgetMax: number,
  isUrgent: boolean = false
): number {
  const base = budgetMax < 5000 ? 2 : budgetMax <= 15000 ? 4 : 6;
  return base + (isUrgent ? 1 : 0);
}

const CREATOR_TIER_BONUS: Record<string, number> = {
  STANDARD: 0,
  RISING_TALENT: 10,
  TOP_RATED: 20,
  ELITE: 40,
};

export interface BidRankInput {
  boostConnects: number;
  isFeatured: boolean;
  isSealed: boolean;
  creatorTier?: string | null;
  assessmentScore?: number | null;
  ratingAverage?: number | null;
  profileCompletenessScore?: number | null;
}

export function computeBidRankScore(input: BidRankInput): number {
  const boostPoints = Math.max(0, input.boostConnects) * 10;
  const featuredPoints = input.isFeatured ? 25 : 0;
  const sealedPoints = input.isSealed ? 10 : 0;
  const tierBonus = CREATOR_TIER_BONUS[input.creatorTier || "STANDARD"] ?? 0;
  const assessmentPoints = Math.max(0, input.assessmentScore ?? 75) * 0.35;
  const ratingPoints = Math.max(0, input.ratingAverage ?? 5) * 8;
  const profilePoints =
    Math.max(0, input.profileCompletenessScore ?? 70) * 0.15;

  return (
    Math.round(
      (boostPoints +
        featuredPoints +
        sealedPoints +
        tierBonus +
        assessmentPoints +
        ratingPoints +
        profilePoints) *
        100
    ) / 100
  );
}

export interface RankableBid {
  id: string;
  creatorProfileId: string;
  boostConnects: number;
  isFeatured: boolean;
  isSealed: boolean;
  rankScore: number;
  createdAt: Date | string;
}

export type RankedBid<T extends RankableBid> = T & {
  rankPosition: number;
  totalBidders: number;
  isTopBoostedSlot: boolean;
  connectsNeededForRank1: number;
  connectsNeededForTop3: number;
};

export function rankBidsForBrief<T extends RankableBid>(
  bids: T[]
): Array<RankedBid<T>> {
  const sorted = [...bids].sort((a, b) => {
    if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
    if (b.boostConnects !== a.boostConnects) {
      return b.boostConnects - a.boostConnects;
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const totalBidders = sorted.length;
  const topScore = sorted[0]?.rankScore ?? 0;
  const thirdScore = sorted[Math.min(2, Math.max(0, totalBidders - 1))]?.rankScore ?? 0;

  return sorted.map((bid, idx) => {
    const rankPosition = idx + 1;
    const isTopBoostedSlot = rankPosition <= 3 && bid.boostConnects > 0;
    const connectsNeededForRank1 =
      rankPosition === 1
        ? 0
        : Math.max(1, Math.floor((topScore - bid.rankScore) / 10) + 1);
    const connectsNeededForTop3 =
      rankPosition <= 3
        ? 0
        : Math.max(1, Math.floor((thirdScore - bid.rankScore) / 10) + 1);

    return {
      ...bid,
      rankPosition,
      totalBidders,
      isTopBoostedSlot,
      connectsNeededForRank1,
      connectsNeededForTop3,
    };
  });
}

export interface CreatorStandoutInput {
  displayName?: string | null;
  headline?: string | null;
  bio?: string | null;
  writingCategories?: string[] | null;
  portfolioSamples?: unknown;
  taglineBadge?: string | null;
  educationCredentials?: string | null;
  introVideoUrl?: string | null;
  yearsExperience?: number | null;
  responseTimeMinutes?: number | null;
  avatarUrl?: string | null;
  availableNowBadgeUntil?: Date | string | null;
  featuredProfileUntil?: Date | string | null;
}

export interface StandoutBreakdownItem {
  key: string;
  label: string;
  completed: boolean;
  points: number;
  impactHint: string;
}

export function computeCreatorProfileStandoutScore(
  profile: CreatorStandoutInput
): {
  score: number;
  tierRecommendation: string;
  breakdown: StandoutBreakdownItem[];
} {
  const samples = Array.isArray(profile.portfolioSamples)
    ? profile.portfolioSamples
    : [];
  const hasAttachment = samples.some(
    (s) =>
      typeof s === "object" &&
      s !== null &&
      Boolean((s as { attachmentUrl?: string }).attachmentUrl)
  );

  const breakdown: StandoutBreakdownItem[] = [
    {
      key: "avatar",
      label: "Professional Studio Portrait",
      completed: Boolean(profile.avatarUrl?.trim()),
      points: 10,
      impactHint: "+24% profile click-through on bidding cards",
    },
    {
      key: "bio_headline",
      label: "Detailed Editorial Bio & Headline",
      completed:
        Boolean(profile.headline && profile.headline.trim().length >= 15) &&
        Boolean(profile.bio && profile.bio.trim().length >= 60),
      points: 15,
      impactHint: "Clarifies niche expertise for high-ticket clients",
    },
    {
      key: "tagline_badge",
      label: "Signature Tagline Badge",
      completed: Boolean(profile.taglineBadge && profile.taglineBadge.trim().length >= 5),
      points: 10,
      impactHint: "Highlighted directly next to your bid rank",
    },
    {
      key: "credentials",
      label: "Domain & Academic Credentials",
      completed: Boolean(
        profile.educationCredentials &&
          profile.educationCredentials.trim().length >= 5
      ),
      points: 15,
      impactHint: "Justifies premium KES rates & Top-Writer upgrades",
    },
    {
      key: "portfolio_samples",
      label: "2+ Portfolio Excerpts with File Attachment",
      completed: samples.length >= 2 && hasAttachment,
      points: 20,
      impactHint: "Proof of craft converts hesitant first-time buyers",
    },
    {
      key: "intro_video",
      label: "Intro Pitch Video or Audio Link",
      completed: Boolean(profile.introVideoUrl && profile.introVideoUrl.trim().length >= 8),
      points: 10,
      impactHint: "2.3x higher shortlisting rate on B2B & thesis briefs",
    },
    {
      key: "sla",
      label: "Fast Response SLA (≤ 30 mins) & Experience",
      completed:
        (profile.responseTimeMinutes ?? 60) <= 30 &&
        (profile.yearsExperience ?? 0) >= 2,
      points: 10,
      impactHint: "Signals readiness for urgent deadlines",
    },
    {
      key: "active_boost",
      label: "Active Standout Boost (Available Now / Featured)",
      completed:
        isFutureTimestamp(profile.availableNowBadgeUntil) ||
        isFutureTimestamp(profile.featuredProfileUntil),
      points: 10,
      impactHint: "Adds +10 to +20 organic lift in bid rank auctions",
    },
  ];

  const score = breakdown.reduce(
    (sum, item) => sum + (item.completed ? item.points : 0),
    0
  );

  const tierRecommendation =
    score >= 85
      ? "Standout Authority — Ready to dominate #1 boosted slots"
      : score >= 60
        ? "Strong Profile — Add credentials or intro pitch to hit 85%+"
        : "Starter Profile — Complete missing proof items to win 2x more bids";

  return { score, tierRecommendation, breakdown };
}
