"use client";

import { useEffect, useState } from "react";
import type {
  CSSProperties,
  ImgHTMLAttributes,
  ReactEventHandler,
} from "react";
import {
  applyImageTransform,
  focalSrc,
  type FocalSrcOptions,
  type ImageTransform,
} from "../utils/imageTransform";

/**
 * Width ladder for hero srcSet. MUST be a subset of the storefront's
 * `next.config.ts` images.deviceSizes = [640,768,1024,1280,1920]. On the
 * default (Cloudflare-off) path /api/image-transform 302s to /_next/image,
 * which returns HTTP 400 for ANY width not in deviceSizes. When CF Image
 * Resizing is on, CF accepts arbitrary widths — so this safe subset works on
 * both paths. (Do NOT add 2400/3200 here without also adding them to deviceSizes.)
 */
const HERO_WIDTHS = [640, 768, 1024, 1280, 1920];
/** Default mobile breakpoint (px) — matches Tailwind `md`. */
const DEFAULT_BREAKPOINT = 768;
/** Base width requested for the rendered desktop / mobile `<img src>` fallback. */
const DESKTOP_BASE_WIDTH = 1920;
const MOBILE_BASE_WIDTH = 1280;

export interface HeroMediaProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "alt" | "style"> {
  /** Desktop (primary) image URL. */
  src: string | null | undefined;
  alt: string;
  /** Desktop focal/zoom/rotation (`asImageTransform(setting)`). */
  transform?: ImageTransform | null;
  /** Optional mobile art-direction image. When set → swaps below `breakpoint`. */
  mobileSrc?: string | null;
  /** Mobile focal/zoom/rotation. Falls back to the desktop transform's focal. */
  mobileTransform?: ImageTransform | null;
  /** Server-crop box aspect for desktop, e.g. "16/9". Match the theme container. */
  desktopAspect?: string;
  /** Server-crop box aspect for mobile, e.g. "4/5". */
  mobileAspect?: string;
  /** object-fit. Default "cover". Pass "contain" for letterboxed art. */
  fit?: "cover" | "contain";
  /** Above-the-fold? Default true → loading=eager + fetchPriority=high. */
  priority?: boolean;
  /** sizes attribute. Hero is full-width → default "100vw". */
  sizes?: string;
  /** Below this width (px) the mobile image is used. Default 768. */
  breakpoint?: number;
  /**
   * Pre-fetch the alternate (off-breakpoint) image so a Desktop↔Mobile swap is an
   * instant cache hit instead of a flash-and-fetch. Default true. Set false to save
   * the one extra background request when smooth resizing isn't worth the bandwidth.
   */
  preloadAlternate?: boolean;
  className?: string;
  style?: CSSProperties;
}

function heroSrcSet(url: string, opts: Omit<FocalSrcOptions, "width">): string {
  return HERO_WIDTHS
    .map((w) => `${focalSrc(url, { width: w, ...opts })} ${w}w`)
    .join(", ");
}

/**
 * <HeroMedia> — above-the-fold hero image for V3 themes.
 *
 *  - Real responsive srcSet routed through /api/image-transform (resize + AVIF/WebP,
 *    + focal smart-crop when Cloudflare Image Resizing is enabled).
 *  - LCP perf defaults: loading=eager + fetchPriority=high (disable via priority={false}).
 *  - Non-destructive focal/zoom/rotation framing via applyImageTransform.
 *  - Optional MOBILE art-direction image: a different bitmap below `breakpoint`.
 *
 * ## Why matchMedia, not <picture><source media>
 * Art direction is resolved in JS (a `matchMedia` listener) rather than a native
 * `<picture><source media>`. A native `<picture>` does NOT reliably re-pick its source
 * when an EMBEDDED preview resizes its iframe — exactly what the theme editor's
 * Desktop/Mobile toggle does — so the hero would stay stuck on the desktop bitmap at
 * mobile sizes. CSS media queries DO re-evaluate on that resize (Tailwind flips the
 * container to portrait), and `matchMedia` shares that engine, so the swap is
 * deterministic. The state initialises from `matchMedia` so the first client paint is
 * already correct (V3 themes mount client-side) — no desktop→mobile flash on phones.
 *
 * ## Smooth swap
 * The off-breakpoint image is pre-warmed (low priority, after paint) so toggling the
 * breakpoint — the editor switch, or a window resize — paints from cache instantly
 * instead of fetching on demand. See `preloadAlternate`.
 *
 * When `mobileSrc` is omitted this is a single responsive <img> filling its parent —
 * the theme keeps its own wrapper/sizing, identical to a raw <img> plus srcSet + perf.
 */
export function HeroMedia({
  src,
  alt,
  transform,
  mobileSrc,
  mobileTransform,
  desktopAspect,
  mobileAspect,
  fit = "cover",
  priority = true,
  sizes = "100vw",
  breakpoint = DEFAULT_BREAKPOINT,
  preloadAlternate = true,
  className,
  style,
  ...rest
}: HeroMediaProps) {
  const hasMobile = !!mobileSrc;
  const mobileQuery = `(max-width: ${breakpoint - 1}px)`;

  // Which art-direction image is active. Initialised from matchMedia so the FIRST
  // client paint is already correct (no desktop→mobile flash on phones), then kept in
  // sync by a change listener (the reliable replacement for <picture> source re-pick).
  const [isMobile, setIsMobile] = useState(
    () =>
      hasMobile &&
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia(mobileQuery).matches,
  );

  // If the storefront's /api/image-transform refuses the image host (it's not on the
  // allow-list → 403), the optimized request fails. Fall back to the RAW url so the
  // hero still renders — never a regression vs a plain <img>. The optimize path
  // (resize/AVIF) still applies for allow-listed hosts (the common case). The theme's
  // own onError (if any) only fires once the RAW url ALSO fails (genuinely broken).
  const [rawFallback, setRawFallback] = useState(false);
  const { onError: themeOnError, ...imgRest } = rest;
  const handleError: ReactEventHandler<HTMLImageElement> = (e) => {
    if (!rawFallback) setRawFallback(true);
    else themeOnError?.(e);
  };

  // Keep `isMobile` in sync with the viewport. matchMedia change events fire on every
  // resize that crosses the breakpoint, INCLUDING an iframe resize — so the editor's
  // Desktop/Mobile toggle deterministically swaps the bitmap.
  useEffect(() => {
    if (!hasMobile || typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mq = window.matchMedia(mobileQuery);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, [hasMobile, mobileQuery]);

  // Framing inputs (safe to compute every render; cheap + pure).
  const desktopFocal = transform?.focal;
  const mobileFocal = mobileTransform?.focal ?? desktopFocal;
  // Desktop server-crop params (focal/aspect/fit) are sent ONLY when an explicit
  // desktopAspect is requested. A full-bleed desktop hero (no aspect) stays width-only
  // — byte-matching the host's width-only <link rel=preload> so the preload is credited.
  // CSS applyImageTransform still frames the desktop focal either way.
  const desktopCrop: Omit<FocalSrcOptions, "width"> = desktopAspect
    ? { focal: desktopFocal, aspect: desktopAspect, fit }
    : {};
  const mobileCrop: Omit<FocalSrcOptions, "width"> = {
    focal: mobileFocal,
    aspect: mobileAspect,
    fit,
  };

  // Pre-warm the ALTERNATE image (low priority, after paint) so the breakpoint swap is
  // an instant cache hit. The active image is already fetched by the rendered <img>;
  // re-warming it would be a no-op cache hit, so we only warm the off-breakpoint one.
  useEffect(() => {
    if (!preloadAlternate || !hasMobile || !src || !mobileSrc) return;
    if (typeof window === "undefined" || typeof window.Image !== "function") return;
    const altUrl = isMobile
      ? rawFallback
        ? src
        : focalSrc(src, { width: DESKTOP_BASE_WIDTH, ...desktopCrop })
      : rawFallback
        ? mobileSrc
        : focalSrc(mobileSrc, { width: MOBILE_BASE_WIDTH, ...mobileCrop });
    if (!altUrl) return;
    const im = new window.Image();
    im.onerror = () => {};
    try {
      (im as unknown as { fetchPriority?: string }).fetchPriority = "low";
    } catch {
      /* not supported — ignore */
    }
    im.decoding = "async";
    im.src = altUrl;
    if (typeof im.decode === "function") im.decode().catch(() => {});
    // desktopCrop/mobileCrop are derived from the deps below; intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preloadAlternate, hasMobile, src, mobileSrc, isMobile, rawFallback]);

  if (!src) {
    // Placeholder so layout doesn't shift while the merchant configures the image.
    return (
      <div
        className={className}
        role="img"
        aria-label={alt}
        style={{ width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.05)", ...style }}
      />
    );
  }

  const useMobile = hasMobile && isMobile;
  const activeUrl = useMobile ? (mobileSrc as string) : src;
  const activeCrop = useMobile ? mobileCrop : desktopCrop;
  const activeBase = useMobile ? MOBILE_BASE_WIDTH : DESKTOP_BASE_WIDTH;
  const activeSrc = rawFallback
    ? activeUrl
    : focalSrc(activeUrl, { width: activeBase, ...activeCrop });
  const activeSrcSet = rawFallback ? undefined : heroSrcSet(activeUrl, activeCrop);
  const fitStyle = applyImageTransform(useMobile ? mobileTransform ?? transform : transform, fit);

  return (
    <img
      src={activeSrc}
      srcSet={activeSrcSet}
      sizes={activeSrcSet ? sizes : undefined}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      onError={handleError}
      className={className}
      style={{ width: "100%", height: "100%", display: "block", ...fitStyle, ...style }}
      {...imgRest}
    />
  );
}
