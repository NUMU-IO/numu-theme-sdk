"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NAVIGATE_EVENT } from "../components/Link";
import {
  availableValues,
  defaultVariant,
  findVariantByOptions,
} from "../utils/variants";
import { publishVariantSelection } from "../utils/selectionRegistry";
import type { Product, ProductVariant } from "../types/entities";

export interface UseVariantSelection {
  /** Currently-selected axis → value map. */
  selection: Record<string, string>;
  /** The variant matching the current selection, if any. */
  variant: ProductVariant | null;
  /** Pick a value on one axis. Other axes stay locked. */
  select: (axis: string, value: string) => void;
  /** Reset the selection (e.g. on "Choose another" button). */
  reset: () => void;
  /**
   * For each unselected axis, the set of values that lead to at
   * least one in-stock variant given the current locked axes.
   * Themes use this to grey out swatches.
   */
  availability: Record<string, Set<string>>;
  /**
   * True when every option axis on the product has a chosen value
   * and `variant` is resolved. Buy buttons should disable until
   * this flips to true on products with options.
   */
  isComplete: boolean;
}

/**
 * Hook that owns variant-axis selection state for a PDP.
 *
 * Initial state auto-selects the default variant's axis values so
 * the PDP loads with a coherent price + image + buy state, matching
 * Shopify's behavior. Themes that prefer "Choose your size" empty
 * state can pass `autoSelect: false`.
 */
export function useVariantSelection(
  product: Pick<Product, "options" | "variants"> & { id?: string },
  opts: { autoSelect?: boolean } = {},
): UseVariantSelection {
  const autoSelect = opts.autoSelect ?? true;

  const initial = useMemo<Record<string, string>>(() => {
    if (!autoSelect) return {};
    const dv = defaultVariant(product);
    if (!dv) return {};
    const opts = dv.option_values || dv.options || {};
    return { ...opts };
  }, [product, autoSelect]);

  const [selection, setSelection] = useState<Record<string, string>>(initial);

  const select = useCallback((axis: string, value: string) => {
    setSelection((prev) => ({ ...prev, [axis]: value }));
  }, []);

  const reset = useCallback(() => setSelection({}), []);

  const variant = useMemo(
    () => findVariantByOptions(product, selection),
    [product, selection],
  );

  // Mirror the live selection into the module registry so AddToCartButton
  // can attach it to the cart write even when no variant row matches
  // (legacy products: axes in attributes JSON, placeholder variant with
  // empty option_values). Themes pass full product objects, so `id` is
  // present in practice; the widened param type keeps this non-breaking.
  useEffect(() => {
    publishVariantSelection(product.id, selection);
  }, [product.id, selection]);

  // `?variant=<id>` (a Back in Stock alert's link, an ad's deep link, a cart
  // line) picks that variant. After mount, so the server render and the first
  // client render agree; keyed on the product id alone, so a theme that
  // rebuilds the product object each render never undoes the shopper's own
  // pick.
  //
  // A soft navigation (the SDK <Link>) or back/forward to THIS product with
  // another `?variant=` keeps the page mounted, so a mount-time read alone left
  // the old variant on screen — tapping the "M" line of a bag while on the "S"
  // page did nothing. Those re-read the target URL too. An id that is not one
  // of this product's variants (a link to another product) changes nothing,
  // and neither does a URL with no `?variant=`.
  const latest = useRef(product);
  useEffect(() => {
    latest.current = product;
  }, [product]);
  useEffect(() => {
    const pick = (search: string) => {
      const id = new URLSearchParams(search).get("variant");
      const chosen = id ? latest.current.variants?.find((v) => String(v.id) === id) : undefined;
      const values = chosen?.option_values || chosen?.options;
      if (values && Object.keys(values).length > 0) setSelection({ ...values });
    };
    const onNavigate = (e: Event) => {
      const href = (e as CustomEvent<{ href?: unknown }>).detail?.href;
      if (typeof href !== "string") return;
      try {
        pick(new URL(href, window.location.href).search);
      } catch {
        // Not a URL — nothing to read.
      }
    };
    const onPopState = () => pick(window.location.search);
    pick(window.location.search);
    window.addEventListener(NAVIGATE_EVENT, onNavigate);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener(NAVIGATE_EVENT, onNavigate);
      window.removeEventListener("popstate", onPopState);
    };
  }, [product.id]);

  const availability = useMemo(
    () => availableValues(product, selection),
    [product, selection],
  );

  const isComplete = useMemo(() => {
    const axes = product.options || [];
    if (axes.length === 0) return true;
    return axes.every((a) => Boolean(selection[a.name]));
  }, [product, selection]);

  return { selection, variant, select, reset, availability, isComplete };
}
