"use client";

import { useCallback, useState } from "react";

/**
 * Reorder / "buy again" — Phase 8.5.
 *
 * Clones every line item from an existing order into the current cart.
 * The backend skips lines whose product is deleted/archived, whose
 * variant is gone, or that are out of stock — returning per-line
 * reasons so themes can show a "couldn't add X items" banner.
 *
 * Backend contract:
 *   POST /storefront/me/orders/{order_id}/reorder
 *     → 200 { data: { added_count, skipped[], cart_total_items } }
 *     → 404 if order doesn't belong to the current customer
 */

export type ReorderSkipReason =
  | "product_deleted"
  | "product_archived"
  | "out_of_stock"
  | "variant_unavailable";

export interface ReorderSkippedItem {
  product_id: string;
  variant_id: string | null;
  quantity: number;
  reason: ReorderSkipReason | string;
}

export interface ReorderResult {
  added_count: number;
  skipped: ReorderSkippedItem[];
  cart_total_items: number;
}

export interface UseReorder {
  /** Last reorder result. */
  result: ReorderResult | null;
  /** True while a reorder is in flight. */
  loading: boolean;
  /** Latest error, cleared on next reorder call. */
  error: Error | null;
  /** Trigger the reorder. Returns the result or null on failure. */
  reorder: (orderId: string) => Promise<ReorderResult | null>;
  /** Clear the last result + error (e.g. after dismissing the banner). */
  reset: () => void;
}

export function useReorder(): UseReorder {
  const [result, setResult] = useState<ReorderResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const reorder = useCallback(
    async (orderId: string): Promise<ReorderResult | null> => {
      if (typeof window === "undefined") return null;
      if (!orderId) {
        setError(new Error("Order id is required."));
        return null;
      }
      setLoading(true);
      setError(null);
      try {
        // Read the CSRF cookie value and echo it as a header — the
        // storefront's mutating proxies verify the double-submit.
        const csrf =
          typeof document !== "undefined"
            ? (document.cookie.match(/(?:^|; )numu_csrf=([^;]+)/)?.[1] ?? "")
            : "";
        const res = await fetch(
          `/api/customer/orders/${encodeURIComponent(orderId)}/reorder`,
          {
            method: "POST",
            headers: csrf ? { "x-numu-csrf": csrf } : {},
            credentials: "include",
          },
        );
        if (!res.ok) {
          if (res.status === 401) {
            setError(new Error("Please sign in to reorder."));
          } else if (res.status === 404) {
            setError(new Error("That order can't be found on your account."));
          } else {
            setError(new Error(`Couldn't reorder (HTTP ${res.status}).`));
          }
          return null;
        }
        const json = (await res.json()) as { data?: ReorderResult };
        const data = json?.data;
        if (!data) {
          setError(new Error("Unexpected response from server."));
          return null;
        }
        setResult(data);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, loading, error, reorder, reset };
}
