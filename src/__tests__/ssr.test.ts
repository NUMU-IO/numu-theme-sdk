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
import { RichText, sanitizeHtml } from "../components/RichText";
import { useCachedResource } from "../lib/dataCache";
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

describe("useCachedResource under plain Node (SSR-safe)", () => {
  it("renders initialData and never fetches on the server", () => {
    function Widget() {
      const { data, isLoading } = useCachedResource<string>(
        "ssr-key",
        // If this ran on the server the render would reject; it must not — the
        // fetch is effect-only and effects don't run under renderToString.
        () => Promise.reject(new Error("fetcher must not run on the server")),
        { initialData: "seed" },
      );
      return createElement("span", null, `${data}:${isLoading}`);
    }
    const html = renderToString(createElement(Widget));
    // initialData is shown; isLoading is true (this hook WOULD fetch on the
    // client), and no window/document access threw a ReferenceError.
    expect(html).toContain("seed:true");
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

/**
 * SSR sanitizer bypasses (Phase 2 correctness). This is the node-env code path
 * (`sanitizeHtml` → `sanitizeHtmlServer`), i.e. the string that ships in the
 * FIRST paint before hydration. Each case is a bypass the old regex allowed.
 */
describe("sanitizeHtml — server path (no DOM) hardening", () => {
  it("neutralizes a slash-separated event handler: <img/onerror=…>", () => {
    const out = sanitizeHtml("<img/onerror=alert(1)>");
    // Old `\s+on\w+=` required whitespace before `onerror`, so the slash form
    // survived untouched. It must not anymore.
    expect(out.toLowerCase()).not.toContain("onerror");
    expect(out).not.toContain("alert(1)");
  });

  it("still strips a plain space-separated handler with a safe src kept", () => {
    const out = sanitizeHtml('<img src="/ok.png" onerror="steal()">');
    expect(out.toLowerCase()).not.toContain("onerror");
    expect(out).not.toContain("steal()");
    // The safe relative src is preserved.
    expect(out).toContain("/ok.png");
  });

  it("neutralizes a nested/spliced <script> that reconstitutes after one pass", () => {
    // Removing the two inner <script></script> in a single pass collapses this
    // into a fresh <script>alert(1)</script>. The fixpoint loop must re-strip.
    const nested =
      "<scr<script></script>ipt>alert(1)</scr<script></script>ipt>";
    const out = sanitizeHtml(nested);
    expect(out.toLowerCase()).not.toContain("<script");
    expect(out.toLowerCase()).not.toContain("</script");
  });

  it("strips javascript: and data: URLs in href/src", () => {
    expect(
      sanitizeHtml('<a href="javascript:alert(1)">x</a>').toLowerCase(),
    ).not.toContain("javascript:");
    expect(
      sanitizeHtml(
        '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>',
      ).toLowerCase(),
    ).not.toContain("data:");
    // Script smuggled inside a data: image src is also gone.
    const img = sanitizeHtml(
      '<img src="data:text/html,<script>alert(1)</script>">',
    );
    expect(img.toLowerCase()).not.toContain("data:");
    expect(img.toLowerCase()).not.toContain("<script");
  });

  it("preserves safe formatting + links", () => {
    const out = sanitizeHtml(
      '<p>Hi <strong>there</strong> <a href="/shop">shop</a> <a href="https://x.test">ext</a></p>',
    );
    expect(out).toContain("<strong>there</strong>");
    expect(out).toContain('href="/shop"');
    expect(out).toContain('href="https://x.test"');
  });
});
