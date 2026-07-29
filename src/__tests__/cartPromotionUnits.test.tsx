/**
 * WS2 — the cents→major boundary for cart promotions. The 100x guard.
 *
 * `normalizeCartFromServer` is the SDK's ONE conversion point for cart
 * money. The backend sends integer cents; themes render with
 * `<Money>`/`formatMoney`, which take major units. `subtotal`, `total` and
 * `discount_amount` have always been converted here — the offers-v2 fields
 * had to join them, because they arrive in cents *next to already-converted
 * totals*.
 *
 * If that regresses, nothing crashes and no test elsewhere goes red: every
 * theme just renders "you saved EGP 10,000" beside a total of EGP 650. That
 * is the single highest-value assertion in this workstream, so it is tested
 * through the real provider (fetch → unwrapCart → normalize → useCart)
 * rather than against the private function, which is not exported.
 *
 * ⚠️ NAMING: the wire field is `automatic_discount_cents` (cents); the
 * theme-facing `Cart` field is **`automatic_discount`** (major). The rename
 * is the point — a `_cents` name holding pounds is the easiest possible way
 * to get a double-divide into a theme. These tests assert the theme sees the
 * NEW name with the CONVERTED value.
 *
 * The absent-stays-absent half matters just as much: when an older backend
 * omits the field it must stay ABSENT — not 0, not NaN — or a theme guarding
 * with `cart.automatic_discount ? …` starts rendering a phantom
 * "EGP 0.00 saved" row on every store still on the old API.
 *
 * React.createElement, no JSX — matches the SDK's no-build test setup.
 */

import { createElement, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NuMuProvider } from "../components/NuMuProvider";
import { useCart } from "../hooks/useCart";
import type { Cart, Store } from "../types/entities";
import type { ThemeSettingsV3 } from "../types/theme";

const store = {
  id: "s1",
  name: "Vionne",
  slug: "vionne",
  currency: "EGP",
  default_language: "en",
  use_nextjs_storefront: true,
} as Store;

const themeSettings = {
  schema_version: 3,
  theme_id: "vionne-v3",
  global_settings: {},
  templates: {},
  section_groups: {},
} as unknown as ThemeSettingsV3;

/**
 * The cart exactly as `numu-storefront`'s `adaptCart` hands it over:
 * envelope unwrapped by the host, field names mapped, money still in CENTS,
 * and the wire name `automatic_discount_cents` still in place.
 */
function serverCart(extra: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "c1",
    items: [
      {
        id: "l1",
        product_id: "p1",
        name: "Printed Modal Scarf",
        price: 25_000, // cents
        quantity: 3,
        category_id: "8f1a0000-0000-0000-0000-0000000000cc",
      },
    ],
    subtotal: 75_000, // cents
    total: 65_000, // cents
    currency: "EGP",
    ...extra,
  };
}

function mockCartFetch(body: Record<string, unknown>) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/cart")) {
        return Promise.resolve(
          new Response(JSON.stringify({ data: body }), { status: 200 }),
        );
      }
      // currencies / customer / anything else the provider primes.
      return Promise.resolve(
        new Response(JSON.stringify({ data: null }), { status: 200 }),
      );
    });
}

function wrapper({ children }: { children: ReactNode }) {
  return createElement(NuMuProvider, { store, themeSettings }, children);
}

async function loadCart(body: Record<string, unknown>): Promise<Cart> {
  mockCartFetch(body);
  const { result } = renderHook(() => useCart(), { wrapper });
  await waitFor(() => expect(result.current.cart.items.length).toBe(1));
  return result.current.cart;
}

/** The raw wire fields, for assertions about what must NOT reach a theme. */
function asRaw(cart: Cart): Record<string, unknown> {
  return cart as unknown as Record<string, unknown>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

// --------------------------------------------------------------------------
// The 100x guard
// --------------------------------------------------------------------------

describe("normalizeCartFromServer — offers-v2 cents→major", () => {
  it("exposes automatic_discount (major) and converts every promotion amount", async () => {
    const cart = await loadCart(
      serverCart({
        automatic_discount_cents: 10_000,
        discount_amount: 10_000,
        applied_promotions: [
          {
            id: "trio",
            title: "3 for EGP 650",
            title_ar: "٣ قطع بـ ٦٥٠ ج.م",
            amount: 10_000,
          },
        ],
      }),
    );

    expect(cart.automatic_discount).toBe(100);
    expect(cart.applied_promotions?.[0].amount).toBe(100);
  });

  it("lands the saving on the same scale as the totals beside it", async () => {
    // The regression this catches renders "saved EGP 10,000" next to a
    // EGP 650 total. The arithmetic has to close, not just the units.
    const cart = await loadCart(
      serverCart({
        automatic_discount_cents: 10_000,
        discount_amount: 10_000,
        applied_promotions: [{ id: "trio", title: "Trio", amount: 10_000 }],
      }),
    );

    expect(cart.subtotal).toBe(750);
    expect(cart.total).toBe(650);
    expect(cart.discount_amount).toBe(100);
    expect(cart.automatic_discount).toBe(100);
    expect(cart.subtotal - cart.automatic_discount!).toBe(cart.total);
    expect(cart.applied_promotions!.reduce((s, p) => s + p.amount, 0)).toBe(
      cart.automatic_discount,
    );
  });

  it("converts every entry when two promotions stacked", async () => {
    const cart = await loadCart(
      serverCart({
        automatic_discount_cents: 16_500,
        applied_promotions: [
          { id: "trio", title: "Trio", amount: 10_000 },
          { id: "welcome", title: "Welcome 10%", amount: 6_500 },
        ],
      }),
    );

    expect(cart.applied_promotions?.map((p) => p.amount)).toEqual([100, 65]);
    expect(cart.automatic_discount).toBe(165);
  });

  it("preserves the non-money fields on each entry", async () => {
    const cart = await loadCart(
      serverCart({
        automatic_discount_cents: 10_000,
        applied_promotions: [
          {
            id: "trio",
            title: "3 for EGP 650",
            title_ar: "٣ قطع بـ ٦٥٠ ج.م",
            amount: 10_000,
          },
        ],
      }),
    );

    expect(cart.applied_promotions?.[0]).toEqual({
      id: "trio",
      title: "3 for EGP 650",
      title_ar: "٣ قطع بـ ٦٥٠ ج.م",
      amount: 100,
    });
  });

  it("converts a sub-pound saving without rounding it away", async () => {
    const cart = await loadCart(
      serverCart({
        automatic_discount_cents: 1,
        applied_promotions: [{ id: "x", title: "One piastre", amount: 1 }],
      }),
    );

    expect(cart.automatic_discount).toBe(0.01);
    expect(cart.applied_promotions?.[0].amount).toBe(0.01);
  });
});

// --------------------------------------------------------------------------
// The rename: one name, one unit
// --------------------------------------------------------------------------

describe("normalizeCartFromServer — the renamed field", () => {
  it("strips the raw wire name so the 100x value is unreachable", async () => {
    // `normalizeCartFromServer` destructures `automatic_discount_cents` OUT
    // of the spread instead of merely adding the converted field beside it.
    // Without that, BOTH names survive 100x apart — and the unconverted one
    // carries the name a theme dev reaches for first (it's the name used by
    // the backend response, by `adaptCart`, and throughout the offers docs).
    // TypeScript can't catch that read because the field isn't on `Cart`, so
    // it would only bite JS themes and `as any` reads: most of the fleet's
    // promo code, including vionne's theme-local `_promotions.ts`.
    const cart = await loadCart(
      serverCart({
        automatic_discount_cents: 10_000,
        applied_promotions: [{ id: "trio", title: "Trio", amount: 10_000 }],
      }),
    );

    // Exactly one name, holding exactly one unit.
    expect(cart.automatic_discount).toBe(100);
    expect(asRaw(cart).automatic_discount_cents).toBeUndefined();
    expect("automatic_discount_cents" in (cart as object)).toBe(false);
  });

  it("keeps applied_promotions[].amount in major units (not renamed)", async () => {
    const cart = await loadCart(
      serverCart({
        automatic_discount_cents: 10_000,
        applied_promotions: [{ id: "trio", title: "Trio", amount: 10_000 }],
      }),
    );
    // Documented asymmetry: `amount` is major on Cart, cents on Order.
    expect(cart.applied_promotions?.[0].amount).toBe(100);
  });
});

// --------------------------------------------------------------------------
// Absent must stay absent — no phantom EGP 0.00 on older backends
// --------------------------------------------------------------------------

describe("normalizeCartFromServer — omitted fields stay omitted", () => {
  it("does not invent the offers fields when the server omits them", async () => {
    const cart = await loadCart(serverCart({}));

    expect("automatic_discount" in cart).toBe(false);
    expect("applied_promotions" in cart).toBe(false);
    expect(cart.automatic_discount).toBeUndefined();
    expect(cart.applied_promotions).toBeUndefined();
    // …and specifically NOT the two values that would render a phantom row.
    expect(cart.automatic_discount).not.toBe(0);
    expect(cart.automatic_discount).not.toBeNaN();
  });

  it("still converts the pre-existing money fields on an old-shaped cart", async () => {
    const cart = await loadCart(serverCart({}));
    expect(cart.subtotal).toBe(750);
    expect(cart.total).toBe(650);
  });

  it("keeps discount_amount independent of the offers fields", async () => {
    // A legacy coupon cart: discount_amount present, offers fields absent.
    const cart = await loadCart(serverCart({ discount_amount: 15_000 }));
    expect(cart.discount_amount).toBe(150);
    expect("automatic_discount" in cart).toBe(false);
  });

  it("an explicit 0 from the server is preserved as 0, not dropped", async () => {
    // The backend always sends these now (defaults to 0), so this is the
    // boundary between "no offer fired" (0) and "old backend" (absent).
    const cart = await loadCart(
      serverCart({ automatic_discount_cents: 0, applied_promotions: [] }),
    );
    expect(cart.automatic_discount).toBe(0);
    expect("automatic_discount" in cart).toBe(true);
    expect(cart.applied_promotions).toEqual([]);
  });

  it("a non-array applied_promotions is ignored rather than crashing", async () => {
    const cart = await loadCart(
      serverCart({ applied_promotions: { id: "oops" } }),
    );
    // The guard is `Array.isArray`; a malformed payload must not reach a
    // theme's `.map()`.
    expect(Array.isArray(cart.applied_promotions)).toBe(false);
    expect(cart.items).toHaveLength(1); // cart still usable
  });
});

// --------------------------------------------------------------------------
// CartItem.category_id — the scoped-offer hint
// --------------------------------------------------------------------------

describe("normalizeCartFromServer — line category_id", () => {
  it("survives normalization so offerProgress can count eligible units", async () => {
    const cart = await loadCart(serverCart({}));
    expect(cart.items[0].category_id).toBe(
      "8f1a0000-0000-0000-0000-0000000000cc",
    );
  });

  it("is simply absent when the host didn't forward one", async () => {
    const body = serverCart({});
    delete (body.items as Record<string, unknown>[])[0].category_id;
    const cart = await loadCart(body);
    expect(cart.items[0].category_id).toBeUndefined();
    expect(cart.items[0].price).toBe(250); // the rest of the line still maps
  });
});
