"use client";
import { useContext, useEffect, useMemo, useState } from "react";
import {
  LocalizationContext,
  NavigationContext,
  type MenuItemData,
} from "../contexts";

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
  /**
   * §5 hide-page → hide-nav-link. `false` when the target CMS page is
   * unpublished/deleted (backend-annotated). Defaults to `true` (visible)
   * when the backend doesn't annotate, so themes can safely filter on
   * `item.target_visible !== false`.
   */
  target_visible: boolean;
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
 * Resolve a bilingual label to a single display string for `locale`,
 * degrading gracefully: active locale → English → Arabic → first value.
 */
function localizeLabel(
  label: Record<string, string> | undefined,
  locale: string,
): string {
  if (!label) return "";
  return (
    label[locale] ||
    label.en ||
    label.ar ||
    Object.values(label).find((v) => !!v) ||
    ""
  );
}

/** Map the backend item `type` onto the SDK's `resource_type` union. */
function mapResourceType(type?: string | null): NavigationItem["resource_type"] {
  switch (type) {
    case "product":
      return "product";
    case "collection":
      return "collection";
    case "page":
      return "page";
    case "blog":
      return "blog";
    case "article":
      return "article";
    case "http":
    case "url":
      return "url";
    default:
      return null;
  }
}

/** Localize a raw (bilingual) menu item tree into display NavigationItems. */
function toNavigationItem(raw: MenuItemData, locale: string): NavigationItem {
  return {
    id: raw.id,
    title: localizeLabel(raw.label, locale),
    url: raw.url || "/",
    resource_type: mapResourceType(raw.type),
    resource_handle: raw.resource_id ?? null,
    target_visible: raw.target_visible !== false,
    children: (raw.children ?? [])
      .map((child) => toNavigationItem(child, locale))
      .filter((child) => child.target_visible),
  };
}

/**
 * Fetch a merchant-managed nav menu by handle.
 *
 * Resolution order (Phase 2.4):
 *   1. Host-injected menus — the storefront resolves menus server-side
 *      (`GET /storefront/store/{id}/menus`) and injects them via
 *      `NuMuProvider`'s `navigation` prop → `NavigationContext`. When the
 *      handle is present we localize + return it synchronously, no fetch.
 *      A non-empty map that lacks the handle means "no such menu" → [].
 *   2. `options.initialItems` — a theme that pre-fetched its own list.
 *   3. Client fetch of `GET /api/storefront/navigation/{handle}` — the
 *      legacy fallback for hosts that inject nothing. On 404 / network
 *      error the hook resolves to [] (a missing menu is a soft failure;
 *      the theme falls back to its own DEFAULT_NAV).
 */
export function useNavigation(
  handle: string,
  options?: { initialItems?: NavigationItem[] },
): NavigationState {
  // NavigationContext defaults to {} outside a provider; LocalizationContext
  // is read defensively (no throw) so useNavigation works even if a theme
  // calls it above NuMuProvider in a test harness.
  const navMap = useContext(NavigationContext);
  const localization = useContext(LocalizationContext);
  const locale = localization?.locale ?? "en";

  const hostProvidedAny = !!navMap && Object.keys(navMap).length > 0;
  const rawItems = handle ? navMap?.[handle] : undefined;

  // Localized view of host-injected items. `null` means "host wired no
  // navigation at all" → fall through to initialItems / fetch. `[]` means
  // the host IS authoritative but this handle is absent/empty → render
  // nothing (no doomed fetch).
  const hostItems = useMemo<NavigationItem[] | null>(() => {
    if (rawItems)
      return rawItems
        .map((it) => toNavigationItem(it, locale))
        // §5 hide-page → hide-nav-link: drop items whose target CMS page is
        // unpublished/deleted (backend-annotated). Children already filtered
        // in toNavigationItem; this drops hidden top-level entries so every
        // theme using useNavigation gets the behaviour for free.
        .filter((it) => it.target_visible);
    if (hostProvidedAny) return [];
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawItems, hostProvidedAny, locale]);

  const [items, setItems] = useState<NavigationItem[]>(
    hostItems ?? options?.initialItems ?? cache.get(handle) ?? [],
  );
  const [loading, setLoading] = useState(
    hostItems === null && !options?.initialItems && !cache.has(handle),
  );
  const [error, setError] = useState<Error | null>(null);

  // Keep items in sync with host-injected menus (locale switch, or the
  // map arriving after first paint). When the host is authoritative we
  // never fetch.
  useEffect(() => {
    if (hostItems === null) return;
    setItems(hostItems);
    setLoading(false);
    setError(null);
  }, [hostItems]);

  useEffect(() => {
    // Host-injected menus win — skip the network entirely.
    if (hostItems !== null) return;
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
    // Deliberate: re-run when `handle` or host-injection state changes;
    // `initialItems` change shouldn't refetch (theme passes it once).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, hostItems === null]);

  return { items, loading, error };
}
