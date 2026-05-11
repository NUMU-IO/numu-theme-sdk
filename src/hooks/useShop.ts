"use client";
import { useContext, useMemo } from "react";
import { ShopContext } from "../contexts";
import { useLocale } from "./useLocalization";
import type { Store } from "../types/entities";

/**
 * Augmented Store shape returned from useShop().
 *
 * Adds a couple of conveniences theme devs reach for constantly:
 *   - `domain` — the active hostname (subdomain or custom). Resolved
 *     from `store.domain ?? store.subdomain ?? store.slug`.
 *   - `formatUrl(path)` — emits a fully-qualified URL using `domain`.
 *     Theme code that needs to render absolute URLs (canonical tags,
 *     Open Graph, JSON-LD) goes through this so dev/prod / subdomain
 *     vs. custom-domain stays correct without each theme reinventing
 *     the resolver.
 */
export interface ShopWithHelpers extends Store {
  /** Fully-qualified hostname this store currently serves on. */
  domain: string;
  /**
   * Format a path (relative or absolute) as a fully-qualified URL on
   * this store's domain. No-ops when given an already-absolute URL.
   *
   * Phase 6 — when the active locale is non-default and the store
   * has opted into locale URL prefixes, the path is prefixed with
   * `/{locale}/` (e.g. `/ar/products/foo`). Already-prefixed paths
   * are left alone so calling `formatUrl(formatUrl(...))` is safe.
   */
  formatUrl(path: string): string;
}

const DEFAULT_PROTOCOL =
  typeof window !== "undefined"
    ? window.location.protocol.replace(":", "")
    : "https";

function resolveDomain(store: Store): string {
  // Custom domain wins when set; otherwise fall back to the platform
  // subdomain. The slug is a last resort for stores that haven't been
  // assigned either yet (mostly demo stores in dev).
  if (store.domain) return store.domain;
  if (store.subdomain) {
    // The platform-domain default lives on the storefront; theme code
    // doesn't have access to env vars, so we read it off the runtime
    // window object when present and fall back to the well-known
    // production value. Themes can override by rendering with
    // `<meta name="numu:platform-domain" content="...">` if they're
    // hosted on a non-default platform.
    const platform =
      (typeof window !== "undefined" &&
        (window as unknown as { __NUMU_PLATFORM_DOMAIN?: string })
          .__NUMU_PLATFORM_DOMAIN) ||
      "numueg.app";
    return `${store.subdomain}.${platform}`;
  }
  return store.slug;
}

export function useShop(): ShopWithHelpers {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop must be used within NuMuProvider");
  const locale = useLocale();

  return useMemo(() => {
    const domain = resolveDomain(ctx);
    const settings = (ctx as Store & { settings?: Record<string, unknown> })
      .settings;
    const localePrefixEnabled = Boolean(
      settings && (settings as { locale_url_prefix_enabled?: boolean }).locale_url_prefix_enabled,
    );
    const defaultLocale = ctx.default_language || "en";
    // List of locales that get a URL prefix. Defaults to "everything
    // except the default" — but a store can opt into `["ar", "en"]`
    // (prefix even the default) if it wants a fully prefixed URL
    // scheme like Shopify does for markets.
    const prefixedLocales =
      (settings as { locale_url_prefix_locales?: string[] } | undefined)
        ?.locale_url_prefix_locales || null;
    const shouldPrefix = (l: string): boolean => {
      if (!localePrefixEnabled) return false;
      if (prefixedLocales) return prefixedLocales.includes(l);
      return l !== defaultLocale;
    };

    const formatUrl = (path: string): string => {
      if (!path) return `${DEFAULT_PROTOCOL}://${domain}/`;
      // Already absolute? Hand back as-is.
      if (/^https?:\/\//i.test(path)) return path;
      // Protocol-relative — assume same protocol as the host.
      if (path.startsWith("//")) return `${DEFAULT_PROTOCOL}:${path}`;
      let normalized = path.startsWith("/") ? path : `/${path}`;
      if (locale && shouldPrefix(locale)) {
        // Idempotent: don't double-prefix if the caller already
        // gave us a /{locale}/... path.
        const prefix = `/${locale}/`;
        const root = `/${locale}`;
        if (normalized !== root && !normalized.startsWith(prefix)) {
          normalized = `${root}${normalized}`;
        }
      }
      return `${DEFAULT_PROTOCOL}://${domain}${normalized}`;
    };
    return { ...ctx, domain, formatUrl };
  }, [ctx, locale]);
}
