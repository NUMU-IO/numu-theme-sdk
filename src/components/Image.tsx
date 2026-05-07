"use client";

import type { ImgHTMLAttributes } from "react";

interface ImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet"> {
  src: string | undefined | null;
  alt: string;
  /**
   * Comma-separated breakpoints for the `sizes` attribute. Default
   * matches a typical responsive grid:
   *   "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
   */
  sizes?: string;
  /**
   * When true (default), generate a `srcSet` with several widths.
   * Disable for above-the-fold hero images where you want a single
   * source under direct theme control.
   */
  responsive?: boolean;
  /**
   * Loading strategy. Default "lazy" matches Shopify themes; pass
   * "eager" for above-the-fold imagery.
   */
  loading?: "eager" | "lazy";
}

const DEFAULT_WIDTHS = [320, 480, 640, 768, 1024, 1280, 1600, 1920];

/**
 * Build a srcSet string from a base image URL by appending a width
 * query param. Works for any CDN that honors `?w=` (R2 image-resizing,
 * Cloudflare Images, Imgix-compatibles). Hosts that ignore the param
 * just serve the original; not a regression.
 *
 * If the URL already has query params we preserve them; if it already
 * has a width directive we pass through unchanged (assume the theme
 * author knows what they want).
 */
function buildSrcSet(src: string, widths: number[] = DEFAULT_WIDTHS): string {
  if (/[?&]w=\d+/.test(src)) return "";
  const sep = src.includes("?") ? "&" : "?";
  return widths.map((w) => `${src}${sep}w=${w} ${w}w`).join(", ");
}

/**
 * <Image> — drop-in replacement for `<img>` with srcSet + lazy loading
 * defaults. Themes should use this everywhere they'd otherwise write a
 * raw `<img>` so merchant-uploaded images get responsive variants and
 * lazy loading without per-section work.
 *
 * If `src` is empty/null, renders a placeholder div so the layout
 * doesn't shift while a merchant configures images in the customizer.
 */
export function Image({
  src,
  alt,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw",
  responsive = true,
  loading = "lazy",
  className,
  style,
  ...rest
}: ImageProps) {
  if (!src) {
    return (
      <div
        className={className}
        role="img"
        aria-label={alt}
        style={{
          backgroundColor: "rgba(0,0,0,0.05)",
          display: "block",
          ...style,
        }}
      />
    );
  }

  const srcSet = responsive ? buildSrcSet(src) : undefined;
  return (
    <img
      src={src}
      alt={alt}
      srcSet={srcSet || undefined}
      sizes={srcSet ? sizes : undefined}
      loading={loading}
      decoding="async"
      className={className}
      style={style}
      {...rest}
    />
  );
}
