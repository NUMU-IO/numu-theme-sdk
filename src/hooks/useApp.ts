"use client";
import { useCallback, useEffect, useState } from "react";
import { useShop } from "./useShop";

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
 * The hook revalidates whenever the slug changes, but does NOT refetch
 * on focus / interval — app data is usually slow-changing (config +
 * manifest). Themes that need live data should layer their own
 * refresh on top of the returned `refresh()` callback.
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

export function useApp<T = unknown>(slug: string): AppState<T> {
  const shop = useShop();
  const [state, setState] = useState<{
    data: AppPayload<T> | null;
    loading: boolean;
    available: boolean;
    error: Error | null;
  }>({ data: null, loading: true, available: false, error: null });

  const fetchApp = useCallback(async (): Promise<void> => {
    if (!slug) {
      setState({ data: null, loading: false, available: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const url = `/api/storefront/apps/${encodeURIComponent(slug)}`;
      const res = await fetch(url, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (res.status === 404) {
        // Not installed (or app disabled). Standard not-available
        // shape — keeps theme branching simple.
        setState({
          data: null,
          loading: false,
          available: false,
          error: null,
        });
        return;
      }
      if (!res.ok) {
        throw new Error(`useApp(${slug}) failed: HTTP ${res.status}`);
      }
      const body = (await res.json()) as {
        data?: AppPayload<T> & { available?: boolean };
      };
      const payload = body.data;
      if (!payload) {
        setState({
          data: null,
          loading: false,
          available: false,
          error: null,
        });
        return;
      }
      setState({
        data: payload as AppPayload<T>,
        loading: false,
        available: payload.available !== false,
        error: null,
      });
    } catch (e) {
      setState({
        data: null,
        loading: false,
        available: false,
        error: e instanceof Error ? e : new Error(String(e)),
      });
    }
  }, [slug, shop.id]);

  useEffect(() => {
    void fetchApp();
  }, [fetchApp]);

  return { ...state, refresh: fetchApp };
}
