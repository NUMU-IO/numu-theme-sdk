"use client";

import { useCallback, useMemo, useState } from "react";
import {
  availableValues,
  defaultVariant,
  findVariantByOptions,
} from "../utils/variants";
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
  product: Pick<Product, "options" | "variants">,
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
