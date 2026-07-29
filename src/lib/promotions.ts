/**
 * Pure helpers for rendering platform promotions in a theme.
 *
 * These are headless by design — data and logic only, zero markup and zero
 * styling — so every theme keeps its own look while sharing one correct
 * implementation of the fiddly parts (unit counting, group math, the
 * cents→major boundary).
 *
 * The hard rule these encode: **a theme never computes a discount.** The
 * engine prices the cart and reports what it saved; helpers here only
 * describe progress toward an offer and format what the engine already
 * decided. Anything else eventually renders a number the server won't honour.
 */

import type { Cart } from "../types/entities";
import { centsToMajor } from "../utils/money";
import type {
  ActivePromotion,
  ActivePromotionsPayload,
  MultibuyOffer,
  OfferProgress,
} from "../types/promotions";

/**
 * Extract the usable multibuy offers ("any N for a fixed total P").
 *
 * Accepts either the whole `/api/storefront/promotions` payload or just an
 * array of promotions, so callers don't have to reach into `auto_discounts`
 * themselves. Anything that isn't a well-formed multibuy — a kind this SDK
 * version doesn't know, a missing N or P — is skipped rather than thrown on:
 * a theme built before a rule kind existed must keep rendering when a
 * merchant starts using it.
 */
export function multibuyOffers(
  promotions: ActivePromotionsPayload | ActivePromotion[] | null | undefined,
): MultibuyOffer[] {
  if (!promotions) return [];
  const list: ActivePromotion[] = Array.isArray(promotions)
    ? promotions
    : (promotions.auto_discounts ?? []);

  const offers: MultibuyOffer[] = [];
  for (const promo of list) {
    const rule = promo?.discount_rule;
    if (!rule || rule.kind !== "multibuy") continue;
    const quantity = rule.multibuy_quantity;
    const groupPriceCents = rule.multibuy_price_cents;
    // Both are required by the engine; a rule missing either is malformed
    // data, not an offer we should advertise.
    if (typeof quantity !== "number" || quantity < 2) continue;
    if (typeof groupPriceCents !== "number" || groupPriceCents <= 0) continue;
    const eligibleProductIds = promo.eligible_product_ids ?? [];
    const eligibleCategoryIds = promo.eligible_category_ids ?? [];
    offers.push({
      promotionId: promo.promotion_id,
      quantity,
      groupPriceCents,
      groupPriceMajor: centsToMajor(groupPriceCents),
      headline: promo.translated_content?.headline,
      eligibleProductIds,
      eligibleCategoryIds,
      // No scoping rows at all ⇒ every product qualifies. Note an older
      // backend that doesn't send these fields also lands here, which is the
      // right default: counting everything is what themes did before.
      isStoreWide:
        eligibleProductIds.length === 0 && eligibleCategoryIds.length === 0,
      raw: promo,
    });
  }
  return offers;
}

/**
 * Does this product take part in the offer?
 *
 * A store-wide offer includes everything. Otherwise the product must be named
 * directly or sit in a named category. A scoped offer over a product whose
 * `category_id` we don't know returns false — better to under-promise than to
 * advertise a discount the server won't apply.
 */
export function offerIncludesProduct(
  offer: MultibuyOffer | null | undefined,
  product: { id?: string; product_id?: string; category_id?: string | null },
): boolean {
  if (!offer) return false;
  if (offer.isStoreWide) return true;
  const id = product?.product_id ?? product?.id;
  if (id && offer.eligibleProductIds.includes(id)) return true;
  const category = product?.category_id;
  return Boolean(category && offer.eligibleCategoryIds.includes(category));
}

/**
 * How many cart UNITS actually qualify for the offer.
 *
 * Units, not lines — three of one product is a valid trio, the way the engine
 * scores it. For a scoped offer this is what the nudge must count; counting
 * the whole cart is how a shopper gets told "add 2 more" and then doesn't get
 * the discount.
 */
export function eligibleUnitsInCart(
  offer: MultibuyOffer | null | undefined,
  cart: Cart | null | undefined,
): number {
  if (!offer) return 0;
  return (cart?.items ?? []).reduce((sum, item) => {
    if (!item) return sum;
    if (!offerIncludesProduct(offer, item)) return sum;
    return sum + (item.quantity || 0);
  }, 0);
}

/**
 * Where the cart stands against one multibuy offer.
 *
 * Counts UNITS, not lines — three of the same product is a valid trio, the
 * same way the engine scores it. `savingMajor` is read from the cart's
 * engine-supplied `applied_promotions`, so an unlocked offer shows the real
 * saving and a theme can never drift from the charged amount.
 *
 * Scoping is handled automatically: when the offer names products or
 * categories, only qualifying units are counted (via `eligibleUnitsInCart`).
 * Pass `eligibleUnits` explicitly to override that — e.g. when the theme has
 * a better source of truth than the cart lines.
 */
export function offerProgress(
  offer: MultibuyOffer | null | undefined,
  cart: Cart | null | undefined,
  eligibleUnits?: number,
): OfferProgress {
  const empty: OfferProgress = {
    unitsInCart: 0,
    unitsNeeded: 0,
    groupsUnlocked: 0,
    savingMajor: 0,
  };
  if (!offer) return empty;

  const unitsInCart =
    typeof eligibleUnits === "number"
      ? Math.max(0, eligibleUnits)
      : eligibleUnitsInCart(offer, cart);

  const groupsUnlocked = Math.floor(unitsInCart / offer.quantity);
  const remainder = unitsInCart % offer.quantity;
  // 0 when the cart just completed a group — "add N more" would be noise
  // right after an unlock. The theme decides whether to nudge for the next
  // group; the number here stays honest about the current one.
  const unitsNeeded = remainder === 0 ? 0 : offer.quantity - remainder;

  // The engine's own number, already in major units (normalizeCartFromServer
  // converted it). Matching on promotion id keeps a stacked cart honest.
  const applied = (cart?.applied_promotions ?? []).find(
    (p) => p && p.id === offer.promotionId,
  );

  return {
    unitsInCart,
    unitsNeeded,
    groupsUnlocked,
    savingMajor: applied ? applied.amount || 0 : 0,
  };
}

/**
 * Should a product page advertise this offer?
 *
 * Only when N of this product actually costs more than the group price —
 * otherwise the "deal" is worse than just buying them, and §5 of the offer
 * spec forbids advertising it (the engine likewise refuses to apply it).
 *
 * @param unitPriceMajor the product's price in MAJOR units, as a theme has it
 */
export function offerBeatsRegularPrice(
  offer: MultibuyOffer | null | undefined,
  unitPriceMajor: number | null | undefined,
): boolean {
  if (!offer || typeof unitPriceMajor !== "number" || unitPriceMajor <= 0) {
    return false;
  }
  // Compare in cents to dodge float drift on prices like 249.99.
  const unitCents = Math.round(unitPriceMajor * 100);
  return unitCents * offer.quantity > offer.groupPriceCents;
}
