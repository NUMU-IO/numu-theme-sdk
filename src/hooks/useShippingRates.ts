"use client";
import { useCallback, useEffect, useState } from "react";
import type { CheckoutAddress, ShippingRateOption } from "./useCheckout";

/**
 * Fetch shipping rate options for an address — Phase 7.4.
 *
 * Themes that want to display rates on the cart page (Shopify
 * pattern: "Shipping calculated at checkout — preview from cart")
 * use this. It posts to /api/shipping/options the same way the
 * platform's shipping step does, but as a self-contained hook so
 * themes don't need to drive the full useCheckout() machinery for a
 * simple display.
 *
 * Returns null when no address is provided (the typical pre-input
 * state) — themes branch on `rates !== null` to decide whether to
 * show the rates panel or a "Enter address" prompt.
 *
 * Optionally accepts a `location_id` for multi-location stores
 * (Phase 8.2) — the resolver uses the named fulfilling location's
 * origin address when calculating rates. Ignored if multi-location
 * is off.
 *
 * Usage:
 *
 *     const { rates, loading, refresh } = useShippingRates({
 *       address: { country: "EG", city: "Cairo" },
 *     });
 */

export interface UseShippingRatesOptions {
  address?: CheckoutAddress | null;
  location_id?: string | null;
  /** Auto-fetch on mount + when the address changes. Default true. */
  enabled?: boolean;
}

export interface UseShippingRatesState {
  rates: ShippingRateOption[] | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

function isAddressSufficient(a?: CheckoutAddress | null): boolean {
  if (!a) return false;
  // Country alone gets a zone-level estimate; city + country gets
  // the rate properly. We require at least country since zones are
  // country-keyed.
  return Boolean(a.country);
}

export function useShippingRates({
  address,
  location_id,
  enabled = true,
}: UseShippingRatesOptions = {}): UseShippingRatesState {
  const [rates, setRates] = useState<ShippingRateOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!isAddressSufficient(address)) {
      setRates(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shipping/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipping_address: address,
          ...(location_id ? { location_id } : {}),
        }),
      });
      if (!res.ok) {
        // 404 = country not covered by any zone. Surface as "no
        // rates" rather than an error so themes can render a
        // "We don't ship to {country}" message gracefully.
        if (res.status === 404) {
          setRates([]);
          return;
        }
        throw new Error(`shipping rates: HTTP ${res.status}`);
      }
      const body = await res.json();
      const list: ShippingRateOption[] =
        (body?.data?.options || body?.data || body?.options || []) as ShippingRateOption[];
      setRates(list);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setRates([]);
    } finally {
      setLoading(false);
    }
  }, [address, location_id]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  return { rates, loading, error, refresh };
}
