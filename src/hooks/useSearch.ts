"use client";
import { useEffect, useRef, useState } from "react";
import type { Product, Collection, Page } from "../types/entities";

/**
 * Mixed-result search shape. The backend tsvector implementation lands in
 * Phase 4; until then this hook talks to /api/storefront/search and
 * gracefully degrades (empty results) when the endpoint isn't available.
 *
 * Two modes:
 *   - "predictive" (default): debounced, capped at 5 per type, returns
 *     fast for autocomplete dropdowns.
 *   - "full": full result set with paging, used by /search pages.
 */

export interface SearchResults {
  products: Product[];
  collections: Collection[];
  pages: Page[];
  /** Articles will populate once the blog backend lands; field shape is
   *  reserved here so themes can write code that doesn't break on
   *  upgrade. */
  articles: Array<{ id: string; title: string; handle: string; excerpt?: string }>;
  total: number;
}

export interface UseSearchOptions {
  /** "predictive" debounces and caps; "full" returns paged results. */
  mode?: "predictive" | "full";
  /** Restrict to specific result types. Default: all. */
  types?: Array<"products" | "collections" | "pages" | "articles">;
  /** Per-type cap. Predictive mode defaults to 5; full mode defaults to 24. */
  limit?: number;
  /** Debounce window in ms for predictive mode. Default 200. */
  debounceMs?: number;
  /** Skip the debounce (e.g. when the user submits the form). */
  immediate?: boolean;
}

export interface SearchState {
  query: string;
  results: SearchResults;
  loading: boolean;
  error: Error | null;
}

const EMPTY: SearchResults = {
  products: [],
  collections: [],
  pages: [],
  articles: [],
  total: 0,
};

export function useSearch(
  query: string,
  options: UseSearchOptions = {},
): SearchState {
  const {
    mode = "predictive",
    types,
    limit,
    debounceMs = 200,
    immediate = false,
  } = options;

  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const lastRequestId = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(EMPTY);
      setLoading(false);
      setError(null);
      return;
    }

    const requestId = ++lastRequestId.current;
    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        const params = new URLSearchParams({ q: trimmed, mode });
        if (types?.length) params.set("types", types.join(","));
        if (limit) params.set("limit", String(limit));
        const res = await fetch(`/api/storefront/search?${params}`, {
          cache: "no-store",
        });
        if (requestId !== lastRequestId.current) return; // superseded
        if (!res.ok) {
          // Backend search not yet wired (Phase 4). Empty result is
          // an acceptable degraded mode — themes show "no results"
          // instead of an error banner.
          setResults(EMPTY);
          return;
        }
        const json = (await res.json()) as Partial<SearchResults> & {
          data?: Partial<SearchResults>;
        };
        const body = json.data || json;
        if (requestId !== lastRequestId.current) return;
        setResults({
          products: body.products || [],
          collections: body.collections || [],
          pages: body.pages || [],
          articles: body.articles || [],
          total: body.total || 0,
        });
      } catch (err) {
        if (requestId !== lastRequestId.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setResults(EMPTY);
      } finally {
        if (requestId === lastRequestId.current) setLoading(false);
      }
    };

    if (immediate || mode === "full") {
      void run();
      return;
    }
    const t = setTimeout(run, debounceMs);
    return () => clearTimeout(t);
  }, [query, mode, debounceMs, immediate, limit, types?.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return { query, results, loading, error };
}
