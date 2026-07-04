"use client";
import { useCallback } from "react";
import type { Product } from "../types/entities";
import { useCachedResource } from "../lib/dataCache";

/**
 * Fetch products related to the given product (same category, excluding
 * self). Phase 3 lands collaborative-filtering / "frequently bought
 * together"; v1 ships the simpler same-category-minus-self heuristic.
 *
 * Backend contract: GET /api/storefront/products/{id}/related?limit=N
 *   → { items: Product[] } | { data: Product[] } | Product[]
 *
 * Returns an empty list (no error) when the endpoint is missing or the
 * product has no siblings — themes should branch on `items.length` and
 * either render the section or skip it entirely.
 *
 * Phase 3 (client-data layer): routed through the shared `useCachedResource`
 * store keyed by `numu:related:<productId>:<limit>`. Two "related products"
 * sections on the same PDP now share ONE request + one result instead of each
 * refetching, and the AbortSignal + cache seq-guard drop a superseded response
 * (e.g. after a rapid product switch) so it can't overwrite the newer list.
 */

export interface RelatedProductsState {
  items: Product[];
  loading: boolean;
  error: Error | null;
}

// Stable empty reference so `items` identity doesn't churn every render.
const EMPTY: Product[] = [];

export function useRelatedProducts(
  productId: string | null | undefined,
  options: { limit?: number } = {},
): RelatedProductsState {
  const limit = options.limit ?? 4;
  const key = productId ? `numu:related:${productId}:${limit}` : "";

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<Product[]> => {
      const res = await fetch(
        `/api/storefront/products/${encodeURIComponent(
          productId as string,
        )}/related?limit=${limit}`,
        { cache: "no-store", signal },
      );
      if (!res.ok) {
        // Endpoint not yet wired — treat as "no related items available"
        // (empty, not an error) so themes just skip the section.
        return EMPTY;
      }
      const json = (await res.json()) as
        | { items?: Product[]; data?: Product[] }
        | Product[];
      return Array.isArray(json)
        ? json
        : Array.isArray(json.data)
          ? json.data
          : Array.isArray(json.items)
            ? json.items
            : EMPTY;
    },
    [productId, limit],
  );

  const { data, isLoading, error } = useCachedResource<Product[]>(key, fetcher, {
    enabled: Boolean(productId),
    initialData: EMPTY,
  });

  return { items: data ?? EMPTY, loading: isLoading, error: error ?? null };
}
