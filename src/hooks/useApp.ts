"use client";
import { useEffect, useState } from "react";

/**
 * Read app-provided data + render app blocks.
 *
 * **v1 stub.** The NUMU app platform (third-party app submissions,
 * sandboxing, billing) ships in Phase 6. This hook exists today so
 * theme developers can write code like:
 *
 *     const { data, loading } = useApp("recommendation-engine");
 *     if (data) return <RecommendList items={data.products} />;
 *
 * and have it not break when the platform lands. Today the hook
 * returns `{ data: null, loading: false, available: false }` for
 * every slug — themes should branch on `available` and fall back to
 * non-app behavior. When the platform exists, this hook will fetch
 * `/api/storefront/apps/{slug}` and surface the app's published data.
 */

export interface AppState<T = unknown> {
  /** App-provided data (shape defined by the app developer). */
  data: T | null;
  loading: boolean;
  /**
   * False today for every slug — the app platform ships in Phase 6.
   * Themes should branch on this so they degrade gracefully.
   */
  available: boolean;
  error: Error | null;
}

const STUB: AppState<unknown> = {
  data: null,
  loading: false,
  available: false,
  error: null,
};

export function useApp<T = unknown>(slug: string): AppState<T> {
  // We deliberately don't fetch — the endpoint doesn't exist. When
  // it does, change this implementation; the signature stays stable.
  const [state] = useState<AppState<T>>(STUB as AppState<T>);
  // Touch slug so the unused-param lint isn't tripped + the hook
  // shape signals "yes I'd refetch on slug change in v1+".
  useEffect(() => {
    void slug;
  }, [slug]);
  return state;
}
