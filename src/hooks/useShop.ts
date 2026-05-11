"use client";
import { useContext, useMemo } from "react";
import { ShopContext } from "../contexts";
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

  return useMemo(() => {
    const domain = resolveDomain(ctx);
    const formatUrl = (path: string): string => {
      if (!path) return `${DEFAULT_PROTOCOL}://${domain}/`;
      // Already absolute? Hand back as-is.
      if (/^https?:\/\//i.test(path)) return path;
      // Protocol-relative — assume same protocol as the host.
      if (path.startsWith("//")) return `${DEFAULT_PROTOCOL}:${path}`;
      const normalized = path.startsWith("/") ? path : `/${path}`;
      return `${DEFAULT_PROTOCOL}://${domain}${normalized}`;
    };
    return { ...ctx, domain, formatUrl };
  }, [ctx]);
}
