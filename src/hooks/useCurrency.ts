"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useShop } from "./useShop";

/**
 * Multi-currency presentment — Phase 6.
 *
 * The store's *capture* currency (what Paymob/Stripe/etc. charges)
 * never changes mid-session. This hook is purely about **display**:
 * letting visitors browse prices in a currency they recognize.
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
 * Behavior:
 *   - `selected` defaults to the persisted `numu_currency` cookie if
 *     valid, else `default_presentment`, else `base`.
 *   - `setSelected` writes the cookie (path=/, 30d) so navigation
 *     preserves the choice across pages.
 *   - `convert(cents)` returns the converted cents in `selected`,
 *     using the rates from the API. When no rate exists, returns
 *     the input unchanged (theme renders in base — better than a
 *     wrong number).
 *
 * Use `<CurrencySwitcher>` from the SDK for an opinionated UI, or
 * read this hook directly for full control.
 */

export interface CurrencyConfig {
  base: string;
  default_presentment: string;
  presentment: string[];
  rates: Record<string, string>; // Decimal-as-string
  auto_convert: boolean;
}

export interface CurrencyState {
  base: string;
  selected: string;
  presentment: string[];
  rates: Record<string, number>;
  autoConvert: boolean;
  loading: boolean;
  setSelected: (currency: string) => void;
  convert: (cents: number, target?: string) => number;
}

const COOKIE_NAME = "numu_currency";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]+)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function useCurrency(): CurrencyState {
  const shop = useShop();
  const [config, setConfig] = useState<CurrencyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelectedState] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/storefront/currencies`, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`currencies: HTTP ${res.status}`);
        const body = (await res.json()) as { data: CurrencyConfig };
        if (cancelled) return;
        setConfig(body.data);
        // Resolve the initial selection: cookie → default → base.
        // Validate against the presentment list so a stale cookie
        // doesn't lock the visitor onto a currency the merchant
        // removed.
        const cookie = readCookie(COOKIE_NAME);
        const valid =
          cookie && body.data.presentment.includes(cookie) ? cookie : null;
        setSelectedState(valid || body.data.default_presentment || body.data.base);
      } catch {
        if (cancelled) return;
        setConfig(null);
        setSelectedState(shop.currency || "EGP");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shop.id, shop.currency]);

  const rates = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    if (!config) return out;
    for (const [k, v] of Object.entries(config.rates)) {
      const n = Number.parseFloat(v);
      if (Number.isFinite(n)) out[k] = n;
    }
    return out;
  }, [config]);

  const convert = useCallback(
    (cents: number, target?: string): number => {
      if (!config) return cents;
      const to = target || selected;
      if (!to || to === config.base) return cents;
      const rate = rates[to];
      if (!rate || !Number.isFinite(rate)) return cents;
      return Math.round(cents * rate);
    },
    [config, rates, selected],
  );

  const setSelected = useCallback((currency: string) => {
    setSelectedState(currency);
    writeCookie(COOKIE_NAME, currency);
  }, []);

  return {
    base: config?.base || shop.currency || "EGP",
    selected: selected || config?.base || shop.currency || "EGP",
    presentment: config?.presentment || [shop.currency || "EGP"],
    rates,
    autoConvert: Boolean(config?.auto_convert),
    loading,
    setSelected,
    convert,
  };
}
