"use client";

import { createElement, type ElementType, type ReactNode } from "react";
import { useLocalization } from "../hooks/useLocalization";
import { useShop } from "../hooks/useShop";
import { useCurrency } from "../hooks/useCurrency";

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
 * Multi-currency: when the store has `auto_convert` on and the caller did NOT
 * pin an explicit `currency`, the amount is presented in the visitor's
 * SELECTED currency (converted via the shared rates from `useCurrency()`). A
 * `<CurrencySwitcher>` change therefore re-renders every `<Money>` on the page
 * without a reload. An explicit `currency` prop means "this amount is already
 * in that currency" — it is respected and never converted.
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
  const { selected, base, autoConvert, convert } = useCurrency();

  const shouldConvert =
    autoConvert && !currency && !!selected && selected !== base;
  const ccy = shouldConvert ? selected : currency || shop?.currency;
  // convert() works in cents; Money's amount is major units — round-trip
  // through cents so currencies with minor units convert correctly.
  const toDisplay = (major: number): number =>
    shouldConvert ? convert(Math.round(major * 100), selected) / 100 : major;

  const showCompare = compareAt != null && compareAt > amount;

  const children: ReactNode[] = [
    <span key="amt">{formatMoney(toDisplay(amount), ccy)}</span>,
  ];
  if (showCompare) {
    children.push(" ");
    children.push(
      <s key="cmp" style={{ opacity: 0.6 }}>
        {formatMoney(toDisplay(compareAt), ccy)}
      </s>,
    );
  }

  return createElement(
    as,
    { className, dir: "auto" },
    children,
  );
}
