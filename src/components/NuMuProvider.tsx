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
  CurrentTemplateContext,
  PageContext,
  NavigationContext,
  CurrencyContext,
} from "../contexts";
import {
  CustomerActionsContext,
  type CustomerActions,
} from "../contexts/customer-actions";
import { readVariantSelection } from "../utils/selectionRegistry";
import type { Store, Cart, CartItem, Customer } from "../types/entities";
import type { ThemeSettingsV3 } from "../types/theme";
import type {
  LocalizationState,
  MenuItemData,
  CartMutationResult,
  CurrencyConfig,
  CurrencyState,
} from "../contexts";

const RTL_LOCALES = ["ar", "he", "fa", "ur"];

interface NuMuProviderProps {
  store: Store;
  themeSettings: ThemeSettingsV3;
  initialCart?: Cart;
  customer?: Customer | null;
  locale?: string;
  translations?: Record<string, string>;
  /**
   * Wave 5 — id of the active page template. Hosts pass this from the
   * route (e.g. "product" inside app/(store)/[subdomain]/product/[id]).
   * Themes read it via `useCurrentTemplate()` to render the matching
   * section list. Defaults to "home" when omitted, so existing themes
   * built before the prop existed keep rendering their home template.
   */
  currentTemplate?: string;
  /**
   * I3 — resolved alternate template key for the current page (e.g.
   * `"product.wholesale"`) when the storefront routed it to a template
   * suffix. Published on the synthesized `PageContext` value so themes read
   * it via `usePage()?.template`. Distinct from `currentTemplate`, which is
   * the base route type (`"product"`). Omit for pages on their default
   * template; additive, so themes/hosts predating it are unaffected.
   */
  pageTemplate?: string;
  /**
   * Pre-fetched product list for the current page. Themes that call
   * `useProducts()` will read these from PageContext without needing
   * `fetchIfMissing: true`. Hosts typically populate this from their
   * route loader / SSR pass; omitting it leaves `useProducts()`
   * returning an empty array unless the theme opts into client fetch.
   */
  initialProducts?: import("../types/entities").Product[];
  /**
   * Pre-fetched collection list — same pattern as initialProducts for
   * `useCollections()`. Categories/collections shown on the home page
   * read this slot.
   */
  initialCollections?: import("../types/entities").Collection[];
  /**
   * Phase 2.4 — store navigation menus keyed by handle (`main-menu`,
   * `footer`, …), resolved server-side by the host and injected so a
   * theme's `useNavigation(handle)` resolves synchronously without a
   * client round-trip. Omit for hosts/themes that don't wire menus —
   * `useNavigation` then falls back to its own fetch or the theme's
   * `DEFAULT_NAV`.
   */
  navigation?: Record<string, MenuItemData[]>;
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
 * The storefront's /api/cart returns money in CENTS (matching the checkout
 * and built-in cart, which divide by 100 themselves). Themes consume the cart
 * via useCart() and render with <Money>/formatMoney, which expect MAJOR units
 * — the same convention as Product.price after the host normalizes it. Convert
 * cart money to major here so the BYOT boundary is consistent end-to-end.
 *
 * Display-only: checkout submits quantities (the server recomputes amounts),
 * so this never changes what the customer is charged.
 */
function normalizeCartFromServer(cart: Cart): Cart {
  const toMajor = (n: number | null | undefined): number =>
    typeof n === "number" ? n / 100 : 0;
  return {
    ...cart,
    subtotal: toMajor(cart.subtotal),
    total: toMajor(cart.total),
    ...(cart.discount_amount != null
      ? { discount_amount: toMajor(cart.discount_amount) }
      : {}),
    items: Array.isArray(cart.items)
      ? cart.items.map((it) => {
          // The storefront/backend cart line item ships `product_name` +
          // `unit_price`/`total_price` (cents), not the `name`/`price` the
          // SDK's CartItem interface (and themes) expect. Map them here so
          // every theme's cart renders the real name + price instead of a
          // blank name and 0.00. Honour `name`/`price` first for any backend
          // that already uses them.
          const raw = it as CartItem & {
            product_name?: string;
            unit_price?: number;
          };
          return {
            ...it,
            name: raw.name || raw.product_name || "",
            price: toMajor(raw.price ?? raw.unit_price),
            variant_name: raw.variant_name ?? undefined,
          };
        })
      : [],
  };
}

/**
 * The storefront's /api/cart* routes return the cart inside a `{data}`
 * envelope (`{ success, data: Cart, message }`) — the platform-wide response
 * shape the hub / admin / customer-fetch all unwrap. The cart logic here
 * historically read the response AS the cart, so `data.items` was `undefined`
 * and the cart silently stayed EMPTY: add-to-cart returned 200/201 but the
 * header count and cart page never updated. Unwrap `.data` when present.
 */
function unwrapCart(json: unknown): Cart {
  if (
    json &&
    typeof json === "object" &&
    "data" in json &&
    (json as { data?: unknown }).data &&
    typeof (json as { data?: unknown }).data === "object"
  ) {
    return (json as { data: Cart }).data;
  }
  return json as Cart;
}

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

// ── Currency cookie (numu_currency) ────────────────────────────────────────
// Persists the visitor's presentment-currency choice so it survives cross-page
// navigation. Owned by NuMuProvider (was previously in useCurrency).
const CURRENCY_COOKIE_NAME = "numu_currency";
const CURRENCY_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function readCurrencyCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${CURRENCY_COOKIE_NAME}=([^;]+)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCurrencyCookie(value: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${CURRENCY_COOKIE_NAME}=${encodeURIComponent(value)}; path=/; max-age=${CURRENCY_COOKIE_MAX_AGE}; SameSite=Lax`;
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
 * Resolves a `CartMutationResult` so the caller can tell success from
 * failure. Previously this swallowed `!res.ok` with a bare `return`, so an
 * out-of-stock / validation / 403 rejection was indistinguishable from a
 * successful write — and `addItem` fired its `add_to_cart` analytics event
 * regardless. Now a non-2xx resolves `{ ok: false, status, message }` (and
 * does NOT apply a cart), so themes can surface the error and analytics can
 * be gated on `ok`. On success it applies the cart and resolves
 * `{ ok: true, status }`. Network throws still reject (callers that relied on
 * try/catch keep that behavior); `mutate` wraps this and always sets loading.
 */
async function postCartMutation(
  endpoint: string,
  body: unknown,
  applyCart: (cart: Cart) => void,
  reserveToken: () => number,
): Promise<CartMutationResult> {
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
  if (!res.ok) {
    // Non-2xx (OOS, validation, 403 CSRF, …). Pull the backend's error text
    // when the body parses so a theme can show a real message; never apply a
    // cart from a failed write.
    let message: string | undefined;
    try {
      const err = (await res.json()) as Record<string, unknown> | null;
      if (err && typeof err === "object") {
        const m = err.message ?? err.error ?? err.detail;
        if (typeof m === "string") message = m;
      }
    } catch {
      // Non-JSON / empty error body — status alone carries the signal.
    }
    void token;
    return { ok: false, status: res.status, message };
  }
  const json = await res.json();
  applyCart(unwrapCart(json));
  // Token was actually consumed on entry; applyCart enforces ordering
  // via the closure below.
  void token;
  return { ok: true, status: res.status };
}

export function NuMuProvider({
  store,
  themeSettings,
  initialCart,
  customer,
  locale: initialLocale,
  translations: initialTranslations,
  currentTemplate = "home",
  pageTemplate,
  initialProducts,
  initialCollections,
  navigation,
  children,
}: NuMuProviderProps) {
  // Synthesise a Page record so `useProducts()` and `useCollections()`
  // can read pre-fetched lists via PageContext. Stable identity ensures
  // we don't bust the context on every render (initialProducts and
  // initialCollections come in as fresh arrays from the host's
  // useMemo'd ctx, so referential equality already holds across renders
  // without changes; useMemo here is belt-and-suspenders).
  const pageValue = useMemo(
    () =>
      ({
        type: currentTemplate,
        title: store?.name ?? "",
        // I3 — resolved alternate template key (e.g. "product.wholesale"),
        // surfaced via usePage()?.template. Omitted when undefined so a
        // page on its default template exposes no `template` field.
        ...(pageTemplate ? { template: pageTemplate } : {}),
        data: {
          products: initialProducts ?? [],
          collections: initialCollections ?? [],
        },
      }) as import("../types/entities").Page,
    [currentTemplate, pageTemplate, store?.name, initialProducts, initialCollections],
  );
  const [cart, setCart] = useState<Cart>(
    initialCart || { ...EMPTY_CART, currency: store.currency },
  );
  // `loading` starts TRUE when the cart is NOT hydrated (no initialCart): the
  // cart is EMPTY_CART only because the on-mount GET /api/cart hasn't landed
  // yet, NOT because the cart is genuinely empty. Without this, a returning
  // shopper's cart page flashed "YOUR CART IS EMPTY" for the fetch window
  // (themes gate their empty state on `loading` — see cart sections). Cleared
  // in the initial-fetch effect's finally. When the host hydrates `initialCart`
  // (SSR), the cart is already known → not loading.
  const [loading, setLoading] = useState(!initialCart);
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
        const json = await res.json();
        const data = unwrapCart(json);
        if (data && typeof data === "object") {
          setCart(normalizeCartFromServer(data));
        }
      } catch {
        // Network blip / not-yet-deployed cart endpoint. Leave the
        // empty initial cart in place; the user can still browse.
      } finally {
        // Initial cart load resolved (success OR failure): the cart state is
        // now authoritative, so drop the loading flag. Themes stop showing
        // their loading placeholder and reveal the real cart / empty state.
        if (!cancelled) setLoading(false);
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
      setCart(normalizeCartFromServer(newCart));
    },
    [],
  );

  const mutate = useCallback(
    async (endpoint: string, body: unknown): Promise<CartMutationResult> => {
      const token = reserveToken();
      setLoading(true);
      try {
        return await postCartMutation(
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
    async (
      productId: string,
      variantId?: string,
      quantity?: number,
      selectedOptions?: Record<string, string>,
    ): Promise<CartMutationResult> => {
      // Shared event id for Meta AddToCart dedup: the host /api/cart/add route
      // fires the CAPI event with this id, and the host <MetaPixel> bridge
      // fires the matching browser fbq from the CustomEvent below.
      const eventId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}`;
      const qty = quantity || 1;
      // Picker axes — the backend uses them ONLY as a variant_name fallback
      // when the variant row can't name itself (legacy products keep axes in
      // attributes JSON with a placeholder variant whose option_values is {}).
      // Falls back to the live useVariantSelection state for this product so
      // themes calling addItem directly get the rule with no changes.
      const axes =
        selectedOptions && Object.keys(selectedOptions).length > 0
          ? selectedOptions
          : (readVariantSelection(productId) ?? undefined);
      const result = await mutate("/api/cart/add", {
        product_id: productId,
        variant_id: variantId,
        quantity: qty,
        selected_options: axes,
        _event_id: eventId,
      });
      // Gate the AddToCart analytics on a SUCCESSFUL write. This previously
      // fired unconditionally, so an out-of-stock / validation / 403 rejection
      // still reported a phantom add_to_cart to Meta/GA and inflated the
      // funnel. On failure, return the result so the theme can react (toast,
      // "out of stock", …) without a spurious conversion event.
      if (!result.ok) return result;
      // Browser-side AddToCart signal — CAPI is fired server-side by the cart
      // route with the same id. Dispatched directly (not via useAnalytics) so
      // we control the event_id and avoid a duplicate /track POST.
      try {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("numu:analytics:event", {
              detail: {
                event: "add_to_cart",
                payload: {
                  content_ids: [productId],
                  content_type: "product",
                  num_items: qty,
                },
                event_id: eventId,
              },
            }),
          );
        }
      } catch {
        /* CustomEvent unsupported — server CAPI still covers the event */
      }
      return result;
    },
    [mutate],
  );

  const removeItem = useCallback(
    (itemId: string) => mutate("/api/cart/remove", { item_id: itemId }),
    [mutate],
  );

  const updateQuantity = useCallback(
    (itemId: string, quantity: number) =>
      mutate("/api/cart/update", { item_id: itemId, quantity }),
    [mutate],
  );

  const applyDiscount = useCallback(
    (code: string) => mutate("/api/cart/discount", { code }),
    [mutate],
  );

  const removeDiscount = useCallback(
    // DELETE — postCartMutation interprets undefined body as DELETE.
    () => mutate("/api/cart/discount", undefined),
    [mutate],
  );

  /**
   * Persist a customer note on the cart. Round-trips to the backend so the
   * note survives reload (the previous local-only behavior was a footgun).
   */
  const updateNote = useCallback(
    (note: string) => mutate("/api/cart/update", { note }),
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

  // ── Multi-currency presentment (fetched ONCE here) ─────────────────────
  // Lifted out of useCurrency() so a single fetch + a single selection back
  // EVERY <Money>/useMoney()/<CurrencySwitcher> on the page. Before this, each
  // useCurrency() caller fetched its own copy and held selection in local
  // state, so a <CurrencySwitcher> change never reached the price tags.
  const [currencyConfig, setCurrencyConfig] = useState<CurrencyConfig | null>(
    null,
  );
  const [currencyLoading, setCurrencyLoading] = useState(true);
  // Empty until the fetch resolves cookie→default→base. Starts empty on BOTH
  // server and client so the first client render matches the server markup
  // (hydration-safe); the effect sets the real value AFTER mount, and any
  // resulting price re-format is a post-hydration update.
  const [currencySelected, setCurrencySelected] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/storefront/currencies", {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`currencies: HTTP ${res.status}`);
        const body = (await res.json()) as { data: CurrencyConfig };
        if (cancelled) return;
        setCurrencyConfig(body.data);
        // cookie → default_presentment → base, validated against presentment
        // so a stale cookie can't lock the visitor onto a removed currency.
        const cookie = readCurrencyCookie();
        const valid =
          cookie && body.data.presentment?.includes(cookie) ? cookie : null;
        setCurrencySelected(
          valid || body.data.default_presentment || body.data.base,
        );
      } catch {
        if (cancelled) return;
        setCurrencyConfig(null);
        setCurrencySelected(store.currency || "EGP");
      } finally {
        if (!cancelled) setCurrencyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store.id, store.currency]);

  const currencyRates = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    if (!currencyConfig) return out;
    for (const [k, v] of Object.entries(currencyConfig.rates)) {
      const n = Number.parseFloat(v);
      if (Number.isFinite(n)) out[k] = n;
    }
    return out;
  }, [currencyConfig]);

  const convertCurrency = useCallback(
    (cents: number, target?: string): number => {
      if (!currencyConfig) return cents;
      const to = target || currencySelected;
      if (!to || to === currencyConfig.base) return cents;
      const rate = currencyRates[to];
      if (!rate || !Number.isFinite(rate)) return cents;
      return Math.round(cents * rate);
    },
    [currencyConfig, currencyRates, currencySelected],
  );

  const setCurrency = useCallback((currency: string) => {
    setCurrencySelected(currency);
    writeCurrencyCookie(currency);
  }, []);

  const currencyValue = useMemo<CurrencyState>(
    () => ({
      base: currencyConfig?.base || store.currency || "EGP",
      selected:
        currencySelected || currencyConfig?.base || store.currency || "EGP",
      presentment: currencyConfig?.presentment || [store.currency || "EGP"],
      rates: currencyRates,
      autoConvert: Boolean(currencyConfig?.auto_convert),
      loading: currencyLoading,
      setSelected: setCurrency,
      convert: convertCurrency,
    }),
    [
      currencyConfig,
      currencySelected,
      currencyRates,
      currencyLoading,
      store.currency,
      setCurrency,
      convertCurrency,
    ],
  );

  return (
    <ShopContext.Provider value={store}>
      <ThemeSettingsContext.Provider value={themeSettings}>
        <CurrentTemplateContext.Provider value={currentTemplate}>
          <PageContext.Provider value={pageValue}>
            <LocalizationContext.Provider value={localization}>
              <CurrencyContext.Provider value={currencyValue}>
                <CartContext.Provider value={cartValue}>
                  <CustomerContext.Provider value={customerState}>
                    <CustomerActionsContext.Provider value={customerActions}>
                      <NavigationContext.Provider value={navigation ?? {}}>
                        {children}
                      </NavigationContext.Provider>
                    </CustomerActionsContext.Provider>
                  </CustomerContext.Provider>
                </CartContext.Provider>
              </CurrencyContext.Provider>
            </LocalizationContext.Provider>
          </PageContext.Provider>
        </CurrentTemplateContext.Provider>
      </ThemeSettingsContext.Provider>
    </ShopContext.Provider>
  );
}
