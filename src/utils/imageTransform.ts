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
