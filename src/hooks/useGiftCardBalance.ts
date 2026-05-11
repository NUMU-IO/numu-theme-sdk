"use client";

import { useCallback, useState } from "react";

/**
 * Gift card balance check — Phase 8.3.
 *
 * Themes call this from the checkout payment step to validate a
 * customer-typed code before sending it as part of the checkout
 * payload. The backend returns 404 for any non-redeemable card
 * (expired, depleted, voided, or wrong store) — the response shape
 * stays uniform so the hook can't be used to probe for valid codes.
 *
 * Backend contract (via storefront proxy):
 *   GET /api/gift-cards/{code}
 *     → 200 { data: { last_four, current_balance_cents, currency,
 *                     expires_at? } }
 *     → 404 { error: { code, message } }
 */

export interface GiftCardBalance {
  last_four: string;
  current_balance_cents: number;
  currency: string;
  expires_at: string | null;
}

export interface UseGiftCardBalance {
  /** Last lookup result, or null when nothing checked yet / failed. */
  balance: GiftCardBalance | null;
  /** True while a lookup is in flight. */
  loading: boolean;
  /** Latest error from the lookup, if any. Cleared on next check. */
  error: Error | null;
  /** Trigger a balance check. Returns the result or null on failure. */
  check: (code: string) => Promise<GiftCardBalance | null>;
  /** Clear the last result + error (e.g. when the user clears the input). */
  reset: () => void;
}

export function useGiftCardBalance(): UseGiftCardBalance {
  const [balance, setBalance] = useState<GiftCardBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const check = useCallback(async (code: string): Promise<GiftCardBalance | null> => {
    if (typeof window === "undefined") return null;
    const trimmed = (code || "").trim();
    if (!trimmed) {
      setError(new Error("Enter a gift card code."));
      setBalance(null);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/gift-cards/${encodeURIComponent(trimmed)}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        setBalance(null);
        // 404 = invalid/redeemed/expired — surface a friendly message
        // rather than the raw API code so themes don't need to map it.
        if (res.status === 404) {
          setError(new Error("That gift card isn't valid or has been used up."));
          return null;
        }
        setError(new Error(`Couldn't check gift card (HTTP ${res.status}).`));
        return null;
      }
      const json = (await res.json()) as { data?: GiftCardBalance };
      const data = json?.data;
      if (!data) {
        setBalance(null);
        setError(new Error("Unexpected response from server."));
        return null;
      }
      setBalance(data);
      return data;
    } catch (err) {
      setBalance(null);
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setBalance(null);
    setError(null);
  }, []);

  return { balance, loading, error, check, reset };
}
