/**
 * Availability — the one place that decides whether something can be bought.
 *
 * ## The bug this file exists to close
 *
 * The platform answers "is this in stock?" at TWO levels and, until this
 * existed, they disagreed:
 *
 *   • `product.in_stock` is `quantity > 0` **OR** the merchant's
 *     `attributes.continue_selling_when_out_of_stock` flag. Turn the flag on
 *     and the product is buyable at any quantity — that is the whole point of
 *     it.
 *   • `variant.is_in_stock` is a bare `inventory_quantity > 0`. The flag lives
 *     on the PRODUCT and a variant row has no way to see it.
 *
 * So on an overselling product the card reads "buyable" (product level) and the
 * PDP reads "Sold out" (variant level) for the same item — which is exactly the
 * inverted behaviour a shopper reports as "the in-stock one won't add and the
 * out-of-stock one will". The API folds the flag into the variant summary it
 * serializes; this module folds it in again at the read site so a theme stays
 * correct against a payload that predates that fix (bundles are CDN artifacts
 * and outlive any single API deploy) and against the 60s ISR window right
 * after it.
 *
 * ## Read this, never `product.in_stock` / `variant.is_in_stock`
 *
 * Every surface — card, PDP, quick-add sheet, sticky bar, listing facet — has
 * to give the same answer, or the shopper meets a control that lies. Two of
 * those surfaces reading the raw field is how they drifted the first time.
 *
 * Lifted into the SDK from the teen theme, which was the only theme that had
 * noticed. Sixteen themes inherit the fix rather than hand-rolling sixteen
 * partial copies of it — two already had, with two incompatible results.
 */

import type { Product, ProductVariant } from "../types/entities";

/** A variant as it may actually arrive — both spellings, both optional. */
export type LooseVariant = Pick<ProductVariant, "id"> &
  Partial<Pick<ProductVariant, "is_in_stock" | "in_stock" | "inventory_quantity">>;

/** The narrow shape these helpers actually read off a product. */
type LooseProduct = Partial<Pick<Product, "in_stock" | "attributes">>;

/**
 * Has the merchant opted into overselling this product?
 *
 * `attributes` is forwarded verbatim from the backend, so the key is the
 * backend's own snake_case. The camelCase spelling is accepted too because the
 * merchant hub has written both over the life of the field, and a product saved
 * under the old one would silently lose its override.
 */
export function continuesSelling(product: LooseProduct | null | undefined): boolean {
  const attrs = (product?.attributes ?? {}) as Record<string, unknown>;
  return Boolean(
    attrs.continue_selling_when_out_of_stock ?? attrs.continueSellingWhenOutOfStock,
  );
}

/**
 * Can this product be bought at all?
 *
 * `in_stock === false` is the only sold-out signal — a MISSING flag means the
 * endpoint didn't send one (the listing payload is thinner than the detail
 * one), and hiding a buyable product because a field was absent is the more
 * expensive of the two errors.
 */
export function productBuyable(product: LooseProduct | null | undefined): boolean {
  if (!product) return false;
  if (continuesSelling(product)) return true;
  return product.in_stock !== false;
}

/**
 * Can this specific variant be bought?
 *
 * Same "unknown is not unavailable" rule as above: a variant row that carries
 * neither spelling of the flag is treated as buyable rather than greyed out.
 */
export function variantBuyable(
  product: LooseProduct | null | undefined,
  variant: LooseVariant | null | undefined,
): boolean {
  if (continuesSelling(product)) return true;
  if (!variant) return productBuyable(product);
  return variant.is_in_stock ?? variant.in_stock ?? true;
}

/**
 * The single answer for a PDP: the product AND the chosen variant.
 *
 * With no variant chosen yet the product's own answer stands — greying out Add
 * to cart before the shopper has picked a size would make every multi-variant
 * product look sold out on first paint.
 */
export function isSoldOut(
  product: LooseProduct | null | undefined,
  variant: LooseVariant | null | undefined,
): boolean {
  if (!productBuyable(product)) return true;
  return variant ? !variantBuyable(product, variant) : false;
}
