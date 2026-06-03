"use client";
import { createContext } from "react";
import type { Store, Product, Collection, Cart, Customer, Page } from "../types/entities";
import type { ThemeSettingsV3 } from "../types/theme";

export interface LocalizationState {
  locale: string;
  direction: "ltr" | "rtl";
  translations: Record<string, string>;
  formatMoney: (amount: number, currency?: string) => string;
  formatDate: (date: string | Date) => string;
  /**
   * Phase 3.7 — locale-aware number formatter. Routes to either
   * Western (1234) or Arab-Indic (١٢٣٤) digits depending on
   * `store.settings.numerals`. Themes calling formatMoney get the
   * same digit choice automatically; this is for raw counts ("12 items").
   */
  formatNumber: (n: number, options?: Intl.NumberFormatOptions) => string;
  /**
   * Phase 3.6 — switch the active locale.
   *
   * Sets the `numu_locale` cookie and triggers a full page reload so
   * the server-rendered layout picks up the new locale (the storefront
   * resolves locale at SSR time from cookie/query). Returns once the
   * cookie is written; the page navigation cancels any pending React
   * work so callers don't need to await.
   */
  setLocale: (next: string) => void;
  /**
   * Phase 3.6 — list of locales the store advertises. Empty when the
   * store hasn't configured a multi-locale catalog. Themes use this
   * to decide whether to render the LocaleSwitcher at all.
   */
  availableLocales: string[];
}

export const ShopContext = createContext<Store | null>(null);
export const ProductContext = createContext<Product | null>(null);
export const CollectionContext = createContext<Collection | null>(null);
export const CartContext = createContext<{ cart: Cart; addItem: (productId: string, variantId?: string, quantity?: number) => Promise<void>; removeItem: (itemId: string) => Promise<void>; updateQuantity: (itemId: string, quantity: number) => Promise<void>; applyDiscount: (code: string) => Promise<void>; removeDiscount: () => Promise<void>; updateNote: (note: string) => Promise<void>; clearCart: () => Promise<void>; loading: boolean } | null>(null);
export const CustomerContext = createContext<Customer | null>(null);
export const ThemeSettingsContext = createContext<ThemeSettingsV3 | null>(null);
export const LocalizationContext = createContext<LocalizationState | null>(null);
export const PageContext = createContext<Page | null>(null);
/**
 * Wave 5 — currently-active template identifier. Mirrors the key inside
 * `themeSettings.templates.<currentTemplate>` so themes can dispatch
 * which section list to render. Hosts set this via `NuMuProvider`'s
 * `currentTemplate` prop (which is passed in by the storefront page
 * component — `app/(store)/[subdomain]/product/[id]/page.tsx` passes
 * "product", `cart/page.tsx` passes "cart", etc.). Falls back to "home".
 */
export const CurrentTemplateContext = createContext<string>("home");

/**
 * A merchant-managed navigation menu item, exactly as the storefront
 * menus resolver returns it (`GET /storefront/store/{id}/menus`):
 * bilingual `label`, a pre-resolved `url`, and nested `children`.
 *
 * This is the RAW shape the host injects via `NuMuProvider`'s
 * `navigation` prop. `useNavigation(handle)` localizes it to the
 * display-ready `NavigationItem` (a single `title` string for the
 * active locale).
 */
export interface MenuItemData {
  id: string;
  label: Record<string, string>;
  url: string;
  type?: string | null;
  resource_id?: string | null;
  children?: MenuItemData[];
}

/**
 * Phase 2.4 — navigation menus keyed by handle (`main-menu`, `footer`,
 * plus custom), injected by the host from the storefront resolver so a
 * theme's `useNavigation(handle)` resolves without a client round-trip.
 *
 * Defaults to `{}` — an empty map signals "host provided no menus", at
 * which point `useNavigation` falls back to its own fetch / a theme's
 * `DEFAULT_NAV`. A present-but-handle-absent map means the menu simply
 * doesn't exist (render nothing / fallback), no fetch attempted.
 */
export const NavigationContext = createContext<Record<string, MenuItemData[]>>(
  {},
);
