/**
 * Unit tests for useNavigation — menu resolution (Phase 2.4).
 *
 * Covers the host-injected path (the storefront resolves menus
 * server-side and injects them via NavigationContext — no network),
 * bilingual label localization with the documented fallback chain,
 * nested-child recursion, backend `type` → SDK `resource_type` mapping,
 * and the client-fetch fallback for hosts that inject nothing.
 *
 * Uses React.createElement (no JSX) so the test transpiles without any
 * JSX-runtime config, matching the SDK's no-build test setup.
 */

import { createElement, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useNavigation, type NavigationItem } from "../hooks/useNavigation";
import {
  LocalizationContext,
  NavigationContext,
  type MenuItemData,
} from "../contexts";

/** Build a wrapper that injects a host menu map + locale into context. */
function wrapper(
  navMap: Record<string, MenuItemData[]>,
  locale = "en",
): (props: { children: ReactNode }) => ReactNode {
  return ({ children }) =>
    createElement(
      NavigationContext.Provider,
      { value: navMap },
      createElement(
        LocalizationContext.Provider,
        // The hook only reads `.locale`; a partial value is fine at runtime.
        { value: { locale } as never },
        children,
      ),
    );
}

const mainMenu: MenuItemData[] = [
  { id: "1", label: { en: "Home", ar: "الرئيسية" }, url: "/", type: "home" },
  {
    id: "2",
    label: { en: "Shop", ar: "تسوق" },
    url: "/products",
    type: "collection",
    resource_id: "summer",
    children: [
      { id: "2a", label: { en: "New", ar: "جديد" }, url: "/products?f=new", type: "url" },
    ],
  },
  { id: "3", label: { en: "Blog", ar: "مدونة" }, url: "/blog", type: "blog" },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useNavigation — host-injected (no network)", () => {
  it("localizes labels to English and maps urls", () => {
    const { result } = renderHook(() => useNavigation("main-menu"), {
      wrapper: wrapper({ "main-menu": mainMenu }),
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.items).toHaveLength(3);
    expect(result.current.items[0].title).toBe("Home");
    expect(result.current.items[0].url).toBe("/");
  });

  it("localizes to Arabic when the active locale is ar", () => {
    const { result } = renderHook(() => useNavigation("main-menu"), {
      wrapper: wrapper({ "main-menu": mainMenu }, "ar"),
    });
    expect(result.current.items[0].title).toBe("الرئيسية");
    expect(result.current.items[1].title).toBe("تسوق");
  });

  it("falls back en → ar → first when the active locale label is missing", () => {
    const arOnly: MenuItemData[] = [
      { id: "x", label: { ar: "فقط عربي" }, url: "/x", type: "url" },
      { id: "y", label: { fr: "Bonjour" }, url: "/y", type: "url" },
    ];
    const { result } = renderHook(() => useNavigation("m"), {
      wrapper: wrapper({ m: arOnly }, "en"),
    });
    // No en, so falls through to ar.
    expect(result.current.items[0].title).toBe("فقط عربي");
    // No en and no ar → first available value.
    expect(result.current.items[1].title).toBe("Bonjour");
  });

  it("recurses nested children", () => {
    const { result } = renderHook(() => useNavigation("main-menu"), {
      wrapper: wrapper({ "main-menu": mainMenu }),
    });
    const shop = result.current.items[1];
    expect(shop.children).toHaveLength(1);
    expect(shop.children[0].title).toBe("New");
    expect(shop.children[0].url).toBe("/products?f=new");
  });

  it("maps backend item types onto the resource_type union", () => {
    const { result } = renderHook(() => useNavigation("main-menu"), {
      wrapper: wrapper({ "main-menu": mainMenu }),
    });
    // "home" is not a typed resource → null.
    expect(result.current.items[0].resource_type).toBeNull();
    expect(result.current.items[1].resource_type).toBe("collection");
    expect(result.current.items[1].resource_handle).toBe("summer");
    expect(result.current.items[1].children[0].resource_type).toBe("url");
    expect(result.current.items[2].resource_type).toBe("blog");
  });

  it("maps the 'http' type to 'url' and defaults a blank url to '/'", () => {
    const items: MenuItemData[] = [
      { id: "h", label: { en: "Ext" }, url: "https://x.test", type: "http" },
      { id: "b", label: { en: "Blank" }, url: "", type: "url" },
    ];
    const { result } = renderHook(() => useNavigation("m"), {
      wrapper: wrapper({ m: items }),
    });
    expect(result.current.items[0].resource_type).toBe("url");
    expect(result.current.items[1].url).toBe("/");
  });

  it("returns [] (no fetch) when the host map is present but lacks the handle", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { result } = renderHook(() => useNavigation("does-not-exist"), {
      wrapper: wrapper({ "main-menu": mainMenu }),
    });
    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("§5: drops a top-level item whose target page is hidden (target_visible:false)", () => {
    const menu: MenuItemData[] = [
      { id: "1", label: { en: "Home" }, url: "/", type: "home" },
      {
        id: "2",
        label: { en: "Lookbook" },
        url: "/pages/lookbook",
        type: "page",
        target_visible: false,
      },
      { id: "3", label: { en: "Contact" }, url: "/contact", type: "page" },
    ];
    const { result } = renderHook(() => useNavigation("m"), {
      wrapper: wrapper({ m: menu }),
    });
    expect(result.current.items.map((i) => i.title)).toEqual([
      "Home",
      "Contact",
    ]);
    // Default-visible items expose target_visible:true.
    expect(result.current.items.every((i) => i.target_visible)).toBe(true);
  });

  it("§5: drops a hidden child link but keeps its (still non-empty) parent column", () => {
    const menu: MenuItemData[] = [
      {
        id: "c",
        label: { en: "Help" },
        url: "/",
        type: "url",
        children: [
          { id: "c1", label: { en: "Shipping" }, url: "/shipping", type: "page" },
          {
            id: "c2",
            label: { en: "Size guide" },
            url: "/pages/size-guide",
            type: "page",
            target_visible: false,
          },
        ],
      },
    ];
    const { result } = renderHook(() => useNavigation("footer"), {
      wrapper: wrapper({ footer: menu }),
    });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].children.map((c) => c.title)).toEqual([
      "Shipping",
    ]);
  });
});

describe("useNavigation — client fetch fallback", () => {
  it("fetches the menu when the host injects nothing", async () => {
    const payload: NavigationItem[] = [
      { id: "f1", title: "Fetched", url: "/f", resource_type: null, resource_handle: null, target_visible: true, children: [] },
    ];
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: payload }), { status: 200 }),
    );
    // Unique handle so the module-level cache can't bleed across tests.
    const { result } = renderHook(() => useNavigation("fetch-ok-1"));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.items[0].title).toBe("Fetched");
    expect(result.current.loading).toBe(false);
  });

  it("resolves to [] on a 404 (missing menu is a soft failure)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not found", { status: 404 }),
    );
    const { result } = renderHook(() => useNavigation("fetch-404-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);
  });

  it("surfaces the error and resolves to [] on a network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useNavigation("fetch-err-1"));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.items).toEqual([]);
  });
});
