"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { useShop } from "../hooks/useShop";

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  /**
   * Path relative to the storefront root, e.g. "/products/foo",
   * "/collections/all", "/cart", "/pages/about". External URLs (with
   * a protocol) are passed through unchanged.
   */
  to: string;
  children: ReactNode;
}

const ABSOLUTE_URL = /^[a-z]+:|^\/\//i;

/**
 * Route-aware <Link>. Themes write paths as `/products/<slug>` (matches
 * the production subdomain root). The storefront proxy rewrites those
 * under `/<subdomain>/...` in dev path-segment routing; in production
 * the subdomain hostname does the same job at the edge.
 *
 * For plain anchor behavior — server-rendered HTML, full page nav — we
 * just emit a regular `<a>`. Themes that want client-side transitions
 * can wrap this in their own router-aware component; in practice
 * storefront pages are SSR'd so a full nav is fine and predictable.
 *
 * External URLs (have a protocol or start with `//`) pass through
 * unchanged so social-media links, CDN paths, etc. work without
 * special casing.
 */
export function Link({ to, children, ...rest }: LinkProps) {
  const shop = useShop();
  const isAbsolute = ABSOLUTE_URL.test(to);
  let href = to;
  if (!isAbsolute && shop && !to.startsWith("/")) {
    // Relative paths like "products/foo" treated as siblings of current.
    // Most themes use leading slashes; this is a defensive fallback.
    href = `/${to}`;
  }
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}
