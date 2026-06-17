"use client";

import type { CSSProperties, ImgHTMLAttributes } from "react";
import { applyImageTransform, type ImageTransform } from "../utils/imageTransform";

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
  /**
   * Shopify-style frame. When set (e.g. "3/4", "16/9", "1/1") the image is
   * wrapped in a fixed-aspect, overflow-hidden box and the `<img>` fills it.
   * Combined with `objectFit="cover"` (the default) this guarantees the image
   * ALWAYS fits its frame — no letterboxing, no overflow — cropping to the
   * focal point. Omit to render a bare `<img>` (legacy behavior).
   */
  aspectRatio?: string;
  /**
   * How the image fills its box. Default "cover" (fill + crop) — the merchant
   * never sees a letterboxed/squashed image. Use "contain" for logos/badges
   * that must show in full.
   */
  objectFit?: "cover" | "contain" | "fill" | "scale-down" | "none";
  /** CSS object-position (e.g. "50% 50%"). Ignored if `transform` is set. */
  objectPosition?: string;
  /**
   * Non-destructive focal/zoom/rotation metadata from the image setting value
   * (`asImageTransform(setting)`). When present it drives object-fit +
   * object-position + scale/rotate so the editor preview and the live render
   * match exactly. Overrides `objectFit`/`objectPosition`.
   */
  transform?: ImageTransform | null;
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
  aspectRatio,
  objectFit,
  objectPosition,
  transform,
  className,
  style,
  ...rest
}: ImageProps) {
  // Frame mode: a fixed-aspect, overflow-hidden wrapper the <img> fills. This
  // is what guarantees "the image always fits its frame" regardless of the
  // uploaded image's own aspect ratio.
  const framed = Boolean(aspectRatio);

  if (!src) {
    const placeholder = (
      <div
        className={framed ? undefined : className}
        role="img"
        aria-label={alt}
        style={{
          backgroundColor: "rgba(0,0,0,0.05)",
          display: "block",
          width: "100%",
          height: framed ? "100%" : undefined,
          ...(framed ? {} : style),
        }}
      />
    );
    if (!framed) return placeholder;
    return (
      <span
        className={className}
        style={{ display: "block", aspectRatio, overflow: "hidden", ...style }}
      >
        {placeholder}
      </span>
    );
  }

  const srcSet = responsive ? buildSrcSet(src) : undefined;

  // Resolve the fit styling. An explicit transform wins (focal/zoom/rotate).
  // Inside a frame, default to cover so the image always fills it. Without a
  // frame, only apply a fit when the caller explicitly asked — preserving the
  // legacy bare-<img> behavior (and never overriding a className like
  // `object-contain` with an inline style).
  const effFit = objectFit ?? (framed ? "cover" : undefined);
  const fitStyle: CSSProperties = transform
    ? applyImageTransform(transform, effFit === "contain" ? "contain" : "cover")
    : {
        ...(effFit ? { objectFit: effFit } : {}),
        ...(objectPosition ? { objectPosition } : {}),
      };

  const img = (
    <img
      src={src}
      alt={alt}
      srcSet={srcSet || undefined}
      sizes={srcSet ? sizes : undefined}
      loading={loading}
      decoding="async"
      className={framed ? undefined : className}
      style={
        framed
          ? { width: "100%", height: "100%", display: "block", ...fitStyle }
          : { ...fitStyle, ...style }
      }
      {...rest}
    />
  );

  if (!framed) return img;
  return (
    <span
      className={className}
      style={{
        display: "block",
        position: "relative",
        width: "100%",
        aspectRatio,
        overflow: "hidden",
        ...style,
      }}
    >
      {img}
    </span>
  );
}
