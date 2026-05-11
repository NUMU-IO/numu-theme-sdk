"use client";
import { useEffect, useState } from "react";

/**
 * Menu item, modeled on Shopify's `linklists` entries.
 *
 * Themes typically render header/footer nav as a tree — we expose
 * `children` so a single fetch hydrates an arbitrary depth. Backends
 * that don't support nesting return a flat list (children=[]).
 */
export interface NavigationItem {
  id: string;
  title: string;
  /** The URL the menu item points to — relative path or absolute URL. */
  url: string;
  /** Optional foreign keys when the item references a typed resource. */
  resource_type?: "product" | "collection" | "page" | "blog" | "article" | "url" | null;
  resource_handle?: string | null;
  children: NavigationItem[];
}

export interface NavigationState {
  /** Items in display order. Empty array when the menu is missing or still loading. */
  items: NavigationItem[];
  loading: boolean;
  /** Non-null when the fetch failed — the menu still resolves to []. */
  error: Error | null;
}

const cache = new Map<string, NavigationItem[]>();

/**
 * Fetch a merchant-managed nav menu by handle.
 *
 * Backend contract: GET /api/storefront/navigation/{handle} →
 *   { items: NavigationItem[] }
 * On 404 / network error / non-OK response the hook returns an empty
 * list — the calling theme decides whether to render nothing or show
 * a fallback. We deliberately don't throw because a missing menu is
 * a soft failure (theme should still render).
 *
 * Why no SSR pre-fetch:
 *   The storefront's [domain]/layout doesn't currently inject menus
 *   into `page.data.navigation`. Once it does, themes can pass an
 *   `initialItems` prop (added below) and skip the round-trip; until
 *   then we fetch on mount with a process-local cache so the same
 *   handle doesn't fetch twice per session.
 */
export function useNavigation(
  handle: string,
  options?: { initialItems?: NavigationItem[] },
): NavigationState {
  const [items, setItems] = useState<NavigationItem[]>(
    options?.initialItems ?? cache.get(handle) ?? [],
  );
  const [loading, setLoading] = useState(
    !options?.initialItems && !cache.has(handle),
  );
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!handle) {
      setItems([]);
      setLoading(false);
      return;
    }
    if (cache.has(handle) && !options?.initialItems) {
      setItems(cache.get(handle) || []);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch(
          `/api/storefront/navigation/${encodeURIComponent(handle)}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          // 404 = no such menu; render nothing instead of an error UI.
          if (cancelled) return;
          cache.set(handle, []);
          setItems([]);
          return;
        }
        const json = (await res.json()) as
          | { items?: NavigationItem[] }
          | NavigationItem[];
        const list: NavigationItem[] = Array.isArray(json)
          ? json
          : json.items || [];
        if (cancelled) return;
        cache.set(handle, list);
        setItems(list);
      } catch (err) {
        if (cancelled) return;
        // Non-OK / network failure → empty list + surface error so
        // themes can decide whether to log or show a fallback.
        setError(err instanceof Error ? err : new Error(String(err)));
        setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Deliberate: re-run when `handle` changes; `initialItems` change
    // shouldn't refetch (theme passes it once at mount).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle]);

  return { items, loading, error };
}
