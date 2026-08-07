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
 * Read a collection list out of whatever envelope the host answered with.
 *
 * `fetchIfMissing` was effectively DEAD before this: it read `data.collections`
 * while `/api/collections` proxies FastAPI verbatim and answers the platform
 * envelope `{ success, data: [...] }`. That lookup is `undefined`, so a theme
 * that opted into the fetch got a request followed by an EMPTY list — the same
 * blank menu it was trying to fix, only slower. Verified against the live
 * endpoint. All three shapes are accepted so the hook can't be re-broken by an
 * envelope change on either side.
 */
function unwrapCollections(json: unknown): Collection[] {
  if (Array.isArray(json)) return json as Collection[];
  const obj = json as
    | {
        collections?: unknown;
        data?: unknown;
      }
    | null
    | undefined;
  if (Array.isArray(obj?.collections)) return obj.collections as Collection[];
  if (Array.isArray(obj?.data)) return obj.data as Collection[];
  const items = (obj?.data as { items?: unknown } | undefined)?.items;
  if (Array.isArray(items)) return items as Collection[];
  return [];
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
        const json = (await res.json()) as unknown;
        if (cancelled) return;
        setCollections(unwrapCollections(json));
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
