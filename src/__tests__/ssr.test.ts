// @vitest-environment node
/**
 * SSR regression gate (0.3.0) — proves the full theme element tree renders
 * under plain Node with NO DOM at all. This is exactly what the storefront's
 * SSR worker does: `renderToString(createApp(ctx))` from a worker_thread.
 *
 * Runs in the `node` vitest environment on purpose (the rest of the suite
 * uses happy-dom): any render-path `window` / `document` access in the
 * provider stack or helpers throws ReferenceError here and fails the gate
 * BEFORE it ships as a hydration bug or a worker crash.
 *
 * Also pins `computeGlobalStyleTokens` (the pure half hosts use to SSR the
 * style vars) and the RichText server sanitizer path.
 */

import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { defineThemeEntry } from "../entry";
import type { ThemeMountContext } from "../mount";
import { RichText } from "../components/RichText";
import { computeGlobalStyleTokens } from "../utils/styleTokens";
import type { ThemeSettingsV3 } from "../types/theme";
import type { Store } from "../types/entities";

const store = {
  id: "store-1",
  name: "Aswan Goods",
  slug: "aswan-goods",
  currency: "EGP",
  default_language: "en",
  use_nextjs_storefront: true,
} as Store;

const themeSettings = {
  schema_version: 3,
  theme_id: "ssr-fixture",
  global_settings: {
    primary_color: "#b8a878",
    heading_font: "cairo",
    body_font: "Custom Sans",
    page_width: "1240px",
    brand_scheme: { background: "#fff7ec", text: "#1a1a1a" },
  },
  templates: {
    home: {
      name: "Home",
      sections: {
        hero_1: { type: "hero", settings: { headline: "THE NEW EMPIRE" } },
      },
      order: ["hero_1"],
    },
  },
  section_groups: {},
} as unknown as ThemeSettingsV3;

function makeCtx(extra?: Partial<ThemeMountContext>): ThemeMountContext {
  return {
    themeSettings,
    storeData: store,
    page: {
      type: "home",
      data: {
        products: [
          { id: "p1", name: "Hand-carved bowl", slug: "bowl", price: 450 },
        ],
      },
    },
    locale: "en",
    demo: false,
    navigation: {},
    ...extra,
  };
}

describe("defineThemeEntry / createApp under plain Node", () => {
  const entry = defineThemeEntry(({ currentTemplate, store: s, themeSettings: ts }) =>
    createElement(
      "main",
      { "data-template": currentTemplate },
      createElement("h1", null, s.name),
      createElement("p", null, `theme:${ts.theme_id}`),
    ),
  );

  it("exposes both halves of the contract", () => {
    expect(typeof entry.mount).toBe("function");
    expect(typeof entry.createApp).toBe("function");
  });

  it("renderToString produces the theme markup with zero DOM access", () => {
    const html = renderToString(entry.createApp(makeCtx()));
    expect(html).toContain('data-template="home"');
    expect(html).toContain("Aswan Goods");
    expect(html).toContain("theme:ssr-fixture");
  });

  it("resolves the template from page.type like the client mount does", () => {
    const html = renderToString(
      entry.createApp(makeCtx({ page: { type: "cart" } })),
    );
    expect(html).toContain('data-template="cart"');
  });

  it("is deterministic — two renders of the same ctx are byte-identical", () => {
    const ctx = makeCtx();
    expect(renderToString(entry.createApp(ctx))).toBe(
      renderToString(entry.createApp(ctx)),
    );
  });
});

describe("computeGlobalStyleTokens (pure host-side SSR vars)", () => {
  const { cssVars, fontHrefs } = computeGlobalStyleTokens(
    themeSettings.global_settings as Record<string, unknown>,
  );

  it("maps colors with role aliases", () => {
    expect(cssVars["--theme-primary_color"]).toBe("#b8a878");
    expect(cssVars["--theme-color-primary"]).toBe("#b8a878");
  });

  it("resolves registry font tokens to stacks + collects webfont hrefs", () => {
    expect(cssVars["--theme-heading_font"]).toContain("Cairo");
    expect(cssVars["--theme-font-heading"]).toContain("Cairo");
    expect(fontHrefs.some((h) => h.includes("Cairo"))).toBe(true);
  });

  it("passes non-registry heading/body fonts through verbatim (mount parity)", () => {
    expect(cssVars["--theme-body_font"]).toBe("Custom Sans");
  });

  it("emits scheme vars for object-valued settings and plain scalars", () => {
    expect(cssVars["--scheme-brand_scheme-background"]).toBe("#fff7ec");
    expect(cssVars["--theme-page_width"]).toBe("1240px");
  });
});

describe("RichText server path", () => {
  it("renders sanitized HTML without a DOM and strips scripts", () => {
    const html = renderToString(
      createElement(RichText, {
        html: '<p>Hello <strong>world</strong></p><script>alert(1)</script>',
      }),
    );
    expect(html).toContain("<strong>world</strong>");
    expect(html).not.toContain("script");
  });
});
