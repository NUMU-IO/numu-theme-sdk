/**
 * Variant resolution helpers — Phase 8.1.
 *
 * Themes render a variant picker (Size + Color radios), then ask the
 * SDK "given my current selection, which variant is it?" The matching
 * variant's id is what add-to-cart sends.
 */

import type { Product, ProductVariant } from "../types/entities";
import { variantBuyable } from "./availability";

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
 * How a single option value should be treated, given the current selection.
 *
 * Three states, because the fleet shipped with two and the two were mislabelled:
 *
 *   • `buyable`     — at least one variant matches and can be bought.
 *   • `out_of_stock`— a variant exists for this combination, with no stock.
 *   • `unreachable` — no variant exists for it at all, given the locked axes.
 *
 * `out_of_stock` and `unreachable` are different sentences to a shopper ("back
 * soon" vs "doesn't come that way") and want different treatments, so they are
 * not collapsed here.
 */
export type ValueState = "buyable" | "out_of_stock" | "unreachable";

/**
 * Per-axis, per-value state given the current (possibly partial) selection.
 *
 * Asked per value with the OTHER axes held at the current selection, so it
 * stays correct on a PDP that auto-selects every axis on first render — the
 * common case, and the one a "which values are left on the UNSELECTED axes"
 * reading answers with an empty map.
 *
 * An axis whose variants carry no `option_values` data at all is UNKNOWN, not
 * sold out: every value comes back `buyable`. That is the legacy shape, where
 * axes are derived from `attributes.variants` and the product has no
 * SKU-tracked variant rows. Rendering that as a row of struck-through swatches
 * would be a confident lie.
 */
export function valueStates(
  product: Pick<Product, "options" | "variants"> & Partial<Pick<Product, "in_stock" | "attributes">>,
  selection: Record<string, string>,
): Record<string, Record<string, ValueState>> {
  const axes = product.options || [];
  const variants = product.variants || [];
  const out: Record<string, Record<string, ValueState>> = {};

  for (const axis of axes) {
    const states: Record<string, ValueState> = {};
    // Does ANY variant describe this axis? If not, availability is unknowable
    // and every declared value stays clickable.
    const axisIsTracked = variants.some((v) => {
      const opts = v.option_values || v.options || {};
      return Boolean(opts[axis.name]);
    });

    for (const value of axis.values || []) {
      if (!axisIsTracked) {
        states[value] = "buyable";
        continue;
      }
      // Hold every OTHER axis at the current selection and probe this value.
      const probe = { ...selection, [axis.name]: value };
      const matching = variants.filter((v) => {
        const opts = v.option_values || v.options || {};
        return Object.entries(probe).every(([k, val]) => opts[k] === val);
      });
      if (matching.length === 0) states[value] = "unreachable";
      else if (matching.some((v) => variantBuyable(product, v))) states[value] = "buyable";
      else states[value] = "out_of_stock";
    }
    out[axis.name] = states;
  }
  return out;
}

/**
 * Given a selection, the set of values on each axis that can actually be BOUGHT.
 *
 * ## What changed, and why a theme may see more struck-through swatches
 *
 * This used to read only `option_values` and the axis's declared values, never
 * `is_in_stock` / `in_stock` / `inventory_quantity` — so it computed combination
 * REACHABILITY while its own JSDoc, and every theme rendering it as `line-through`
 * or `opacity-50`, claimed it meant "sold out". A genuinely sold-out variant
 * rendered as an ordinary clickable option and the shopper found out at Add to
 * cart. It now means what it always said it meant.
 *
 * Kept returning `Record<string, Set<string>>` so the 19 themes reading it need
 * no change. Themes wanting to tell "out of stock" from "doesn't exist" apart
 * should read {@link valueStates} instead.
 */
export function availableValues(
  product: Pick<Product, "options" | "variants"> & Partial<Pick<Product, "in_stock" | "attributes">>,
  selection: Record<string, string>,
): Record<string, Set<string>> {
  const states = valueStates(product, selection);
  const out: Record<string, Set<string>> = {};
  for (const [axis, values] of Object.entries(states)) {
    out[axis] = new Set(
      Object.entries(values)
        .filter(([, state]) => state === "buyable")
        .map(([value]) => value),
    );
  }
  return out;
}
