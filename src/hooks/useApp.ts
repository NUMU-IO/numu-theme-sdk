"use client";
import { useCallback } from "react";
import { useShop } from "./useShop";
import { useCachedResource } from "../lib/dataCache";

/**
 * Read app-provided data + manifest for a slug installed on the
 * current store.
 *
 * Phase 6 wired this to the real backend at
 * `/api/storefront/store/{store_id}/apps/{slug}`. Theme usage:
 *
 *     const recommend = useApp<RecommendationData>("recommendation-engine");
 *     if (!recommend.available) return <Fallback />;
 *     if (recommend.loading) return <Skeleton />;
 *     return <RecommendList items={recommend.data?.products ?? []} />;
 *
 * `available` flips to true only when an enabled installation exists
 * for the store. Apps the merchant hasn't installed surface as
 * `{ available: false }` rather than as a network error — themes
 * branch on availability without try/catch.
 *
 * Phase 3 (client-data layer): the fetch now runs through the shared
 * `useCachedResource` store keyed by `numu:app:<store_id>:<slug>`. Two upgrades
 * over the old per-instance `useState` + fetch:
 *   - DEDUP + SYNC: N consumers of the same app slug share ONE request and one
 *     result, instead of each firing its own `/apps/{slug}` fetch.
 *   - CANCELLATION / ORDERING: the fetcher receives an AbortSignal and the
 *     cache seq-guards results, so a slow response for a superseded slug (or a
 *     superseded `refresh()`) can no longer apply stale state over a newer one
 *     — the audited "out-of-order responses apply stale state" bug.
 *
 * `loading` reflects the FIRST load only; a `refresh()` revalidates in the
 * background (`isValidating`) while keeping the last-good data visible, rather
 * than blanking to a skeleton on every manual refresh.
 */

export interface AppManifestBlock {
  type: string;
  name: string;
  block_schema: Record<string, unknown>;
}

export interface AppPayload<T = unknown> {
  slug: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  version: string;
  manifest: Record<string, unknown>;
  settings: Record<string, unknown>;
  blocks: AppManifestBlock[];
  /** App-provided data (shape defined by the app developer). Today
   * the response always returns null for `data` — apps emit data via
   * their `endpoints.data` URL, which the theme fetches separately.
   * Surfaced here so the field is stable when v2 lands the proxy. */
  data: T | null;
}

export interface AppState<T = unknown> {
  data: AppPayload<T> | null;
  loading: boolean;
  available: boolean;
  error: Error | null;
  /** Re-fetch the install. Returns a promise that resolves when the
   * request settles (regardless of success). */
  refresh: () => Promise<void>;
}

/** Normalized fetch result cached per key. `available:false` covers both the
 *  "not installed" (404) and "no payload" cases so themes branch on one flag. */
interface AppFetchResult<T> {
  payload: AppPayload<T> | null;
  available: boolean;
}

export function useApp<T = unknown>(slug: string): AppState<T> {
  const shop = useShop();
  // Key on store + slug so a different slug is a different cache entry — a
  // rapid slug switch reads its own entry rather than racing one shared slot.
  const key = slug ? `numu:app:${shop.id}:${slug}` : "";

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<AppFetchResult<T>> => {
      const url = `/api/storefront/apps/${encodeURIComponent(slug)}`;
      const res = await fetch(url, {
        credentials: "include",
        headers: { Accept: "application/json" },
        signal,
      });
      if (res.status === 404) {
        // Not installed (or app disabled). Standard not-available shape —
        // keeps theme branching simple (no thrown error).
        return { payload: null, available: false };
      }
      if (!res.ok) {
        throw new Error(`useApp(${slug}) failed: HTTP ${res.status}`);
      }
      const body = (await res.json()) as {
        data?: (AppPayload<T> & { available?: boolean }) | null;
      };
      const payload = body.data ?? null;
      if (!payload) return { payload: null, available: false };
      return {
        payload: payload as AppPayload<T>,
        available: payload.available !== false,
      };
    },
    [slug],
  );

  const { data, isLoading, error, revalidate } = useCachedResource<
    AppFetchResult<T>
  >(key, fetcher, {
    enabled: Boolean(slug),
    initialData: { payload: null, available: false },
  });

  const refresh = useCallback(async (): Promise<void> => {
    await revalidate();
  }, [revalidate]);

  // Preserve the original contract: on error, present as not-available with a
  // null payload (the error is still surfaced separately).
  return {
    data: error ? null : data?.payload ?? null,
    loading: isLoading,
    available: error ? false : data?.available ?? false,
    error: error ?? null,
    refresh,
  };
}
