"use client";

/**
 * Shared commerce core — price, stock and quick-add for product cards
 * (theme-section-base PHASE-7, Wave 2).
 *
 * Generalised from vionne-v3's `_quick-add.tsx` and genova's `lib/price.tsx`.
 * A product does NOT arrive in one shape:
 *
 *   list    (`page.data.products`, `/api/products`) → `variants: []`, `in_stock`
 *   related (`/…/related`)                           → no `variants`, `is_in_stock`
 *   detail  (`/api/storefront/products/{id}`)        → real `variants`, `is_in_stock`
 *
 * `variants: []` on a list payload means UNKNOWN, not "no variants". The cart
 * keys a line by `{product_id}:{variant_id}` (or `{product_id}` without a
 * variant), so adding a product without its variant id opens a second line
 * next to the same product added from its page. Quick-add therefore resolves
 * the variant from the detail endpoint on click before it writes.
 */

import { useEffect, useRef, useState } from "react";

import { requestNavigate } from "../components/Link";
import { useCart } from "../hooks/useCart";
import type { Product } from "../types/entities";
import { productHref } from "../utils/routes";

/** Money arrives as numbers from the storefront's normalizer, as strings (`"30.00"`) raw. */
function toAmount(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** A card's price in MAJOR units, from the first variant when there is one. */
export function cardPrice(product: Product): { price: number; compareAt: number | null } {
  const variant = product.variants?.[0];
  return {
    price: toAmount(variant?.price) ?? toAmount(product.price) ?? 0,
    compareAt: toAmount(variant?.compare_at_price) ?? toAmount(product.compare_at_price),
  };
}

/** True only for a genuine, higher was-price; an equal or lower one is data noise. */
export function isDiscounted(price: number, compareAt: number | null | undefined): boolean {
  return typeof compareAt === "number" && compareAt > price;
}

/** Whole-percent saving, 0 when not discounted. */
export function discountPercent(price: number, compareAt: number | null | undefined): number {
  if (!isDiscounted(price, compareAt)) return 0;
  return Math.round(((compareAt! - price) / compareAt!) * 100);
}

/**
 * Stock across the three payload shapes. Unknown counts as in stock: the cart
 * refuses a sold-out add with a message, while a wrongly greyed card loses a sale.
 */
export function inStock(product: Product): boolean {
  const raw = product as Product & { is_in_stock?: boolean | null; in_stock?: boolean | null };
  const flag = raw.in_stock ?? raw.is_in_stock;
  if (typeof flag === "boolean") return flag;
  const variants = product.variants ?? [];
  return variants.length === 0 || variants.some((v) => v.is_in_stock ?? v.in_stock ?? true);
}

const detailCache = new Map<string, Product>();
const detailInflight = new Map<string, Promise<Product>>();

/**
 * A product's full detail record (variants, options, every image) by id or
 * slug, cached for the life of the page with one in-flight request per key.
 * Rejects on failure, and a failure is not cached, so the next call retries.
 */
export function fetchProductDetail(idOrSlug: string): Promise<Product> {
  const cached = detailCache.get(idOrSlug);
  if (cached) return Promise.resolve(cached);
  const pending = detailInflight.get(idOrSlug);
  if (pending) return pending;

  const task = (async () => {
    try {
      const res = await fetch(`/api/storefront/products/${encodeURIComponent(idOrSlug)}`);
      if (!res.ok) throw new Error(`/api/storefront/products → ${res.status}`);
      const json = (await res.json()) as { data?: unknown } | null;
      // The host route flattens `{ success, data }`; accept the envelope too.
      const body = json && typeof json.data === "object" && json.data !== null ? json.data : json;
      if (!body || typeof body !== "object") throw new Error("/api/storefront/products → empty body");
      detailCache.set(idOrSlug, body as Product);
      return body as Product;
    } finally {
      detailInflight.delete(idOrSlug);
    }
  })();
  detailInflight.set(idOrSlug, task);
  return task;
}

export type QuickAddState = "idle" | "loading" | "added" | "error";

export interface QuickAddOptions {
  /** Called with the detail record when the product has more than one variant. Default: go to the product page. */
  onNeedsOptions?: (detail: Product) => void;
}

export interface QuickAdd {
  state: QuickAddState;
  /** Pass the click event when the button sits inside a card link. */
  add: (event?: { preventDefault(): void; stopPropagation(): void }) => void;
  soldOut: boolean;
  /** The backend's refusal text ("Only 2 left"), when it sent one. */
  failMessage: string | null;
}

/**
 * One-tap add-to-cart for a product card.
 *
 * Never adds a product with variants without a variant id: a list or related
 * payload is resolved through {@link fetchProductDetail} first; one variant is
 * added, several go to `onNeedsOptions` or the product page. "added" shows
 * only when `addItem` resolves `ok !== false` — it resolves `{ ok: false }` on
 * a refused add rather than throwing.
 */
export function useQuickAdd(product: Product, opts: QuickAddOptions = {}): QuickAdd {
  const { addItem } = useCart();
  const [state, setState] = useState<QuickAddState>("idle");
  const [failMessage, setFailMessage] = useState<string | null>(null);
  const busy = useRef(false);
  const soldOut = !inStock(product);

  useEffect(() => {
    if (state !== "added" && state !== "error") return;
    const timer = setTimeout(
      () => {
        setState("idle");
        setFailMessage(null);
      },
      state === "added" ? 2000 : 2500,
    );
    return () => clearTimeout(timer);
  }, [state]);

  const add: QuickAdd["add"] = (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (busy.current || soldOut) return;
    busy.current = true;
    setFailMessage(null);
    setState("loading");
    void (async () => {
      try {
        const detail = product.variants?.length ? product : await fetchProductDetail(product.id);
        const variants = detail.variants ?? [];
        if (variants.length > 1) {
          setState("idle");
          if (opts.onNeedsOptions) {
            opts.onNeedsOptions(detail);
          } else {
            const href = productHref(product.slug || product.id);
            if (!requestNavigate(href) && typeof window !== "undefined") window.location.assign(href);
          }
          return;
        }
        const result = await addItem(product.id, variants[0]?.id, 1);
        if (result && result.ok === false) {
          setFailMessage(result.message || null);
          setState("error");
          return;
        }
        setState("added");
      } catch {
        setState("error");
      } finally {
        busy.current = false;
      }
    })();
  };

  return { state, add, soldOut, failMessage };
}
