// @vitest-environment node
/**
 * lib-product-rail — SSR inside the real provider stack, on the list payload
 * the storefront puts in `page.data.products`.
 */

import { createElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { describe, expect, it } from "vitest";

import { PageContext } from "../contexts";
import { defineThemeEntry } from "../entry";
import type { ThemeMountContext } from "../mount";
import ProductRail from "../sections/lib-product-rail/ProductRail";
import type { Store } from "../types/entities";
import type { SectionInstance, ThemeSettingsV3 } from "../types/theme";

interface RenderOptions {
  locale?: string;
  /** `null` leaves `page.data.products` out, as on pages that don't pre-fetch. */
  products?: unknown[] | null;
}

async function render(settings: Record<string, unknown>, { locale = "en", products = PRODUCTS }: RenderOptions = {}) {
  const instance = { type: "lib-product-rail", settings } as SectionInstance;
  const rail = createElement(ProductRail, { instance, sectionId: "rail-0" });
  // NuMuProvider always writes `data.products` (`?? []`), so a page without
  // pre-fetched products can only be simulated by overriding PageContext.
  const entry = defineThemeEntry(() =>
    createElement("main", null, products === null ? createElement(PageContext.Provider, { value: { type: "page", data: {} } as never }, rail) : rail),
  );
  const ctx = {
    themeSettings: { schema_version: 3, theme_id: "library-fixture", global_settings: {}, templates: {}, section_groups: {} } as unknown as ThemeSettingsV3,
    storeData: { id: "s1", name: "Store", slug: "store", currency: "EGP", default_language: locale, use_nextjs_storefront: true } as Store,
    page: { type: "home", data: products === null ? { collections: [] } : { products, collections: [] } },
    locale,
    demo: false,
    navigation: {},
  } as ThemeMountContext;
  const { prelude } = await prerenderToNodeStream(entry.createApp(ctx), { progressiveChunkSize: Number.MAX_SAFE_INTEGER });
  let html = "";
  for await (const chunk of prelude) html += chunk;
  return html;
}

// The list shape, oldest first as the API returns it.
const PRODUCTS = [
  { id: "a", name: "Old linen", slug: "old-linen", price: 300, currency: "EGP", images: [{ url: "https://cdn.numueg.app/a.jpg" }], variants: [], in_stock: true, category_id: "c1", tags: ["Summer"], created_at: "2026-01-01 10:00:00+00:00" },
  { id: "b", name: "Mid scarf", slug: "mid-scarf", price: 200, compare_at_price: 250, currency: "EGP", images: [], variants: [], in_stock: true, category_id: "c2", tags: ["sale"], created_at: "2026-03-01 10:00:00+00:00" },
  { id: "c", name: "New dress", slug: "new-dress", price: 500, currency: "EGP", images: [], variants: [], in_stock: false, category_id: "c1", tags: null, created_at: "2026-05-01 10:00:00+00:00" },
];

const cards = (html: string) => html.match(/class="lib-card( is-soldout)?"/g) ?? [];
const order = (html: string, ...names: string[]) => names.map((n) => html.indexOf(n));

describe("lib-product-rail", () => {
  it("renders nothing on the storefront without products", async () => {
    expect(await render({}, { products: [] })).not.toContain('class="lib-section');
    expect(await render({ source: "collection", collection: "missing" })).not.toContain('class="lib-section');
    expect(await render({ source: "tag" })).not.toContain('class="lib-section');
  });

  it("defaults to newest first as a rail, with prev/next buttons and a view-all link", async () => {
    const html = await render({});
    expect(html).toContain('class="lib-section lib-rail is-rail"');
    const [newest, mid, oldest] = order(html, "New dress", "Mid scarf", "Old linen");
    expect(newest).toBeLessThan(mid);
    expect(mid).toBeLessThan(oldest);
    expect(html).toContain("New arrivals");
    expect(html.match(/class="lib-rail-btn"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Next products"');
    expect(html).toContain('href="/products" class="lib-rail-all">View all');
    expect(html).toContain('href="/products/old-linen" class="lib-card-link"');
    expect(html).toContain("/api/image-transform");
    expect(html).toContain("<h2");
  });

  it("filters by collection id, tag (case-insensitive) and the picked product order", async () => {
    const collection = await render({ source: "collection", collection: "c1" });
    expect(collection).toContain("Old linen");
    expect(collection).toContain("New dress");
    expect(collection).not.toContain("Mid scarf");
    expect(collection).toContain("Featured products");

    const tag = await render({ source: "tag", tag: " SUMMER " });
    expect(cards(tag)).toHaveLength(1);
    expect(tag).toContain("Old linen");

    const picked = await render({ source: "product_list", product_list: ["c", "missing", "old-linen", "c"] });
    expect(cards(picked)).toHaveLength(2);
    const [first, second] = order(picked, "New dress", "Old linen");
    expect(first).toBeLessThan(second);
    expect(picked).not.toContain("Mid scarf");
  });

  it("clamps the limit and renders the grid style with its column variables", async () => {
    expect(cards(await render({ limit: 2 }))).toHaveLength(2);
    expect(cards(await render({ limit: 999 }))).toHaveLength(3);
    const grid = await render({ style: "grid", columns_desktop: 3, columns_mobile: 9, image_ratio: "1-1", view_all_link: "" });
    expect(grid).toContain('class="lib-section lib-rail is-grid"');
    expect(grid).toContain("--lib-rail-cols:3;--lib-rail-cols-m:2;--lib-card-ratio:1/1");
    expect(grid).not.toContain('class="lib-rail-btn"');
    expect(grid).not.toContain('class="lib-rail-all"');
  });

  it("badges discounts and sold-out cards, and offers quick-add only on buyable cards", async () => {
    const html = await render({});
    expect(html).toContain('class="lib-card-badge" dir="ltr">-20%');
    expect(html).toContain('class="lib-card is-soldout"');
    expect(html).toContain('class="lib-card-badge is-soldout">Sold out');
    expect(html.match(/class="lib-card-add"/g)).toHaveLength(2);
    expect(html).toContain('class="lib-card-was"');

    const bare = await render({ show_quick_add: false, show_discount_badge: false });
    expect(bare).not.toContain('class="lib-card-add"');
    expect(bare).not.toContain('class="lib-card-badge" dir="ltr"');
    expect(bare).toContain('class="lib-card-was"');
  });

  it("uses Egyptian Arabic defaults for Arabic stores", async () => {
    const html = await render({}, { locale: "ar" });
    expect(html).toContain("وصل جديد");
    expect(html).toContain("شوف الكل");
    expect(html).toContain("أضف للسلة");
    expect(html).toContain("خلصت الكمية");
    expect(html).toContain('aria-label="المنتجات اللي بعد"');
    expect(await render({ source: "tag", tag: "sale" }, { locale: "ar" })).toContain("اخترنالك");
  });

  it("reserves the space with skeleton cards while products load on the client", async () => {
    const html = await render({ limit: 4 }, { products: null });
    expect(html.match(/class="lib-rail-ghost"/g)).toHaveLength(4);
    expect(html).toContain('aria-busy="true"');
    expect(cards(html)).toHaveLength(0);
  });
});
