"use client";

import { useContext, useMemo } from "react";

import { ShopContext } from "../contexts";
import type { InstalledApp, Store } from "../types/entities";

/**
 * Settings for one installed app, available at FIRST RENDER.
 *
 * This is the read side of `installed_apps` on the store payload, and the
 * reason it is not `useApp()`: `useApp` fetches client-side inside an effect,
 * so anything rendered from it appears only after hydration. A picker that
 * waited for it would emit the theme's own markup on the server, swap to the
 * app's on hydration, and drop one of the two — a double render and a layout
 * shift on every product page and grid card, on a mobile-first market.
 *
 * Returns `undefined` when the app is not installed, not enabled, or when the
 * host predates `installed_apps`. Callers must treat that as "render without
 * app settings", NOT as "render nothing" — a bundle is a CDN artifact and
 * outlives any single API deploy, so an older payload must degrade rather than
 * blank the section.
 *
 * `useApp()` stays exactly as it is for apps that genuinely need client-side
 * data later. It is simply not on the critical render path.
 */
export function useInstalledApp<T = Record<string, unknown>>(
  slug: string,
): T | undefined {
  const store = useContext(ShopContext) as Store | null;
  return useMemo(() => {
    const installs = store?.installed_apps;
    if (!Array.isArray(installs)) return undefined;
    const found = installs.find((a: InstalledApp) => a?.slug === slug);
    return found ? ((found.settings ?? {}) as T) : undefined;
  }, [store, slug]);
}

/** Is this app installed and enabled on the current store? */
export function useHasApp(slug: string): boolean {
  return useInstalledApp(slug) !== undefined;
}
