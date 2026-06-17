/**
 * `applyGlobalStyleTokens(globalSettings, el)` — Phase 3.5.
 *
 * Bridges a store's **global theme settings** (colors, fonts, layout) to
 * **CSS custom properties** on the bundle's mount root, so editing a color
 * or font in Theme Settings actually re-paints the storefront. Before this,
 * themes shipped static CSS tokens that nothing wrote to → the pickers were
 * a silent no-op.
 *
 * ## Token contract (canonical names every theme can rely on)
 *
 * For each global setting `<id>` we set `--theme-<id>` verbatim (colors as
 * their value, fonts resolved to a CSS font stack, other scalars as-is).
 * Themes consume these with the current static value as a fallback:
 *
 *   --by-cream:     var(--theme-background_color, #f7f1e8);
 *   --by-espresso:  var(--theme-primary_color,   #3a2418);
 *   --by-font-serif: var(--theme-heading_font, "Cormorant Garamond", serif);
 *
 * In addition, well-known ids are aliased to **role** tokens so themes that
 * prefer semantic names share one vocabulary:
 *
 *   colors → --theme-color-{background,text,primary,secondary,accent,border,button}
 *   fonts  → --theme-font-{heading,body}
 *
 * `color_scheme` / `color_scheme_group` settings (object values keyed by role)
 * emit `--scheme-<id>-<role>`.
 *
 * The helper is **idempotent** and safe to call on every `applyDraft` so the
 * customizer's live preview re-paints as the merchant drags a color.
 */

type GlobalSettings = Record<string, unknown> | null | undefined;

/** id → canonical color role. Covers both `<role>_color` and `color_<role>`. */
const COLOR_ROLE_ALIASES: Record<string, string> = {
  background_color: "background",
  color_background: "background",
  bg_color: "background",
  text_color: "text",
  color_text: "text",
  primary_color: "primary",
  color_primary: "primary",
  secondary_color: "secondary",
  color_secondary: "secondary",
  accent_color: "accent",
  color_accent: "accent",
  border_color: "border",
  color_border: "border",
  button_color: "button",
  color_button: "button",
  button_text_color: "button-text",
  color_button_text: "button-text",
};

/** id → canonical font role. */
const FONT_ROLE_ALIASES: Record<string, string> = {
  heading_font: "heading",
  font_heading: "heading",
  headings_font: "heading",
  body_font: "body",
  font_body: "body",
  text_font: "body",
};

/**
 * Font token → CSS stack + optional Google Fonts href. A `font_picker`/select
 * stores a token (e.g. "cormorant"); we resolve it to a real stack and inject
 * the webfont so a picked font actually loads. Unknown tokens fall through and
 * are used verbatim as the family (so a theme can store a raw stack too).
 */
const FONT_REGISTRY: Record<string, { stack: string; href?: string }> = {
  cormorant: {
    stack: '"Cormorant Garamond", Georgia, "Times New Roman", serif',
    href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap",
  },
  "dm-sans": {
    stack: '"DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
    href: "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700&display=swap",
  },
  playfair: {
    stack: '"Playfair Display", Georgia, serif',
    href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap",
  },
  inter: {
    stack: '"Inter", system-ui, -apple-system, sans-serif',
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  },
  poppins: {
    stack: '"Poppins", system-ui, sans-serif',
    href: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap",
  },
  montserrat: {
    stack: '"Montserrat", system-ui, sans-serif',
    href: "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap",
  },
  lora: {
    stack: '"Lora", Georgia, serif',
    href: "https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&display=swap",
  },
  cairo: {
    stack: '"Cairo", system-ui, sans-serif',
    href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap",
  },
  tajawal: {
    stack: '"Tajawal", system-ui, sans-serif',
    href: "https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap",
  },
};

const COLOR_RE = /^(#([0-9a-f]{3,8})|rgba?\(|hsla?\(|color\(|var\()/i;

function isColorValue(v: unknown): v is string {
  return typeof v === "string" && COLOR_RE.test(v.trim());
}

function isFontToken(v: unknown): v is string {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(FONT_REGISTRY, v);
}

/** Idempotently inject a webfont <link> into <head>. */
function injectFontLink(href: string): void {
  if (typeof document === "undefined" || !href) return;
  const existing = document.querySelector(
    `link[data-numu-font][href="${href}"]`,
  );
  if (existing) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.setAttribute("data-numu-font", "");
  document.head.appendChild(link);
}

/** Pure registry lookup — no webfont injection. */
function lookupFontStack(value: string): string {
  return FONT_REGISTRY[value]?.stack ?? value;
}

/**
 * Resolve a font setting value to a CSS stack. Known tokens map through the
 * registry (and load the webfont); anything else is treated as a literal
 * family/stack the theme author supplied.
 */
export function resolveFontStack(value: string): string {
  const entry = FONT_REGISTRY[value];
  if (entry) {
    if (entry.href) injectFontLink(entry.href);
    return entry.stack;
  }
  return value;
}

/** Result of `computeGlobalStyleTokens` — everything a host needs to paint
 *  global settings without a DOM. */
export interface ComputedStyleTokens {
  /** CSS custom properties to set on the theme's mount root. */
  cssVars: Record<string, string>;
  /** Google-Fonts stylesheet hrefs for any registry fonts in use. */
  fontHrefs: string[];
}

/**
 * Pure half of `applyGlobalStyleTokens`: compute the exact CSS custom
 * properties (and webfont hrefs) a settings object maps to, without touching
 * any DOM. This is what lets a host SERVER-render a theme with the same vars
 * the bundle applies on mount — both sides call this one function, so the
 * values cannot drift (drift = unstyled flash or hydration noise).
 *
 * Includes the explicit `heading_font` / `body_font` resolution that
 * `mountTheme` historically layered on top: any string value for those two
 * ids resolves through the registry (or passes verbatim) so a picked font
 * gets a real stack even when it isn't a known token.
 */
export function computeGlobalStyleTokens(
  globalSettings: GlobalSettings,
): ComputedStyleTokens {
  const cssVars: Record<string, string> = {};
  const fontHrefs: string[] = [];
  if (!globalSettings || typeof globalSettings !== "object") {
    return { cssVars, fontHrefs };
  }

  const pushHref = (href?: string) => {
    if (href && !fontHrefs.includes(href)) fontHrefs.push(href);
  };

  for (const [key, value] of Object.entries(globalSettings)) {
    if (!key || key.startsWith("__")) continue;

    // color_scheme / color_scheme_group → object of role:color
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [role, c] of Object.entries(value as Record<string, unknown>)) {
        if (isColorValue(c)) cssVars[`--scheme-${key}-${role}`] = c;
      }
      continue;
    }

    if (isColorValue(value)) {
      cssVars[`--theme-${key}`] = value.trim();
      const role = COLOR_ROLE_ALIASES[key];
      if (role) cssVars[`--theme-color-${role}`] = value.trim();
      continue;
    }

    if (isFontToken(value)) {
      const entry = FONT_REGISTRY[value];
      cssVars[`--theme-${key}`] = entry.stack;
      const role = FONT_ROLE_ALIASES[key];
      if (role) cssVars[`--theme-font-${role}`] = entry.stack;
      pushHref(entry.href);
      continue;
    }

    // Plain scalar (layout values like page_width "1240px", spacing, etc.).
    if (typeof value === "string" || typeof value === "number") {
      const v = String(value).trim();
      if (v) cssVars[`--theme-${key}`] = v;
    }
  }

  // Explicit heading/body resolution (formerly done by mountTheme's effect):
  // non-registry font names fall through the scalar branch verbatim above;
  // these two ids always get the resolved stack + webfont.
  for (const id of ["heading_font", "body_font"] as const) {
    const value = (globalSettings as Record<string, unknown>)[id];
    if (typeof value === "string" && value.trim()) {
      cssVars[`--theme-${id}`] = lookupFontStack(value);
      pushHref(FONT_REGISTRY[value]?.href);
    }
  }

  return { cssVars, fontHrefs };
}

/**
 * Map a store's global settings onto CSS custom properties on `el`. Call on
 * mount and on every `applyDraft` (live preview). No-op when `el` or the
 * settings are missing. Reserved `__`-prefixed keys (e.g. `__translations`)
 * are skipped. Thin DOM shell over `computeGlobalStyleTokens`.
 */
export function applyGlobalStyleTokens(
  globalSettings: GlobalSettings,
  el: HTMLElement | null | undefined,
): void {
  if (!el || !globalSettings || typeof globalSettings !== "object") return;
  const { cssVars, fontHrefs } = computeGlobalStyleTokens(globalSettings);
  const style = el.style;
  for (const [prop, value] of Object.entries(cssVars)) {
    style.setProperty(prop, value);
  }
  for (const href of fontHrefs) injectFontLink(href);
}
