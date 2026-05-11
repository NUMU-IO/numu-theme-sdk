"use client";
import { useCallback, useMemo } from "react";

/**
 * Theme-facing analytics dispatcher.
 *
 * Two delivery channels, fired in parallel:
 *   1. Server-side track: POST /api/storefront/track with the event
 *      payload. The backend fans out to merchant-configured pixels
 *      (GA4 Measurement Protocol, Meta CAPI, TikTok Events API). The
 *      server-side fanout lands in Phase 4 — until then the endpoint
 *      either no-ops or returns 404, which is fine; we don't await
 *      the response because failed pixels must never block the UI.
 *   2. Window CustomEvent (`numu:analytics:event`): so theme devs can
 *      wire their own GTM container, third-party SDK, or in-house
 *      pixel without going through the server. Detail shape mirrors
 *      what gets POSTed.
 *
 * Standard event names (recommended for compatibility with GA4 / Meta):
 *   page_view, view_item, view_collection, search, add_to_cart,
 *   remove_from_cart, view_cart, begin_checkout, add_payment_info,
 *   add_shipping_info, purchase, refund, sign_up, login,
 *   add_to_wishlist, share. Custom names are also fine — the dispatcher
 *   does not validate, so themes can ship store-specific events.
 */

export interface AnalyticsPayload {
  /** Standard or custom event name. Lowercase + underscores recommended. */
  [key: string]: unknown;
}

export interface AnalyticsApi {
  /**
   * Fire an event. Non-blocking — both the fetch and the CustomEvent
   * dispatch happen in the next microtask; theme code shouldn't await.
   */
  track: (eventName: string, payload?: AnalyticsPayload) => void;
}

export function useAnalytics(): AnalyticsApi {
  const track = useCallback(
    (eventName: string, payload: AnalyticsPayload = {}) => {
      if (typeof window === "undefined") return;

      // 1. Window CustomEvent — synchronous, cheap. Themes that wire
      //    their own pixels listen here.
      try {
        window.dispatchEvent(
          new CustomEvent("numu:analytics:event", {
            detail: { event: eventName, payload, ts: Date.now() },
          }),
        );
      } catch {
        /* CustomEvent unsupported — no DOM event polyfill needed today. */
      }

      // 2. Server-side fanout. Fire-and-forget — never block on it.
      //    Errors are silently swallowed; analytics outages must not
      //    surface to the customer. The /api/storefront/track endpoint
      //    is OK to return 404 today (Phase 4 wires the dispatcher).
      void (async () => {
        try {
          await fetch("/api/storefront/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: eventName,
              payload,
              ts: Date.now(),
            }),
            keepalive: true, // survive page-unload (e.g. begin_checkout → redirect)
          });
        } catch {
          /* swallowed by design */
        }
      })();
    },
    [],
  );

  return useMemo(() => ({ track }), [track]);
}
