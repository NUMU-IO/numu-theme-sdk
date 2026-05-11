"use client";
import { useEffect, useState } from "react";
import type { Product } from "../types/entities";

/**
 * Fetch products related to the given product (same category, excluding
 * self). Phase 3 lands collaborative-filtering / "frequently bought
 * together"; v1 ships the simpler same-category-minus-self heuristic.
 *
 * Backend contract: GET /api/storefront/products/{id}/related?limit=N
 *   → { items: Product[] } | Product[]
 *
 * Returns an empty list (no error) when the endpoint is missing or the
 * product has no siblings — themes should branch on `items.length` and
 * either render the section or skip it entirely.
 */

export interface RelatedProductsState {
  items: Product[];
  loading: boolean;
  error: Error | null;
}

export function useRelatedProducts(
  productId: string | null | undefined,
  options: { limit?: number } = {},
): RelatedProductsState {
  const limit = options.limit ?? 4;
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!productId) {
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch(
          `/api/storefront/products/${encodeURIComponent(productId)}/related?limit=${limit}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          // Endpoint not yet wired — don't surface an error; themes
          // should treat this as "no related items available" and
          // skip the section.
          if (cancelled) return;
          setItems([]);
          return;
        }
        const json = (await res.json()) as
          | { items?: Product[]; data?: Product[] }
          | Product[];
        const list: Product[] = Array.isArray(json)
          ? json
          : Array.isArray(json.data)
            ? json.data
            : Array.isArray(json.items)
              ? json.items
              : [];
        if (cancelled) return;
        setItems(list);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId, limit]);

  return { items, loading, error };
}
