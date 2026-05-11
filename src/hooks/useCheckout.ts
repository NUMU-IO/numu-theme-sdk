"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Programmatic checkout driver — Phase 7.6.
 *
 * The storefront's multi-step checkout pages (Phase 1.2) own the
 * default flow: contact → shipping → payment → review → processing →
 * thank-you. This hook gives themes a programmatic alternative so a
 * BYOT theme can render the checkout exactly how it wants — single-
 * page, accordion, full-bleed hero, whatever — without being forced
 * through the platform's step pages.
 *
 * State lives in `numu_checkout_state` sessionStorage (same blob the
 * platform's step pages use) so themes that drive checkout
 * programmatically can hand off to the platform mid-flow (e.g. theme
 * collects contact + shipping, then redirects to /checkout/payment
 * for the gateway capture). The platform-side state machine guards
 * deep-links via `hasContactStep / hasShippingStep / hasPaymentStep`
 * regardless of how the state got populated.
 *
 * Usage:
 *
 *     const checkout = useCheckout();
 *     checkout.contact.set({ email, phone, shipping_address });
 *     await checkout.shipping.refresh();
 *     checkout.shipping.select(rate.id);
 *     checkout.payment.select("paymob");
 *     const result = await checkout.placeOrder();
 *     if (result.payment_url) window.location.assign(result.payment_url);
 */

export type CheckoutStep =
  | "contact"
  | "shipping"
  | "payment"
  | "review"
  | "processing";

export interface CheckoutAddress {
  first_name?: string;
  last_name?: string;
  line1?: string;
  line2?: string | null;
  city?: string;
  state?: string | null;
  postal_code?: string | null;
  country?: string;
  phone?: string | null;
}

export interface ShippingRateOption {
  id: string;
  name: string;
  amount_cents: number;
  currency: string;
  estimated_days_min?: number | null;
  estimated_days_max?: number | null;
  carrier?: string | null;
}

export interface CheckoutSessionState {
  email: string;
  phone: string;
  shipping_address: CheckoutAddress;
  selected_shipping_rate_id: string | null;
  shipping_method: string | null;
  payment_method: string | null;
  cod_requested: boolean;
  deposit_gateway: string | null;
  saved_payment_method_id: string | null;
  customer_notes: string;
  coupon_code: string;
}

export interface PlaceOrderResult {
  order_id: string;
  order_number: string;
  total: number;
  currency: string;
  payment_status: string;
  payment_url?: string | null;
  payment_data?: Record<string, unknown> | null;
}

export interface CheckoutApi {
  state: CheckoutSessionState;
  step: CheckoutStep;
  contact: {
    set: (input: {
      email?: string;
      phone?: string;
      shipping_address?: CheckoutAddress;
    }) => void;
    isComplete: () => boolean;
  };
  shipping: {
    rates: ShippingRateOption[] | null;
    loading: boolean;
    refresh: () => Promise<ShippingRateOption[]>;
    select: (rateId: string) => void;
    isComplete: () => boolean;
  };
  payment: {
    select: (
      method: string,
      opts?: { saved_payment_method_id?: string; deposit_gateway?: string },
    ) => void;
    isComplete: () => boolean;
  };
  setNotes: (notes: string) => void;
  setCoupon: (code: string) => void;
  placeOrder: () => Promise<PlaceOrderResult>;
  reset: () => void;
}

const STORAGE_KEY = "numu_checkout_state";

const EMPTY_STATE: CheckoutSessionState = {
  email: "",
  phone: "",
  shipping_address: {},
  selected_shipping_rate_id: null,
  shipping_method: null,
  payment_method: null,
  cod_requested: false,
  deposit_gateway: null,
  saved_payment_method_id: null,
  customer_notes: "",
  coupon_code: "",
};

function readState(): CheckoutSessionState {
  if (typeof window === "undefined") return { ...EMPTY_STATE };
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_STATE };
    return { ...EMPTY_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY_STATE };
  }
}

function writeState(state: CheckoutSessionState): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    // Notify any other useCheckout() consumers in the same tab.
    window.dispatchEvent(new CustomEvent("numu:checkout:updated"));
  } catch {
    /* Safari private mode → swallow */
  }
}

function hasContact(s: CheckoutSessionState): boolean {
  return Boolean(
    s.email &&
      s.shipping_address?.line1 &&
      s.shipping_address?.city &&
      s.shipping_address?.country,
  );
}

function hasShipping(s: CheckoutSessionState): boolean {
  return hasContact(s) && Boolean(s.selected_shipping_rate_id);
}

function hasPayment(s: CheckoutSessionState): boolean {
  return hasShipping(s) && Boolean(s.payment_method);
}

function resolveStep(s: CheckoutSessionState): CheckoutStep {
  if (!hasContact(s)) return "contact";
  if (!hasShipping(s)) return "shipping";
  if (!hasPayment(s)) return "payment";
  return "review";
}

export function useCheckout(): CheckoutApi {
  const [state, setState] = useState<CheckoutSessionState>(() => readState());
  const [rates, setRates] = useState<ShippingRateOption[] | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);

  // Sync from sessionStorage when other consumers update (other tab
  // would not trigger the same-tab event but storage event handles it).
  useEffect(() => {
    function onChange() {
      setState(readState());
    }
    window.addEventListener("numu:checkout:updated", onChange);
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY) onChange();
    });
    return () => {
      window.removeEventListener("numu:checkout:updated", onChange);
    };
  }, []);

  const patch = useCallback((partial: Partial<CheckoutSessionState>) => {
    setState((prev) => {
      const next = { ...prev, ...partial };
      writeState(next);
      return next;
    });
  }, []);

  const refreshShipping = useCallback(async (): Promise<ShippingRateOption[]> => {
    setRatesLoading(true);
    try {
      const res = await fetch("/api/shipping/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipping_address: state.shipping_address }),
      });
      if (!res.ok) {
        setRates([]);
        return [];
      }
      const body = await res.json();
      const list: ShippingRateOption[] =
        (body?.data?.options || body?.data || body?.options || []) as ShippingRateOption[];
      setRates(list);
      return list;
    } catch {
      setRates([]);
      return [];
    } finally {
      setRatesLoading(false);
    }
  }, [state.shipping_address]);

  const placeOrder = useCallback(async (): Promise<PlaceOrderResult> => {
    // Cart line items are read server-side from the session cookie;
    // we still pass an empty list because the schema requires the field.
    const payload = {
      line_items: [],
      shipping_address: state.shipping_address,
      payment_method: state.payment_method,
      selected_shipping_rate_id: state.selected_shipping_rate_id,
      shipping_method: state.shipping_method,
      guest_email: state.email,
      cod_requested: state.cod_requested,
      deposit_gateway: state.deposit_gateway,
      saved_payment_method_id: state.saved_payment_method_id,
      customer_notes: state.customer_notes || null,
      coupon_code: state.coupon_code || null,
    };
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Idempotency-Key prevents a double-click double-charge.
        "Idempotency-Key":
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,
      },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) {
      const detail =
        body?.detail || body?.error || `Checkout failed (${res.status})`;
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }
    const data = (body?.data || body) as PlaceOrderResult;
    return data;
  }, [state]);

  const step = useMemo(() => resolveStep(state), [state]);

  const api = useMemo<CheckoutApi>(
    () => ({
      state,
      step,
      contact: {
        set: (input) =>
          patch({
            ...(input.email !== undefined && { email: input.email }),
            ...(input.phone !== undefined && { phone: input.phone }),
            ...(input.shipping_address && {
              shipping_address: {
                ...state.shipping_address,
                ...input.shipping_address,
              },
              // Invalidate downstream picks when address changes.
              selected_shipping_rate_id: null,
              shipping_method: null,
            }),
          }),
        isComplete: () => hasContact(state),
      },
      shipping: {
        rates,
        loading: ratesLoading,
        refresh: refreshShipping,
        select: (rateId) => {
          const rate = rates?.find((r) => r.id === rateId);
          patch({
            selected_shipping_rate_id: rateId,
            shipping_method: rate?.name || null,
          });
        },
        isComplete: () => hasShipping(state),
      },
      payment: {
        select: (method, opts) =>
          patch({
            payment_method: method,
            cod_requested: method === "cod",
            deposit_gateway: opts?.deposit_gateway || null,
            saved_payment_method_id: opts?.saved_payment_method_id || null,
          }),
        isComplete: () => hasPayment(state),
      },
      setNotes: (notes) => patch({ customer_notes: notes }),
      setCoupon: (code) => patch({ coupon_code: code }),
      placeOrder,
      reset: () => {
        if (typeof window !== "undefined") {
          try {
            window.sessionStorage.removeItem(STORAGE_KEY);
          } catch {
            /* swallow */
          }
        }
        setState({ ...EMPTY_STATE });
        setRates(null);
      },
    }),
    [state, step, rates, ratesLoading, refreshShipping, placeOrder, patch],
  );

  return api;
}
