"use client";
import { useCallback, useEffect, useState } from "react";
import { useCustomer } from "./useCustomer";

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
 * mutation methods will short-circuit to the server fetch and the
 * effect below will drop the localStorage path for authed users.
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

function writeLocal(storeId: string, items: WishlistItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(storeId), JSON.stringify(items));
  } catch {
    /* quota / private mode — wishlist degrades to in-memory for the session */
  }
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

/**
 * @param storeId The store the wishlist is scoped to. Pass `useShop().id`.
 *                Without it, the hook can't keep one merchant's wishlist
 *                from leaking into another's localStorage on a shared
 *                domain (e.g. apex preview).
 */
export function useWishlist(storeId: string): WishlistState {
  const customer = useCustomer();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Hydrate from localStorage on mount. When the server-side endpoint
  // lands, an authed customer will fetch from there instead.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setItems(readLocal(storeId));
    setLoading(false);
  }, [storeId, customer?.id]);

  const has = useCallback(
    (productId: string, variantId?: string | null) =>
      items.some((it) => sameItem(it, productId, variantId)),
    [items],
  );

  const addToWishlist = useCallback(
    (productId: string, variantId?: string | null) => {
      setItems((prev) => {
        if (prev.some((it) => sameItem(it, productId, variantId))) {
          return prev;
        }
        const next: WishlistItem[] = [
          ...prev,
          {
            product_id: productId,
            variant_id: variantId ?? null,
            added_at: Date.now(),
          },
        ];
        writeLocal(storeId, next);
        return next;
      });
    },
    [storeId],
  );

  const removeFromWishlist = useCallback(
    (productId: string, variantId?: string | null) => {
      setItems((prev) => {
        const next = prev.filter((it) => !sameItem(it, productId, variantId));
        writeLocal(storeId, next);
        return next;
      });
    },
    [storeId],
  );

  const clear = useCallback(() => {
    setItems([]);
    writeLocal(storeId, []);
  }, [storeId]);

  return { items, loading, has, addToWishlist, removeFromWishlist, clear };
}
