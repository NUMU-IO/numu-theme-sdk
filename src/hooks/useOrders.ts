"use client";

import { useEffect, useState } from "react";
import { useCustomer } from "./useCustomer";

/**
 * Customer order history.
 *
 * `useOrders()` returns the logged-in customer's orders, paginated.
 * The hook is gated on `useCustomer()` — when null (anonymous
 * visitor), it returns an empty list without hitting the network.
 *
 * `useOrder(id)` fetches a single order. Backend rejects with 404
 * when the id doesn't belong to the customer regardless of whether
 * it exists for someone else (avoids enumeration).
 */

export interface OrderListEntry {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  fulfillment_status: string;
  total: number;
  currency: string;
  created_at: string | null;
  item_count?: number;
}

export interface OrderListState {
  orders: OrderListEntry[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

export interface OrderDetail extends OrderListEntry {
  line_items: unknown[];
  shipping_address?: Record<string, unknown> | null;
  billing_address?: Record<string, unknown> | null;
  subtotal: number;
  shipping_cost: number;
  tax_amount: number;
  discount_amount: number;
}

export interface OrderState {
  order: OrderDetail | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

function unwrap(json: unknown): unknown {
  if (json && typeof json === "object" && "data" in json) {
    return (json as { data: unknown }).data;
  }
  return json;
}

export function useOrders(): OrderListState {
  const customer = useCustomer();
  const [orders, setOrders] = useState<OrderListEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!customer) {
      // Anonymous: nothing to fetch. Reset state so a logged-out
      // visitor doesn't see stale data carried over from a prior session.
      setOrders([]);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch("/api/customer/me/orders", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = unwrap(await res.json());
        if (cancelled) return;
        // Backend returns either a list directly or a paginated wrapper
        // `{ items, total, page, ... }`. Normalize to a list.
        const list = Array.isArray(body)
          ? body
          : Array.isArray((body as Record<string, unknown>)?.items)
            ? ((body as { items: OrderListEntry[] }).items)
            : [];
        setOrders(list as OrderListEntry[]);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customer, tick]);

  return {
    orders,
    loading,
    error,
    refresh: () => setTick((t) => t + 1),
  };
}

export function useOrder(id: string | null | undefined): OrderState {
  const customer = useCustomer();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!id) {
      setOrder(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        // Logged-in customer → full owned-order detail. Guest (the common
        // post-purchase order-confirmation case) → the PUBLIC order-tracking
        // endpoint, protected by the unguessable order UUID. Without this a
        // guest's confirmation page showed "order not found".
        const trackUrl = `/api/storefront/track/${encodeURIComponent(id)}`;
        let res = customer
          ? await fetch(`/api/customer/me/orders/${encodeURIComponent(id)}`, {
              method: "GET",
              credentials: "include",
              cache: "no-store",
            })
          : await fetch(trackUrl, { cache: "no-store" });
        // A logged-in user opening someone else's confirmation link (or an
        // order not yet linked to their account) 404s on /me/orders — fall
        // back to the public track view so the page still renders.
        if (!res.ok && customer) {
          res = await fetch(trackUrl, { cache: "no-store" });
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = unwrap(await res.json());
        if (cancelled) return;
        setOrder(body as OrderDetail);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customer, id, tick]);

  return {
    order,
    loading,
    error,
    refresh: () => setTick((t) => t + 1),
  };
}
