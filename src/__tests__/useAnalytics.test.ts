/**
 * @vitest-environment happy-dom
 *
 * Tests for the funnel-event branch of useAnalytics.
 *
 * The CustomEvent dispatch + non-funnel fallback are exercised
 * implicitly here too; we focus on the strict funnel-event shape and
 * the attribution-envelope wiring because those are what drive the
 * journey + multi-touch dashboards.
 *
 * Run with: npx vitest run src/__tests__/useAnalytics.test.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dispatchAnalyticsEvent } from "../hooks/useAnalytics";

// Type the per-tab session-fingerprint shim. The __numu_attribution
// global is already declared in useAnalytics.ts; redeclaring it here
// would conflict, so we cast inline when the test needs to assign it.
declare global {
  interface Window {
    __numu_session_fp?: string;
  }
}

interface AttributionWindow {
  __numu_attribution?: { get(): unknown };
  __numu_customer?: { getId(): string | null };
  __numu_session_fp?: string;
}

const TEST_ENVELOPE = {
  v: 1,
  first_touch: {
    ts: "2026-05-22T10:00:00.000Z",
    utm_source: "facebook",
    utm_medium: "social",
    utm_campaign: "eid-sale-AB7K9X",
    utm_term: null,
    utm_content: null,
    gclid: null,
    fbclid: "IwAR0xyz",
    referrer: "https://facebook.com/",
    landing_path: "/product/abaya",
  },
  last_touch: {
    ts: "2026-05-22T10:30:00.000Z",
    utm_source: "email",
    utm_medium: "newsletter",
    utm_campaign: "eid-sale-AB7K9X",
    utm_term: null,
    utm_content: null,
    gclid: null,
    fbclid: null,
    referrer: null,
    landing_path: "/checkout",
  },
  session_id: "01HEXAMPLE0000000000000000",
};

describe("dispatchAnalyticsEvent", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    // Clean per-tab fingerprint between tests.
    const w = window as unknown as AttributionWindow;
    delete w.__numu_session_fp;
    delete w.__numu_attribution;
    delete w.__numu_customer;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends the funnel-event shape for standard step names", async () => {
    (window as unknown as AttributionWindow).__numu_attribution = {
      get: () => TEST_ENVELOPE,
    };

    dispatchAnalyticsEvent("add_to_cart", { product_id: "abc", quantity: 2 });

    // Microtask flush — fetch is fired off a void async IIFE.
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/storefront/track");
    const body = JSON.parse(init.body as string);
    expect(body.step).toBe("add_to_cart");
    expect(body.step_data).toEqual({ product_id: "abc", quantity: 2 });
    expect(body.attribution).toBeDefined();
    expect(body.attribution.last_touch.utm_source).toBe("email");
    // The session_id from the envelope becomes the fingerprint so
    // funnel + journey + multi-touch all key on the same identity.
    expect(body.fingerprint).toBe("01HEXAMPLE0000000000000000");
    // Idempotency: every funnel-event request carries a client UUID.
    expect(body.event_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("maps standard event names to the correct funnel steps", async () => {
    (window as unknown as AttributionWindow).__numu_attribution = {
      get: () => TEST_ENVELOPE,
    };

    const cases: Array<[string, string]> = [
      ["page_view", "page_view"],
      ["view_item", "product_view"],
      ["add_to_cart", "add_to_cart"],
      ["begin_checkout", "checkout_started"],
      ["purchase", "order_completed"],
    ];
    for (const [eventName, expectedStep] of cases) {
      fetchSpy.mockClear();
      dispatchAnalyticsEvent(eventName);
      await Promise.resolve();
      await Promise.resolve();
      const body = JSON.parse(
        (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body.step).toBe(expectedStep);
    }
  });

  it("falls back to the loose payload shape for non-funnel events", async () => {
    (window as unknown as AttributionWindow).__numu_attribution = {
      get: () => TEST_ENVELOPE,
    };

    dispatchAnalyticsEvent("custom_theme_event", { foo: "bar" });

    await Promise.resolve();
    await Promise.resolve();

    const body = JSON.parse(
      (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
    );
    // Loose shape (custom events aren't in the funnel mapping):
    expect(body.event).toBe("custom_theme_event");
    expect(body.payload).toEqual({ foo: "bar" });
    expect(body.step).toBeUndefined();
    expect(body.fingerprint).toBeUndefined();
  });

  it("uses a per-tab fallback fingerprint when the envelope is absent", async () => {
    // No __numu_attribution bridge — simulates first-visit-before-
    // AttributionProvider-effect-runs case.
    dispatchAnalyticsEvent("page_view");
    await Promise.resolve();
    await Promise.resolve();
    dispatchAnalyticsEvent("view_item");
    await Promise.resolve();
    await Promise.resolve();

    const fp1 = JSON.parse(
      (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
    ).fingerprint;
    const fp2 = JSON.parse(
      (fetchSpy.mock.calls[1] as [string, RequestInit])[1].body as string,
    ).fingerprint;
    // Same tab, same fingerprint — otherwise the funnel dashboard
    // would over-count distinct sessions for visitors without UTMs.
    expect(fp1).toBe(fp2);
    expect(fp1).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("omits attribution when the envelope bridge is unavailable", async () => {
    dispatchAnalyticsEvent("add_to_cart");
    await Promise.resolve();
    await Promise.resolve();

    const body = JSON.parse(
      (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
    );
    // Absent rather than null — matches "no signal to report".
    expect(body.attribution).toBeUndefined();
  });

  it("survives a thrown envelope bridge without crashing", async () => {
    (window as unknown as AttributionWindow).__numu_attribution = {
      get: () => {
        throw new Error("bridge broken");
      },
    };

    // The whole point of analytics is that it never breaks the UI.
    // A misbehaving theme overriding the bridge must not surface up.
    expect(() => dispatchAnalyticsEvent("add_to_cart")).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    // POST still fires (with no attribution).
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(
      (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
    );
    expect(body.attribution).toBeUndefined();
  });

  it("includes customer_id when the host storefront installs the bridge", async () => {
    (window as unknown as AttributionWindow).__numu_customer = {
      getId: () => "11111111-2222-3333-4444-555555555555",
    };

    dispatchAnalyticsEvent("add_to_cart", { product_id: "abc" });
    await Promise.resolve();
    await Promise.resolve();

    const body = JSON.parse(
      (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
    );
    expect(body.customer_id).toBe("11111111-2222-3333-4444-555555555555");
  });

  it("omits customer_id when the host bridge returns null (guest visitor)", async () => {
    (window as unknown as AttributionWindow).__numu_customer = {
      getId: () => null,
    };

    dispatchAnalyticsEvent("add_to_cart");
    await Promise.resolve();
    await Promise.resolve();

    const body = JSON.parse(
      (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
    );
    // Absent rather than null in the wire body — matches the
    // attribution envelope's "no signal" semantic.
    expect(body.customer_id).toBeUndefined();
  });

  it("survives a thrown customer bridge without crashing", async () => {
    (window as unknown as AttributionWindow).__numu_customer = {
      getId: () => {
        throw new Error("customer bridge broken");
      },
    };

    expect(() => dispatchAnalyticsEvent("page_view")).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();

    const body = JSON.parse(
      (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
    );
    expect(body.customer_id).toBeUndefined();
  });

  it("still dispatches the window CustomEvent in parallel", () => {
    (window as unknown as AttributionWindow).__numu_attribution = {
      get: () => TEST_ENVELOPE,
    };
    const listener = vi.fn();
    window.addEventListener("numu:analytics:event", listener);

    dispatchAnalyticsEvent("page_view", { path: "/" });

    expect(listener).toHaveBeenCalledTimes(1);
    const evt = listener.mock.calls[0][0] as CustomEvent;
    expect(evt.detail.event).toBe("page_view");
    expect(evt.detail.payload).toEqual({ path: "/" });

    window.removeEventListener("numu:analytics:event", listener);
  });
});
