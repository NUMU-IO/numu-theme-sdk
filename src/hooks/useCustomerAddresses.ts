"use client";

import { useCallback, useEffect, useState } from "react";
import { useCustomer } from "./useCustomer";

/**
 * Customer address book. Used by:
 *   - The /account/addresses dashboard (list + CRUD).
 *   - Checkout autofill (default address selected by default).
 *
 * Mutations return the updated row (or void on delete) and bump the
 * internal tick so the list reflects state changes immediately.
 * Anonymous visitors get an empty list with no network calls.
 */

export interface CustomerAddress {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  phone?: string | null;
  label?: string | null;
  is_default?: boolean;
  // Optional geocoding fields — present when the merchant collects them.
  latitude?: number | null;
  longitude?: number | null;
}

export type AddressInput = Omit<CustomerAddress, "id" | "is_default"> & {
  is_default?: boolean;
};

export interface CustomerAddressesState {
  addresses: CustomerAddress[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
  addAddress: (input: AddressInput) => Promise<CustomerAddress | null>;
  updateAddress: (
    id: string,
    input: Partial<AddressInput>,
  ) => Promise<CustomerAddress | null>;
  deleteAddress: (id: string) => Promise<boolean>;
  setDefaultAddress: (id: string) => Promise<boolean>;
}

function unwrap(json: unknown): unknown {
  if (json && typeof json === "object" && "data" in json) {
    return (json as { data: unknown }).data;
  }
  return json;
}

async function readBody(res: Response): Promise<unknown> {
  try {
    return unwrap(await res.json());
  } catch {
    return null;
  }
}

export function useCustomerAddresses(): CustomerAddressesState {
  const customer = useCustomer();
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!customer) {
      setAddresses([]);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch("/api/customer/me/addresses", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await readBody(res);
        if (cancelled) return;
        const list = Array.isArray(body)
          ? body
          : Array.isArray((body as Record<string, unknown>)?.items)
            ? ((body as { items: CustomerAddress[] }).items)
            : [];
        setAddresses(list as CustomerAddress[]);
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

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // CSRF: cart and customer mutations both echo the `numu_csrf` cookie
  // value as `x-numu-csrf` header. Read it from document.cookie just-
  // in-time so we always send the freshest value (the cookie may be
  // refreshed by /api/cart on first mount).
  function readCsrf(): string | null {
    if (typeof document === "undefined") return null;
    const m = document.cookie.match(/(?:^|; )numu_csrf=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function mutationHeaders(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    const csrf = readCsrf();
    if (csrf) h["x-numu-csrf"] = csrf;
    return h;
  }

  const addAddress = useCallback(
    async (input: AddressInput) => {
      const res = await fetch("/api/customer/me/addresses", {
        method: "POST",
        credentials: "include",
        headers: mutationHeaders(),
        body: JSON.stringify(input),
      });
      if (!res.ok) return null;
      const created = (await readBody(res)) as CustomerAddress | null;
      refresh();
      return created;
    },
    [refresh],
  );

  const updateAddress = useCallback(
    async (id: string, input: Partial<AddressInput>) => {
      const res = await fetch(
        `/api/customer/me/addresses/${encodeURIComponent(id)}`,
        {
          method: "PUT",
          credentials: "include",
          headers: mutationHeaders(),
          body: JSON.stringify(input),
        },
      );
      if (!res.ok) return null;
      const updated = (await readBody(res)) as CustomerAddress | null;
      refresh();
      return updated;
    },
    [refresh],
  );

  const deleteAddress = useCallback(
    async (id: string) => {
      const res = await fetch(
        `/api/customer/me/addresses/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: mutationHeaders(),
        },
      );
      if (!res.ok) return false;
      refresh();
      return true;
    },
    [refresh],
  );

  const setDefaultAddress = useCallback(
    async (id: string) => {
      const res = await fetch(
        `/api/customer/me/addresses/${encodeURIComponent(id)}/default`,
        {
          method: "PUT",
          credentials: "include",
          headers: mutationHeaders(),
        },
      );
      if (!res.ok) return false;
      refresh();
      return true;
    },
    [refresh],
  );

  return {
    addresses,
    loading,
    error,
    refresh,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
  };
}
