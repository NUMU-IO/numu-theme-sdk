/**
 * ProductAppSlot — where installed apps render on the product page.
 *
 * Every store gets this markup the moment the host serves the new SDK, so the
 * case that matters most is the empty one: a store without the app, or a
 * position no app uses yet, must render nothing at all — not even a wrapper.
 */

import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocalizationContext, ShopContext, type LocalizationState } from "../contexts";
import { ProductAppSlot, type ProductAppSlotPosition } from "../components/ProductAppSlot";
import { resetNotifyConfig } from "../components/apps/NotifyMe";
import type { Product, ProductVariant, Store } from "../types/entities";

const SOLD_OUT = { id: "v-m", option_values: { Size: "M" }, is_in_stock: false } as ProductVariant;
const IN_STOCK = { id: "v-l", option_values: { Size: "L" }, is_in_stock: true } as ProductVariant;
const PRODUCT = { id: "p1", name: "Tee", in_stock: true, variants: [SOLD_OUT, IN_STOCK] } as unknown as Product;

function slot(
  position: ProductAppSlotPosition,
  { apps = ["back-in-stock"], variant = SOLD_OUT, product = PRODUCT }: { apps?: string[]; variant?: ProductVariant | null; product?: Product } = {},
) {
  const store = { id: "s1", installed_apps: apps.map((slug) => ({ slug, settings: {} })) } as unknown as Store;
  const l10n = { locale: "en", direction: "ltr", translations: {} } as unknown as LocalizationState;
  const wrap = (children: ReactNode) => (
    <ShopContext.Provider value={store}>
      <LocalizationContext.Provider value={l10n}>{children}</LocalizationContext.Provider>
    </ShopContext.Provider>
  );
  return render(wrap(<ProductAppSlot position={position} product={product} variant={variant} />)).container;
}

beforeEach(() => {
  resetNotifyConfig();
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"contact":"phone_or_email"}')));
});

afterEach(() => vi.unstubAllGlobals());

describe("ProductAppSlot", () => {
  it("renders nothing on a store without the app", () => {
    expect(slot("after_buy", { apps: [] }).innerHTML).toBe("");
    expect(slot("after_buy", { apps: ["reviews"] }).innerHTML).toBe("");
  });

  it("after_buy shows the notify-me form for a sold-out variant", () => {
    expect(slot("after_buy").querySelector(".numu-notify")).not.toBeNull();
  });

  it("after_buy is empty while the chosen variant can be bought", () => {
    expect(slot("after_buy", { variant: IN_STOCK }).innerHTML).toBe("");
  });

  it("with no variant chosen, the product's own stock decides", () => {
    expect(slot("after_buy", { variant: null }).innerHTML).toBe("");
    const soldOut = { ...PRODUCT, in_stock: false } as Product;
    expect(slot("after_buy", { variant: null, product: soldOut }).querySelector(".numu-notify")).not.toBeNull();
  });

  it("an overselling product never offers the form", () => {
    const oversell = { ...PRODUCT, attributes: { continue_selling_when_out_of_stock: true } } as unknown as Product;
    expect(slot("after_buy", { product: oversell }).innerHTML).toBe("");
  });

  it.each(["below_title", "before_buy"] as const)("%s is empty until an app uses it", (position) => {
    expect(slot(position).innerHTML).toBe("");
  });

  it("an unknown position from an untyped theme renders nothing", () => {
    expect(slot("sidebar" as ProductAppSlotPosition).innerHTML).toBe("");
  });
});
