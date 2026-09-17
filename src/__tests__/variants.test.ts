/**
 * Tests for the variant availability helpers.
 *
 * `availableValues` shipped with no test at all, which is how its JSDoc came to
 * describe one thing ("values that lead to at least one in-stock variant") while
 * the code computed another (combination reachability — it never read a stock
 * field). Every `line-through` and `opacity-50` "sold out" style across the
 * fleet was rendering that mislabelled set, so a genuinely sold-out variant was
 * an ordinary clickable option and the shopper found out at Add to cart.
 *
 * The two-axis fixtures matter more than usual here: ZERO multi-axis products
 * exist on either live store, so this file is the only place the multi-axis
 * paths are exercised at all.
 */

import { describe, expect, it } from "vitest";

import {
  continuesSelling,
  isSoldOut,
  productBuyable,
  variantBuyable,
} from "../utils/availability";
import { availableValues, valueStates } from "../utils/variants";
import type { Product, ProductVariant } from "../types/entities";

function variant(
  option_values: Record<string, string>,
  overrides: Partial<ProductVariant> = {},
): ProductVariant {
  return {
    id: Object.values(option_values).join("-") || "default",
    position: 0,
    option_values,
    price: 100,
    inventory_quantity: 1,
    is_in_stock: true,
    ...overrides,
  } as ProductVariant;
}

function product(
  options: Product["options"],
  variants: ProductVariant[],
  extra: Partial<Product> = {},
): Parameters<typeof valueStates>[0] {
  return { options, variants, ...extra } as Parameters<typeof valueStates>[0];
}

/** Size x Color, with the one combination a shopper trips over. */
const TWO_AXIS = product(
  [
    { name: "Size", position: 0, values: ["S", "M"] },
    { name: "Color", position: 1, values: ["Red", "Blue", "Green"] },
  ],
  [
    variant({ Size: "S", Color: "Red" }),
    variant({ Size: "S", Color: "Blue" }),
    variant({ Size: "M", Color: "Red" }),
    // M/Blue exists but is sold out; M/Green was never made.
    variant({ Size: "M", Color: "Blue" }, { is_in_stock: false, inventory_quantity: 0 }),
  ],
);

describe("valueStates", () => {
  it("separates out-of-stock from unreachable on a two-axis product", () => {
    const states = valueStates(TWO_AXIS, { Size: "M" });
    expect(states.Color).toEqual({
      Red: "buyable",
      Blue: "out_of_stock", // the variant exists, it has no stock
      Green: "unreachable", // no M/Green variant was ever made
    });
  });

  it("answers per axis with the other axes held at the selection", () => {
    // Under Size=S both colours are buyable; the M-only problems vanish.
    expect(valueStates(TWO_AXIS, { Size: "S" }).Color).toEqual({
      Red: "buyable",
      Blue: "buyable",
      Green: "unreachable",
    });
  });

  it("still answers for an axis that is itself selected", () => {
    // The PDP auto-selects every axis on first render. If this only answered
    // for UNSELECTED axes the map would be permanently empty there, and a
    // sold-out size would render as an ordinary clickable chip.
    const states = valueStates(TWO_AXIS, { Size: "M", Color: "Blue" });
    // Each axis is answered with the OTHER axis held at the selection, so this
    // reads "with Blue chosen, which sizes can I buy?" — S yes, M no, because
    // M/Blue is the sold-out row. M being buyable in Red is a different
    // question, and answering it here is what would let a shopper click
    // straight into a combination that cannot be sold.
    expect(states.Size).toEqual({ S: "buyable", M: "out_of_stock" });
    expect(states.Color.Blue).toBe("out_of_stock");
  });

  it("treats an axis no variant describes as unknown, not sold out", () => {
    // The legacy shape: axes derived from `attributes.variants`, with a single
    // placeholder variant carrying no option_values.
    const legacy = product(
      [{ name: "Color", position: 0, values: ["Taupe", "Cafe"] }],
      [variant({}, { id: "placeholder" })],
    );
    expect(valueStates(legacy, {})).toEqual({
      Color: { Taupe: "buyable", Cafe: "buyable" },
    });
  });

  it("honours continue_selling_when_out_of_stock", () => {
    const oversell = product(
      [{ name: "Size", position: 0, values: ["S"] }],
      [variant({ Size: "S" }, { is_in_stock: false, inventory_quantity: 0 })],
      { attributes: { continue_selling_when_out_of_stock: true } } as Partial<Product>,
    );
    expect(valueStates(oversell, {}).Size.S).toBe("buyable");
  });

  it("returns an empty map for a product with no axes", () => {
    expect(valueStates(product([], [variant({})]), {})).toEqual({});
  });
});

describe("availableValues", () => {
  it("now excludes a sold-out value — the regression it was meant to catch", () => {
    const available = availableValues(TWO_AXIS, { Size: "M" });
    expect(available.Color.has("Red")).toBe(true);
    expect(available.Color.has("Blue")).toBe(false); // exists, no stock
    expect(available.Color.has("Green")).toBe(false); // never made
  });

  it("keeps returning a Set per axis so existing themes need no change", () => {
    const available = availableValues(TWO_AXIS, {});
    expect(available.Size).toBeInstanceOf(Set);
    expect(available.Color).toBeInstanceOf(Set);
  });

  it("keeps every declared value when the axis is untracked", () => {
    const legacy = product(
      [{ name: "Color", position: 0, values: ["Taupe", "Cafe"] }],
      [variant({}, { id: "placeholder" })],
    );
    expect([...availableValues(legacy, {}).Color]).toEqual(["Taupe", "Cafe"]);
  });
});

describe("availability helpers", () => {
  it("reads both spellings of the overselling flag", () => {
    expect(continuesSelling({ attributes: { continue_selling_when_out_of_stock: true } })).toBe(true);
    expect(continuesSelling({ attributes: { continueSellingWhenOutOfStock: true } })).toBe(true);
    expect(continuesSelling({ attributes: {} })).toBe(false);
    expect(continuesSelling(null)).toBe(false);
  });

  it("treats a missing stock flag as buyable, not as sold out", () => {
    // The listing payload is thinner than the detail one. Hiding a buyable
    // product because a field was absent is the more expensive error.
    expect(productBuyable({})).toBe(true);
    expect(productBuyable({ in_stock: false })).toBe(false);
    expect(variantBuyable({}, { id: "v" })).toBe(true);
  });

  it("lets the product-level overselling flag lift a variant-level sold out", () => {
    const attrs = { attributes: { continue_selling_when_out_of_stock: true } };
    const soldOutRow = { id: "v", is_in_stock: false };
    // This disagreement is what made an overselling product show a buyable card
    // and a greyed-out Add to cart at the same time.
    expect(variantBuyable(attrs, soldOutRow)).toBe(true);
    expect(isSoldOut(attrs, soldOutRow)).toBe(false);
  });

  it("does not grey out the buy button before an axis is chosen", () => {
    expect(isSoldOut({ in_stock: true }, null)).toBe(false);
    expect(isSoldOut({ in_stock: false }, null)).toBe(true);
  });
});
