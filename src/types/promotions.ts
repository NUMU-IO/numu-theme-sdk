/**
 * Storefront promotion types — the shape the platform serves to every theme.
 *
 * Source of truth is the backend's offers-v2 engine. The host proxies it at
 * `GET /api/storefront/promotions`, which returns the visitor's active
 * promotions grouped by surface. Themes only ever *render* these; the engine
 * decides what a cart costs, and the same engine runs at checkout. A theme
 * that computes its own discount is telling the shopper a number the server
 * will overrule.
 *
 * ⚠️ Every `*_cents` field here is in INTEGER CENTS, straight off the API —
 * unlike `Cart`, which the SDK normalizes to major units. Convert with the
 * helpers in `lib/promotions` rather than dividing ad hoc; a missed
 * conversion is a silent 100x error.
 */

/** One step of a tiered "spend X, get Y%" rule. */
export interface DiscountTier {
  threshold_cents: number;
  percent: number;
}

/**
 * The math behind a promotion. `kind` is an open string union on purpose:
 * the platform adds kinds over time and older themes must degrade quietly
 * rather than crash on one they've never heard of.
 */
export interface DiscountRule {
  kind:
    | "percentage"
    | "fixed"
    | "free_shipping"
    | "bogo"
    | "tiered"
    | "multibuy"
    | (string & {});
  value_cents?: number | null;
  value_percent?: number | null;
  min_subtotal_cents?: number | null;
  max_discount_cents?: number | null;
  buy_quantity?: number | null;
  get_quantity?: number | null;
  get_discount_percent?: number | null;
  tiers?: DiscountTier[];
  /** MULTIBUY: how many eligible items form one group (N). */
  multibuy_quantity?: number | null;
  /** MULTIBUY: the fixed total price for one complete group (P), in cents. */
  multibuy_price_cents?: number | null;
}

/** A promotion resolved as active for the current visitor. */
export interface ActivePromotion {
  promotion_id: string;
  surface?: string;
  priority?: number;
  content?: Record<string, unknown>;
  translated_content?: {
    headline?: Record<string, string>;
    body?: Record<string, string>;
    [key: string]: unknown;
  };
  discount_rule?: DiscountRule | null;
  coupon_code?: string | null;
  /**
   * Which catalog entries can take part in the rule. BOTH EMPTY (or absent,
   * on an older backend) means the whole store qualifies.
   *
   * Needed so a scoped offer doesn't lie: without it a "3 for EGP 650 on
   * scarves" offer counts every cart unit, and a shopper holding one
   * ineligible item is told "add 2 more" and then doesn't get the discount.
   */
  eligible_product_ids?: string[];
  eligible_category_ids?: string[];
}

/** The `/api/storefront/promotions` payload, grouped by surface. */
export interface ActivePromotionsPayload {
  announcement_bars?: ActivePromotion[];
  popups?: ActivePromotion[];
  floating_widgets?: ActivePromotion[];
  cookie_banner?: ActivePromotion | null;
  /** Automatic (no code needed) discounts — where multibuy offers live. */
  auto_discounts?: ActivePromotion[];
  discount_codes_visible?: ActivePromotion[];
}

/**
 * A validated multibuy offer, normalized for display.
 *
 * `groupPriceMajor` is in MAJOR units (EGP, not piastres) so it can go
 * straight into `<Money>` / `formatMoney` — the conversion happened once,
 * here, rather than in each theme.
 */
export interface MultibuyOffer {
  promotionId: string;
  /** N — how many items make a group. */
  quantity: number;
  /** P in cents, as the engine stores it. */
  groupPriceCents: number;
  /** P in major units, ready to render. */
  groupPriceMajor: number;
  /** Merchant's bilingual headline, when they set one. */
  headline?: Record<string, string>;
  /** Products the offer is scoped to. Empty (with categories) = whole store. */
  eligibleProductIds: string[];
  /** Categories the offer is scoped to. Empty (with products) = whole store. */
  eligibleCategoryIds: string[];
  /** True when the offer applies to the entire catalogue. */
  isStoreWide: boolean;
  raw: ActivePromotion;
}

/** Where a shopper stands against one multibuy offer. */
export interface OfferProgress {
  /** Eligible units currently in the cart. */
  unitsInCart: number;
  /** How many more units to complete the next group. 0 = just unlocked. */
  unitsNeeded: number;
  /** Complete groups the cart has already earned. */
  groupsUnlocked: number;
  /**
   * What the engine says this offer actually saved, in MAJOR units. Read
   * from `cart.applied_promotions` — never recomputed, so the number the
   * shopper reads is the number they are charged.
   */
  savingMajor: number;
}
