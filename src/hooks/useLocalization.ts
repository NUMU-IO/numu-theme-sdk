import { useContext } from "react";
import { LocalizationContext } from "../contexts";
import type { LocalizationState } from "../contexts";

export function useLocalization(): LocalizationState {
  const ctx = useContext(LocalizationContext);
  if (!ctx) throw new Error("useLocalization must be used within NuMuProvider");
  return ctx;
}

export function useDirection(): "ltr" | "rtl" {
  const { direction } = useLocalization();
  return direction;
}

export function useLocale(): string {
  const { locale } = useLocalization();
  return locale;
}

export function useTranslation() {
  const { translations, locale } = useLocalization();
  return {
    t: (key: string, fallback?: string) => translations[key] || fallback || key,
    locale,
  };
}

/**
 * Phase 3.6 — pull a translated field off a domain object.
 *
 * Convention: per-product translations live on `entity.attributes`
 * keyed as `<field>_<locale>` — e.g. `name_ar`, `description_ar`.
 * Backend writes these via the merchant hub when a merchant turns on
 * "Translations" for a product. Themes call:
 *
 *     const productName = useFieldTranslation(product, "name");
 *
 * and get the Arabic name when the active locale is "ar", falling
 * back to the English `product.name` otherwise. Works for any object
 * that pairs a base field on the entity with an `attributes` JSONB
 * blob holding the translated variants.
 *
 * Why not put translations on the entity itself? Adding `name_ar`,
 * `description_ar`, `name_he`, etc. as first-class columns means a
 * schema migration every time a merchant enables a new locale. JSONB
 * lets the merchant flip locales on/off in settings without touching
 * the table.
 */
export function useFieldTranslation<
  T extends { attributes?: Record<string, unknown> },
>(entity: T | null | undefined, field: string): string | undefined {
  const { locale } = useLocalization();
  if (!entity) return undefined;
  // English (or whichever default locale the merchant configured) is
  // stored as the base field; non-default locales live on attributes
  // with a `<field>_<locale>` key.
  const translated =
    entity.attributes && typeof entity.attributes === "object"
      ? (entity.attributes as Record<string, unknown>)[`${field}_${locale}`]
      : undefined;
  if (typeof translated === "string" && translated) return translated;
  // Base field — supports any value type that stringifies sensibly.
  const base = (entity as unknown as Record<string, unknown>)[field];
  if (typeof base === "string") return base;
  if (base == null) return undefined;
  return String(base);
}

/**
 * Phase 3.7 — formatted-number hook.
 *
 * Themes that need to render counts ("12 items", "3 reviews") should
 * route through this hook so Arab-Indic digits (٠١٢٣٤) vs Western
 * (01234) stay consistent with money + date elsewhere on the page.
 *
 *     const fmtNum = useNumberFormat();
 *     fmtNum(12)              → "12"   (or "١٢" for Arabic stores)
 *     fmtNum(12.5, { minimumFractionDigits: 2 }) → "12.50" / "١٢٫٥٠"
 */
export function useNumberFormat() {
  const { formatNumber } = useLocalization();
  return formatNumber;
}
