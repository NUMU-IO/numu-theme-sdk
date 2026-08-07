import type { CSSProperties } from "react";

/**
 * Non-destructive image framing transform (focal / zoom / rotation).
 *
 * An image setting value may carry optional `transform` metadata
 * (`{ url, alt, transform }`). The original asset is never modified — the
 * storefront reproduces the framing purely from these numbers via CSS, so the
 * SAME uploaded image can be framed differently per placement (hero vs card).
 *
 * Hoisted into the SDK (was duplicated in every theme's `_shared.ts` and in
 * the merchant-hub editor's `imageTransform.ts`). The editor copy MUST stay
 * equivalent so its preview matches the storefront render exactly.
 */
export interface ImageTransform {
  v: 1;
  focal?: { x: number; y: number }; // 0..1, default center
  zoom?: number; // 1..4, default 1
  rotation?: number; // degrees, default 0
  fit?: "cover" | "contain";
}

const _clampT = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));

/** Read the transform off an image setting value (string | {url,alt,transform}). */
export function asImageTransform(v: unknown): ImageTransform | undefined {
  if (v && typeof v === "object" && "transform" in v) {
    const t = (v as { transform?: unknown }).transform;
    if (t && typeof t === "object") return t as ImageTransform;
  }
  return undefined;
}

/**
 * CSS reproducing the transform on an `<img>` that fills a fixed-aspect,
 * overflow-hidden frame. Default fit is `cover` (Shopify-style: the image
 * fills its frame, cropping to the focal point) — pass `"contain"` only for
 * placements that must show the whole image (e.g. a logo).
 *
 * **No transform → empty object.** An inline style beats a className, so
 * returning `{ objectFit: fit }` here would silently override a placement's
 * own `object-contain` / `object-none` class on every untransformed image —
 * which is most merchant images. The section's className stays in charge; a
 * caller that needs a guaranteed fit supplies it itself, e.g.
 * `{ objectFit: fit, ...applyImageTransform(t, fit) }` (see `HeroMedia`).
 * This matches `Image.tsx`'s untransformed branch and the behaviour every
 * theme's local copy has shipped with.
 */
export function applyImageTransform(
  t: ImageTransform | undefined | null,
  fit: "cover" | "contain" = "cover",
): CSSProperties {
  if (!t) return {};
  const fx = Math.round(_clampT(t.focal?.x ?? 0.5, 0, 1) * 1e4) / 100;
  const fy = Math.round(_clampT(t.focal?.y ?? 0.5, 0, 1) * 1e4) / 100;
  const zoom = _clampT(t.zoom ?? 1, 1, 4);
  const rot = (((t.rotation ?? 0) % 360) + 360) % 360;
  const effFit = t.fit ?? fit;
  const style: CSSProperties = {
    transform: `scale(${zoom}) rotate(${rot}deg)`,
    transformOrigin: `${fx}% ${fy}%`,
    objectFit: effFit,
  };
  if (effFit === "cover") style.objectPosition = `${fx}% ${fy}%`;
  return style;
}

/**
 * focalSrc — build a URL for a server-side, focal-point-aware image transform.
 *
 * OPT-IN helper. A theme that wants a bandwidth-efficient SMART CROP for a big
 * image (typically a hero) calls this to point the <img src> at the storefront's
 * `/api/image-transform` endpoint with focal/aspect params. The endpoint honors
 * them only when Cloudflare Image Resizing is enabled on the zone
 * (NUMU_CF_IMAGE_RESIZING=1); otherwise it gracefully ignores them and serves a
 * plain resized image — so the theme's CSS `applyImageTransform` framing remains
 * the correctness baseline either way. This is purely a perf optimization.
 *
 * Returns a RELATIVE path (`/api/image-transform?...`) — the SDK runs
 * same-origin inside the storefront, matching how <Form>/useShop build URLs.
 *
 * @example
 *   <img
 *     src={focalSrc(hero.url, { width: 1600, focal: t?.focal, aspect: "16/9" })}
 *     style={applyImageTransform(t, "cover")}   // CSS still frames as fallback
 *   />
 */
export interface FocalSrcOptions {
  /** Target width in px (e.g. 1600 for a desktop hero). Required for a crop. */
  width?: number;
  /** Focal point, normalized 0..1 (0.5,0.5 = center). */
  focal?: { x?: number; y?: number };
  /** Target aspect ratio "W/H" (e.g. "16/9"); drives the crop box height. */
  aspect?: string;
  /** Crop mode. Default "cover". */
  fit?: "cover" | "contain";
  /** Quality 1..100. */
  quality?: number;
  /** Output format. */
  format?: "webp" | "avif" | "jpeg" | "jpg" | "png";
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Does the HOST honor server-side crop params (`fp-x`/`fp-y`/`ar`/`fit`)?
 *
 * The storefront's `/api/image-transform` only acts on them when Cloudflare
 * Image Resizing is enabled (`NUMU_CF_IMAGE_RESIZING=1`); with CF off it
 * DROPS them and forwards `url`+`w`+`q` to `/_next/image`. So on every store
 * running today, a URL carrying `&ar=4/5&fit=cover` fetches byte-for-byte the
 * same image as the width-only URL — the params are inert.
 *
 * Inert is not free. A URL that differs from the width-only form is a
 * different cache key, so it misses the host's `<link rel=preload as=image>`
 * for the hero (which is width-only by construction — the host can't know a
 * theme's `mobileAspect`). Measured on vionne: the mobile hero was preloaded
 * at high priority, discarded, and re-requested 6.9 s later once the theme
 * hydrated — the single largest contributor to an 18.7 s mobile LCP.
 *
 * So: emit crop params only when the host says it will honor them. The
 * storefront sets `__NUMU_CF_IMAGE_RESIZING__` (see the storefront's
 * RuntimeImportMap) from the same env var the route reads, which keeps the
 * URL we build and the transform the server performs in lockstep. Absent the
 * flag we assume off — the safe default, since that's the configuration every
 * store runs and CSS `applyImageTransform` frames the image regardless.
 *
 * Read through `globalThis` so the value is identical under the SSR worker
 * and in the browser (a `typeof window` check would diverge and produce a
 * hydration mismatch on `src` the moment CF is switched on).
 */
function hostHonorsCropParams(): boolean {
  return (
    (globalThis as { __NUMU_CF_IMAGE_RESIZING__?: boolean })
      .__NUMU_CF_IMAGE_RESIZING__ === true
  );
}

export function focalSrc(
  url: string | null | undefined,
  options: FocalSrcOptions = {},
): string {
  if (!url) return "";
  // data: URIs and already-transformed URLs pass through untouched.
  if (url.startsWith("data:") || /[?&](fp-x|fp-y)=/.test(url)) return url;

  const crop = hostHonorsCropParams();
  const p = new URLSearchParams();
  p.set("url", url);
  if (options.width) p.set("w", String(Math.round(options.width)));
  if (crop && options.focal?.x != null) p.set("fp-x", String(clamp01(options.focal.x)));
  if (crop && options.focal?.y != null) p.set("fp-y", String(clamp01(options.focal.y)));
  if (crop && options.aspect) p.set("ar", options.aspect);
  if (crop && options.fit) p.set("fit", options.fit);
  if (options.quality) p.set("q", String(Math.min(100, Math.max(1, Math.round(options.quality)))));
  if (options.format) p.set("f", options.format.toLowerCase());

  return `/api/image-transform?${p.toString()}`;
}
