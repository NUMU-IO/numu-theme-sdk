"use client";
import { useState, useCallback, useMemo, type ReactNode } from "react";
import { ShopContext, CartContext, CustomerContext, ThemeSettingsContext, LocalizationContext } from "../contexts";
import type { Store, Cart, CartItem, Customer } from "../types/entities";
import type { ThemeSettingsV3 } from "../types/theme";
import type { LocalizationState } from "../contexts";

const RTL_LOCALES = ["ar", "he", "fa", "ur"];

interface NuMuProviderProps {
  store: Store;
  themeSettings: ThemeSettingsV3;
  initialCart?: Cart;
  customer?: Customer | null;
  locale?: string;
  translations?: Record<string, string>;
  children: ReactNode;
}

const EMPTY_CART: Cart = { id: "", items: [], subtotal: 0, total: 0, currency: "EGP" };

export function NuMuProvider({
  store, themeSettings, initialCart, customer, locale: initialLocale, translations: initialTranslations, children,
}: NuMuProviderProps) {
  const [cart, setCart] = useState<Cart>(initialCart || { ...EMPTY_CART, currency: store.currency });
  const [loading, setLoading] = useState(false);
  const [locale, setLocale] = useState(initialLocale || store.default_language || "en");
  const [translations] = useState(initialTranslations || {});

  const addItem = useCallback(async (productId: string, variantId?: string, quantity?: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cart/add`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_id: productId, variant_id: variantId, quantity: quantity || 1 }) });
      if (res.ok) { const data = await res.json(); setCart(data); }
    } finally { setLoading(false); }
  }, []);

  const removeItem = useCallback(async (itemId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cart/remove`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item_id: itemId }) });
      if (res.ok) { const data = await res.json(); setCart(data); }
    } finally { setLoading(false); }
  }, []);

  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cart/update`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item_id: itemId, quantity }) });
      if (res.ok) { const data = await res.json(); setCart(data); }
    } finally { setLoading(false); }
  }, []);

  const applyDiscount = useCallback(async (code: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cart/discount`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      if (res.ok) { const data = await res.json(); setCart(data); }
    } finally { setLoading(false); }
  }, []);

  const removeDiscount = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cart/discount`, { method: "DELETE" });
      if (res.ok) { const data = await res.json(); setCart(data); }
    } finally { setLoading(false); }
  }, []);

  const updateNote = useCallback(async (note: string) => {
    setCart(prev => ({ ...prev, note }));
  }, []);

  const clearCart = useCallback(async () => {
    setCart({ ...EMPTY_CART, currency: store.currency });
  }, [store.currency]);

  const cartValue = useMemo(() => ({
    cart, addItem, removeItem, updateQuantity, applyDiscount, removeDiscount, updateNote, clearCart, loading,
  }), [cart, addItem, removeItem, updateQuantity, applyDiscount, removeDiscount, updateNote, clearCart, loading]);

  const localization: LocalizationState = useMemo(() => ({
    locale,
    direction: RTL_LOCALES.includes(locale) ? "rtl" : "ltr",
    translations,
    formatMoney: (amount: number, currency?: string) =>
      new Intl.NumberFormat(locale, { style: "currency", currency: currency || store.currency }).format(amount),
    formatDate: (date: string | Date) =>
      new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" }).format(new Date(date)),
  }), [locale, translations, store.currency]);

  return (
    <ShopContext.Provider value={store}>
      <ThemeSettingsContext.Provider value={themeSettings}>
        <LocalizationContext.Provider value={localization}>
          <CartContext.Provider value={cartValue}>
            <CustomerContext.Provider value={customer || null}>
              {children}
            </CustomerContext.Provider>
          </CartContext.Provider>
        </LocalizationContext.Provider>
      </ThemeSettingsContext.Provider>
    </ShopContext.Provider>
  );
}
