/**
 * V2 → V3 compatibility shim.
 *
 * V2 themes in `numu-egyptian-bazaar/src/themes/` consume data via the
 * bazaar's own context hooks (useStore, useProductsContext,
 * useAuth, useLanguage, useTheme). When porting a V2 theme to V3 via
 * `numu-theme migrate`, those hooks don't exist inside the BYOT
 * bundle — the bundle runs in its own React tree fed by the SDK's
 * NuMuProvider, which exposes a different (V3) API.
 *
 * Rather than rewrite every section by hand on the first pass, themes
 * can import these compat hooks (e.g. `useV2Products()`) which return
 * the OLD V2-shaped data the section already knows how to render.
 * Internally they thunk into the V3 SDK hooks. This buys "the theme
 * renders" same-day; the per-section idiomatic V3 rewrite then
 * happens incrementally without blocking the bundle build.
 *
 * Use cases:
 *
 *   1. `useV2Products()` — returns `Product[]` (flat, no pagination
 *      shape). Internally calls `useProducts()` and exposes only
 *      the first page's items. Themes that paginate manually keep
 *      working; themes that assume "all products are loaded" keep
 *      working with the first 50.
 *
 *   2. `useV2Categories()` — returns `Category[]` shaped like the
 *      bazaar's `Category` (id, name, slug, image_url) rather than
 *      the SDK's `Collection`. Adapter maps fields.
 *
 *   3. `useV2Auth()` — returns `{ user, isAuthenticated }`. Maps
 *      from `useCustomer()`'s null-or-Customer return.
 *
 *   4. `useV2Language()` — returns `{ language, setLanguage }` with
 *      'en' | 'ar' shape. Maps to `useLocalization()`.
 *
 *   5. `useV2Theme()` — returns the bazaar's V2 theme shape
 *      (`{ themeSettings.theme.primary_color }`) by reading from the
 *      V3 `themeSettings.global_settings` (which is where the
 *      migrated values end up).
 *
 * Subpath import: `import { useV2Products } from "@numueg/theme-sdk/v2-compat"`.
 * Keeping this off the main entrypoint signals "this is a migration
 * helper, plan to remove it" — themes that linger on the shim past
 * the V2 retirement deadline (Wave 8) will fail to resolve the
 * subpath once we drop the file.
 */

"use client";

import { useMemo } from "react";
import { useProducts } from "./hooks/useProducts";
import { useCollections } from "./hooks/useCollections";
import { useCustomer } from "./hooks/useCustomer";
import { useLocalization } from "./hooks/useLocalization";
import { useThemeSettings } from "./hooks/useThemeSettings";
import type { Product, Collection, Customer } from "./types/entities";

// ─── useV2Products ──────────────────────────────────────────────────────────

/**
 * V2's `useProductsContext().products` returned a flat array; V3's
 * useProducts() returns `{ items, loading, hasMore, ... }`. The shim
 * exposes `items` plus a `loading` flag so V2 sections that conditionally
 * render against a "still loading" placeholder don't break.
 */
export interface V2ProductsState {
  products: Product[];
  loading: boolean;
}

export function useV2Products(): V2ProductsState {
  const { products, loading } = useProducts();
  return useMemo(
    () => ({
      products,
      loading,
    }),
    [products, loading],
  );
}

// ─── useV2Categories ────────────────────────────────────────────────────────

/**
 * Bazaar `Category` shape. V2 sections destructure `cat.image_url`,
 * `cat.name`; the SDK's `Collection` calls the field `image`. Map.
 */
export interface V2Category {
  id: string;
  name: string;
  slug?: string;
  image_url?: string | null;
  description?: string | null;
}

export interface V2CategoriesState {
  categories: V2Category[];
  loading: boolean;
}

function collectionToV2Category(c: Collection): V2Category {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    image_url: c.image_url ?? null,
    description: c.description ?? null,
  };
}

export function useV2Categories(): V2CategoriesState {
  const { collections, loading } = useCollections();
  return useMemo(
    () => ({
      categories: collections.map(collectionToV2Category),
      loading,
    }),
    [collections, loading],
  );
}

// ─── useV2Auth ──────────────────────────────────────────────────────────────

export interface V2AuthState {
  user: Customer | null;
  isAuthenticated: boolean;
}

export function useV2Auth(): V2AuthState {
  const customer = useCustomer();
  return useMemo(
    () => ({
      user: customer,
      isAuthenticated: customer !== null,
    }),
    [customer],
  );
}

// ─── useV2Language ──────────────────────────────────────────────────────────

export interface V2LanguageState {
  language: "ar" | "en";
  direction: "rtl" | "ltr";
  setLanguage: (next: "ar" | "en") => void;
  t: (key: string, fallback?: string) => string;
}

export function useV2Language(): V2LanguageState {
  const { locale, direction, translations, setLocale } = useLocalization();
  const normalisedLocale = locale === "ar" ? "ar" : "en";
  return useMemo<V2LanguageState>(
    () => ({
      language: normalisedLocale,
      direction,
      setLanguage: (next) => setLocale(next),
      t: (key, fallback) => translations[key] ?? fallback ?? key,
    }),
    [normalisedLocale, direction, translations, setLocale],
  );
}

// ─── useV2Theme ─────────────────────────────────────────────────────────────

/**
 * V2 themes destructure `useTheme().themeSettings.theme.primary_color`
 * etc. V3 stores the same values under `global_settings.<key>` (the
 * V2 → V3 normalizer flattens the nested object on first read).
 * This shim re-wraps the flat V3 shape into the V2 nested form so the
 * old destructure paths still resolve.
 *
 * Field map (V2 nested key → V3 flat key):
 *
 *   theme.primary_color       → global_settings.primary_color
 *   theme.accent_color        → global_settings.accent_color
 *   theme.background_color    → global_settings.background_color
 *   theme.text_color          → global_settings.text_color
 *   theme.heading_font        → global_settings.heading_font
 *   identity.logo_url         → global_settings.logo_url
 *   identity.store_name       → global_settings.store_name
 *
 * Themes that read keys not in this map fall through to undefined —
 * the consumer code should treat them as optional (V2 already did).
 */
export interface V2ThemeShape {
  themeSettings: {
    theme: {
      primary_color?: string;
      accent_color?: string;
      background_color?: string;
      text_color?: string;
      heading_font?: string;
      [extra: string]: unknown;
    };
    identity: {
      logo_url?: string;
      store_name?: string;
      [extra: string]: unknown;
    };
    [extra: string]: unknown;
  };
}

export function useV2Theme(): V2ThemeShape {
  const settings = useThemeSettings();
  return useMemo<V2ThemeShape>(() => {
    const g = settings.global_settings ?? {};
    const get = (key: string): string | undefined => {
      const v = (g as Record<string, unknown>)[key];
      return typeof v === "string" ? v : undefined;
    };
    return {
      themeSettings: {
        theme: {
          primary_color: get("primary_color"),
          accent_color: get("accent_color"),
          background_color: get("background_color"),
          text_color: get("text_color"),
          heading_font: get("heading_font"),
          ...g,
        },
        identity: {
          logo_url: get("logo_url"),
          store_name: get("store_name"),
        },
      },
    };
  }, [settings]);
}
