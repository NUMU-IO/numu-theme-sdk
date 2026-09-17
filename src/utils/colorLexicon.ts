/**
 * Bilingual colour lexicon — tier 2 of the swatch colour ladder.
 *
 * The ladder, first hit wins:
 *   1. the explicit hex the merchant set for that option value
 *   2. THIS lexicon
 *   3. the value's own image
 *   4. a text pill
 *
 * There is deliberately no tier-5 grey. "Navy Heather falls back to a default
 * gray" is a documented failure of the Shopify swatch-app category, and
 * shoppers report it as "wrong colours" — which is worse than no colour at all.
 * A value that misses every tier renders as a pill or an explicit unknown chip,
 * never as a confident wrong swatch.
 *
 * This is Egyptian retail vocabulary, not a translated CSS colour list: `نبيتي`
 * and `أوف وايت` are what merchants actually type, and neither is a CSS colour
 * name.
 */

/**
 * Fold the spellings of one Arabic word onto a single key.
 *
 * Merchants type `كحلى` and `كحلي`, `بيچ` and `بيج`, `أسود` and `اسود` — the
 * same colour, three ways to miss a lookup. Normalises hamza carriers, the
 * ya / alef-maksura pair, teh marbuta, the Persian chars that reach an Arabic
 * keyboard, plus tatweel and the diacritics a copy-paste drags in.
 */
export function normalizeColorKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "") // harakat + tatweel
    .replace(/[أإآٱ]/g, "ا") // أ إ آ ٱ -> ا
    .replace(/ى/g, "ي") // ى -> ي
    .replace(/ة/g, "ه") // ة -> ه
    .replace(/پ/g, "ب") // پ -> ب
    .replace(/[چژ]/g, "ج") // چ ژ -> ج
    .replace(/ڤ/g, "ف") // ڤ -> ف
    .replace(/گ/g, "ك") // گ -> ك
    .replace(/[\s‏‎_-]+/g, " ") // collapse spaces + bidi marks
    .trim();
}

/** Raw entries, keyed by the spelling a merchant is most likely to type. */
const ENTRIES: Record<string, string> = {
  // ── Neutrals ────────────────────────────────────────────────────────────
  "أسود": "#111111", black: "#111111",
  "أبيض": "#ffffff", white: "#ffffff",
  "أوف وايت": "#f4f1ea", "off white": "#f4f1ea", offwhite: "#f4f1ea",
  "كريمي": "#f5ead6", cream: "#f5ead6",
  "بيج": "#d9c4a9", beige: "#d9c4a9",
  "جملي": "#c19a6b", camel: "#c19a6b",
  "بني": "#6b4423", brown: "#6b4423",
  "شوكولاتة": "#4a2c20", chocolate: "#4a2c20",
  "رمادي": "#8a8a8a", grey: "#8a8a8a", gray: "#8a8a8a",
  "فضي": "#c0c0c0", silver: "#c0c0c0",
  "ذهبي": "#d4af37", gold: "#d4af37",
  "نحاسي": "#b87333", bronze: "#b87333", copper: "#b87333",
  // ── Blues ───────────────────────────────────────────────────────────────
  "أزرق": "#1f4fd8", blue: "#1f4fd8",
  "كحلي": "#1b2a4a", navy: "#1b2a4a",
  "لبني": "#a9c7e4", "baby blue": "#a9c7e4",
  "سماوي": "#7ec8e3", "sky blue": "#7ec8e3",
  "تركواز": "#30d5c8", turquoise: "#30d5c8", teal: "#2f8f8a",
  "بترولي": "#2f4f5a", petrol: "#2f4f5a",
  // ── Greens ──────────────────────────────────────────────────────────────
  "أخضر": "#2e7d32", green: "#2e7d32",
  "زيتي": "#6b7042", olive: "#6b7042",
  "منت": "#a8e6cf", mint: "#a8e6cf",
  // ── Reds / pinks / purples ──────────────────────────────────────────────
  "أحمر": "#d32f2f", red: "#d32f2f",
  "نبيتي": "#6d1f2c", burgundy: "#6d1f2c", maroon: "#6d1f2c", wine: "#6d1f2c",
  "وردي": "#f4a6c0", pink: "#f4a6c0",
  "فوشيا": "#e6338c", fuchsia: "#e6338c",
  "موف": "#b39ddb", mauve: "#b39ddb",
  "بنفسجي": "#6a1b9a", purple: "#6a1b9a",
  // ── Yellows / oranges ───────────────────────────────────────────────────
  "أصفر": "#f5c518", yellow: "#f5c518",
  "برتقالي": "#ef6c00", orange: "#ef6c00",
  "خردلي": "#c9a227", mustard: "#c9a227",
};

/** Normalised lookup, built once. */
const LEXICON: Map<string, string> = new Map(
  Object.entries(ENTRIES).map(([k, v]) => [normalizeColorKey(k), v]),
);

/** A CSS colour the browser will actually paint, or `undefined`. */
export function lexiconHex(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return LEXICON.get(normalizeColorKey(value));
}

/**
 * Is this string already a usable CSS colour?
 *
 * Only hex is accepted. The whole bug this component exists to fix is a theme
 * passing the merchant's LABEL to `background-color`, where `"Taupe"` happened
 * to be a valid CSS keyword and `"كحلي"` painted nothing — so guessing at
 * keywords is precisely the behaviour to not reintroduce.
 */
export function isHex(value: string | null | undefined): value is string {
  return typeof value === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.trim());
}

/** Default axis names treated as colour axes when the merchant sets none. */
export const DEFAULT_COLOR_AXIS_NAMES = ["color", "colour", "اللون", "الالوان", "لون"];

/** Does this axis name name a colour axis? */
export function isColorAxisName(
  name: string | null | undefined,
  configured?: string | string[] | null,
): boolean {
  if (!name) return false;
  const list =
    typeof configured === "string"
      ? configured.split(",")
      : Array.isArray(configured) && configured.length > 0
        ? configured
        : DEFAULT_COLOR_AXIS_NAMES;
  const key = normalizeColorKey(name);
  return list.some((n) => normalizeColorKey(String(n)) === key);
}
