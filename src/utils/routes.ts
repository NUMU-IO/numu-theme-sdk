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

export function seriesHref(slugOrId: string | undefined | null): string {
  return slugOrId ? `/series/${slugOrId}` : "/products";
}

/**
 * A WhatsApp link from whatever the merchant typed: `01012345678`,
 * `+20 10 1234 5678`, `0020…`, or a whole wa.me / api.whatsapp.com URL.
 * Undefined when there is no usable number.
 *
 * Themes build these inline and only strip non-digits, so a local Egyptian
 * number becomes `wa.me/010…`, which WhatsApp cannot open.
 */
export function whatsappHref(raw: string | undefined | null): string | undefined {
  const value = (raw ?? "").trim();
  if (/^https?:\/\//i.test(value)) return value;
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  // ponytail: a local number (leading 0) is read as Egyptian (+20); use the
  // store's country once non-Egyptian stores rely on this.
  else if (digits.startsWith("0")) digits = `20${digits.slice(1)}`;
  return digits.length >= 8 ? `https://wa.me/${digits}` : undefined;
}
