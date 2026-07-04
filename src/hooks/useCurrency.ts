"use client";
import { useContext, useMemo } from "react";
import { CurrencyContext } from "../contexts";
import { useShop } from "./useShop";
import type { CurrencyState } from "../contexts";

/**
 * Multi-currency presentment — Phase 6, lifted into a provider context in
 * Phase 2 (correctness).
 *
 * The store's *capture* currency (what Paymob/Stripe/etc. charges) never
 * changes mid-session. This hook is purely about **display**: letting
 * visitors browse prices in a currency they recognize.
 *
 * As of Phase 2 the currency config + selection live in `CurrencyContext`,
 * fetched ONCE by `NuMuProvider` (see `/api/storefront/currencies`) and shared
 * by every consumer. Before this, each `useCurrency()` caller fetched its own
 * copy and held the selection in per-instance state, so a `<CurrencySwitcher>`
 * change never reached the `<Money>` tags. Now it does — changing the selected
 * currency re-renders every `<Money>`/`useMoney()` on the page, no reload.
 *
 * Usage:
 *
 *     const { base, selected, presentment, convert, setSelected } = useCurrency();
 *     <p>{convert(product.price.amount_cents)} {selected}</p>
 *     {presentment.length > 1 && (
 *       <select value={selected} onChange={(e) => setSelected(e.target.value)}>
 *         {presentment.map(c => <option key={c}>{c}</option>)}
 *       </select>
 *     )}
 *
 * Behavior (owned by `NuMuProvider`):
 *   - `selected` defaults to the persisted `numu_currency` cookie if valid,
 *     else `default_presentment`, else `base`.
 *   - `setSelected` writes the cookie (path=/, 30d) so navigation preserves
 *     the choice across pages.
 *   - `convert(cents)` returns the converted cents in `selected`, using the
 *     rates from the API. When no rate exists, returns the input unchanged
 *     (theme renders in base — better than a wrong number).
 *
 * Use `<CurrencySwitcher>` from the SDK for an opinionated UI, or read this
 * hook directly for full control.
 */

// Re-export the currency types from their canonical home (contexts) so
// existing `import type { CurrencyConfig, CurrencyState } from
// "@numueg/theme-sdk"` (which flows through this module's re-export in
// index.ts) keeps resolving unchanged.
export type { CurrencyConfig, CurrencyState } from "../contexts";

export function useCurrency(): CurrencyState {
  const ctx = useContext(CurrencyContext);
  const shop = useShop();

  // Fallback for trees without a NuMuProvider currency value — SSR before the
  // provider's fetch resolves, or a theme mounted outside NuMuProvider. A
  // base-only, no-conversion state so `<Money>`/`<CurrencySwitcher>` render the
  // store currency instead of crashing. The provider owns the real fetch.
  const fallback = useMemo<CurrencyState>(() => {
    const ccy = shop?.currency || "EGP";
    return {
      base: ccy,
      selected: ccy,
      presentment: [ccy],
      rates: {},
      autoConvert: false,
      loading: false,
      setSelected: () => {},
      convert: (cents: number) => cents,
    };
  }, [shop?.currency]);

  return ctx ?? fallback;
}
