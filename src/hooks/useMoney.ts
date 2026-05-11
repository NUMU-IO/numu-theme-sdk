"use client";

import { useLocalization } from "./useLocalization";
import { useShop } from "./useShop";

/**
 * useMoney — convenience hook that returns a stable formatter bound to
 * the active store's currency.
 *
 * Useful when a section needs to format multiple amounts in a render:
 *
 *   const money = useMoney();
 *   return <td>{money(item.price * item.quantity)}</td>
 *
 * For one-off price displays prefer the <Money> component which handles
 * compare-at and inline rendering.
 */
export function useMoney(currencyOverride?: string) {
  const { formatMoney } = useLocalization();
  const shop = useShop();
  const ccy = currencyOverride || shop?.currency;
  return (amount: number) => formatMoney(amount, ccy);
}
