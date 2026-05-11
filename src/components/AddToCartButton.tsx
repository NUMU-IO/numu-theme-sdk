"use client";

import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useCart } from "../hooks/useCart";
import type { Product, ProductVariant } from "../types/entities";

interface AddToCartButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "disabled"> {
  product: Product;
  variant?: ProductVariant;
  quantity?: number;
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
  label = "Add to cart",
  loadingLabel = "Adding…",
  soldOutLabel = "Sold out",
  errorLabel = "Couldn't add — try again",
  onAdded,
  ...rest
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [state, setState] = useState<"idle" | "adding" | "error">("idle");

  const inStock = variant?.in_stock ?? product.in_stock;
  if (!inStock) {
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
      await addItem(product.id, variant?.id, quantity);
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
