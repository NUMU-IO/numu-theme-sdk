/**
 * Variant resolution helpers — Phase 8.1.
 *
 * Themes render a variant picker (Size + Color radios), then ask the
 * SDK "given my current selection, which variant is it?" The matching
 * variant's id is what add-to-cart sends.
 */

import type { Product, ProductVariant } from "../types/entities";

/**
 * Pick the variant that exactly matches the given option_values map.
 * Returns null when no variant matches — themes render that as
 * "Combination unavailable" or a disabled buy button.
 */
export function findVariantByOptions(
  product: Pick<Product, "variants">,
  selection: Record<string, string>,
): ProductVariant | null {
  const variants = product.variants || [];
  if (variants.length === 0) return null;
  // Single-variant products (no axes): the only variant matches the
  // empty selection trivially.
  if (variants.length === 1 && Object.keys(selection).length === 0) {
    return variants[0];
  }
  for (const v of variants) {
    const opts = v.option_values || v.options || {};
    const matches = Object.entries(selection).every(
      ([axis, value]) => opts[axis] === value,
    );
    if (matches && Object.keys(selection).length === Object.keys(opts).length) {
      return v;
    }
  }
  return null;
}

/**
 * Find the "default" variant — the one the PDP should auto-select on
 * first render. Prefers the first in-stock variant; falls back to the
 * first variant if all are out of stock (so the picker still shows
 * something coherent).
 */
export function defaultVariant(product: Pick<Product, "variants">): ProductVariant | null {
  const variants = product.variants || [];
  if (variants.length === 0) return null;
  const inStock = variants.find((v) => v.is_in_stock || v.in_stock);
  return inStock || variants[0];
}

/**
 * Given a partial selection (e.g. just Size=M, no Color yet), return
 * the set of values still available on each unselected axis. Themes
 * use this to disable swatches whose paired variants are all out of
 * stock for the current selection.
 */
export function availableValues(
  product: Pick<Product, "options" | "variants">,
  selection: Record<string, string>,
): Record<string, Set<string>> {
  const axes = product.options || [];
  const variants = product.variants || [];
  const out: Record<string, Set<string>> = {};
  for (const axis of axes) {
    const set = new Set<string>();
    for (const v of variants) {
      const opts = v.option_values || v.options || {};
      // Only consider variants compatible with the locked-in part of
      // the selection (every locked axis must match this variant).
      const compatible = Object.entries(selection).every(
        ([k, val]) => k === axis.name || opts[k] === val,
      );
      if (compatible && opts[axis.name]) {
        set.add(opts[axis.name]);
      }
    }
    // When NO variant carries option-value data for this axis, availability
    // is UNKNOWN — not "all sold out". This happens for legacy products whose
    // axes live in `attributes.variants` (derived into `options`) but have no
    // SKU-tracked variant rows, so every `variant.option_values` is empty.
    // Falling back to the axis's declared values keeps the picker usable
    // instead of rendering every swatch struck-through. A genuinely
    // constrained axis (≥1 variant with data) keeps its computed set.
    out[axis.name] = set.size > 0 ? set : new Set(axis.values || []);
  }
  return out;
}
