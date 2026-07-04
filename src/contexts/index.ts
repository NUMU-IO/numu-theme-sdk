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

/**
 * Result of a cart mutation (add / remove / update / discount / note).
 *
 * `ok` mirrors the HTTP result: `false` for any non-2xx response — an
 * out-of-stock or validation rejection, a 403 CSRF failure, etc. — so a
 * theme can surface the failure (toast, inline error) instead of assuming
 * the write landed. `status` is the HTTP status (0 for a network throw that
 * the caller catches); `message` carries the backend's error text when the
 * error body parses.
 *
 * Back-compat: the cart methods previously resolved `Promise<void>`; callers
 * that `await` them and ignore the return keep working unchanged — the
 * resolved value is purely additive.
 */
export interface CartMutationResult {
  ok: boolean;
  status: number;
  message?: string;
}

export interface CartContextValue {
  cart: Cart;
  addItem: (
    productId: string,
    variantId?: string,
    quantity?: number,
    /** Picker axes ({Color: "Black", Size: "L"}) — variant_name fallback for
     *  products whose variant rows carry no option_values. */
    selectedOptions?: Record<string, string>,
  ) => Promise<CartMutationResult>;
  removeItem: (itemId: string) => Promise<CartMutationResult>;
  updateQuantity: (
    itemId: string,
    quantity: number,
  ) => Promise<CartMutationResult>;
  applyDiscount: (code: string) => Promise<CartMutationResult>;
  removeDiscount: () => Promise<CartMutationResult>;
  updateNote: (note: string) => Promise<CartMutationResult>;
  clearCart: () => Promise<void>;
  loading: boolean;
}

export const ShopContext = createContext<Store | null>(null);
export const ProductContext = createContext<Product | null>(null);
export const CollectionContext = createContext<Collection | null>(null);
export const CartContext = createContext<CartContextValue | null>(null);
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
  /**
   * §5 hide-page → hide-nav-link. `false` when the item targets a CMS page
   * (`/pages/<handle>`) that is currently unpublished or deleted. The backend
   * menus resolver annotates it; absent/`true` means visible (back-compat).
   */
  target_visible?: boolean;
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

/**
 * Multi-currency presentment config, as returned by
 * `GET /api/storefront/currencies`. Display-only — the store's *capture*
 * currency never changes mid-session; this just lets visitors browse prices
 * in a currency they recognize.
 */
export interface CurrencyConfig {
  base: string;
  default_presentment: string;
  presentment: string[];
  rates: Record<string, string>; // Decimal-as-string
  auto_convert: boolean;
}

/**
 * The value `useCurrency()` returns and `CurrencyContext` carries.
 *
 * `convert(cents, target?)` returns the converted **cents** in `target`
 * (defaults to `selected`), using the API rates; returns the input unchanged
 * when no rate exists (theme renders base — better than a wrong number).
 */
export interface CurrencyState {
  base: string;
  selected: string;
  presentment: string[];
  rates: Record<string, number>;
  autoConvert: boolean;
  loading: boolean;
  setSelected: (currency: string) => void;
  convert: (cents: number, target?: string) => number;
}

/**
 * Phase 2 (correctness) — multi-currency lifted into a provider context.
 *
 * Previously `useCurrency()` fetched `/api/storefront/currencies` and held
 * the selected currency in per-instance `useState`, so each `<Money>`,
 * `useMoney()` and `<CurrencySwitcher>` owned an INDEPENDENT copy: switching
 * currency in the switcher never reached the price tags, and every consumer
 * re-fetched. `NuMuProvider` now fetches ONCE and publishes a single
 * `CurrencyState` here, so a `<CurrencySwitcher>` change re-renders every
 * `<Money>` on the page without a reload.
 *
 * Null when no provider is present (SSR before hydrate, or a theme mounted
 * outside `NuMuProvider`); `useCurrency()` then falls back to a base-only,
 * no-convert state derived from the store currency so `<Money>` still renders.
 */
export const CurrencyContext = createContext<CurrencyState | null>(null);
