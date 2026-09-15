/**
 * Shared commerce core: price/stock helpers over the three product payload
 * shapes, the detail cache, the quick-add state machine, and AddToCartButton's
 * handling of a refused add.
 */

import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cardPrice, discountPercent, fetchProductDetail, inStock, isDiscounted, useQuickAdd } from "../commerce/core";
import { AddToCartButton } from "../components/AddToCartButton";
import { NAVIGATE_EVENT } from "../components/Link";
import { CartContext, type CartContextValue } from "../contexts";
import type { Product } from "../types/entities";

/** `page.data.products`: variants unknown (`[]`), normalized `in_stock`. */
const listed = (over: Record<string, unknown> = {}) =>
  ({ id: "p", name: "Scarf", slug: "scarf", price: 300, currency: "EGP", images: [], variants: [], in_stock: true, ...over }) as unknown as Product;
/** `/…/related`: no `variants`, raw `is_in_stock`, string money. */
const related = (over: Record<string, unknown> = {}) =>
  ({ id: "r", name: "Shawl", slug: "shawl", price: "250.00", compare_at_price: "500.00", images: [], is_in_stock: false, ...over }) as unknown as Product;
const variant = (id: string, over: Record<string, unknown> = {}) => ({ id, price: 280, compare_at_price: 350, is_in_stock: true, option_values: {}, ...over });

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function cart(addItem: CartContextValue["addItem"]) {
  const value = { addItem } as unknown as CartContextValue;
  return ({ children }: { children: ReactNode }) => createElement(CartContext.Provider, { value }, children);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cardPrice / isDiscounted / discountPercent", () => {
  it("reads the first variant, then the product, coercing string money", () => {
    expect(cardPrice(listed({ price: 300, compare_at_price: 400 }))).toEqual({ price: 300, compareAt: 400 });
    expect(cardPrice(related())).toEqual({ price: 250, compareAt: 500 });
    expect(cardPrice(listed({ variants: [variant("v1")] }))).toEqual({ price: 280, compareAt: 350 });
    expect(cardPrice(listed({ price: "abc" }))).toEqual({ price: 0, compareAt: null });
  });

  it("counts only a higher compare-at as a discount, in whole percent", () => {
    expect(isDiscounted(300, 400)).toBe(true);
    expect(isDiscounted(300, 300)).toBe(false);
    expect(isDiscounted(300, null)).toBe(false);
    expect(discountPercent(300, 400)).toBe(25);
    expect(discountPercent(200, 300)).toBe(33);
    expect(discountPercent(300, 200)).toBe(0);
  });
});

describe("inStock", () => {
  it("handles list, related and detail shapes, and treats unknown as in stock", () => {
    expect(inStock(listed({ in_stock: false }))).toBe(false);
    expect(inStock(related())).toBe(false);
    expect(inStock(related({ is_in_stock: true }))).toBe(true);
    const detail = { id: "d", name: "D", slug: "d", images: [] } as unknown as Product;
    expect(inStock({ ...detail, variants: [variant("a", { is_in_stock: false }), variant("b")] } as unknown as Product)).toBe(true);
    expect(inStock({ ...detail, variants: [variant("a", { is_in_stock: false })] } as unknown as Product)).toBe(false);
    expect(inStock(detail)).toBe(true);
  });
});

describe("fetchProductDetail", () => {
  it("dedupes in-flight requests, caches, and unwraps { data }", async () => {
    const fetchMock = vi.fn(async () => json({ success: true, data: { id: "fd-1", variants: [variant("v1")] } }));
    vi.stubGlobal("fetch", fetchMock);
    const [a, b] = await Promise.all([fetchProductDetail("fd-1"), fetchProductDetail("fd-1")]);
    expect(a).toBe(b);
    expect(a.variants[0].id).toBe("v1");
    await fetchProductDetail("fd-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/storefront/products/fd-1");
  });

  it("accepts a bare product, and does not cache a failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ error: "upstream_error" }, 502))
      .mockResolvedValueOnce(json({ id: "fd-2", variants: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchProductDetail("fd-2")).rejects.toThrow("502");
    await expect(fetchProductDetail("fd-2")).resolves.toMatchObject({ id: "fd-2" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("useQuickAdd", () => {
  const ok = () => vi.fn(async () => ({ ok: true, status: 200 }));

  async function click(result: { current: ReturnType<typeof useQuickAdd> }, event?: { preventDefault(): void; stopPropagation(): void }) {
    await act(async () => {
      result.current.add(event);
    });
  }

  it("adds a single-variant detail product with its variant id, without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const addItem = ok();
    const product = listed({ id: "qa-1", variants: [variant("v1")] });
    const { result } = renderHook(() => useQuickAdd(product), { wrapper: cart(addItem) });
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    await click(result, event);
    await waitFor(() => expect(result.current.state).toBe("added"));
    expect(addItem).toHaveBeenCalledWith("qa-1", "v1", 1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it("resolves a listing product's variant from the detail endpoint before adding", async () => {
    const fetchMock = vi.fn(async () => json({ id: "qa-2", variants: [variant("v9")] }));
    vi.stubGlobal("fetch", fetchMock);
    const addItem = ok();
    const { result } = renderHook(() => useQuickAdd(listed({ id: "qa-2" })), { wrapper: cart(addItem) });
    await click(result);
    await waitFor(() => expect(result.current.state).toBe("added"));
    expect(fetchMock).toHaveBeenCalledWith("/api/storefront/products/qa-2");
    expect(addItem).toHaveBeenCalledWith("qa-2", "v9", 1);
  });

  it("hands a multi-variant product to onNeedsOptions and never adds it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ data: { id: "qa-3", variants: [variant("s"), variant("m")] } })));
    const addItem = ok();
    const onNeedsOptions = vi.fn();
    const { result } = renderHook(() => useQuickAdd(related({ id: "qa-3", is_in_stock: true }), { onNeedsOptions }), { wrapper: cart(addItem) });
    await click(result);
    await waitFor(() => expect(onNeedsOptions).toHaveBeenCalledTimes(1));
    expect(onNeedsOptions.mock.calls[0][0].variants).toHaveLength(2);
    expect(addItem).not.toHaveBeenCalled();
    expect(result.current.state).toBe("idle");
  });

  it("navigates to the product page when no onNeedsOptions is given", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ id: "qa-4", variants: [variant("s"), variant("m")] })));
    const hrefs: string[] = [];
    const claim = (e: Event) => {
      e.preventDefault();
      hrefs.push((e as CustomEvent<{ href: string }>).detail.href);
    };
    window.addEventListener(NAVIGATE_EVENT, claim);
    const addItem = ok();
    const { result } = renderHook(() => useQuickAdd(listed({ id: "qa-4", slug: "wide-leg" })), { wrapper: cart(addItem) });
    await click(result);
    await waitFor(() => expect(hrefs).toEqual(["/products/wide-leg"]));
    window.removeEventListener(NAVIGATE_EVENT, claim);
    expect(addItem).not.toHaveBeenCalled();
  });

  it("shows an error with the backend's message when the add is refused", async () => {
    const addItem = vi.fn(async () => ({ ok: false, status: 409, message: "Only 2 left" }));
    const { result } = renderHook(() => useQuickAdd(listed({ id: "qa-5", variants: [variant("v1")] })), { wrapper: cart(addItem) });
    await click(result);
    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.failMessage).toBe("Only 2 left");
  });

  it("errors without adding when the detail cannot load, and ignores sold-out products", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 502)));
    const addItem = ok();
    const { result } = renderHook(() => useQuickAdd(listed({ id: "qa-6" })), { wrapper: cart(addItem) });
    await click(result);
    await waitFor(() => expect(result.current.state).toBe("error"));

    const soldOut = renderHook(() => useQuickAdd(related({ id: "qa-7" })), { wrapper: cart(addItem) });
    expect(soldOut.result.current.soldOut).toBe(true);
    await click(soldOut.result);
    expect(soldOut.result.current.state).toBe("idle");
    expect(addItem).not.toHaveBeenCalled();
  });
});

describe("AddToCartButton", () => {
  it("shows the error label, and skips onAdded, when addItem resolves ok:false", async () => {
    const addItem = vi.fn(async () => ({ ok: false, status: 409, message: "Sold out" }));
    const onAdded = vi.fn();
    render(createElement(AddToCartButton, { product: listed({ id: "atc-1" }), errorLabel: "Nope", onAdded }), { wrapper: cart(addItem) });
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("button").textContent).toBe("Nope"));
    expect(onAdded).not.toHaveBeenCalled();
  });

  it("calls onAdded on success and treats a related payload's is_in_stock as stock", async () => {
    const addItem = vi.fn(async () => ({ ok: true, status: 200 }));
    const onAdded = vi.fn();
    render(createElement(AddToCartButton, { product: related({ id: "atc-2", is_in_stock: true }), onAdded }), { wrapper: cart(addItem) });
    expect(screen.getByRole("button").textContent).toBe("Add to cart");
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(onAdded).toHaveBeenCalledTimes(1));
  });
});
