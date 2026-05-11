"use client";

import { useEffect, useState } from "react";
import { usePage } from "./usePage";
import { useShop } from "./useShop";
import type { Product } from "../types/entities";

interface UseProductsOptions {
  /** Limit the slice returned. Defaults to whatever the host gave us. */
  limit?: number;
  /**
   * When true, fetch from `/api/products` if the host didn't provide a
   * list via PageContext. Useful for sections rendered on routes that
   * don't pre-fetch products (e.g. a custom CMS page that wants a
   * "featured" rail). Default: false — themes typically prefer SSR data.
   */
  fetchIfMissing?: boolean;
}

interface UseProductsResult {
  products: Product[];
  loading: boolean;
  error: Error | null;
}

/**
 * useProducts — read the storefront-pre-fetched product list from the
 * page context, optionally falling back to a client-side fetch.
 *
 * The SSR path passes `page.data.products: Product[]` from
 * `numu-storefront/src/app/[domain]/page.tsx`; sections on the home
 * route get them for free. For other routes that don't pre-fetch, set
 * `fetchIfMissing: true` and we'll hit `/api/products`.
 */
export function useProducts(
  opts: UseProductsOptions = {},
): UseProductsResult {
  const { limit, fetchIfMissing = false } = opts;
  const page = usePage();
  const shop = useShop();
  const initial = (page?.data?.products as Product[] | undefined) ?? null;

  const [products, setProducts] = useState<Product[]>(initial ?? []);
  const [loading, setLoading] = useState<boolean>(
    initial == null && fetchIfMissing,
  );
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (initial != null) return;
    if (!fetchIfMissing) return;
    if (!shop?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ store_id: shop.id });
        if (limit) params.set("limit", String(limit));
        const res = await fetch(`/api/products?${params.toString()}`);
        if (!res.ok) throw new Error(`/api/products → ${res.status}`);
        const data = (await res.json()) as { products?: Product[] };
        if (cancelled) return;
        setProducts(data.products ?? []);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initial, fetchIfMissing, limit, shop?.id]);

  const sliced = limit != null ? products.slice(0, limit) : products;
  return { products: sliced, loading, error };
}
