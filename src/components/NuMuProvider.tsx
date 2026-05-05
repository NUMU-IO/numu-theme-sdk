"use client";
import {
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  ShopContext,
  CartContext,
  CustomerContext,
  ThemeSettingsContext,
  LocalizationContext,
} from "../contexts";
import type { Store, Cart, Customer } from "../types/entities";
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

const EMPTY_CART: Cart = {
  id: "",
  items: [],
  subtotal: 0,
  total: 0,
  currency: "EGP",
};

/**
 * postCartMutation — shared helper for cart writes.
 *
 * Implements request versioning so a burst of "+ + +" clicks doesn't apply
 * stale responses. Each call reserves a token; only the response for the
 * highest-numbered token is allowed to update local state. Older responses
 * are dropped without affecting the cart.
 *
 * Returns the latest cart state (whatever the server says), but the caller
 * shouldn't blindly setState from it — `applyCart` already filtered.
 */
async function postCartMutation(
  endpoint: string,
  body: unknown,
  applyCart: (cart: Cart) => void,
  reserveToken: () => number,
): Promise<void> {
  const token = reserveToken();
  const res = await fetch(endpoint, {
    method: body === undefined ? "DELETE" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) return;
  const data = (await res.json()) as Cart;
  applyCart(data);
  // Token was actually consumed on entry; applyCart enforces ordering
  // via the closure below.
  void token;
}

export function NuMuProvider({
  store,
  themeSettings,
  initialCart,
  customer,
  locale: initialLocale,
  translations: initialTranslations,
  children,
}: NuMuProviderProps) {
  const [cart, setCart] = useState<Cart>(
    initialCart || { ...EMPTY_CART, currency: store.currency },
  );
  const [loading, setLoading] = useState(false);
  const [locale, setLocale] = useState(
    initialLocale || store.default_language || "en",
  );
  const [translations] = useState(initialTranslations || {});

  // ── Request-versioning machinery ───────────────────────────────────────
  // `nextRequestId` increases on each cart mutation; `latestApplied` tracks
  // the highest id whose response has been applied. A response is applied
  // only if its id is >= latestApplied (i.e., not superseded).
  const nextRequestId = useRef(0);
  const latestApplied = useRef(0);

  const reserveToken = useCallback(() => {
    nextRequestId.current += 1;
    return nextRequestId.current;
  }, []);

  const buildApplyCart = useCallback(
    (token: number) => (newCart: Cart) => {
      if (token < latestApplied.current) {
        // A later request has already updated state — ignore stale response.
        return;
      }
      latestApplied.current = token;
      setCart(newCart);
    },
    [],
  );

  const mutate = useCallback(
    async (endpoint: string, body: unknown): Promise<void> => {
      const token = reserveToken();
      setLoading(true);
      try {
        await postCartMutation(
          endpoint,
          body,
          buildApplyCart(token),
          () => token, // already reserved; just return the same token
        );
      } finally {
        setLoading(false);
      }
    },
    [reserveToken, buildApplyCart],
  );

  // ── Cart actions ───────────────────────────────────────────────────────

  const addItem = useCallback(
    async (productId: string, variantId?: string, quantity?: number) => {
      await mutate("/api/cart/add", {
        product_id: productId,
        variant_id: variantId,
        quantity: quantity || 1,
      });
    },
    [mutate],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      await mutate("/api/cart/remove", { item_id: itemId });
    },
    [mutate],
  );

  const updateQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      await mutate("/api/cart/update", { item_id: itemId, quantity });
    },
    [mutate],
  );

  const applyDiscount = useCallback(
    async (code: string) => {
      await mutate("/api/cart/discount", { code });
    },
    [mutate],
  );

  const removeDiscount = useCallback(async () => {
    // DELETE — postCartMutation interprets undefined body as DELETE.
    await mutate("/api/cart/discount", undefined);
  }, [mutate]);

  /**
   * Persist a customer note on the cart. Round-trips to the backend so the
   * note survives reload (the previous local-only behavior was a footgun).
   */
  const updateNote = useCallback(
    async (note: string) => {
      await mutate("/api/cart/update", { note });
    },
    [mutate],
  );

  const clearCart = useCallback(async () => {
    setCart({ ...EMPTY_CART, currency: store.currency });
  }, [store.currency]);

  const cartValue = useMemo(
    () => ({
      cart,
      addItem,
      removeItem,
      updateQuantity,
      applyDiscount,
      removeDiscount,
      updateNote,
      clearCart,
      loading,
    }),
    [
      cart,
      addItem,
      removeItem,
      updateQuantity,
      applyDiscount,
      removeDiscount,
      updateNote,
      clearCart,
      loading,
    ],
  );

  // ── Localization with memoized Intl formatters ─────────────────────────
  // Building Intl.NumberFormat / Intl.DateTimeFormat per call is costly;
  // memoize on (locale, currency).

  const moneyFmt = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: store.currency,
      }),
    [locale, store.currency],
  );
  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [locale],
  );

  const localization: LocalizationState = useMemo(
    () => ({
      locale,
      direction: RTL_LOCALES.includes(locale) ? "rtl" : "ltr",
      translations,
      formatMoney: (amount: number, currency?: string) => {
        if (currency && currency !== store.currency) {
          // Override-currency path is rare; pay the formatter cost only here.
          return new Intl.NumberFormat(locale, {
            style: "currency",
            currency,
          }).format(amount);
        }
        return moneyFmt.format(amount);
      },
      formatDate: (date: string | Date) =>
        dateFmt.format(typeof date === "string" ? new Date(date) : date),
    }),
    [locale, translations, store.currency, moneyFmt, dateFmt],
  );

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
