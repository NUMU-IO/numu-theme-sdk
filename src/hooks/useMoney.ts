"use client";

import { useLocalization } from "./useLocalization";
import { useShop } from "./useShop";
import { useCurrency } from "./useCurrency";

/**
 * useMoney — convenience hook that returns a formatter bound to the active
 * store's currency.
 *
 * Useful when a section needs to format multiple amounts in a render:
 *
 *   const money = useMoney();
 *   return <td>{money(item.price * item.quantity)}</td>
 *
 * Multi-currency: like <Money>, when the store has `auto_convert` on and no
 * `currencyOverride` is passed, amounts are converted to and formatted in the
 * visitor's SELECTED presentment currency (shared via `useCurrency()`), so a
 * `<CurrencySwitcher>` change reflows these too. Pass a `currencyOverride` to
 * pin a specific currency and skip conversion.
 *
 * For one-off price displays prefer the <Money> component which handles
 * compare-at and inline rendering.
 */
export function useMoney(currencyOverride?: string) {
  const { formatMoney } = useLocalization();
  const shop = useShop();
  const { selected, base, autoConvert, convert } = useCurrency();
  return (amount: number) => {
    const shouldConvert =
      autoConvert && !currencyOverride && !!selected && selected !== base;
    if (shouldConvert) {
      // convert() works in cents; amount is major units — round-trip.
      const converted = convert(Math.round(amount * 100), selected) / 100;
      return formatMoney(converted, selected);
    }
    return formatMoney(amount, currencyOverride || shop?.currency);
  };
}
