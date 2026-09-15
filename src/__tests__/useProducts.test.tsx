/**
 * Unit tests for useProducts' `fetchIfMissing` escape hatch.
 *
 * This path was DEAD in production: it read `data.products` off the response,
 * while `/api/products` proxies FastAPI verbatim and answers the platform
 * envelope `{ success, data: { items: [...] } }`. The lookup was `undefined`,
 * so a theme that opted into the fetch made the request and then committed an
 * EMPTY list — the same blank grid it was trying to fix, only slower. The
 * identical bug had already been found and fixed in `useCollections`, and
 * neither fix had a test; this is that test for the products side.
 *
 * Uses React.createElement (no JSX) so the test transpiles without any
 * JSX-runtime config, matching the SDK's no-build test setup.
 */

import { createElement, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProducts } from "../hooks/useProducts";
import {
  LocalizationContext,
  PageContext,
  ShopContext,
  type LocalizationState,
} from "../contexts";
import { NuMuProvider } from "../components/NuMuProvider";
import type { Page, Store } from "../types/entities";
import type { ThemeSettingsV3 } from "../types/theme";

const store = { id: "store-1", name: "Vionne" } as unknown as Store;
const providerStore = { id: "store-1", name: "Vionne", slug: "vionne", currency: "EGP", default_language: "en" } as unknown as Store;
const themeSettings = { schema_version: 3, theme_id: "t", global_settings: {}, templates: {}, section_groups: {} } as unknown as ThemeSettingsV3;

// useProducts → useShop → useLocale, so the localization context has to exist
// even though nothing here reads a translated string.
const localization = {
  locale: "en",
  direction: "ltr",
  translations: {},
  formatMoney: (n: number) => String(n),
  formatDate: (d: string | Date) => String(d),
  formatNumber: (n: number) => String(n),
} as unknown as LocalizationState;

function wrapper(page: Page | null) {
  return ({ children }: { children: ReactNode }) =>
    createElement(
      LocalizationContext.Provider,
      { value: localization },
      createElement(
        ShopContext.Provider,
        { value: store },
        createElement(PageContext.Provider, { value: page }, children),
      ),
    );
}

/** A page with no pre-fetched products — i.e. /cart, /account, any CMS page. */
const noProductsPage: Page = { type: "page", title: "Cart", data: {} };

function mockFetchJson(body: unknown) {
  const spy = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

describe("useProducts", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reads page.data.products without any request", () => {
    const spy = mockFetchJson({});
    const { result } = renderHook(() => useProducts(), {
      wrapper: wrapper({
        type: "home",
        title: "Home",
        data: { products: [{ id: "p1", name: "Scarf" }] },
      } as Page),
    });
    expect(result.current.products).toHaveLength(1);
    expect(spy).not.toHaveBeenCalled();
  });

  it("does not fetch when fetchIfMissing is off (the default)", () => {
    const spy = mockFetchJson({ data: { items: [{ id: "p1" }] } });
    const { result } = renderHook(() => useProducts(), {
      wrapper: wrapper(noProductsPage),
    });
    expect(result.current.products).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  // The regression this file exists for: the real production envelope.
  it("unwraps the platform envelope {success,data:{items}} — the shape /api/products actually returns", async () => {
    mockFetchJson({
      success: true,
      message: "Products retrieved successfully",
      data: {
        items: [{ id: "p1", name: "Scarf" }, { id: "p2", name: "Shawl" }],
        total: 2,
        page: 1,
      },
    });
    const { result } = renderHook(
      () => useProducts({ fetchIfMissing: true }),
      { wrapper: wrapper(noProductsPage) },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.products.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("still accepts the documented {products:[]} shape", async () => {
    mockFetchJson({ products: [{ id: "p1", name: "Scarf" }] });
    const { result } = renderHook(
      () => useProducts({ fetchIfMissing: true }),
      { wrapper: wrapper(noProductsPage) },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.products).toHaveLength(1);
  });

  it("accepts a bare {data:[]} envelope and a plain array", async () => {
    mockFetchJson({ data: [{ id: "p1" }] });
    const { result: a } = renderHook(
      () => useProducts({ fetchIfMissing: true }),
      { wrapper: wrapper(noProductsPage) },
    );
    await waitFor(() => expect(a.current.loading).toBe(false));
    expect(a.current.products).toHaveLength(1);

    mockFetchJson([{ id: "p1" }, { id: "p2" }]);
    const { result: b } = renderHook(
      () => useProducts({ fetchIfMissing: true }),
      { wrapper: wrapper(noProductsPage) },
    );
    await waitFor(() => expect(b.current.loading).toBe(false));
    expect(b.current.products).toHaveLength(2);
  });

  // Through the real provider, not a hand-built PageContext: NuMuProvider used
  // to publish `products: []` when the host sent none, so `initial` was never
  // null and fetchIfMissing never fired on /cart, CMS pages or 404.
  it("fetches under the real NuMuProvider when the host sent no products", async () => {
    const spy = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/products")) {
        return new Response(JSON.stringify({ data: { items: [{ id: "p1" }] } }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: null }), { status: 200 });
    });
    vi.stubGlobal("fetch", spy);
    const provider = (initialProducts?: Array<{ id: string }>) =>
      ({ children }: { children: ReactNode }) =>
        createElement(NuMuProvider, { store: providerStore, themeSettings, initialProducts: initialProducts as never }, children);

    const { result } = renderHook(() => useProducts({ fetchIfMissing: true }), { wrapper: provider() });
    await waitFor(() => expect(result.current.products.map((p) => p.id)).toEqual(["p1"]));

    spy.mockClear();
    const { result: sent } = renderHook(() => useProducts({ fetchIfMissing: true }), {
      wrapper: provider([{ id: "ssr" }]),
    });
    expect(sent.current.products.map((p) => p.id)).toEqual(["ssr"]);
    expect(spy.mock.calls.some(([u]) => String(u).startsWith("/api/products"))).toBe(false);
  });

  it("commits an empty list — not a crash — on an unrecognized shape", async () => {
    mockFetchJson({ nope: true });
    const { result } = renderHook(
      () => useProducts({ fetchIfMissing: true }),
      { wrapper: wrapper(noProductsPage) },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.products).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
