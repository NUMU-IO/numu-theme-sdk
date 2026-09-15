/**
 * lib-bundle-builder — the pure parts: which products to offer, when a pick is
 * ready for the cart, how lines are added, and what an offer really charges.
 *
 * Pricing rule: nothing here invents a discount. An offer price is quoted only
 * from an active automatic multibuy promotion ("any N for P") — the same rule
 * the offers engine applies in the cart and at checkout — and only when the
 * engine would apply it to exactly these picks. Otherwise the regular total.
 */

import { cardPrice, inStock } from "../../commerce/core";
import type { CartMutationResult } from "../../contexts";
import { offerBeatsRegularPrice, offerIncludesProduct } from "../../lib/promotions";
import type { Product, ProductVariant } from "../../types/entities";
import type { MultibuyOffer } from "../../types/promotions";

export interface Pick {
  product: Product;
  /** `null` until the detail record arrives: a list payload's `variants: []` means UNKNOWN. */
  variants: ProductVariant[] | null;
  variantId?: string;
}

export interface BundleLine {
  key: string;
  productId: string;
  variantId?: string;
  name: string;
  /** The chosen option ("M / Black"), empty for a single-variant product. */
  label: string;
  price: number;
}

export function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.min(max, Math.max(min, n));
}

type Listed = Product & { category_id?: string | null };

/**
 * The products a shopper picks from — the same rules as lib-product-rail:
 * collection = exact `category_id` match, tag = case-insensitive, product
 * list = merchant order (ids or slugs, duplicates and missing ids skipped).
 */
export function sourceProducts(
  pool: readonly Product[],
  opts: { source: string; collection: string; tag: string; productList: unknown },
): Product[] {
  const list = pool as Listed[];
  if (opts.source === "tag") {
    const tag = opts.tag.trim().toLowerCase();
    return tag ? list.filter((p) => (p.tags ?? []).some((t) => typeof t === "string" && t.toLowerCase() === tag)) : [];
  }
  if (opts.source === "product_list") {
    const keys = Array.isArray(opts.productList)
      ? [...new Set(opts.productList.filter((k): k is string => typeof k === "string"))]
      : [];
    return keys.map((k) => list.find((p) => p.id === k || p.slug === k)).filter((p): p is Listed => !!p);
  }
  const id = opts.collection;
  return id ? list.filter((p) => p.category_id === id || p.category === id) : [];
}

export function variantLabel(v: ProductVariant): string {
  return Object.values(v.option_values ?? v.options ?? {}).filter(Boolean).join(" / ") || v.name || "";
}

function chosenVariant(pick: Pick): ProductVariant | undefined {
  if (!pick.variants) return undefined;
  return pick.variants.length === 1 ? pick.variants[0] : pick.variants.find((v) => v.id === pick.variantId);
}

/** A pick's unit price in major units: the chosen variant's, else the card price. */
export function pickPrice(pick: Pick): number {
  const v = chosenVariant(pick);
  return cardPrice(v ? { ...pick.product, variants: [v] } : pick.product).price;
}

/**
 * Cart lines for a finished selection, or null while it isn't one: fewer
 * picks than `count`, a detail record still loading, or a product with
 * several variants and none chosen. A product with variants never produces a
 * line without its variant id — that opens a duplicate cart line.
 */
export function readyLines(picks: readonly Pick[], count: number): BundleLine[] | null {
  if (picks.length !== count) return null;
  const lines: BundleLine[] = [];
  for (const pick of picks) {
    if (!pick.variants) return null;
    const v = chosenVariant(pick);
    if (pick.variants.length > 0 && !v) return null;
    lines.push({
      key: `${pick.product.id}:${v?.id ?? ""}`,
      productId: pick.product.id,
      variantId: v?.id,
      name: pick.product.name,
      label: v && pick.variants.length > 1 ? variantLabel(v) : "",
      price: pickPrice(pick),
    });
  }
  return lines;
}

export type AddItem = (productId: string, variantId?: string, quantity?: number) => Promise<CartMutationResult>;

export interface LineResult {
  line: BundleLine;
  ok: boolean;
  message?: string;
}

/**
 * Adds lines one at a time, in order, skipping keys already added by an
 * earlier partly failed attempt (so a retry doesn't double them). Each write
 * returns the whole cart; sequential writes keep the last response the full
 * bundle. A refused add (`ok: false`) or a throw is recorded, not fatal.
 */
export async function addLines(addItem: AddItem, lines: readonly BundleLine[], skip: readonly string[] = []): Promise<LineResult[]> {
  const results: LineResult[] = [];
  for (const line of lines) {
    if (skip.includes(line.key)) continue;
    try {
      const result = await addItem(line.productId, line.variantId, 1);
      results.push(result && result.ok === false ? { line, ok: false, message: result.message } : { line, ok: true });
    } catch {
      results.push({ line, ok: false });
    }
  }
  return results;
}

/**
 * Only single-price multibuys. A rule with `multibuy_tiers` ("2 for X, 3 for
 * Y") is grouped greedily by the engine across tiers, so N picks may not be
 * priced at the N tier.
 * ponytail: tiered multibuys show the regular total; add a tier walk mirroring
 * the engine's `_multibuy` if merchants use tier ladders here.
 */
function singleTier(offer: MultibuyOffer): boolean {
  const tiers = (offer.raw.discount_rule as { multibuy_tiers?: unknown[] } | null | undefined)?.multibuy_tiers;
  return !Array.isArray(tiers) || tiers.length === 0;
}

/** The offer to advertise before picking: N matches, and N eligible in-stock products beat P. */
export function hintOffer(offers: readonly MultibuyOffer[], count: number, products: readonly Product[]): MultibuyOffer | null {
  return (
    offers.find(
      (o) =>
        singleTier(o) &&
        o.quantity === count &&
        products.filter((p) => inStock(p) && offerIncludesProduct(o, p) && offerBeatsRegularPrice(o, cardPrice(p).price)).length >= count,
    ) ?? null
  );
}

/**
 * What these picks cost under an active multibuy, in major units, or null
 * when none applies. Mirrors the engine for one group of exactly N units:
 * every pick in scope, regular total above P (the engine never raises a
 * price), `max_discount_cents` caps the saving. `min_subtotal_cents` is
 * checked against the picks alone, so a fuller cart can only do better.
 * Integer cents throughout.
 */
export function offerQuote(
  offers: readonly MultibuyOffer[],
  picks: readonly Pick[],
): { offer: MultibuyOffer; regular: number; total: number } | null {
  const regularCents = picks.reduce((sum, p) => sum + Math.round(pickPrice(p) * 100), 0);
  for (const offer of offers) {
    if (!singleTier(offer) || offer.quantity !== picks.length) continue;
    if (!picks.every((p) => offerIncludesProduct(offer, p.product))) continue;
    if (regularCents <= offer.groupPriceCents) continue;
    const rule = offer.raw.discount_rule;
    if (typeof rule?.min_subtotal_cents === "number" && regularCents < rule.min_subtotal_cents) continue;
    let saving = regularCents - offer.groupPriceCents;
    if (typeof rule?.max_discount_cents === "number") saving = Math.min(saving, rule.max_discount_cents);
    if (saving <= 0) continue;
    return { offer, regular: regularCents / 100, total: (regularCents - saving) / 100 };
  }
  return null;
}
