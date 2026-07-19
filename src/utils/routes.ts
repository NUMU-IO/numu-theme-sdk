/**
 * Storefront route builders.
 *
 * The storefront's URL shape is platform knowledge, not theme knowledge: a
 * theme that hardcodes `/products/${slug}` has quietly taken a dependency on
 * the host's routing, and every copy of that template is a place the fleet can
 * disagree with the host. Centralising the templates here means a route change
 * is one edit rather than a fleet-wide grep.
 *
 * Hoisted out of the themes' `sections/_shared.ts`, where `productHref` was
 * hand-copied into 4 themes and their 4 scaffold templates.
 */

/**
 * Link to a product detail page.
 *
 * Falls back to the product index when there's no identifier, so a card built
 * from incomplete data links somewhere useful instead of `/products/undefined`.
 */
export function productHref(slugOrId: string | undefined | null): string {
  if (!slugOrId) return "/products";
  return `/products/${slugOrId}`;
}

/**
 * Link to a collection page.
 *
 * Prefers the slug and falls back to the id, because a category with no slug
 * is common in practice and the bare template produces `/collections/undefined`
 * — a 404 the merchant sees as a broken menu item. Accepts either a category
 * object or a plain slug string so call sites don't have to unpack first.
 */
export function collectionHref(
  category: string | { slug?: string | null; id?: string | null } | null | undefined,
): string {
  if (!category) return "/collections";
  if (typeof category === "string") {
    return category ? `/collections/${category}` : "/collections";
  }
  const key = category.slug || category.id;
  return key ? `/collections/${key}` : "/collections";
}
