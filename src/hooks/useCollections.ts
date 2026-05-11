"use client";

import { useEffect, useState } from "react";
import { usePage } from "./usePage";
import { useShop } from "./useShop";
import type { Collection } from "../types/entities";

interface UseCollectionsOptions {
  limit?: number;
  fetchIfMissing?: boolean;
}

interface UseCollectionsResult {
  collections: Collection[];
  loading: boolean;
  error: Error | null;
}

/**
 * useCollections — analog to useProducts. Reads page.data.collections
 * pre-fetched by the storefront SSR; falls back to /api/collections
 * when fetchIfMissing is true.
 */
export function useCollections(
  opts: UseCollectionsOptions = {},
): UseCollectionsResult {
  const { limit, fetchIfMissing = false } = opts;
  const page = usePage();
  const shop = useShop();
  const initial = (page?.data?.collections as Collection[] | undefined) ?? null;

  const [collections, setCollections] = useState<Collection[]>(initial ?? []);
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
        const res = await fetch(`/api/collections?${params.toString()}`);
        if (!res.ok) throw new Error(`/api/collections → ${res.status}`);
        const data = (await res.json()) as { collections?: Collection[] };
        if (cancelled) return;
        setCollections(data.collections ?? []);
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
  }, [initial, fetchIfMissing, shop?.id]);

  const sliced = limit != null ? collections.slice(0, limit) : collections;
  return { collections: sliced, loading, error };
}
