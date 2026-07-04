"use client";

import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
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
 * Event dispatched on `window` when a Link is clicked and eligible for
 * client-side (soft) navigation. `detail.href` is the target path.
 *
 * Contract: the event is CANCELABLE. A host that can perform soft
 * navigation (e.g. the Next.js storefront routing through its client
 * router) listens for it and calls `event.preventDefault()` to claim
 * the navigation. If no listener claims it, the Link falls back to
 * default anchor behavior — a normal full-page navigation — so themes
 * running under hosts without the bridge (older storefronts, the CLI
 * dev server, static previews) keep working unchanged.
 */
export const NAVIGATE_EVENT = "numu:navigate";

export interface NavigateEventDetail {
  href: string;
}

/**
 * Ask the host to soft-navigate to `href`. Returns true when a host
 * listener claimed the navigation (the caller should suppress its own
 * default behavior), false when no handler is present (the caller
 * should fall back to a full navigation). Exposed for themes that
 * navigate programmatically (e.g. after a search submit).
 */
export function requestNavigate(href: string): boolean {
  if (typeof window === "undefined") return false;
  const event = new CustomEvent<NavigateEventDetail>(NAVIGATE_EVENT, {
    detail: { href },
    cancelable: true,
  });
  // dispatchEvent returns false when a listener called preventDefault()
  // — i.e. the host claimed the navigation.
  return !window.dispatchEvent(event);
}

/**
 * Route-aware <Link>. Themes write paths as `/products/<slug>` (matches
 * the production subdomain root). The storefront proxy rewrites those
 * under `/<subdomain>/...` in dev path-segment routing; in production
 * the subdomain hostname does the same job at the edge.
 *
 * Navigation is a two-tier contract:
 *   1. Soft (preferred): on an eligible plain left-click we dispatch a
 *      cancelable NAVIGATE_EVENT. A router-aware host claims it with
 *      preventDefault() and performs a client-side transition — React,
 *      the SDK runtime, and the evaluated theme bundle all stay warm,
 *      so page-to-page moves skip the full document reload + remount.
 *   2. Hard (fallback): no listener claims the event → default anchor
 *      behavior, a normal full-page navigation. Identical to the
 *      pre-0.10 behavior, so themes never break on hosts without the
 *      bridge.
 *
 * Soft navigation is only attempted for storefront-internal paths and
 * unmodified left-clicks: external URLs (protocol or `//`), hash-only
 * anchors, modified clicks (ctrl/cmd/shift/alt — "open in new tab"),
 * non-left buttons, `target` other than `_self`, and `download` links
 * all keep default browser behavior.
 */
export function Link({ to, children, onClick, ...rest }: LinkProps) {
  const shop = useShop();
  const isAbsolute = ABSOLUTE_URL.test(to);
  let href = to;
  if (!isAbsolute && shop && !to.startsWith("/")) {
    // Relative paths like "products/foo" treated as siblings of current.
    // Most themes use leading slashes; this is a defensive fallback.
    href = `/${to}`;
  }

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // The theme's own handler runs first and can preventDefault() to
    // opt out of navigation entirely (e.g. quick-view interception).
    onClick?.(e);
    if (e.defaultPrevented) return;
    // Only unmodified left-clicks on same-document targets are soft-nav
    // candidates; everything else keeps native browser semantics.
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (rest.target && rest.target !== "_self") return;
    if (rest.download !== undefined) return;
    if (isAbsolute) return;
    // Guard on `to` (the author-written path), not `href`: the shop
    // normalizer above prefixes bare paths with "/", turning "#reviews"
    // into "/#reviews" — which would slip past an href-only check and
    // wrongly soft-nav an in-page anchor.
    if (to.startsWith("#") || href.startsWith("#")) return;
    if (requestNavigate(href)) e.preventDefault();
  };

  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
