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
}

export const ShopContext = createContext<Store | null>(null);
export const ProductContext = createContext<Product | null>(null);
export const CollectionContext = createContext<Collection | null>(null);
export const CartContext = createContext<{ cart: Cart; addItem: (productId: string, variantId?: string, quantity?: number) => Promise<void>; removeItem: (itemId: string) => Promise<void>; updateQuantity: (itemId: string, quantity: number) => Promise<void>; applyDiscount: (code: string) => Promise<void>; removeDiscount: () => Promise<void>; updateNote: (note: string) => Promise<void>; clearCart: () => Promise<void>; loading: boolean } | null>(null);
export const CustomerContext = createContext<Customer | null>(null);
export const ThemeSettingsContext = createContext<ThemeSettingsV3 | null>(null);
export const LocalizationContext = createContext<LocalizationState | null>(null);
export const PageContext = createContext<Page | null>(null);
