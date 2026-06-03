"use client";

/**
 * `mountTheme(el, ctx, renderApp)` — the canonical V3 bundle entry helper.
 *
 * ## Why this exists
 *
 * Every theme bundle exports `mount(el, ctx): MountResult`. Historically each
 * theme hand-wrote that function, and the wiring it needs is non-trivial and
 * easy to get wrong:
 *
 *   1. **Forward the real catalog.** The host ships the page's products /
 *      collections in `ctx.page.data` (home + listing routes) and the product
 *      in `ctx.page.data.product` (PDP). A theme that doesn't pass these into
 *      `NuMuProvider` (+ wrap the PDP in `<ProductProvider>`) sees
 *      `useProducts()` / `useProductOptional()` return empty on a REAL store —
 *      so product sections render "No products yet" or fall back to demo data
 *      on a stocked merchant. This was the single most common BYOT bug:
 *      only bon-younes wired it; the other 13 themes dropped the catalog.
 *
 *   2. **Apply global style tokens.** Merchant-chosen colors/fonts live in
 *      `themeSettings.global_settings`; they only paint if the bundle calls
 *      `applyGlobalStyleTokens` on its mount root (and resolves font tokens
 *      to real stacks + injects the webfont link). Themes that skipped this
 *      ignored every color/font picker.
 *
 *   3. **Forward navigation.** `useNavigation(handle)` only resolves the
 *      header/footer menus the host pre-resolved if the bundle passes
 *      `ctx.navigation` into `NuMuProvider`.
 *
 *   4. **Live-preview + lifecycle.** The customizer streams draft settings via
 *      the host's `applyDraft`; the bundle must hold them in state and re-paint
 *      the style tokens on every draft. And it must return a `MountResult`
 *      (`cleanup` + `applyDraft`) the host's `ByotThemeBoundary` understands.
 *
 * `mountTheme` does all of that once, so a theme's `main.tsx` collapses to:
 *
 * ```tsx
 * import { mountTheme } from "@numueg/theme-sdk";
 * export function mount(el, ctx) {
 *   return mountTheme(el, ctx, ({ currentTemplate }) =>
 *     <ThemeApp currentTemplate={currentTemplate} />,
 *   );
 * }
 * ```
 *
 * The theme owns only its section list (`ThemeApp`). Everything in the list
 * above is handled here — fix it once, every theme benefits.
 *
 * ## Both ctx shapes
 *
 * The host (numu-storefront `ByotThemeBoundary`) passes
 * `{ themeSettings, storeData, page, locale, demo, navigation }`. Older / dev
 * contexts used `{ store, currentTemplate }`. We normalise both so a bundle
 * built against this helper works regardless of which host calls it.
 */

import {
  StrictMode,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  type ReactNode,
} from "react";
import { createRoot, type Root } from "react-dom/client";

import { NuMuProvider } from "./components/NuMuProvider";
import { ProductProvider } from "./components/ProductProvider";
import { applyGlobalStyleTokens, resolveFontStack } from "./utils/styleTokens";
import type {
  Store,
  Cart,
  Customer,
  Product,
  Collection,
} from "./types/entities";
import type { ThemeSettingsV3, MountResult } from "./types/theme";
import type { MenuItemData } from "./contexts";

/** Minimal page descriptor the host forwards in the mount context. */
export interface ThemeMountPage {
  type?: string;
  handle?: string;
  title?: string;
  data?: Record<string, unknown>;
}

/**
 * The mount context a host (or dev harness) passes to a bundle's `mount`.
 * Accepts both the current storefront shape (`storeData`/`page`) and the
 * legacy/dev shape (`store`/`currentTemplate`); `mountTheme` normalises them.
 */
export interface ThemeMountContext {
  // Current storefront contract
  storeData?: Store;
  page?: ThemeMountPage;
  // Legacy / dev contract
  store?: Store;
  currentTemplate?: string;
  // Common
  themeSettings: ThemeSettingsV3;
  initialCart?: Cart;
  customer?: Customer | null;
  locale?: string;
  translations?: Record<string, string>;
  /** AUTHORITATIVE marketplace-preview flag from the host (true only for the
   *  catalog "Try theme" preview). Themes with demo-image fallbacks gate on
   *  it so a real installed store never shows demo imagery. */
  demo?: boolean;
  /** Store navigation menus keyed by handle, resolved server-side. */
  navigation?: Record<string, MenuItemData[]>;
  [extra: string]: unknown;
}

/** Arguments handed to a theme's render callback on every (re)render. */
export interface ThemeRenderArgs {
  /** Active template key — "home" | "product" | "collection" | "cart" | … */
  currentTemplate: string;
  /** Marketplace-preview flag (see ThemeMountContext.demo). */
  demo: boolean;
  /** The raw host page descriptor (type/handle/data), or null. */
  page: ThemeMountPage | null;
  /** Normalised store record (never undefined). */
  store: Store;
  /** Live theme settings (reflects customizer drafts via applyDraft). */
  themeSettings: ThemeSettingsV3;
}

interface DraftHandle {
  applyDraft: (next: ThemeSettingsV3) => void;
}

/** Normalise the two ctx shapes' store slot; never return undefined — SDK
 *  code reads `store.currency` without optional chaining and would throw. */
function pickStore(ctx: ThemeMountContext): Store {
  const s = ctx.storeData ?? ctx.store;
  if (s) return s;
  return {
    id: "unknown",
    name: "Store",
    slug: "store",
    currency: "EGP",
    default_language: "en",
    use_nextjs_storefront: true,
  } as Store;
}

/** Resolve the active template from either contract, defaulting to "home". */
function pickTemplate(ctx: ThemeMountContext): string {
  if (typeof ctx.currentTemplate === "string" && ctx.currentTemplate) {
    return ctx.currentTemplate;
  }
  const pageType = ctx.page?.type;
  if (typeof pageType === "string" && pageType) return pageType;
  return "home";
}

/** Resolve the demo flag: explicit host flag wins; else infer from empty
 *  templates (the marketplace preview ships none → render bundled preset). */
function pickDemo(ctx: ThemeMountContext, themeSettings: ThemeSettingsV3): boolean {
  if (typeof ctx.demo === "boolean") return ctx.demo;
  const t = themeSettings.templates;
  return !t || Object.keys(t).length === 0;
}

/**
 * Bridge that holds live draft settings, re-applies global style tokens on
 * every change, and wires the full provider stack (catalog + nav) around the
 * theme's app. Exposes `applyDraft` so the host can stream customizer edits.
 */
const ThemeMountBridge = forwardRef<
  DraftHandle,
  {
    ctx: ThemeMountContext;
    mountEl: HTMLElement;
    renderApp: (args: ThemeRenderArgs) => ReactNode;
  }
>(function ThemeMountBridge({ ctx, mountEl, renderApp }, ref) {
  const [themeSettings, setThemeSettings] = useState<ThemeSettingsV3>(
    ctx.themeSettings,
  );
  useImperativeHandle(
    ref,
    () => ({
      applyDraft: (next) =>
        setThemeSettings((prev) => (prev === next ? prev : next)),
    }),
    [],
  );

  // Global settings (colors/fonts/layout) → CSS custom properties on the
  // mount root. Re-runs on every draft so the customizer's live preview
  // re-paints as a merchant drags a color or picks a font.
  useEffect(() => {
    const gs = (themeSettings.global_settings ?? {}) as Record<string, unknown>;
    applyGlobalStyleTokens(gs, mountEl);
    // Fonts: applyGlobalStyleTokens only writes a stack for tokens in its
    // built-in FONT_REGISTRY; the platform's wider font catalog would
    // otherwise fall through as a bare name with no webfont link. Resolve
    // heading/body explicitly so any picked font loads + gets a real stack,
    // writing the exact vars themes read.
    const headingFont = gs.heading_font;
    if (typeof headingFont === "string" && headingFont.trim()) {
      mountEl.style.setProperty(
        "--theme-heading_font",
        resolveFontStack(headingFont),
      );
    }
    const bodyFont = gs.body_font;
    if (typeof bodyFont === "string" && bodyFont.trim()) {
      mountEl.style.setProperty("--theme-body_font", resolveFontStack(bodyFont));
    }
  }, [themeSettings, mountEl]);

  const store = pickStore(ctx);
  const template = pickTemplate(ctx);
  const demo = pickDemo(ctx, themeSettings);

  // Real catalog the host forwards: home/listing routes ship
  // page.data.{products,collections}; the PDP ships page.data.product.
  // Feeding these into NuMuProvider (+ ProductProvider) is what makes
  // useProducts()/useProduct() return the merchant's ACTUAL catalog.
  const pageData = (ctx.page?.data ?? {}) as {
    products?: Product[];
    collections?: Collection[];
    product?: Product;
  };

  const app = renderApp({
    currentTemplate: template,
    demo,
    page: ctx.page ?? null,
    store,
    themeSettings,
  });

  return (
    <NuMuProvider
      store={store}
      themeSettings={themeSettings}
      initialCart={ctx.initialCart}
      customer={ctx.customer}
      locale={ctx.locale}
      translations={ctx.translations}
      navigation={ctx.navigation}
      initialProducts={pageData.products}
      initialCollections={pageData.collections}
      currentTemplate={template}
    >
      {pageData.product ? (
        <ProductProvider product={pageData.product}>{app}</ProductProvider>
      ) : (
        app
      )}
    </NuMuProvider>
  );
});

/**
 * Mount a V3 theme. Owns the React root, the provider stack (catalog + nav +
 * style tokens), and the live-preview draft cycle. Returns the host-contract
 * `MountResult` (`cleanup` + `applyDraft`).
 *
 * @param el        the host-supplied container element
 * @param ctx       the mount context (either host or legacy/dev shape)
 * @param renderApp returns the theme's section tree for the current args
 */
export function mountTheme(
  el: HTMLElement,
  ctx: ThemeMountContext,
  renderApp: (args: ThemeRenderArgs) => ReactNode,
): MountResult {
  const root: Root = createRoot(el);
  const handleRef = { current: null as DraftHandle | null };

  root.render(
    <StrictMode>
      <ThemeMountBridge
        ctx={ctx}
        mountEl={el}
        renderApp={renderApp}
        ref={(h) => {
          handleRef.current = h;
        }}
      />
    </StrictMode>,
  );

  return {
    applyDraft: (next) => handleRef.current?.applyDraft(next),
    cleanup: () => {
      root.unmount();
      handleRef.current = null;
    },
  };
}
