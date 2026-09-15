/**
 * Pure helpers for lib-ugc-carousel: no React, unit-tested
 * (src/__tests__/section-library.test.tsx).
 */

import { imageUrl } from "../_shared";

export type VideoEmbed =
  | { kind: "file"; src: string; poster?: string }
  | { kind: "iframe"; src: string; provider: string; poster?: string };

const VIDEO_FILE_RE = /\.(mp4|webm|ogg|ogv|mov|m4v)(\?.*)?$/i;

/**
 * A `video_picker` value (`{ url, poster }`, or a legacy plain URL) as
 * something renderable: a direct file for `<video>`, or an embed URL for an
 * iframe. Null when empty (`{ url: "" }` included) or from an unknown host.
 *
 * `autoplay` decides whether the embed URL asks the player to start by
 * itself. The caller passes true only when the merchant setting is on and the
 * visitor allows motion and data — see `autoplayAllowed`.
 */
export function resolveVideoEmbed(raw: unknown, opts: { autoplay: boolean }): VideoEmbed | null {
  const url = imageUrl(raw).trim();
  if (!url) return null;
  const posterRaw = raw && typeof raw === "object" ? (raw as { poster?: unknown }).poster : undefined;
  const poster = imageUrl(posterRaw) || undefined;

  if (VIDEO_FILE_RE.test(url) || url.startsWith("blob:") || url.startsWith("data:")) {
    return { kind: "file", src: url, poster };
  }

  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const iframe = (src: string, provider: string): VideoEmbed => ({ kind: "iframe", src, provider, poster });
  const { autoplay } = opts;

  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com" || host === "youtu.be") {
    let id = "";
    if (host === "youtu.be") id = u.pathname.split("/").filter(Boolean)[0] ?? "";
    else if (u.pathname.startsWith("/shorts/") || u.pathname.startsWith("/embed/")) id = u.pathname.split("/")[2] ?? "";
    else id = u.searchParams.get("v") ?? "";
    if (!id) return null;
    const q = new URLSearchParams({ mute: "1", loop: "1", playlist: id, playsinline: "1", modestbranding: "1", rel: "0" });
    // Without autoplay the shopper needs the controls to start it.
    q.set("controls", autoplay ? "0" : "1");
    if (autoplay) q.set("autoplay", "1");
    return iframe(`https://www.youtube-nocookie.com/embed/${id}?${q.toString()}`, "youtube");
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = u.pathname.split("/").filter(Boolean).pop() ?? "";
    if (!/^\d+$/.test(id)) return null;
    // `background=1` is Vimeo's chromeless autoplay-muted-loop mode.
    const q = new URLSearchParams(autoplay ? { autoplay: "1", muted: "1", loop: "1", background: "1" } : { loop: "1" });
    return iframe(`https://player.vimeo.com/video/${id}?${q.toString()}`, "vimeo");
  }

  if (host === "instagram.com") {
    const m = u.pathname.match(/\/(reels?|p|tv)\/([^/]+)/);
    if (!m) return null;
    return iframe(`https://www.instagram.com/${m[1] === "reels" ? "reel" : m[1]}/${m[2]}/embed`, "instagram");
  }

  if (host === "tiktok.com") {
    const m = u.pathname.match(/\/video\/(\d+)/);
    return m ? iframe(`https://www.tiktok.com/embed/v2/${m[1]}`, "tiktok") : null;
  }

  if (host === "facebook.com" || host === "m.facebook.com" || host === "fb.watch") {
    const q = new URLSearchParams({ href: url, show_text: "false", autoplay: String(autoplay), mute: "1" });
    return iframe(`https://www.facebook.com/plugins/video.php?${q.toString()}`, "facebook");
  }

  return null;
}

/**
 * The product slug or id in a tagged link — `/products/<x>` (the storefront's
 * own URL) or the legacy `/product/<x>`, relative or absolute. Undefined for
 * anything else, such as a `/collections/...` link, which still renders as a
 * plain link.
 */
export function productKeyFromLink(link: string): string | undefined {
  const m = link.match(/^(?:https?:\/\/[^/]+)?\/products?\/([^/?#]+)/i);
  if (!m) return undefined;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return undefined;
  }
}

/**
 * First image URL of a product across the API's shapes: catalog products
 * carry `images: [{ url }]`, related products `images: ["https://…"]`, and some
 * rows only legacy `image_url` / `first_image_url` / `image`.
 */
export function productImage(p: unknown): string | undefined {
  const obj = p as Record<string, unknown> | null | undefined;
  if (!obj) return undefined;
  const imgs = obj.images;
  if (Array.isArray(imgs) && imgs.length > 0) {
    const first = imgs[0] as unknown;
    if (typeof first === "string") return first;
    const url = (first as { url?: unknown } | null)?.url;
    if (typeof url === "string") return url;
  }
  for (const k of ["image_url", "first_image_url", "image"]) {
    const v = obj[k];
    if (typeof v === "string" && v) return v;
  }
  return undefined;
}

export interface AutoplayEnv {
  matchMedia?: (query: string) => { matches: boolean } | null | undefined;
  navigator?: { connection?: { saveData?: boolean; effectiveType?: string } };
}

/**
 * Whether this visitor should get autoplaying video. Reduced motion is the
 * accessibility contract; Save-Data and 2G are the bandwidth contract (Egyptian
 * mobile traffic). Both fall back to tap-to-play. False on the server.
 */
export function autoplayAllowed(
  env: AutoplayEnv | undefined = typeof window === "undefined" ? undefined : (window as unknown as AutoplayEnv),
): boolean {
  if (!env) return false;
  try {
    if (env.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return false;
  } catch {
    // matchMedia unavailable — decide on the data signals alone.
  }
  const conn = env.navigator?.connection;
  if (conn?.saveData) return false;
  return !(typeof conn?.effectiveType === "string" && /2g$/.test(conn.effectiveType));
}

/**
 * A concurrency gate: at most `max` speculative prewarms run at once, the rest
 * queue. Each run gets a `release` that frees its slot exactly once.
 */
export function createPrepareGate(max: number) {
  let inFlight = 0;
  const queue: Array<() => void> = [];
  return function withSlot(run: (release: () => void) => void): void {
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      inFlight = Math.max(0, inFlight - 1);
      queue.shift()?.();
    };
    const begin = () => {
      inFlight += 1;
      run(release);
    };
    if (inFlight < max) begin();
    else queue.push(begin);
  };
}

type MediaLike = Pick<HTMLMediaElement, "readyState" | "addEventListener" | "removeEventListener">;

/**
 * Call `release` once the element has metadata — immediately if it already
 * does. A queued prewarm can start after hover or autoplay attached the same
 * reel; waiting for a `loadedmetadata` that already fired would hold the slot
 * forever and, after two such reels, stop every later prewarm.
 */
export function releaseOnMetadata(el: MediaLike, release: () => void): void {
  if (el.readyState >= 1) {
    release();
    return;
  }
  const done = () => {
    el.removeEventListener("loadedmetadata", done);
    el.removeEventListener("error", done);
    release();
  };
  el.addEventListener("loadedmetadata", done);
  el.addEventListener("error", done);
}
