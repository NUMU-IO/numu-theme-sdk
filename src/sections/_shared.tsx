/**
 * Helpers for the NUMU section library (`lib-*` sections).
 *
 * The value guards mirror @numueg/theme-kit exactly — the SDK does not depend
 * on the kit, and library sections must read settings the way theme sections
 * already do.
 */

import { focalSrc } from "../utils/imageTransform";

export const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : fallback;

export const bool = (v: unknown, fallback = false): boolean =>
  typeof v === "boolean" ? v : fallback;

/** A merchant-uploaded image arrives as a URL string or `{ url, alt }`. */
export function imageUrl(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const r = v as { url?: unknown; src?: unknown };
    if (typeof r.url === "string") return r.url;
    if (typeof r.src === "string") return r.src;
  }
  return fallback;
}

/**
 * The alt text saved with an uploaded image, or `fallback`. Unlike theme-kit's
 * `asImageAlt`, an empty alt falls back too, so an image nobody described
 * still gets its caption or heading as alt text.
 */
export function imageAlt(v: unknown, fallback = ""): string {
  const alt = v && typeof v === "object" ? (v as { alt?: unknown }).alt : undefined;
  return typeof alt === "string" && alt ? alt : fallback;
}

/** A section or block as stored: nested blocks as a map plus `block_order`. */
export interface RawBlock {
  type?: string;
  disabled?: boolean;
  settings?: Record<string, unknown>;
  blocks?: Record<string, RawBlock>;
  block_order?: string[];
}

/** Enabled child blocks of `type`, in the merchant's order. */
export function readBlocks(parent: RawBlock | undefined, type: string): RawBlock[] {
  const blocks = parent?.blocks ?? {};
  const order = parent?.block_order?.length ? parent.block_order : Object.keys(blocks);
  return order.map((id) => blocks[id]).filter((b): b is RawBlock => !!b && b.type === type && !b.disabled);
}

export const localized = (locale: string | undefined, en: string, ar: string): string =>
  (locale || "").toLowerCase().startsWith("ar") ? ar : en;

// ─── Responsive images through the storefront's transform proxy ────────────

/**
 * The only widths the optimizer serves. `/api/image-transform` forwards `w`
 * to `/_next/image`, which rejects any width outside `deviceSizes ∪
 * imageSizes` in numu-storefront/next.config.ts with a 400. Keep this list
 * equal to that union.
 */
const IMG_WIDTHS = [64, 128, 256, 384, 640, 768, 1024, 1280, 1920] as const;

function snapWidth(want: number): number {
  for (const w of IMG_WIDTHS) if (w >= want) return w;
  return IMG_WIDTHS[IMG_WIDTHS.length - 1];
}

/**
 * Hosts the transform proxy relays. MUST stay a subset of `DEFAULT_HOSTS` in
 * numu-storefront/src/lib/image-transform.ts — any other host gets a 403 and
 * a broken image, so those URLs are passed through untouched instead.
 */
const PROXY_IMAGE_HOSTS = ["numueg.app", "r2.dev", "r2.cloudflarestorage.com", "imagedelivery.net"];

function transformable(url: string | null | undefined): url is string {
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return false;
  if (url.startsWith("/")) return true;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return PROXY_IMAGE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/** `src` / `srcSet` / `sizes` for an `<img>`, ready to spread. */
export function responsiveImg(
  url: string | null | undefined,
  preset: { widths: readonly number[]; sizes: string },
): { src: string; srcSet?: string; sizes?: string } {
  if (!transformable(url)) return { src: url || "" };
  const ladder = [...new Set(preset.widths.map(snapWidth))].sort((a, b) => a - b);
  return {
    src: focalSrc(url, { width: ladder[0] }),
    srcSet: ladder.map((w) => `${focalSrc(url, { width: w })} ${w}w`).join(", "),
    sizes: preset.sizes,
  };
}

/** Full-bleed editorial imagery. */
export const WIDE_IMG = {
  widths: [640, 768, 1024, 1280, 1920],
  sizes: "(min-width: 1280px) 50vw, (min-width: 768px) 60vw, 100vw",
} as const;

// ─── Styles ─────────────────────────────────────────────────────────────────

/**
 * A library section's CSS, rendered with the section. React 19 hoists a
 * `<style href precedence>` into <head> and dedupes it by `href`, both in
 * `renderToString` and on hydration, so the storefront needs no stylesheet
 * of its own for library sections.
 */
export function LibStyle({ id, css }: { id: string; css: string }) {
  return (
    <style href={id} precedence="default">
      {css}
    </style>
  );
}

/** Styles every library section shares (type roles, container, editor prompt). */
export const BASE_CSS = `
.lib-section{color:inherit;font-family:inherit}
.lib-container{max-inline-size:1200px;margin-inline:auto;padding-inline:1rem}
.lib-eyebrow{display:block;margin-block-end:.5rem;font-size:.75rem;font-weight:500;letter-spacing:.2em;text-transform:uppercase;opacity:.7}
.lib-heading{margin:0;font-family:var(--theme-font-heading,inherit);font-weight:500;line-height:1.1}
.lib-muted{opacity:.7}
.lib-label{font-size:.7rem;font-weight:500;letter-spacing:.18em;text-transform:uppercase}
:lang(ar) .lib-eyebrow,[dir="rtl"] .lib-eyebrow,:lang(ar) .lib-label,[dir="rtl"] .lib-label{letter-spacing:normal;text-transform:none}
.lib-empty{margin:1rem;padding:3rem 1rem;text-align:center;border:1px dashed color-mix(in srgb,currentColor 30%,transparent)}
`;
