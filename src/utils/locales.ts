/**
 * Theme-bundled locale files: load + merge.
 *
 * The plugin discovers `locales/<code>.json` (and the fallback
 * `locales/en.default.json`) and bakes them into the bundle as a map
 * keyed by locale code. The runtime calls `pickTranslations(map, locale)`
 * to resolve the right one, with English fallback for missing keys.
 *
 * Conventions:
 *   - locales/en.default.json is the canonical English source. It's
 *     the fallback for any other locale's missing keys.
 *   - locales/ar.json (and friends) override or extend the default.
 *   - Nested keys are flattened with dot notation: `{"hero": {"cta": "Buy"}}`
 *     becomes `"hero.cta"` for `t("hero.cta")` to look up.
 *
 * Why flatten:
 *   `useTranslation()` returns `t(key)` which expects a string lookup —
 *   structured access would force every theme to write
 *   `translations.hero?.cta ?? "Buy"`. Flattening keeps the call site
 *   short and matches Shopify's `t` semantics.
 */

export interface LocaleMessages {
  [key: string]: string;
}

export interface LocaleBundle {
  /** Locale code → flat key/value messages. */
  [locale: string]: LocaleMessages;
}

/**
 * Recursively flatten a nested locale object into dot-keyed strings.
 *
 * Non-string leaves are skipped with a console warning — translations
 * are user-facing strings; numbers and booleans don't belong in a
 * locale file (they should be in schema settings).
 */
export function flattenMessages(
  source: Record<string, unknown>,
  prefix = "",
): LocaleMessages {
  const out: LocaleMessages = {};
  for (const [key, val] of Object.entries(source)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (val === null || val === undefined) continue;
    if (typeof val === "string") {
      out[fullKey] = val;
    } else if (typeof val === "object" && !Array.isArray(val)) {
      Object.assign(
        out,
        flattenMessages(val as Record<string, unknown>, fullKey),
      );
    } else if (typeof console !== "undefined") {
      console.warn(
        `[numu] locale key '${fullKey}' has non-string value (${typeof val}); skipped.`,
      );
    }
  }
  return out;
}

/**
 * Resolve the messages map for the requested locale, falling back to
 * "en" then "en.default" then an empty map. Missing keys in the
 * requested locale are filled from "en" (so an Arabic translation
 * file with 90% coverage doesn't show empty strings for the missing
 * 10%; English shows through).
 */
export function pickTranslations(
  bundle: LocaleBundle,
  locale: string,
): LocaleMessages {
  const fallback = bundle["en"] || bundle["en.default"] || {};
  const requested = bundle[locale];
  if (!requested) return fallback;
  // Merge: fallback < requested. The requested locale wins per-key;
  // any key the requested locale doesn't define falls through to en.
  return { ...fallback, ...requested };
}

/**
 * Build a LocaleBundle from raw imports. Themes call this in their
 * `main.tsx` after a Vite glob import:
 *
 *   const localeModules = import.meta.glob<Record<string, unknown>>(
 *     "./locales/*.json", { eager: true, import: "default" });
 *   const translations = buildLocaleBundle(localeModules);
 *
 * `localeModules` keys are paths like `./locales/ar.json`; we strip
 * the directory + extension to get the locale code, and flatten each
 * value.
 */
export function buildLocaleBundle<T extends Record<string, unknown>>(
  modules: T,
): LocaleBundle {
  const bundle: LocaleBundle = {};
  for (const [path, raw] of Object.entries(modules)) {
    const m = /\/([^/]+)\.json$/.exec(path);
    if (!m) continue;
    let code = m[1];
    // `en.default` → keep as-is so pickTranslations can find it; theme
    // devs naming the file that way is a soft signal that this is the
    // canonical English source.
    if (code !== "en.default") {
      // Strip trailing ".default" from any other code (someone might
      // write `ar.default.json` by mistake).
      code = code.replace(/\.default$/, "");
    }
    const value = raw as unknown;
    if (typeof value === "object" && value !== null) {
      bundle[code] = flattenMessages(value as Record<string, unknown>);
    }
  }
  return bundle;
}
