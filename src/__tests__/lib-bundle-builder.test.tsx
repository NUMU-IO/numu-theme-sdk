// @vitest-environment node
/**
 * lib-bundle-builder — SSR inside the real provider stack, plus the pure
 * selection / add / pricing rules in ./bundle.
 */

import { createElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { describe, expect, it, vi } from "vitest";

import { defineThemeEntry } from "../entry";
import { multibuyOffers } from "../lib/promotions";
import type { ThemeMountContext } from "../mount";
import BundleBuilder from "../sections/lib-bundle-builder/BundleBuilder";
import { addLines, hintOffer, offerQuote, readyLines, sourceProducts, type BundleLine, type Pick } from "../sections/lib-bundle-builder/bundle";
import type { Product, ProductVariant, Store } from "../types/entities";
import type { ActivePromotion } from "../types/promotions";
import type { SectionInstance, ThemeSettingsV3 } from "../types/theme";

async function render(settings: Record<string, unknown>, { locale = "en", products = PRODUCTS }: { locale?: string; products?: unknown[] } = {}) {
  const instance = { type: "lib-bundle-builder", settings } as SectionInstance;
  const entry = defineThemeEntry(() => createElement("main", null, createElement(BundleBuilder, { instance, sectionId: "bb-0" })));
  const ctx = {
    themeSettings: { schema_version: 3, theme_id: "library-fixture", global_settings: {}, templates: {}, section_groups: {} } as unknown as ThemeSettingsV3,
    storeData: { id: "s1", name: "Store", slug: "store", currency: "EGP", default_language: locale, use_nextjs_storefront: true } as Store,
    page: { type: "home", data: { products, collections: [] } },
    locale,
    demo: false,
    navigation: {},
  } as ThemeMountContext;
  const { prelude } = await prerenderToNodeStream(entry.createApp(ctx), { progressiveChunkSize: Number.MAX_SAFE_INTEGER });
  let html = "";
  for await (const chunk of prelude) html += chunk;
  return html;
}

const product = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, name: `Product ${id}`, slug: `product-${id}`, price: 250, currency: "EGP", images: [], variants: [], in_stock: true, category_id: "scarves", tags: ["Eid"], ...extra }) as unknown as Product;

const PRODUCTS = ["a", "b", "c", "d", "e", "f"].map((id) => product(id));
const ALL = { source: "tag", tag: "eid" };
const pickButtons = (html: string) => html.match(/class="lib-bb-pick"/g) ?? [];

const variant = (id: string, extra: Partial<ProductVariant> = {}) =>
  ({ id, position: 0, option_values: { Size: id.toUpperCase() }, price: 250, inventory_quantity: 5, is_in_stock: true, ...extra }) as ProductVariant;

const promo = (rule: Record<string, unknown>, extra: Partial<ActivePromotion> = {}): ActivePromotion => ({
  promotion_id: "promo-1",
  discount_rule: { kind: "multibuy", multibuy_quantity: 3, multibuy_price_cents: 65000, ...rule },
  ...extra,
});

describe("lib-bundle-builder SSR", () => {
  it("renders nothing on the storefront without enough products in stock", async () => {
    expect(await render(ALL, { products: [] })).not.toContain('class="lib-section');
    expect(await render({ source: "collection" })).not.toContain('class="lib-section');
    const twoInStock = [product("a"), product("b"), product("c", { in_stock: false })];
    expect(await render(ALL, { products: twoInStock })).not.toContain('class="lib-section');
  });

  it("renders the grid, pick buttons, progress and styles with English defaults", async () => {
    const html = await render(ALL);
    expect(html).toContain('class="lib-section lib-bb is-grid"');
    expect(html).toMatch(/data-href="[^"]*lib-bundle-builder/);
    expect(html).toContain("Build your bundle");
    expect(html).toContain("Pick 3 products and add them to your bag in one go.");
    expect(pickButtons(html)).toHaveLength(6);
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(6);
    expect(html).toContain('Picked <span dir="ltr">0</span> of <span dir="ltr">3</span>');
    expect(html).toContain('role="status" aria-live="polite"');
    // Nothing picked: the add button waits, and no price is promised.
    expect(html).toMatch(/class="lib-bb-add" disabled=""/);
    expect(html).not.toContain('class="lib-bb-was"');
    expect(html).not.toContain('class="lib-bb-hint"');
    expect(html).toContain("<h2");
  });

  it("renders the sticky style and clamps the pick count", async () => {
    const sticky = await render({ ...ALL, style: "sticky", pick_count: 9, subheading: "" });
    expect(sticky).toContain('class="lib-section lib-bb is-sticky"');
    expect(sticky).toMatch(/<span dir="ltr">6<\/span>/);
    expect(sticky).not.toContain('class="lib-muted lib-bb-sub"');
    expect(await render({ ...ALL, style: "nope", pick_count: 1 })).toContain('class="lib-section lib-bb is-grid"');
  });

  it("speaks Egyptian Arabic for an Arabic store", async () => {
    const html = await render({ ...ALL, pick_count: 2 }, { locale: "ar" });
    expect(html).toContain("كوّن باقتك");
    expect(html).toContain("اختار منتجين وضيفهم للسلة مرة واحدة.");
    expect(html).toContain("ضيف الباقة للسلة");
    expect(html).toContain(">اختار</button>");
    expect(html).toContain("اخترت ");
  });

  it("offers only the source products, in the merchant's order", async () => {
    const html = await render({ source: "product_list", product_list: ["c", "missing", "product-a", "b"] });
    expect(pickButtons(html)).toHaveLength(3);
    expect(html.indexOf("Product c")).toBeLessThan(html.indexOf("Product a"));
    expect(html).not.toContain("Product d");
  });
});

describe("lib-bundle-builder sources", () => {
  it("filters by collection id, tag and product list", () => {
    const pool = [product("a", { category_id: "c1", tags: ["Summer"] }), product("b", { category_id: "c2", tags: null })];
    const opts = { source: "collection", collection: "c1", tag: "", productList: undefined };
    expect(sourceProducts(pool, opts).map((p) => p.id)).toEqual(["a"]);
    expect(sourceProducts(pool, { ...opts, collection: "" })).toEqual([]);
    expect(sourceProducts(pool, { ...opts, source: "tag", tag: " summer " }).map((p) => p.id)).toEqual(["a"]);
    expect(sourceProducts(pool, { ...opts, source: "product_list", productList: ["b", "a", "b", 7] }).map((p) => p.id)).toEqual(["b", "a"]);
  });
});

describe("lib-bundle-builder selection", () => {
  const listed = product("a");

  it("is not ready until every pick is complete and resolved", () => {
    expect(readyLines([{ product: listed, variants: [] }], 2)).toBeNull();
    // A list payload's variants are unknown until the detail arrives.
    expect(readyLines([{ product: listed, variants: null }], 1)).toBeNull();
  });

  it("never produces a line without a variant id for a product with several variants", () => {
    const variants = [variant("s"), variant("m", { price: 300 })];
    expect(readyLines([{ product: listed, variants }], 1)).toBeNull();
    const [line] = readyLines([{ product: listed, variants, variantId: "m" }], 1)!;
    expect(line).toMatchObject({ productId: "a", variantId: "m", label: "M", price: 300, key: "a:m" });
    expect(readyLines([{ product: listed, variants, variantId: "gone" }], 1)).toBeNull();
  });

  it("uses the only variant automatically and no variant id for a product without variants", () => {
    expect(readyLines([{ product: listed, variants: [variant("one")] }], 1)![0]).toMatchObject({ variantId: "one", label: "" });
    expect(readyLines([{ product: listed, variants: [] }], 1)![0]).toMatchObject({ variantId: undefined, key: "a:" });
  });
});

describe("lib-bundle-builder adding", () => {
  const line = (id: string, variantId?: string): BundleLine => ({ key: `${id}:${variantId ?? ""}`, productId: id, variantId, name: id, label: "", price: 1 });

  it("adds each line with its variant id, one at a time and in order", async () => {
    const log: string[] = [];
    const addItem = vi.fn(async (productId: string, variantId?: string, quantity?: number) => {
      log.push(`start ${productId}:${variantId}:${quantity}`);
      await new Promise((r) => setTimeout(r, 5));
      log.push(`end ${productId}`);
      return { ok: true, status: 200 };
    });
    const results = await addLines(addItem, [line("a", "v1"), line("b")]);
    expect(log).toEqual(["start a:v1:1", "end a", "start b:undefined:1", "end b"]);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it("reports refused and thrown adds, and a retry skips lines already added", async () => {
    const addItem = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: false, status: 409, message: "Only 1 left" })
      .mockRejectedValueOnce(new Error("offline"));
    const results = await addLines(addItem, [line("a"), line("b"), line("c")]);
    expect(results.map((r) => [r.line.productId, r.ok, r.message])).toEqual([
      ["a", true, undefined],
      ["b", false, "Only 1 left"],
      ["c", false, undefined],
    ]);

    const retry = vi.fn(async () => ({ ok: true, status: 200 }));
    await addLines(retry, [line("a"), line("b"), line("c")], ["a:"]);
    expect(retry.mock.calls.map((c) => c[0])).toEqual(["b", "c"]);
  });
});

describe("lib-bundle-builder pricing", () => {
  const picks = (...prices: number[]): Pick[] => prices.map((price, i) => ({ product: product(`p${i}`, { price }), variants: [] }));

  it("quotes no discount without a matching active promotion", () => {
    expect(offerQuote([], picks(250, 250, 250))).toBeNull();
    expect(offerQuote(multibuyOffers([promo({ multibuy_quantity: 2 })]), picks(250, 250, 250))).toBeNull();
    expect(offerQuote(multibuyOffers([promo({}, { surface: "automatic" })]).map((o) => ({ ...o, quantity: 4 })), picks(250, 250, 250))).toBeNull();
  });

  it("quotes the group price when the engine would apply it to exactly these picks", () => {
    const quote = offerQuote(multibuyOffers([promo({})]), picks(250, 250, 300));
    expect(quote).toMatchObject({ regular: 800, total: 650 });
    expect(quote!.offer.promotionId).toBe("promo-1");
  });

  it("never quotes a price above regular, outside the offer scope, or past the rule's limits", () => {
    expect(offerQuote(multibuyOffers([promo({})]), picks(200, 200, 200))).toBeNull();
    const scoped = multibuyOffers([promo({}, { eligible_category_ids: ["scarves"] })]);
    const outside: Pick[] = [...picks(250, 250), { product: product("x", { category_id: "shoes" }), variants: [] }];
    expect(offerQuote(scoped, outside)).toBeNull();
    expect(offerQuote(scoped, picks(250, 250, 250))).toMatchObject({ total: 650 });
    expect(offerQuote(multibuyOffers([promo({ max_discount_cents: 5000 })]), picks(250, 250, 250))).toMatchObject({ total: 700 });
    expect(offerQuote(multibuyOffers([promo({ min_subtotal_cents: 100000 })]), picks(250, 250, 250))).toBeNull();
    // Tier ladders are grouped by the engine across tiers: no promise.
    expect(offerQuote(multibuyOffers([promo({ multibuy_tiers: [{ quantity: 2, price_cents: 45000 }] })]), picks(250, 250, 250))).toBeNull();
  });

  it("advertises an offer only when enough in-stock eligible products beat its price", () => {
    const offers = multibuyOffers([promo({})]);
    expect(hintOffer(offers, 3, PRODUCTS)?.promotionId).toBe("promo-1");
    expect(hintOffer(offers, 2, PRODUCTS)).toBeNull();
    expect(hintOffer(offers, 3, [product("a", { price: 100 }), product("b", { price: 100 }), product("c", { price: 100 })])).toBeNull();
    expect(hintOffer(offers, 3, [product("a"), product("b"), product("c", { in_stock: false })])).toBeNull();
  });
});
