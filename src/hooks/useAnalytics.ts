"use client";
import { useCallback, useMemo } from "react";

/**
 * Theme-facing analytics dispatcher.
 *
 * Two delivery channels, fired in parallel:
 *   1. Server-side track: POST /api/storefront/track with the event
 *      payload. The host storefront proxies to FastAPI's funnel-event
 *      endpoint (/storefront/store/{id}/track) and fans out to
 *      merchant-configured pixels (GA4 Measurement Protocol, Meta CAPI,
 *      TikTok Events API). Failed pixels never block the UI — we
 *      don't await the response.
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
 *
 * Funnel-event mapping
 * --------------------
 * Standard event names that map to the backend's funnel steps are
 * dispatched with the full funnel-event payload shape (path,
 * session_fingerprint, attribution envelope from
 * window.__numu_attribution). This is what powers the merchant
 * funnel / journey / multi-touch attribution dashboards. Events with
 * no funnel mapping still POST with the loose `{event, payload}`
 * shape — the proxy forwards them so the pixel-fanout layer still
 * fires.
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

/**
 * Standard event name → backend funnel step mapping.
 *
 * Only events listed here drive the funnel / attribution dashboards.
 * Everything else still POSTs (for pixel fanout) but doesn't land in
 * the funnel_events table. The mapping mirrors what the bazaar
 * storefront's trackingService uses on the SaaS side.
 */
const EVENT_TO_FUNNEL_STEP: Record<string, string> = {
  page_view: "page_view",
  view_item: "product_view",
  view_collection: "page_view",
  add_to_cart: "add_to_cart",
  begin_checkout: "checkout_started",
  purchase: "order_completed",
  // Wave 2+ standard Meta events — backend's FUNNEL_STEP_TO_META_EVENT
  // table accepts these as funnel steps directly.
  search: "search",
  lead: "lead",
  sign_up: "complete_registration",
  add_to_wishlist: "add_to_wishlist",
  add_payment_info: "add_payment_info",
};

interface AttributionEnvelope {
  v?: number;
  first_touch?: unknown;
  last_touch?: unknown;
  session_id?: string | null;
}

interface NumuAttributionBridge {
  get(): AttributionEnvelope | null;
}

declare global {
  interface Window {
    __numu_attribution?: NumuAttributionBridge;
  }
}

function readAttribution(): AttributionEnvelope | null {
  if (typeof window === "undefined") return null;
  try {
    return window.__numu_attribution?.get?.() ?? null;
  } catch {
    return null;
  }
}

/**
 * Session fingerprint for funnel-event dedup.
 *
 * The attribution envelope's session_id (ULID, stable for cookie
 * lifetime) is the natural fingerprint — same cookie lifetime as the
 * attribution window, so funnel + journey + multi-touch all agree on
 * what "one session" means.
 *
 * Fallback: a per-tab random string when no envelope exists yet (first
 * visit before AttributionProvider's effect has run). Persisted on the
 * window so subsequent calls in the same tab reuse it — otherwise
 * each event would generate its own fingerprint and the funnel
 * dashboard would over-count distinct sessions.
 */
function getFingerprint(): string {
  if (typeof window === "undefined") return "ssr";
  const env = readAttribution();
  if (env?.session_id) return env.session_id;

  const w = window as unknown as { __numu_session_fp?: string };
  if (w.__numu_session_fp) return w.__numu_session_fp;
  // crypto.randomUUID is universally available in our supported
  // browsers (no IE / pre-2022 mobile Safari). Skip the fallback.
  const fp = crypto.randomUUID();
  w.__numu_session_fp = fp;
  return fp;
}

/**
 * Free function body of the hook's `track`.
 *
 * Extracted so unit tests can call it directly without spinning up a
 * React renderer for what is essentially a side-effect dispatcher.
 * The exported `useAnalytics` hook is a thin memoization wrapper.
 */
export function dispatchAnalyticsEvent(
  eventName: string,
  payload: AnalyticsPayload = {},
): void {
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

  // 2. Server-side fanout. Funnel-step events get the strict payload
  //    shape the backend's funnel_events table expects (path,
  //    fingerprint, step, step_data, attribution). Non-funnel events
  //    keep the loose shape for the pixel-fanout layer.
  const step = EVENT_TO_FUNNEL_STEP[eventName] ?? null;
  const body: Record<string, unknown> = step
    ? {
        event_id: crypto.randomUUID(),
        path: window.location.pathname,
        fingerprint: getFingerprint(),
        step,
        step_data: payload,
        referrer:
          typeof document !== "undefined" && document.referrer
            ? document.referrer
            : undefined,
        attribution: readAttribution() ?? undefined,
      }
    : {
        event: eventName,
        payload,
        ts: Date.now(),
        attribution: readAttribution() ?? undefined,
      };

  void (async () => {
    try {
      await fetch("/api/storefront/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true, // survive page-unload (e.g. begin_checkout → redirect)
      });
    } catch {
      /* swallowed by design */
    }
  })();
}

export function useAnalytics(): AnalyticsApi {
  const track = useCallback(
    (eventName: string, payload: AnalyticsPayload = {}) => {
      dispatchAnalyticsEvent(eventName, payload);
    },
    [],
  );

  return useMemo(() => ({ track }), [track]);
}
