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
