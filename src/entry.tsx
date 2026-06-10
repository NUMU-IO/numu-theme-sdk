"use client";

/**
 * `defineThemeEntry(renderApp)` — one-call theme entry that yields BOTH
 * halves of the V3 contract from a single component:
 *
 *   - `mount(el, ctx)`   — the client entry every host already calls
 *                          (now hydration-aware via `ctx.hydrate`).
 *   - `createApp(ctx)`   — the same React tree as a plain element, so the
 *                          host can `renderToString(createApp(ctx))` on the
 *                          server and ship real HTML before any JS runs.
 *
 * ```tsx
 * // src/main.tsx
 * import { defineThemeEntry } from "@numueg/theme-sdk";
 *
 * const entry = defineThemeEntry(({ currentTemplate }) => (
 *   <ThemeApp currentTemplate={currentTemplate} />
 * ));
 *
 * export const mount = entry.mount;
 * export const createApp = entry.createApp;
 * ```
 *
 * Why both MUST come from one definition: hydration only succeeds when the
 * server markup and the client tree are identical. Routing both through
 * `buildThemeElement` makes that true by construction — a theme cannot
 * accidentally ship a `createApp` that disagrees with its `mount`.
 *
 * Themes that only export `mount` keep working exactly as before; they are
 * simply never server-rendered (the host detects the missing `createApp`
 * and falls back to today's client-only mount).
 */

import type { ReactElement, ReactNode } from "react";

import {
  buildThemeElement,
  mountTheme,
  type ThemeMountContext,
  type ThemeRenderArgs,
} from "./mount";
import type { MountResult } from "./types/theme";

/** The pair of entry points a V3 theme bundle exports. */
export interface ThemeEntry {
  /** Client entry — host contract `mount(el, ctx): MountResult`. */
  mount: (el: HTMLElement, ctx: ThemeMountContext) => MountResult;
  /**
   * Server entry — returns the exact element tree `mount` would render,
   * for host-side `renderToString`. Must stay side-effect free: no DOM
   * access happens until React effects run (which they don't on the
   * server).
   */
  createApp: (ctx: ThemeMountContext) => ReactElement;
}

export function defineThemeEntry(
  renderApp: (args: ThemeRenderArgs) => ReactNode,
): ThemeEntry {
  return {
    mount: (el, ctx) => mountTheme(el, ctx, renderApp),
    createApp: (ctx) => buildThemeElement(ctx, null, renderApp),
  };
}
