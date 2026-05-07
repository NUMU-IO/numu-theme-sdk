"use client";

import { useMemo } from "react";

interface UseImageOptions {
  /** Sizes attribute (CSS sizes form). */
  sizes?: string;
  /** Widths to generate in srcSet. Falsy → use defaults. */
  widths?: number[];
  /** Pass-through alt text — useImage doesn't render anything; the
   * caller does. */
  alt?: string;
}

interface ImageDescriptor {
  src: string | null;
  srcSet: string | null;
  sizes: string;
  alt: string;
}

const DEFAULT_WIDTHS = [320, 480, 640, 768, 1024, 1280, 1600, 1920];
const DEFAULT_SIZES =
  "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw";

/**
 * useImage — returns srcSet/sizes for a CDN-served image so themes
 * don't have to hand-roll responsive image markup. Pairs with the
 * <Image> component, but is also useful when the theme wants to render
 * something other than a plain `<img>` (e.g., `<picture>` with art
 * direction or a CSS `background-image` via inline style).
 *
 * Returns `null` srcSet if the source URL already encodes a width
 * directive (theme author opted out of auto-sizing).
 */
export function useImage(
  src: string | null | undefined,
  opts: UseImageOptions = {},
): ImageDescriptor {
  const { sizes = DEFAULT_SIZES, widths = DEFAULT_WIDTHS, alt = "" } = opts;
  return useMemo(() => {
    if (!src) return { src: null, srcSet: null, sizes, alt };
    if (/[?&]w=\d+/.test(src)) return { src, srcSet: null, sizes, alt };
    const sep = src.includes("?") ? "&" : "?";
    const srcSet = widths.map((w) => `${src}${sep}w=${w} ${w}w`).join(", ");
    return { src, srcSet, sizes, alt };
  }, [src, sizes, widths, alt]);
}
