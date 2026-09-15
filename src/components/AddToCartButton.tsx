"use client";

import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { inStock } from "../commerce/core";
import { useCart } from "../hooks/useCart";
import type { Product, ProductVariant } from "../types/entities";

interface AddToCartButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "disabled"> {
  product: Product;
  variant?: ProductVariant;
  quantity?: number;
  /**
   * Picker axes to persist on the cart line ({Color: "Black"}). Optional —
   * when omitted, the button reads the live useVariantSelection state for
   * this product from the SDK registry, so existing themes get the variant
   * label end-to-end (cart → checkout → order → email) with no changes.
   */
  selectedOptions?: Record<string, string>;
  /** Custom labels — fallbacks are English defaults. */
  label?: ReactNode;
  loadingLabel?: ReactNode;
  soldOutLabel?: ReactNode;
  errorLabel?: ReactNode;
  /** Called after successful addition. Useful for analytics events. */
  onAdded?: (product: Product, variant?: ProductVariant) => void;
}

/**
 * Themed Add-to-Cart button with built-in loading/disabled/error states.
 *
 * Wraps useCart().addItem and tracks its own UX state machine:
 *   idle → adding → idle (or → error briefly, then idle)
 *
 * Renders a regular `<button>` so themes style it with whatever class
 * names they want — we only own the disabled/aria-busy logic and label
 * swaps. If the variant (or product) is out of stock, button is
 * disabled and shows soldOutLabel.
 *
 * Doesn't trap navigation — for "buy now" flows that should redirect
 * to checkout, themes wrap this in their own `<a>` after onAdded.
 */
export function AddToCartButton({
  product,
  variant,
  quantity = 1,
  selectedOptions,
  label = "Add to cart",
  loadingLabel = "Adding…",
  soldOutLabel = "Sold out",
  errorLabel = "Couldn't add — try again",
  onAdded,
  ...rest
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [state, setState] = useState<"idle" | "adding" | "error">("idle");

  // `inStock` reads `in_stock` and `is_in_stock`: related-products payloads
  // only send the latter, and reading `in_stock` alone greyed them all out.
  const stocked = variant ? (variant.is_in_stock ?? variant.in_stock ?? true) : inStock(product);
  if (!stocked) {
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        {...rest}
      >
        {soldOutLabel}
      </button>
    );
  }

  async function handleClick() {
    if (state === "adding") return;
    setState("adding");
    try {
      // addItem itself falls back to the live useVariantSelection state for
      // this product when no explicit axes are passed; the backend only uses
      // them when the variant row can't name itself (empty option_values).
      const result = await addItem(product.id, variant?.id, quantity, selectedOptions);
      // addItem RESOLVES { ok: false } on a refused add (sold out, stock cap);
      // it does not throw, so a refusal must not look like success.
      if (result && result.ok === false) throw new Error(result.message || "add refused");
      setState("idle");
      onAdded?.(product, variant);
    } catch {
      setState("error");
      // Auto-clear after 2s so the merchant can try again.
      setTimeout(() => setState("idle"), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === "adding"}
      aria-busy={state === "adding"}
      {...rest}
    >
      {state === "adding"
        ? loadingLabel
        : state === "error"
          ? errorLabel
          : label}
    </button>
  );
}
