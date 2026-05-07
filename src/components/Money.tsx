"use client";

import { createElement, type ElementType, type ReactNode } from "react";
import { useLocalization } from "../hooks/useLocalization";
import { useShop } from "../hooks/useShop";

interface MoneyProps {
  /** Amount in major units (e.g. dollars, not cents). */
  amount: number;
  /** ISO-4217 currency code. Defaults to the active store's currency. */
  currency?: string;
  /**
   * When the same product has both a sale price and a compare-at price,
   * pass the higher (compare-at) value here and we'll render it with a
   * strike-through next to the active price. Skipped when undefined or
   * <= the main amount.
   */
  compareAt?: number;
  className?: string;
  /** Custom HTML element tag — defaults to `span`. */
  as?: ElementType;
}

/**
 * <Money amount={49.99} /> — formatted price, locale-aware.
 *
 * Wraps useLocalization().formatMoney so theme code stops re-implementing
 * Intl.NumberFormat. Renders inline with `dir="auto"` so the digits
 * flow naturally in RTL (Arabic) without flipping the currency symbol.
 *
 * Usage:
 *   <Money amount={product.price} compareAt={product.compare_at_price} />
 */
export function Money({
  amount,
  currency,
  compareAt,
  className,
  as = "span",
}: MoneyProps) {
  const { formatMoney } = useLocalization();
  const shop = useShop();
  const ccy = currency || shop?.currency;
  const showCompare = compareAt != null && compareAt > amount;

  const children: ReactNode[] = [
    <span key="amt">{formatMoney(amount, ccy)}</span>,
  ];
  if (showCompare) {
    children.push(" ");
    children.push(
      <s key="cmp" style={{ opacity: 0.6 }}>
        {formatMoney(compareAt, ccy)}
      </s>,
    );
  }

  return createElement(
    as,
    { className, dir: "auto" },
    children,
  );
}
