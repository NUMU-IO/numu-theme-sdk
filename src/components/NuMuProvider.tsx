"use client";
import {
  useEffect,
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
import {
  CustomerActionsContext,
  type CustomerActions,
} from "../contexts/customer-actions";
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
 * Read the `numu_csrf` cookie value from document.cookie.
 *
 * The storefront's GET /api/cart sets this on first fetch; we echo it
 * back in `x-numu-csrf` on every mutation so the proxy can verify the
 * double-submit. Without this gate any XSS in a theme can drain the
 * customer's cart by hitting /api/cart/add directly.
 */
function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)numu_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * postCartMutation — shared helper for cart writes.
 *
 * Three concerns layered together:
 *
 *   1. Request versioning so a burst of "+ + +" clicks doesn't apply
 *      stale responses. Each call reserves a token; only the response
 *      for the highest-numbered token is allowed to update local state.
 *
 *   2. CSRF: every cart mutation includes `x-numu-csrf` from the cookie.
 *      The /api/cart/* proxy compares cookie + header (double-submit)
 *      and rejects mismatches with 403.
 *
 *   3. Idempotency: each call mints a UUID idempotency key. The
 *      backend (when supported) caches the response for that key in
 *      Redis so a double-clicked Add-to-Cart only mutates state once.
 *      Wire format is stable; backend honoring it is opt-in.
 *
 * Returns the latest cart state (whatever the server says), but the
 * caller shouldn't blindly setState from it — `applyCart` already
 * filtered.
 */
async function postCartMutation(
  endpoint: string,
  body: unknown,
  applyCart: (cart: Cart) => void,
  reserveToken: () => number,
): Promise<void> {
  const token = reserveToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const csrf = readCsrfCookie();
  if (csrf) headers["x-numu-csrf"] = csrf;
  // Idempotency key — randomUUID is widely supported; fall back if not
  // (older Safari, embedded webviews).
  const idempotencyKey =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  headers["x-numu-idempotency-key"] = idempotencyKey;

  const res = await fetch(endpoint, {
    method: body === undefined ? "DELETE" : "POST",
    headers,
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
  // Phase 3.6 — locale precedence:
  //   1. `initialLocale` prop (storefront pages that resolved it server-side)
  //   2. `numu_locale` cookie (client-side fallback for pages that don't
  //      thread the prop through)
  //   3. `store.default_language`
  //   4. "en"
  const [locale, setLocale] = useState(() => {
    if (initialLocale) return initialLocale;
    if (typeof document !== "undefined") {
      const m = document.cookie.match(/(?:^|; )numu_locale=([^;]+)/);
      if (m) return decodeURIComponent(m[1]);
    }
    return store.default_language || "en";
  });
  const [translations] = useState(initialTranslations || {});

  // ── Customer state + auth actions ──────────────────────────────────────
  // Customer comes from one of three sources, in order of precedence:
  //   1. SSR-supplied `customer` prop (when /account/* routes pre-fetch
  //      the customer server-side via the cookie).
  //   2. The mount effect below which calls GET /api/customer/me, used
  //      on routes that don't pre-fetch (home/product/etc.) to keep the
  //      cart drawer / header user menu accurate.
  //   3. Mutations triggered by `useCustomerActions()` (login/logout/
  //      register/updateProfile) — these refresh state immediately.
  const [customerState, setCustomerState] = useState<Customer | null>(
    customer ?? null,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Skip the GET if the SSR pass already supplied a customer; the
    // round-trip would only confirm what we already know and waste a
    // request budget on every navigation.
    if (customer) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/customer/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        if (cancelled) return;
        // 401 means logged-out: leave customerState=null. Any other
        // non-OK is treated the same — the customer can still browse.
        if (!res.ok) return;
        const json = await res.json();
        const next =
          json && typeof json === "object" && "data" in json
            ? (json as { data: Customer }).data
            : (json as Customer);
        if (next && typeof next === "object") {
          setCustomerState(next);
        }
      } catch {
        // Network blip — keep current customerState.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh re-fetches /api/customer/me; used after any mutation that
  // changed the customer record (login/register/profile update).
  const refreshCustomer = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      const res = await fetch("/api/customer/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (res.status === 401) {
        setCustomerState(null);
        return;
      }
      if (!res.ok) return;
      const json = await res.json();
      const next =
        json && typeof json === "object" && "data" in json
          ? (json as { data: Customer }).data
          : (json as Customer);
      setCustomerState(next ?? null);
    } catch {
      // ignore
    }
  }, []);

  // CSRF: customer mutations echo `numu_csrf` cookie value as header
  // for double-submit. Read just-in-time so we always send the freshest
  // (the cookie may rotate on /api/cart roundtrip).
  function readCsrf(): string | null {
    if (typeof document === "undefined") return null;
    const m = document.cookie.match(/(?:^|; )numu_csrf=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  async function postCustomer(path: string, body: unknown): Promise<unknown> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const csrf = readCsrf();
    if (csrf) headers["x-numu-csrf"] = csrf;
    const res = await fetch(path, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      // empty body — fine
    }
    return json;
  }

  async function putCustomer(path: string, body: unknown): Promise<unknown> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const csrf = readCsrf();
    if (csrf) headers["x-numu-csrf"] = csrf;
    const res = await fetch(path, {
      method: "PUT",
      credentials: "include",
      cache: "no-store",
      headers,
      body: JSON.stringify(body ?? {}),
    });
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  const customerActions: CustomerActions = useMemo(
    () => ({
      login: async (input) => {
        const r = await postCustomer("/api/customer/login", input);
        await refreshCustomer();
        return r;
      },
      register: async (input) => {
        const r = await postCustomer("/api/customer/register", input);
        await refreshCustomer();
        return r;
      },
      logout: async () => {
        const r = await postCustomer("/api/customer/logout", {});
        // Don't wait on refresh — backend cleared the cookie, so
        // setCustomerState(null) directly avoids a redundant 401.
        setCustomerState(null);
        return r;
      },
      requestRecover: (input) =>
        postCustomer("/api/customer/recover", input),
      confirmReset: async (input) => {
        const r = await postCustomer("/api/customer/reset", input);
        // Reset clears all sessions on the backend; user must log in
        // again. Force null so any stale state from before the reset
        // doesn't linger.
        setCustomerState(null);
        return r;
      },
      verifyEmail: async (input) => {
        const r = await postCustomer("/api/customer/verify-email", input);
        await refreshCustomer();
        return r;
      },
      resendVerification: (input) =>
        postCustomer("/api/customer/resend-verification", input),
      updateProfile: async (input) => {
        const r = await putCustomer("/api/customer/me", input);
        await refreshCustomer();
        return r;
      },
      changePassword: (input) =>
        putCustomer("/api/customer/me/password", input),
      refresh: refreshCustomer,
    }),
    [refreshCustomer],
  );

  // ── Initial cart fetch ─────────────────────────────────────────────────
  // GET /api/cart on mount serves two purposes:
  //   1. Hydrates the live cart state for returning visitors so the
  //      header cart count is accurate before any user interaction.
  //   2. Mints the `numu_csrf` cookie (the storefront's GET /api/cart
  //      handler emits Set-Cookie if missing). Subsequent cart-write
  //      calls read this cookie via document.cookie and echo it as
  //      the `x-numu-csrf` header for double-submit verification.
  //      Without this priming round-trip, a first-Add-to-Cart 403s
  //      because the cookie hasn't been issued yet.
  //
  // SSR-safe: `fetch` is a browser-only call here; we gate on `window`.
  // Errors are swallowed — the cart context starts empty either way,
  // and downstream actions surface their own errors.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/cart", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as Cart;
        if (data && typeof data === "object") {
          setCart(data);
        }
      } catch {
        // Network blip / not-yet-deployed cart endpoint. Leave the
        // empty initial cart in place; the user can still browse.
      }
    })();
    return () => {
      cancelled = true;
    };
    // Run once per mount; the cart endpoint is idempotent and the
    // CSRF cookie persists across navigations within the SPA.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Broadcast a `numu:cart:updated` CustomEvent on every cart change.
  // Why: non-React themes (vanilla JS / Alpine / Vue islands) can't
  // consume `useCart()`. They listen on `window` instead, which gives
  // them the same write-then-react contract React themes get for free.
  // The event detail mirrors the React `cart` shape so consumers don't
  // need to re-fetch.
  //
  // We skip the first dispatch — the initial state is the empty
  // placeholder before the GET /api/cart response lands, and themes
  // that ran their own `numu:cart:fetched`-style logic on page load
  // would otherwise see a spurious empty event right after rendering.
  const cartFirstRender = useRef(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (cartFirstRender.current) {
      cartFirstRender.current = false;
      return;
    }
    window.dispatchEvent(
      new CustomEvent("numu:cart:updated", { detail: cart }),
    );
  }, [cart]);

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
  //
  // Resilience: stores can come back from older API rows with `currency`
  // null/empty. `Intl.NumberFormat({ currency: "" })` throws "Currency
  // code is required with currency style", which crashes the entire
  // render tree. Fall back to USD for the formatter so themes keep
  // working — merchants will see prices in USD until they configure a
  // real currency, which is a clearer signal than a blank screen.
  const safeCurrency = (store.currency || "USD").toUpperCase();

  // Phase 3.7 — numeral system. Merchants opt into Arab-Indic
  // digits (٠١٢٣٤) for Arabic stores via store.settings.numerals.
  // Western (default) keeps the ASCII digits everyone's used to.
  // We construct intl locales with the appropriate `-u-nu-<system>`
  // extension so money + date + count formatters all stay consistent.
  const numeralSystem =
    ((store as unknown as { settings?: { numerals?: string } }).settings
      ?.numerals === "arabic")
      ? "arab"
      : "latn";
  const intlLocale = `${locale}-u-nu-${numeralSystem}`;

  // We deliberately compute intlLocale BEFORE these memos so the
  // numbering-system extension is part of the formatter cache key —
  // a merchant flipping store.settings.numerals from "western" to
  // "arabic" rebuilds the formatters on the next render rather than
  // continuing to render Western digits from the stale cache.
  const moneyFmt = useMemo(() => {
    try {
      return new Intl.NumberFormat(intlLocale, {
        style: "currency",
        currency: safeCurrency,
      });
    } catch {
      // Pathologic intlLocale (engine doesn't support `-u-nu-arab`
      // for the active language) — fall back to the bare locale.
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: safeCurrency,
      });
    }
  }, [intlLocale, locale, safeCurrency]);
  const dateFmt = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(intlLocale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
  }, [intlLocale, locale]);

  // Phase 3.6 — locales the store advertises. Falls back to a single-
  // entry list (the active locale) so themes can render the
  // LocaleSwitcher unconditionally without an extra check.
  const availableLocales = useMemo(() => {
    const list =
      (store as unknown as { available_locales?: string[] }).available_locales;
    if (Array.isArray(list) && list.length > 0) return list;
    return [locale];
  }, [store, locale]);

  // Phase 3.6 — locale switcher. Writes the cookie + reloads so the
  // server-rendered layout picks up the change. We prefer cookie over
  // querystring because cookie persists across cross-page navigation
  // without each page having to thread `?locale=ar` through every link.
  const switchLocale = useCallback((next: string) => {
    if (typeof document === "undefined") return;
    if (!next) return;
    // 1-year cookie; SameSite=Lax so it travels with same-origin nav
    // but doesn't leak on cross-site requests. Path=/ so every page
    // sees it.
    document.cookie =
      `numu_locale=${encodeURIComponent(next)}; ` +
      `Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    setLocale(next);
    // Reload so SSR re-runs with the new cookie. Themes that want
    // client-only locale swaps (no SSR re-render) can wrap their text
    // in `useTranslation()` and skip the reload — but locale-aware
    // SSR data (translated product names, RTL <html dir>) needs the
    // reload to take effect.
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }, []);

  // Default (no-options) number formatter — memoized so the formatNumber
  // hot path doesn't construct one per call. Declared BEFORE the
  // localization useMemo so the closure captures the resolved value.
  const defaultNumberFmt = useMemo(() => {
    try {
      return new Intl.NumberFormat(intlLocale);
    } catch {
      return new Intl.NumberFormat(locale);
    }
  }, [intlLocale, locale]);

  const localization: LocalizationState = useMemo(
    () => ({
      locale,
      direction: RTL_LOCALES.includes(locale) ? "rtl" : "ltr",
      translations,
      availableLocales,
      setLocale: switchLocale,
      formatMoney: (amount: number, currency?: string) => {
        const ccy = (currency || safeCurrency).toUpperCase();
        if (ccy !== safeCurrency) {
          // Override-currency path is rare; pay the formatter cost only here.
          // Empty/invalid override falls back to the store's safeCurrency
          // before this branch via the `||` above, so we never construct
          // an Intl.NumberFormat with `currency: ""`.
          try {
            return new Intl.NumberFormat(intlLocale, {
              style: "currency",
              currency: ccy,
            }).format(amount);
          } catch {
            return moneyFmt.format(amount);
          }
        }
        return moneyFmt.format(amount);
      },
      formatDate: (date: string | Date) =>
        dateFmt.format(typeof date === "string" ? new Date(date) : date),
      formatNumber: (n: number, options?: Intl.NumberFormatOptions) => {
        if (!options) return defaultNumberFmt.format(n);
        try {
          return new Intl.NumberFormat(intlLocale, options).format(n);
        } catch {
          return String(n);
        }
      },
    }),
    [
      locale,
      translations,
      safeCurrency,
      moneyFmt,
      dateFmt,
      availableLocales,
      switchLocale,
      intlLocale,
      defaultNumberFmt,
    ],
  );

  return (
    <ShopContext.Provider value={store}>
      <ThemeSettingsContext.Provider value={themeSettings}>
        <LocalizationContext.Provider value={localization}>
          <CartContext.Provider value={cartValue}>
            <CustomerContext.Provider value={customerState}>
              <CustomerActionsContext.Provider value={customerActions}>
                {children}
              </CustomerActionsContext.Provider>
            </CustomerContext.Provider>
          </CartContext.Provider>
        </LocalizationContext.Provider>
      </ThemeSettingsContext.Provider>
    </ShopContext.Provider>
  );
}
