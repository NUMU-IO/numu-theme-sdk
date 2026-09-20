/**
 * Unit tests for useDiscountCode.
 *
 * The whole point of the hook is that `applyDiscount` REPORTS failure
 * instead of throwing, which every hand-rolled coupon box in a theme got
 * wrong in one of two directions. Both directions are pinned here:
 * a rejected code must surface the backend's message and keep what the
 * shopper typed, and an accepted code must NOT report an error.
 *
 * Uses React.createElement (no JSX) so the test transpiles without any
 * JSX-runtime config, matching the SDK's no-build test setup.
 */

import { createElement, type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDiscountCode } from "../hooks/useDiscountCode";
import { CartContext, type CartMutationResult } from "../contexts";
import type { Cart } from "../types/entities";

const emptyCart = { items: [], subtotal: 0, total: 0 } as unknown as Cart;

function wrapperFor(
  applyResult: CartMutationResult,
  cart: Cart = emptyCart,
  removeDiscount = vi.fn(async () => ({ ok: true, status: 200 })),
) {
  const applyDiscount = vi.fn(async () => applyResult);
  const value = {
    cart,
    addItem: vi.fn(),
    removeItem: vi.fn(),
    updateQuantity: vi.fn(),
    applyDiscount,
    removeDiscount,
    updateNote: vi.fn(),
    clearCart: vi.fn(),
    loading: false,
  } as unknown as React.ContextType<typeof CartContext>;
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(CartContext.Provider, { value }, children);
  return { wrapper, applyDiscount, removeDiscount };
}

describe("useDiscountCode", () => {
  it("surfaces the backend's message when the code is rejected", async () => {
    const { wrapper } = wrapperFor({
      ok: false,
      status: 400,
      message: "This coupon has expired",
    });
    const { result } = renderHook(() => useDiscountCode(), { wrapper });

    act(() => result.current.setCode("EXPIRED"));
    let applied: boolean | undefined;
    await act(async () => {
      applied = await result.current.apply();
    });

    expect(applied).toBe(false);
    expect(result.current.error).toBe("This coupon has expired");
    // The typed code survives a rejection — clearing it forces the shopper
    // to retype a code that may only need a bigger cart.
    expect(result.current.code).toBe("EXPIRED");
  });

  it("falls back to a readable message when the backend sends none", async () => {
    const { wrapper } = wrapperFor({ ok: false, status: 400 });
    const { result } = renderHook(() => useDiscountCode("nope"), { wrapper });

    await act(async () => {
      await result.current.apply("ANY");
    });

    expect(result.current.error).toBe("nope");
  });

  it("reports success and clears the input when the code applies", async () => {
    const { wrapper, applyDiscount } = wrapperFor({ ok: true, status: 200 });
    const { result } = renderHook(() => useDiscountCode(), { wrapper });

    act(() => result.current.setCode("  SAVE10  "));
    let applied: boolean | undefined;
    await act(async () => {
      applied = await result.current.apply();
    });

    expect(applied).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.code).toBe("");
    // Trimmed — a pasted code carrying whitespace is the same code.
    expect(applyDiscount).toHaveBeenCalledWith("SAVE10");
  });

  it("reads the applied code and discount off the cart", () => {
    const cart = {
      items: [],
      subtotal: 0,
      total: 0,
      discount_code: "SAVE10",
      discount_amount: 25,
    } as unknown as Cart;
    const { wrapper } = wrapperFor({ ok: true, status: 200 }, cart);
    const { result } = renderHook(() => useDiscountCode(), { wrapper });

    expect(result.current.applied).toBe("SAVE10");
    expect(result.current.discount).toBe(25);
  });

  it("does not call the API for an empty code", async () => {
    const { wrapper, applyDiscount } = wrapperFor({ ok: true, status: 200 });
    const { result } = renderHook(() => useDiscountCode(), { wrapper });

    await act(async () => {
      await result.current.apply("   ");
    });

    expect(applyDiscount).not.toHaveBeenCalled();
  });
});
