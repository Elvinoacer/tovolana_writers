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

export interface BookingPricingInput {
  listedPrice: number;
  extraCharges?: number;
  standardServiceFeePct: number;
  proFeeDiscountPct: number;
  serviceFeePctOverride?: number | null;
  userIsPro: boolean;
}

export interface BookingPricingBreakdown {
  listedPrice: number;
  extraCharges: number;
  baseSubtotal: number;
  rawServiceFee: number;
  proDiscount: number;
  serviceFee: number;
  totalPayable: number;
  creatorNetAmount: number;
  effectiveFeePct: number;
}

export function calculateBookingPricing(
  input: BookingPricingInput
): BookingPricingBreakdown {
  const listedPrice = roundCurrency(Math.max(0, input.listedPrice));
  const extraCharges = roundCurrency(Math.max(0, input.extraCharges ?? 0));
  const baseSubtotal = roundCurrency(listedPrice + extraCharges);

  const feePct =
    input.serviceFeePctOverride !== null &&
    input.serviceFeePctOverride !== undefined
      ? input.serviceFeePctOverride
      : input.standardServiceFeePct;

  const rawServiceFee = roundCurrency(baseSubtotal * (feePct / 100));
  const proDiscount = input.userIsPro
    ? roundCurrency(rawServiceFee * (input.proFeeDiscountPct / 100))
    : 0;
  const serviceFee = roundCurrency(Math.max(0, rawServiceFee - proDiscount));
  const totalPayable = roundCurrency(baseSubtotal + serviceFee);
  const creatorNetAmount = baseSubtotal;

  return {
    listedPrice,
    extraCharges,
    baseSubtotal,
    rawServiceFee,
    proDiscount,
    serviceFee,
    totalPayable,
    creatorNetAmount,
    effectiveFeePct: feePct,
  };
}

export function isFutureTimestamp(
  value: Date | string | null | undefined
): boolean {
  if (!value) return false;
  const parsed = typeof value === "string" ? new Date(value) : value;
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() > Date.now();
}

export function getDeadlineHoursLeft(value: Date | string): number {
  const parsed = typeof value === "string" ? new Date(value) : value;
  return Math.round((parsed.getTime() - Date.now()) / (1000 * 60 * 60));
}
