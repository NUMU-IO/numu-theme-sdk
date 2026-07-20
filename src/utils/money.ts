/**
 * Money formatting for NUMU storefronts.
 *
 * Three implementations of this existed and disagreed:
 *
 *   - the themes' own `fmt` (4 byte-identical copies): EGP fallback,
 *     `maximumFractionDigits: 0`, locale `"ar"` mapped to `"ar-EG"`
 *   - `@numueg/theme-kit`'s `formatMoney`: **USD** fallback, 2 fraction
 *     digits, raw locale passed through
 *   - `NuMuProvider`'s own `formatMoney`: a third variant again
 *
 * This adopts the themes' behaviour, because that is what production renders
 * today: adopting the kit's would silently turn every promo nudge from
 * `LE 500` into `£E 500.00` on live stores. NUMU is Egypt-first — EGP is the
 * right fallback, whole piastres are noise at Egyptian price points, and
 * `ar-EG` is what produces Egyptian Arabic numerals and currency placement.
 *
 * The unit is CENTS, matching the API end to end. `formatMoneyMajor` exists
 * for the one place that already divided (the SDK exposes cart money in major
 * units), so nobody has to remember which side of the boundary they're on.
 */

export interface FormatMoneyOptions {
  /** Currency code. Falls back to EGP — Egypt-first, not USD. */
  currency?: string | null;
  /** `"ar"` maps to `ar-EG`; anything else formats as `en-EG`. */
  locale?: string | null;
  /**
   * Fraction digits. Defaults to 0: Egyptian retail prices are whole pounds,
   * and `500.00 EGP` reads as noise next to `500 EGP`. Pass 2 where sub-unit
   * precision genuinely matters (a unit price, an FX-converted amount).
   */
  fractionDigits?: number;
}

function resolveLocale(locale: string | null | undefined): string {
  return locale === "ar" ? "ar-EG" : "en-EG";
}

/**
 * Format an integer amount of cents.
 *
 * @example formatMoney(50000)                    // "EGP 500"
 * @example formatMoney(50000, { locale: "ar" })  // "٥٠٠ ج.م.‏"
 */
export function formatMoney(
  cents: number,
  options: FormatMoneyOptions = {},
): string {
  const { currency, locale, fractionDigits = 0 } = options;
  // A non-finite amount formats as the zero of its currency rather than
  // "NaN EGP" on a product card.
  const safe = Number.isFinite(cents) ? cents : 0;
  return new Intl.NumberFormat(resolveLocale(locale), {
    style: "currency",
    currency: currency || "EGP",
    maximumFractionDigits: fractionDigits,
  }).format(safe / 100);
}

/**
 * Format an amount already expressed in major units.
 *
 * The SDK hands cart money to themes in major units while the API speaks
 * cents, so a shared helper that only accepted one of the two guaranteed a
 * factor-of-100 bug at the seam.
 */
export function formatMoneyMajor(
  amount: number,
  options: FormatMoneyOptions = {},
): string {
  return formatMoney(
    (Number.isFinite(amount) ? amount : 0) * 100,
    options,
  );
}

/** Cents to major units. Non-finite input yields 0, never NaN. */
export function centsToMajor(cents: number): number {
  return (Number.isFinite(cents) ? cents : 0) / 100;
}

/** Major units to integer cents, rounded — the inverse of `centsToMajor`. */
export function majorToCents(amount: number): number {
  return Math.round((Number.isFinite(amount) ? amount : 0) * 100);
}
