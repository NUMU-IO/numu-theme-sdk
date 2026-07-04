/**
 * Live variant-picker selection registry.
 *
 * `useVariantSelection` publishes its current axis→value map here keyed by
 * product id; `AddToCartButton` reads it back at click time. This is what
 * lets the selection reach the cart even when no real variant row matches —
 * legacy products keep their axes in attributes JSON with a single
 * placeholder variant whose option_values is {}, so `findVariantByOptions`
 * returns null and there'd otherwise be nothing to send.
 *
 * Module-scoped (not React context) on purpose: the hook instance lives in
 * the theme's PDP section while the button may be a sibling — they share no
 * provider of ours. Bounded: one entry per product id, last write wins.
 */

const selections = new Map<string, Record<string, string>>();

export function publishVariantSelection(
  productId: string | undefined | null,
  selection: Record<string, string>,
): void {
  if (!productId) return;
  selections.set(productId, selection);
}

/** Latest non-empty selection for a product, or null. */
export function readVariantSelection(
  productId: string | undefined | null,
): Record<string, string> | null {
  if (!productId) return null;
  const sel = selections.get(productId);
  if (!sel) return null;
  const filtered: Record<string, string> = {};
  for (const [k, v] of Object.entries(sel)) {
    if (v) filtered[k] = v;
  }
  return Object.keys(filtered).length > 0 ? filtered : null;
}
