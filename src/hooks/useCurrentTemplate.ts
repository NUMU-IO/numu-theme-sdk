"use client";

import { useContext } from "react";
import { CurrentTemplateContext } from "../contexts";

/**
 * useCurrentTemplate — read the active page template's id.
 *
 * Values are the same strings used as keys in
 * `themeSettings.templates.<id>`:
 *
 *   "home" | "product" | "collection" | "cart" | "checkout"
 *   "order-confirmation" | "profile" | "page" | "404" | "password"
 *
 * Themes use this to render the matching section list:
 *
 *   const template = useCurrentTemplate();
 *   const settings = useThemeSettings();
 *   const sections = settings.templates?.[template]?.sections ?? {};
 *
 * Default: "home" — when the host hasn't supplied a CurrentTemplate
 * provider, themes still render their home template instead of
 * crashing or showing a blank screen.
 *
 * The hook is read-only; the active template changes via the host
 * navigating between Next.js routes (each route's `page.tsx` wraps
 * its content with the correct currentTemplate at the
 * `<NuMuProvider currentTemplate="…">` prop).
 */
export function useCurrentTemplate(): string {
  return useContext(CurrentTemplateContext);
}
