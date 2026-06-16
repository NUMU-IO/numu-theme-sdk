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
 * placements that must show the whole image (e.g. a logo). Empty object when
 * there is no transform AND the caller wants the section's own className to
 * decide; pass an explicit `fit` to force a default even without a transform.
 */
export function applyImageTransform(
  t: ImageTransform | undefined | null,
  fit: "cover" | "contain" = "cover",
): CSSProperties {
  if (!t) return { objectFit: fit };
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

export function focalSrc(
  url: string | null | undefined,
  options: FocalSrcOptions = {},
): string {
  if (!url) return "";
  // data: URIs and already-transformed URLs pass through untouched.
  if (url.startsWith("data:") || /[?&](fp-x|fp-y)=/.test(url)) return url;

  const p = new URLSearchParams();
  p.set("url", url);
  if (options.width) p.set("w", String(Math.round(options.width)));
  if (options.focal?.x != null) p.set("fp-x", String(clamp01(options.focal.x)));
  if (options.focal?.y != null) p.set("fp-y", String(clamp01(options.focal.y)));
  if (options.aspect) p.set("ar", options.aspect);
  if (options.fit) p.set("fit", options.fit);
  if (options.quality) p.set("q", String(Math.min(100, Math.max(1, Math.round(options.quality)))));
  if (options.format) p.set("f", options.format.toLowerCase());

  return `/api/image-transform?${p.toString()}`;
}
