import type {
  ThemeSettingsV3,
  SectionGroup,
  SectionInstance,
  PageTemplate,
} from "../types/theme";

/**
 * Default theme id when neither the V3 payload nor the legacy `theme.base_theme`
 * is set. Sourced from the env at build time so it stays in sync with the
 * backend's `NUMU_DEFAULT_THEME_ID`.
 *
 * Read once: SDK code that runs in browsers can't read env at runtime, but
 * tsup inlines `process.env.*` at build time when configured to do so.
 */
const DEFAULT_THEME_ID =
  (typeof process !== "undefined" &&
    process.env?.NUMU_DEFAULT_THEME_ID) ||
  "modern";

/**
 * Dual-Read normalization: converts V1/V2 legacy payloads to V3 in memory.
 * Portable — works in both Node.js (SSR) and browser.
 *
 * Output must match the backend's `normalize_legacy_to_v3()` byte-for-byte
 * on the same input. The unit test in __tests__/normalize.test.ts asserts
 * this. If you change the shape here, update the backend mapper too —
 * otherwise stores rendered via SDK and stores rendered via SSR will
 * disagree on what the page contains.
 */
export function resolveThemeSettings(
  raw: Record<string, unknown> | null | undefined,
): ThemeSettingsV3 {
  const safeRaw = (raw ?? {}) as Record<string, unknown>;

  // Already V3 — pass through unchanged.
  if (safeRaw.schema_version === 3) {
    return safeRaw as unknown as ThemeSettingsV3;
  }

  const themeBlock = (safeRaw.theme as Record<string, unknown>) || {};
  const themeId =
    (typeof themeBlock.base_theme === "string" && themeBlock.base_theme) ||
    DEFAULT_THEME_ID;

  const globalSettings: Record<string, unknown> = {};
  for (const key of [
    "primary_color",
    "secondary_color",
    "font_family",
    "logo_url",
  ]) {
    if (themeBlock[key] !== undefined) globalSettings[key] = themeBlock[key];
  }
  if (safeRaw.identity) globalSettings.identity = safeRaw.identity;

  const sections: Record<string, SectionInstance> = {};
  const order: string[] = [];

  const hero = safeRaw.hero as Record<string, unknown> | undefined;
  if (hero) {
    sections["hero_1"] = {
      type: "hero",
      settings: {
        // Mirrors backend `normalize_legacy_to_v3` exactly — includes
        // headline_ar so Arabic content survives the round-trip.
        headline: hero.headline ?? "",
        headline_ar: hero.headline_ar ?? "",
        subtitle: hero.subtitle ?? "",
        background_image: hero.hero_image_url ?? "",
        cta_text: hero.cta_text ?? "",
        cta_link: hero.cta_link ?? "",
      },
    };
    order.push("hero_1");
  }

  const products = safeRaw.products as Record<string, unknown> | undefined;
  if (products) {
    sections["featured_1"] = {
      type: "featured-products",
      settings: products,
    };
    order.push("featured_1");
  }

  const templates: Record<string, PageTemplate> = {};
  if (Object.keys(sections).length > 0) {
    templates["home"] = { name: "Home", sections, order };
  }

  const sectionGroups: Record<string, SectionGroup> = {
    header: {
      name: "Header Group",
      sections: {
        header_1: {
          type: "header",
          settings: (safeRaw.header as Record<string, unknown>) || {},
        },
      },
      order: ["header_1"],
    },
    footer: {
      name: "Footer Group",
      sections: {
        footer_1: {
          type: "footer",
          settings: (safeRaw.footer as Record<string, unknown>) || {},
        },
      },
      order: ["footer_1"],
    },
  };

  let externalTheme: ThemeSettingsV3["external_theme"] = null;
  const ext = safeRaw.external_theme as
    | { bundle_url?: unknown; css_url?: unknown; mode?: unknown }
    | undefined;
  if (
    ext &&
    typeof ext === "object" &&
    typeof ext.bundle_url === "string" &&
    ext.bundle_url
  ) {
    externalTheme = {
      bundle_url: ext.bundle_url,
      css_url: typeof ext.css_url === "string" ? ext.css_url : null,
      mode: typeof ext.mode === "string" ? ext.mode : "production",
    };
  }

  return {
    schema_version: 3,
    theme_id: themeId,
    global_settings: globalSettings,
    templates,
    section_groups: sectionGroups,
    external_theme: externalTheme,
  };
}
