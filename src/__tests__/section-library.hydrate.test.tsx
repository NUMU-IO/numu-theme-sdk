/**
 * Section library — the storefront adopts SSR markup with `hydrateRoot`.
 * Every library section must hydrate cleanly, and its hoisted `<style>` must
 * not break that adoption.
 */

import { act, createElement } from "react";
import { hydrateRoot } from "react-dom/client";
import { prerender } from "react-dom/static";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defineThemeEntry } from "../entry";
import type { ThemeMountContext } from "../mount";
import type { Store } from "../types/entities";
import type { SectionInstance, ThemeSettingsV3 } from "../types/theme";
import { librarySection } from "../sections";
import { sectionLibraryCatalog } from "../sections/catalog";

/** A filled-in instance per library section, and text it must show. */
const FIXTURES: Record<string, { instance: Partial<SectionInstance>; text: string; products?: unknown[] }> = {
  "lib-product-rail": {
    instance: { settings: { heading: "Picks" } },
    products: [{ id: "p1", name: "Linen shirt", slug: "linen-shirt", price: 300, compare_at_price: 400, currency: "EGP", images: [{ url: "/p.jpg" }], variants: [], in_stock: true }],
    text: "Linen shirt",
  },
  "lib-bundle-builder": {
    instance: { settings: { heading: "Pick your trio", pick_count: 2, source: "product_list", product_list: ["p1", "p2"] } },
    products: [
      { id: "p1", name: "Linen shirt", slug: "linen-shirt", price: 300, currency: "EGP", images: [], variants: [], in_stock: true },
      { id: "p2", name: "Cotton scarf", slug: "cotton-scarf", price: 200, currency: "EGP", images: [], variants: [], in_stock: true },
    ],
    text: "Pick your trio",
  },
  "lib-countdown": { instance: { settings: { ends_at: "2030-01-01T00:00", heading: "Sale" } }, text: "Sale" },
  "lib-hero": { instance: { settings: { style: "slideshow" }, blocks: { a: { type: "slide", settings: { headline: "Summer drop" } }, b: { type: "slide", settings: { headline: "Eid edit" } } }, block_order: ["a", "b"] } as Partial<SectionInstance>, text: "Summer drop" },
  "lib-newsletter": { instance: { settings: { heading: "Join the list" } }, text: "Join the list" },
  "lib-video": { instance: { settings: { heading: "Film", video: "/v.mp4" } }, text: "Film" },
  "lib-gallery": { instance: { settings: { heading: "Gallery wall" }, blocks: { p: { type: "photo", settings: { image: "/g.jpg" } } }, block_order: ["p"] } as Partial<SectionInstance>, text: "Gallery wall" },
  "lib-image-text": { instance: { settings: { title: "Our story", body: "Since 2010" } }, text: "Our story" },
  "lib-logo-list": { instance: { settings: { heading: "Our brands" }, blocks: { l: { type: "logo", settings: { image: "/l.png", name: "Acme" } } }, block_order: ["l"] } as Partial<SectionInstance>, text: "Our brands" },
  "lib-made-to-order": { instance: { settings: { lead_time_text: "Ready in 5 days" } }, text: "Ready in 5 days" },
  "lib-rich-text": { instance: { settings: { heading: "About us", content: "<p>Hello text</p>" } }, text: "Hello text" },
  "lib-shop-the-look": { instance: { settings: { image: "/s.jpg" }, blocks: { h: { type: "hotspot", settings: { x: 30, y: 40, label: "Linen shirt" } } }, block_order: ["h"] } as Partial<SectionInstance>, text: "Linen shirt" },
  "lib-trust-strip": { instance: { settings: {}, blocks: { i: { type: "item", settings: { icon: "cash", title: "Cash on delivery" } } }, block_order: ["i"] } as Partial<SectionInstance>, text: "Cash on delivery" },
  "lib-before-after": { instance: { settings: { title: "Glow", after_image: "/a.jpg" } }, text: "Glow" },
  "lib-collection-tiles": {
    instance: {
      settings: { source: "manual", title: "Shop jeans" },
      blocks: { t1: { type: "tile", settings: { label: "Wide leg", image: "/w.jpg", link: "/collections/wide-leg" } } },
      block_order: ["t1"],
    } as Partial<SectionInstance>,
    text: "Wide leg",
  },
  "lib-faq": {
    instance: {
      settings: {},
      blocks: {
        g: { type: "group", settings: {}, blocks: { q: { type: "qa", settings: { question: "Why?", answer: "Because." } } } },
      },
    },
    text: "Why?",
  },
  "lib-lookbook": { instance: { settings: { look_1_image: "/l.jpg", look_1_caption: "Linen" } }, text: "Linen" },
  "lib-marquee": { instance: { settings: { item_1: "Free shipping" } }, text: "Free shipping" },
  "lib-materials-care": {
    instance: { settings: {}, blocks: { r: { type: "row", settings: { term: "Cotton", description: "Wash cold" } } }, block_order: ["r"] } as Partial<SectionInstance>,
    text: "Wash cold",
  },
  "lib-process": { instance: { settings: { step_1_title: "Pick" } }, text: "Pick" },
  "lib-promo-banner": { instance: { settings: { image: "/b.jpg", overlay_text: "Eid" } }, text: "Eid" },
  "lib-size-guide": {
    instance: { settings: { chart_columns: "Waist" }, blocks: { r: { type: "row", settings: { size: "M", values: "80" } } }, block_order: ["r"] } as Partial<SectionInstance>,
    text: "80",
  },
  "lib-store-visit": { instance: { settings: { address: "12 Nile St", whatsapp: "01012345678" } }, text: "12 Nile St" },
  "lib-testimonials": { instance: { settings: { review_1_name: "Mona", review_1_text: "Lovely" } }, text: "Lovely" },
  "lib-ugc-carousel": { instance: { settings: { title: "Reels", item_1_video: "/r.mp4" } }, text: "Reels" },
};

describe("section library hydration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("has a fixture for every library section", () => {
    expect(Object.keys(FIXTURES).sort()).toEqual(Object.keys(sectionLibraryCatalog).sort());
  });

  for (const [type, fixture] of Object.entries(FIXTURES)) {
    it(`${type} hydrates SSR output with no recoverable errors`, async () => {
      // Mounting the provider stack fetches cart / customer / currencies.
      // Unit tests never reach the network.
      vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
      (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
      const Component = librarySection(type)!;
      const instance = { type, ...fixture.instance } as SectionInstance;
      const entry = defineThemeEntry(() =>
        createElement(
          "main",
          null,
          createElement(Component, { instance, sectionId: "a" }),
          createElement(Component, { instance, sectionId: "b" }),
        ),
      );
      const ctx = {
        themeSettings: { schema_version: 3, theme_id: "t", global_settings: {}, templates: {}, section_groups: {} } as unknown as ThemeSettingsV3,
        storeData: { id: "s", name: "S", slug: "s", currency: "EGP", default_language: "en", use_nextjs_storefront: true } as Store,
        page: { type: "home", data: { products: fixture.products ?? [] } },
        locale: "en",
        demo: false,
        navigation: {},
      } as ThemeMountContext;

      const el = document.createElement("div");
      // Lazy library chunks: render the way the storefront worker does, waiting for Suspense.
      const { prelude } = await prerender(entry.createApp(ctx), { progressiveChunkSize: Number.MAX_SAFE_INTEGER });
      el.innerHTML = await new Response(prelude).text();
      document.body.appendChild(el);

      const errors: string[] = [];
      let root: ReturnType<typeof hydrateRoot> | undefined;
      await act(async () => {
        root = hydrateRoot(el, entry.createApp(ctx), {
          onRecoverableError: (e) => errors.push(String((e as Error)?.message ?? e)),
        });
      });

      expect(errors).toEqual([]);
      expect(el.textContent).toContain(fixture.text);
      // Same-precedence styles merge into one tag: data-href="lib-base lib-…".
      expect(document.querySelectorAll(`style[data-href~="${type}"]`).length).toBe(1);
      await act(async () => root?.unmount());
    });
  }
});
