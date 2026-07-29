/**
 * WS4 — the promotion display primitives themes import instead of copy.
 *
 * These helpers exist so no theme ever computes a discount. What they may
 * do is describe *progress* toward an offer and normalize the units the
 * platform speaks. Everything asserted here is one of those two jobs:
 *
 *  - `multibuyOffers` must be a filter, never a parser that throws. A theme
 *    bundle compiled today keeps running when the platform ships a rule kind
 *    it has never heard of — that forward-compatibility is the whole reason
 *    `DiscountRule["kind"]` is an open union.
 *  - `offerProgress` counts UNITS (three of one product is a valid trio) and
 *    reads the saving from `cart.applied_promotions` BY PROMOTION ID, so a
 *    cart with two stacked automatics can't attribute one promo's saving to
 *    the other.
 *  - `offerBeatsRegularPrice` is the §5 "never advertise a worse deal" gate,
 *    and it must compare in cents — a float price like 249.99 drifts if you
 *    multiply in major units.
 *
 * No JSX / no DOM: these are pure functions.
 */

import { describe, expect, it } from "vitest";
import {
  multibuyOffers,
  offerProgress,
  offerBeatsRegularPrice,
} from "../lib/promotions";
import type {
  ActivePromotion,
  ActivePromotionsPayload,
  MultibuyOffer,
} from "../types/promotions";
import type { Cart } from "../types/entities";

const N = 3;
const P_CENTS = 65_000; // EGP 650

function promo(
  id: string,
  rule: Record<string, unknown> | null,
  extra: Partial<ActivePromotion> = {},
): ActivePromotion {
  return {
    promotion_id: id,
    surface: "automatic",
    discount_rule: rule as ActivePromotion["discount_rule"],
    ...extra,
  };
}

function trioPromo(id = "trio"): ActivePromotion {
  return promo(
    id,
    {
      kind: "multibuy",
      multibuy_quantity: N,
      multibuy_price_cents: P_CENTS,
    },
    { translated_content: { headline: { en: "3 for EGP 650" } } },
  );
}

function payload(...promotions: ActivePromotion[]): ActivePromotionsPayload {
  return {
    announcement_bars: [promo("bar", null)],
    auto_discounts: promotions,
  };
}

/** A cart in the shape a theme sees it — MAJOR units, post-normalization. */
function cart(
  quantities: number[],
  applied: Cart["applied_promotions"] = [],
): Cart {
  return {
    id: "c1",
    items: quantities.map((quantity, i) => ({
      id: `l${i}`,
      product_id: `p${i}`,
      name: "Scarf",
      price: 250,
      quantity,
    })),
    subtotal: 750,
    total: 650,
    currency: "EGP",
    applied_promotions: applied,
  };
}

// --------------------------------------------------------------------------
// multibuyOffers
// --------------------------------------------------------------------------

describe("multibuyOffers — input shapes", () => {
  it("accepts the full /api/storefront/promotions payload", () => {
    const offers = multibuyOffers(payload(trioPromo()));
    expect(offers).toHaveLength(1);
    expect(offers[0].promotionId).toBe("trio");
  });

  it("accepts a bare array of promotions", () => {
    const offers = multibuyOffers([trioPromo()]);
    expect(offers).toHaveLength(1);
    expect(offers[0].quantity).toBe(N);
  });

  it("returns [] for null / undefined / an empty payload", () => {
    expect(multibuyOffers(null)).toEqual([]);
    expect(multibuyOffers(undefined)).toEqual([]);
    expect(multibuyOffers({})).toEqual([]);
    expect(multibuyOffers([])).toEqual([]);
  });

  it("converts the group price to major units exactly once", () => {
    const [offer] = multibuyOffers([trioPromo()]);
    expect(offer.groupPriceCents).toBe(65_000);
    expect(offer.groupPriceMajor).toBe(650);
    expect(offer.groupPriceMajor).toBe(offer.groupPriceCents / 100);
  });

  it("carries the merchant headline and the raw promotion through", () => {
    const source = trioPromo();
    const [offer] = multibuyOffers([source]);
    expect(offer.headline).toEqual({ en: "3 for EGP 650" });
    expect(offer.raw).toBe(source);
  });
});

describe("multibuyOffers — forward compatibility", () => {
  it("skips kinds this SDK version has never heard of, without throwing", () => {
    // The contract that lets a theme built today survive a rule kind
    // invented next year: unknown ⇒ ignored, not crashed on.
    const future = promo("future", {
      kind: "spend_and_get_a_free_tote_2027",
      mystery_field: { nested: [1, 2, 3] },
    });
    expect(() => multibuyOffers([future])).not.toThrow();
    expect(multibuyOffers([future])).toEqual([]);
  });

  it("ignores the other known kinds", () => {
    const others = [
      promo("a", { kind: "percentage", value_percent: 20 }),
      promo("b", { kind: "fixed", value_cents: 10_000 }),
      promo("c", { kind: "free_shipping" }),
      promo("d", { kind: "bogo", buy_quantity: 2, get_quantity: 1 }),
      promo("e", { kind: "tiered", tiers: [{ threshold_cents: 1, percent: 5 }] }),
    ];
    expect(multibuyOffers(others)).toEqual([]);
  });

  it("picks only the multibuy out of a mixed feed, preserving order", () => {
    const offers = multibuyOffers(
      payload(
        promo("pct", { kind: "percentage", value_percent: 20 }),
        trioPromo("trio-a"),
        promo("odd", { kind: "brand_new_kind" }),
        trioPromo("trio-b"),
      ),
    );
    expect(offers.map((o) => o.promotionId)).toEqual(["trio-a", "trio-b"]);
  });
});

describe("multibuyOffers — malformed rules are skipped, never advertised", () => {
  const bad: Array<[string, Record<string, unknown>]> = [
    ["missing N", { kind: "multibuy", multibuy_price_cents: P_CENTS }],
    ["missing P", { kind: "multibuy", multibuy_quantity: N }],
    ["null N", { kind: "multibuy", multibuy_quantity: null, multibuy_price_cents: P_CENTS }],
    ["null P", { kind: "multibuy", multibuy_quantity: N, multibuy_price_cents: null }],
    ["N = 1", { kind: "multibuy", multibuy_quantity: 1, multibuy_price_cents: P_CENTS }],
    ["N = 0", { kind: "multibuy", multibuy_quantity: 0, multibuy_price_cents: P_CENTS }],
    ["N negative", { kind: "multibuy", multibuy_quantity: -3, multibuy_price_cents: P_CENTS }],
    ["P = 0", { kind: "multibuy", multibuy_quantity: N, multibuy_price_cents: 0 }],
    ["P negative", { kind: "multibuy", multibuy_quantity: N, multibuy_price_cents: -1 }],
    ["N as a string", { kind: "multibuy", multibuy_quantity: "3", multibuy_price_cents: P_CENTS }],
    ["P as a string", { kind: "multibuy", multibuy_quantity: N, multibuy_price_cents: "65000" }],
  ];

  it.each(bad)("skips a rule with %s", (_label, rule) => {
    expect(() => multibuyOffers([promo("x", rule)])).not.toThrow();
    expect(multibuyOffers([promo("x", rule)])).toEqual([]);
  });

  it("N = 2 is the lowest valid group (boundary)", () => {
    const offers = multibuyOffers([
      promo("pair", {
        kind: "multibuy",
        multibuy_quantity: 2,
        multibuy_price_cents: 45_000,
      }),
    ]);
    expect(offers).toHaveLength(1);
    expect(offers[0].quantity).toBe(2);
  });

  it("survives a null rule and a null entry in the list", () => {
    const list = [
      promo("norule", null),
      null as unknown as ActivePromotion,
      trioPromo(),
    ];
    expect(() => multibuyOffers(list)).not.toThrow();
    expect(multibuyOffers(list).map((o) => o.promotionId)).toEqual(["trio"]);
  });
});

// --------------------------------------------------------------------------
// offerProgress
// --------------------------------------------------------------------------

const [TRIO] = multibuyOffers([trioPromo()]);

describe("offerProgress — counts units, not lines", () => {
  it("one line of quantity 3 is a complete trio", () => {
    const p = offerProgress(TRIO, cart([3]));
    expect(p.unitsInCart).toBe(3);
    expect(p.groupsUnlocked).toBe(1);
  });

  it("three lines of quantity 1 count the same as one line of 3", () => {
    expect(offerProgress(TRIO, cart([1, 1, 1]))).toEqual(
      offerProgress(TRIO, cart([3])),
    );
  });

  it("sums quantities across mixed lines", () => {
    expect(offerProgress(TRIO, cart([2, 4, 1])).unitsInCart).toBe(7);
    expect(offerProgress(TRIO, cart([2, 4, 1])).groupsUnlocked).toBe(2);
  });
});

describe("offerProgress — unitsNeeded boundaries", () => {
  it.each([
    [0, 0, 0],
    [1, 2, 0],
    [2, 1, 0],
    [3, 0, 1], // just unlocked — "add 3 more" would be noise
    [4, 2, 1],
    [5, 1, 1],
    [6, 0, 2],
    [7, 2, 2],
  ])(
    "%i units → unitsNeeded %i, groupsUnlocked %i",
    (units, needed, groups) => {
      const p = offerProgress(TRIO, cart(units === 0 ? [] : [units]));
      expect(p.unitsInCart).toBe(units);
      expect(p.unitsNeeded).toBe(needed);
      expect(p.groupsUnlocked).toBe(groups);
    },
  );
});

describe("offerProgress — savingMajor comes from the engine, by id", () => {
  it("reads the entry matching THIS offer, not the first one", () => {
    // Two automatics stacked. If the lookup were positional the trio would
    // render the Welcome promo's saving.
    const withTwo = cart(
      [3],
      [
        { id: "welcome", title: "Welcome 10%", amount: 75 },
        { id: "trio", title: "3 for EGP 650", amount: 100 },
      ],
    );
    expect(offerProgress(TRIO, withTwo).savingMajor).toBe(100);
  });

  it("is 0 when the engine did not apply this offer", () => {
    const other = cart([3], [{ id: "welcome", title: "Welcome", amount: 75 }]);
    expect(offerProgress(TRIO, other).savingMajor).toBe(0);
  });

  it("is 0 when the cart has no applied_promotions at all", () => {
    const bare = { ...cart([3]) };
    delete bare.applied_promotions;
    expect(offerProgress(TRIO, bare).savingMajor).toBe(0);
  });

  it("does NOT re-divide — the cart already arrives in major units", () => {
    // normalizeCartFromServer converted 10000 cents → 100. Anything that
    // divided again here would render "you saved EGP 1".
    const c = cart([3], [{ id: "trio", title: "Trio", amount: 100 }]);
    expect(offerProgress(TRIO, c).savingMajor).toBe(100);
  });
});

describe("offerProgress — degenerate inputs", () => {
  it("returns all zeroes for a null offer", () => {
    expect(offerProgress(null, cart([3]))).toEqual({
      unitsInCart: 0,
      unitsNeeded: 0,
      groupsUnlocked: 0,
      savingMajor: 0,
    });
    expect(offerProgress(undefined, cart([3])).unitsInCart).toBe(0);
  });

  it("treats a null/empty cart as zero units", () => {
    expect(offerProgress(TRIO, null).unitsInCart).toBe(0);
    expect(offerProgress(TRIO, undefined).unitsInCart).toBe(0);
    expect(offerProgress(TRIO, cart([])).unitsInCart).toBe(0);
  });

  it("honours an explicit eligibleUnits override for a scoped offer", () => {
    // Cart has 5 units but only 3 are in the offer's categories — only the
    // server knows that, so the theme passes the count in.
    const p = offerProgress(TRIO, cart([5]), 3);
    expect(p.unitsInCart).toBe(3);
    expect(p.groupsUnlocked).toBe(1);
    expect(p.unitsNeeded).toBe(0);
  });

  it("an eligibleUnits override of 0 wins over a non-empty cart", () => {
    // Boundary: 0 is falsy, so a `||`-style default would silently fall
    // back to counting the whole cart and advertise an unlock that isn't.
    const p = offerProgress(TRIO, cart([5]), 0);
    expect(p.unitsInCart).toBe(0);
    expect(p.groupsUnlocked).toBe(0);
    expect(p.unitsNeeded).toBe(0);
  });

  it("clamps a negative eligibleUnits to 0", () => {
    expect(offerProgress(TRIO, cart([5]), -2).unitsInCart).toBe(0);
  });
});

// --------------------------------------------------------------------------
// offerBeatsRegularPrice
// --------------------------------------------------------------------------

describe("offerBeatsRegularPrice — §5 never advertise a worse deal", () => {
  it("true when N units cost more than the group price", () => {
    expect(offerBeatsRegularPrice(TRIO, 250)).toBe(true); // 750 > 650
  });

  it("FALSE when N units cost exactly the group price (the boundary)", () => {
    // 3 × 216.6667 isn't expressible; use the exact boundary in cents.
    const pair = multibuyOffers([
      promo("pair", {
        kind: "multibuy",
        multibuy_quantity: 2,
        multibuy_price_cents: 50_000,
      }),
    ])[0];
    expect(offerBeatsRegularPrice(pair, 250)).toBe(false); // 500 === 500
  });

  it("false when N units are already cheaper than the group price", () => {
    expect(offerBeatsRegularPrice(TRIO, 200)).toBe(false); // 600 < 650
  });

  it("false for 0, negative and non-numeric prices", () => {
    expect(offerBeatsRegularPrice(TRIO, 0)).toBe(false);
    expect(offerBeatsRegularPrice(TRIO, -250)).toBe(false);
    expect(offerBeatsRegularPrice(TRIO, null)).toBe(false);
    expect(offerBeatsRegularPrice(TRIO, undefined)).toBe(false);
    expect(
      offerBeatsRegularPrice(TRIO, "250" as unknown as number),
    ).toBe(false);
  });

  it("false for a null offer", () => {
    expect(offerBeatsRegularPrice(null, 250)).toBe(false);
    expect(offerBeatsRegularPrice(undefined, 250)).toBe(false);
  });

  it("compares in cents, so float prices don't drift", () => {
    // 249.99 × 3 = 749.9699999999999 in IEEE 754. Rounded to cents it is
    // 24999 × 3 = 74997 > 65000 → the pill shows. The point of the test is
    // that the comparison is exact, not that it happens to be true.
    expect(offerBeatsRegularPrice(TRIO, 249.99)).toBe(true);

    // The float-drift boundary itself: a group price set exactly at
    // 3 × 216.66 = 649.98 must NOT beat the regular price.
    const exact: MultibuyOffer = {
      ...TRIO,
      groupPriceCents: 64_998,
      groupPriceMajor: 649.98,
    };
    expect(offerBeatsRegularPrice(exact, 216.66)).toBe(false);

    // One piastre cheaper per unit and it does.
    expect(offerBeatsRegularPrice(exact, 216.67)).toBe(true);
  });
});
