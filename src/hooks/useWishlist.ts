"use client";
import { useCallback } from "react";
import { useCachedResource, readResource } from "../lib/dataCache";

/**
 * Wishlist hook with localStorage fallback.
 *
 * Architecture (Phase 4 lands the server side):
 *   - Authenticated customer: persists to /api/customer/me/wishlist
 *     (server-backed, syncs across devices).
 *   - Anonymous visitor: persists to localStorage under
 *     `numu_wishlist_<store_id>`. On login, the wishlist merges into
 *     the server-side list (mirrors the cart's session→customer flow).
 *
 * v1 implementation: localStorage only. The /api/customer/me/wishlist
 * endpoint isn't wired yet; an authed visitor still gets the local
 * fallback so themes work end-to-end. When the endpoint lands, the
 * fetcher below swaps its localStorage read for the server fetch and the
 * mutation methods gain a `{ revalidate: true }` write-through.
 *
 * Phase 3 (client-data layer): the items list now lives in the shared
 * `useCachedResource` store keyed by `numu_wishlist_<store_id>`, NOT in
 * per-instance `useState`. Previously two `<Heart>`s for the same product
 * each held their own copy, so adding via one never re-rendered the other —
 * the two hearts DESYNCED. Now every `useWishlist(storeId)` consumer reads
 * and writes ONE shared entry, so an add/remove anywhere reflows every heart.
 * Writes are optimistic (the shared store updates instantly) and roll back if
 * persistence throws.
 */

export interface WishlistItem {
  product_id: string;
  /** Optional variant scoping — themes that show variant pickers can
   *  wishlist a specific size/color combo separately. */
  variant_id?: string | null;
  /** Server timestamp once persistence lands; ms-since-epoch in v1. */
  added_at: number;
}

export interface WishlistState {
  items: WishlistItem[];
  loading: boolean;
  has: (productId: string, variantId?: string | null) => boolean;
  addToWishlist: (productId: string, variantId?: string | null) => void;
  removeFromWishlist: (productId: string, variantId?: string | null) => void;
  clear: () => void;
}

function storageKey(storeId: string): string {
  return `numu_wishlist_${storeId}`;
}

function readLocal(storeId: string): WishlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(storeId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WishlistItem[]) : [];
  } catch {
    return [];
  }
}

/**
 * Persist the list. Unlike the previous swallow-all writer, this THROWS on a
 * write failure (quota / private mode) so the optimistic mutation can roll
 * back — the shared store must not diverge from what actually persisted.
 */
function persistWishlist(storeId: string, items: WishlistItem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(storeId), JSON.stringify(items));
}

function sameItem(
  a: WishlistItem,
  productId: string,
  variantId?: string | null,
): boolean {
  return (
    a.product_id === productId && (a.variant_id ?? null) === (variantId ?? null)
  );
}

// Stable empty reference so `items` identity doesn't churn every render.
const EMPTY: WishlistItem[] = [];

/**
 * @param storeId The store the wishlist is scoped to. Pass `useShop().id`.
 *                Without it, the hook can't keep one merchant's wishlist
 *                from leaking into another's localStorage on a shared
 *                domain (e.g. apex preview).
 */
export function useWishlist(storeId: string): WishlistState {
  const key = storageKey(storeId);

  // Hydrate from localStorage. Wrapped in a resolved promise so the shared
  // cache has one code path for both the v1 localStorage read and the future
  // server-backed fetch. SSR-safe: readLocal returns [] on the server and the
  // fetch only runs client-side inside useCachedResource's effect.
  const fetcher = useCallback(
    () => Promise.resolve(readLocal(storeId)),
    [storeId],
  );

  const { data, isLoading, mutate } = useCachedResource<WishlistItem[]>(
    key,
    fetcher,
    { initialData: EMPTY },
  );

  const items = data ?? EMPTY;

  const has = useCallback(
    (productId: string, variantId?: string | null) =>
      items.some((it) => sameItem(it, productId, variantId)),
    [items],
  );

  // Shared optimistic write: compute next from the CURRENT shared value (not a
  // stale closure), publish it to every subscriber immediately, then persist;
  // roll back to the previous value if the write throws. Returning `null` from
  // `compute` means "no change" (e.g. adding a duplicate) — skip entirely.
  const applyOptimistic = useCallback(
    (compute: (prev: WishlistItem[]) => WishlistItem[] | null) => {
      const prev = readResource<WishlistItem[]>(key) ?? EMPTY;
      const next = compute(prev);
      if (next === null) return;
      mutate(next, { revalidate: false });
      try {
        persistWishlist(storeId, next);
      } catch {
        mutate(prev, { revalidate: false });
      }
    },
    [key, storeId, mutate],
  );

  const addToWishlist = useCallback(
    (productId: string, variantId?: string | null) =>
      applyOptimistic((prev) =>
        prev.some((it) => sameItem(it, productId, variantId))
          ? null
          : [
              ...prev,
              {
                product_id: productId,
                variant_id: variantId ?? null,
                added_at: Date.now(),
              },
            ],
      ),
    [applyOptimistic],
  );

  const removeFromWishlist = useCallback(
    (productId: string, variantId?: string | null) =>
      applyOptimistic((prev) => {
        const next = prev.filter((it) => !sameItem(it, productId, variantId));
        return next.length === prev.length ? null : next;
      }),
    [applyOptimistic],
  );

  const clear = useCallback(
    () => applyOptimistic((prev) => (prev.length === 0 ? null : [])),
    [applyOptimistic],
  );

  return { items, loading: isLoading, has, addToWishlist, removeFromWishlist, clear };
}
