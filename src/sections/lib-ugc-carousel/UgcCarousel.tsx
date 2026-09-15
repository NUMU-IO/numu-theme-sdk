"use client";

/**
 * lib-ugc-carousel — shopper video reels with tagged products.
 *
 * Built from Vionne's `vionne-ugc-carousel`. The 38 setting ids are identical,
 * so the same stored settings render in any theme. Fixes from the 2026-09-14
 * audit:
 *  - tagged links match `/products/<slug>` (the storefront's own URL) as well
 *    as the legacy `/product/<slug>`;
 *  - iframe embeds autoplay only when the merchant setting is on AND the
 *    visitor allows motion and data;
 *  - a queued prewarm whose reel was attached meanwhile frees its slot at once;
 *  - cards are visible without JS — the reveal runs only when scripting is on;
 *  - tagged products also resolve on routes without page products (needs the
 *    host SDK ≥ 0.13.3 for `fetchIfMissing`).
 *
 * Media budget, as measured on the Vionne store: no video bytes at mount; a
 * metadata-only prewarm within 400px, after page load and idle, at most 2 at
 * once; at most 4 reels autoplay, each ≥ 50% visible; nothing autoplays under
 * reduced motion, Save-Data or 2G.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { Link } from "../../components/Link";
import { useLocale } from "../../hooks/useLocalization";
import { useProducts } from "../../hooks/useProducts";
import { useResolvedSettings } from "../../hooks/useResolvedSettings";
import { applyImageTransform, asImageTransform } from "../../utils/imageTransform";
import { InlineText, useInsideEditor } from "../InlineText";
import { BASE_CSS, LibStyle, imageUrl, localized, responsiveImg, str } from "../_shared";
import type { LibrarySectionProps } from "../index";
import {
  autoplayAllowed,
  createPrepareGate,
  productImage,
  productKeyFromLink,
  releaseOnMetadata,
  resolveVideoEmbed,
  type VideoEmbed,
} from "./media";

const PREPARE_ROOT_MARGIN_PX = 400;
const MAX_CONCURRENT_AUTOPLAY = 4;
const AUTOPLAY_VISIBLE_RATIO = 0.5;

/** Fixed-width cards in a horizontal track. */
const CARD_TRACK_IMG = { widths: [256, 384, 640], sizes: "(min-width: 768px) 260px, (min-width: 640px) 240px, 210px" };
/** The 44 × 44 tagged-product chip; 128 covers 2× DPR. */
const CHIP_IMG = { widths: [64, 128], sizes: "44px" };

/**
 * 1 × 1 transparent GIF used as the poster of last resort. A `<video>` keeps
 * showing its poster only while a `poster` attribute exists; without one, the
 * prewarm would paint the first video frame over the shimmer before any click.
 */
const BLANK_POSTER = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const CSS = `
.lib-ugc{padding-block:3rem}
@media (min-width:768px){.lib-ugc{padding-block:4rem}}
.lib-ugc-head{display:flex;align-items:flex-end;justify-content:space-between;gap:1rem;margin-block-end:1.5rem}
.lib-ugc-head .lib-heading{font-size:clamp(1.5rem,2.6vw,1.875rem)}
.lib-ugc-head p{margin:.375rem 0 0;font-size:.875rem}
.lib-ugc-cta{display:inline-flex;align-items:center;gap:.375rem;flex-shrink:0;padding-block-end:.5rem;color:inherit;text-decoration:none}
.lib-ugc-cta:hover{opacity:.7}
[dir="rtl"] .lib-ugc-arrow{transform:scaleX(-1)}
.lib-ugc-track{display:flex;gap:.75rem;overflow-x:auto;scroll-snap-type:x mandatory;padding-block-end:.75rem;scrollbar-width:none}
.lib-ugc-track::-webkit-scrollbar{display:none}
@media (min-width:768px){.lib-ugc-track{gap:1rem}}
.lib-ugc-card{position:relative;flex-shrink:0;scroll-snap-align:start;inline-size:210px;aspect-ratio:3/4;border-radius:.375rem;overflow:hidden;display:flex;flex-direction:column;background:color-mix(in srgb,currentColor 6%,transparent)}
@media (min-width:640px){.lib-ugc-card{inline-size:240px}}
@media (min-width:768px){.lib-ugc-card{inline-size:260px}}
@media (scripting:enabled) and (prefers-reduced-motion:no-preference){
.lib-ugc-card{transition:opacity .7s ease,transform .7s ease}
.lib-ugc-track:not([data-visible]) .lib-ugc-card{opacity:0;transform:translateY(40px)}
}
.lib-ugc-intro{background:color-mix(in srgb,currentColor 88%,#000);color:#fff}
.lib-ugc-intro>img{opacity:.5}
.lib-ugc-intro-body{position:absolute;inset:0;display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;padding:1.25rem;text-align:start}
.lib-ugc-intro-body h3{margin:0;font-family:var(--theme-font-heading,inherit);font-size:1.5rem;line-height:1.05;text-transform:uppercase}
:lang(ar) .lib-ugc-intro-body h3,[dir="rtl"] .lib-ugc-intro-body h3{text-transform:none}
.lib-ugc-intro-body p{margin:.5rem 0 0;font-size:.75rem;opacity:.75;max-inline-size:80%}
.lib-ugc-intro-body a{color:#fff;text-decoration:none}
.lib-ugc-media{position:relative;flex:1;overflow:hidden}
.lib-ugc-fill{position:absolute;inset:0;inline-size:100%;block-size:100%;object-fit:cover;border:0}
.lib-ugc-play{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:transparent;border:0;cursor:pointer;color:#fff}
.lib-ugc-play>span{inline-size:2.75rem;block-size:2.75rem;border-radius:9999px;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;transition:transform .3s}
.lib-ugc-play:hover>span{transform:scale(1.1)}
.lib-ugc-play:focus-visible>span{outline:2px solid #fff;outline-offset:2px}
.lib-ugc-shimmer{position:absolute;inset:0;background:linear-gradient(90deg,transparent,color-mix(in srgb,currentColor 8%,transparent),transparent);background-size:200% 100%}
@media (prefers-reduced-motion:no-preference){.lib-ugc-shimmer{animation:lib-ugc-shimmer 1.4s ease-in-out infinite}}
@keyframes lib-ugc-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}
.lib-ugc-caption{position:absolute;inset-block-start:.75rem;inset-inline-start:.75rem;padding:.25rem .625rem;font-size:.625rem;border-radius:.125rem;background:var(--theme-color-accent,#a20000);color:#fff}
.lib-ugc-chip{position:absolute;inset-block-end:.75rem;inset-inline-start:.75rem;inline-size:2.75rem;block-size:2.75rem;object-fit:cover;border-radius:.5rem;box-shadow:0 0 0 2px #fff,0 4px 6px rgba(0,0,0,.15)}
.lib-ugc-shop{display:block;padding:.625rem .75rem;background:var(--theme-color-background,Canvas);color:var(--theme-color-text,CanvasText);text-decoration:none}
.lib-ugc-name{display:block;font-size:.8125rem;font-weight:500;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.lib-ugc-badge{display:block;margin-block-start:.125rem;font-size:.75rem;font-weight:600;color:var(--theme-color-accent,currentColor)}
`;

// ── Prewarm: one shared observer, at most two metadata fetches at a time ────

function whenIdleAfterLoad(fn: () => void): () => void {
  let cancelled = false;
  const idle = () => {
    if (cancelled) return;
    const ric = (window as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void })
      .requestIdleCallback;
    if (typeof ric === "function") ric(() => !cancelled && fn(), { timeout: 2000 });
    else setTimeout(() => !cancelled && fn(), 200);
  };
  if (document.readyState === "complete") idle();
  else window.addEventListener("load", idle, { once: true });
  return () => {
    cancelled = true;
    window.removeEventListener("load", idle);
  };
}

const prepareTargets = new WeakMap<Element, () => void>();
let prepareObserver: IntersectionObserver | null = null;
const withPrepareSlot = createPrepareGate(2);

function getPrepareObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === "undefined") return null;
  if (!prepareObserver) {
    prepareObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const prepare = prepareTargets.get(entry.target);
          prepareObserver?.unobserve(entry.target);
          prepareTargets.delete(entry.target);
          prepare?.();
        }
      },
      { rootMargin: `${PREPARE_ROOT_MARGIN_PX}px` },
    );
  }
  return prepareObserver;
}

// ── Autoplay director: only the most-visible few reels play ─────────────────

interface AutoplayEntry {
  ratio: number;
  playing: boolean;
  play: () => void;
  pause: () => void;
}

const autoplayEntries = new Map<Element, AutoplayEntry>();
let autoplayObserver: IntersectionObserver | null = null;
let visibilityBound = false;

function reconcileAutoplay(): void {
  const winners = new Set(
    [...autoplayEntries.values()]
      .filter((e) => e.ratio >= AUTOPLAY_VISIBLE_RATIO)
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, MAX_CONCURRENT_AUTOPLAY),
  );
  for (const entry of autoplayEntries.values()) {
    const should = winners.has(entry);
    if (should && !entry.playing) {
      entry.playing = true;
      entry.play();
    } else if (!should && entry.playing) {
      entry.playing = false;
      entry.pause();
    }
  }
}

function getAutoplayObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === "undefined") return null;
  if (!autoplayObserver) {
    autoplayObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const rec = autoplayEntries.get(entry.target);
          if (rec) rec.ratio = entry.intersectionRatio;
        }
        reconcileAutoplay();
      },
      { threshold: [0, 0.25, 0.5, 0.6, 0.75, 1] },
    );
  }
  return autoplayObserver;
}

function bindVisibilityPause(): void {
  if (visibilityBound || typeof document === "undefined") return;
  visibilityBound = true;
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) return reconcileAutoplay();
    for (const entry of autoplayEntries.values()) {
      if (entry.playing) {
        entry.playing = false;
        entry.pause();
      }
    }
  });
}

const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const ArrowIcon = () => (
  <svg className="lib-ugc-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

/**
 * One reel: poster first, bytes on demand. The `src` is withheld until it is
 * wanted, then attached with `load()` — the one path the spec guarantees starts
 * resource selection, so `preload="metadata"` fetches only the header. Flipping
 * the `preload` attribute later is browser-dependent and can silently do nothing.
 *
 * Stages: (1) mount — poster only; (2) after load + idle, within 400px —
 * metadata prewarm, queued; (3) mouse hover or keyboard focus — the same,
 * immediately. A click always attaches first. Autoplay attaches only when the
 * director picks the reel, so an unseen reel downloads nothing.
 */
function UgcReel({ src, poster, label, autoplay }: { src: string; poster?: string; label: string; autoplay: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const attachedRef = useRef(false);
  const [started, setStarted] = useState(false);

  const attach = useCallback((): HTMLVideoElement | null => {
    const el = videoRef.current;
    if (!el) return null;
    if (attachedRef.current) return el;
    attachedRef.current = true;
    el.src = src;
    el.load();
    return el;
  }, [src]);

  const prepare = useCallback(() => {
    if (attachedRef.current || !videoRef.current) return;
    withPrepareSlot((release) => {
      const el = attach();
      if (!el) return release();
      releaseOnMetadata(el, release);
    });
  }, [attach]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    let observer: IntersectionObserver | null = null;
    const cancel = whenIdleAfterLoad(() => {
      observer = getPrepareObserver();
      if (!observer) return;
      prepareTargets.set(el, prepare);
      observer.observe(el);
    });
    return () => {
      cancel();
      observer?.unobserve(el);
      prepareTargets.delete(el);
    };
  }, [prepare]);

  useEffect(() => {
    const el = videoRef.current;
    if (!autoplay || !el || !autoplayAllowed()) return;
    const observer = getAutoplayObserver();
    if (!observer) return;
    bindVisibilityPause();
    autoplayEntries.set(el, {
      ratio: 0,
      playing: false,
      play: () => {
        attach();
        setStarted(true);
        void el.play().catch(() => setStarted(false));
      },
      pause: () => {
        try {
          el.pause();
        } catch {
          // Element torn down mid-scroll.
        }
      },
    });
    observer.observe(el);
    return () => {
      observer.unobserve(el);
      autoplayEntries.delete(el);
      reconcileAutoplay();
    };
  }, [autoplay, attach]);

  const onPointerEnter = (e: { pointerType?: string }) => {
    if (e.pointerType === "mouse") attach();
  };

  const start = () => {
    const el = attach();
    if (!el) return;
    setStarted(true);
    void el.play().catch(() => setStarted(false));
  };

  return (
    <>
      {!poster && <div className="lib-ugc-shimmer" />}
      <video
        ref={videoRef}
        poster={poster || BLANK_POSTER}
        className="lib-ugc-fill"
        preload="metadata"
        muted
        loop
        playsInline
        onClick={start}
        onPointerEnter={onPointerEnter}
      />
      {!started && (
        <button type="button" className="lib-ugc-play" onClick={start} onPointerEnter={onPointerEnter} onFocus={attach} aria-label={label}>
          <span>
            <PlayIcon />
          </span>
        </button>
      )}
    </>
  );
}

interface Item {
  n: number;
  media: string;
  mediaRaw: unknown;
  video: VideoEmbed | null;
  caption: string;
  productImage: string;
  productImageRaw: unknown;
  productLink: string;
}

export default function UgcCarousel({ instance, sectionId }: LibrarySectionProps) {
  const locale = useLocale();
  const s = useResolvedSettings(instance);
  const eyebrow = str(s.eyebrow);
  const title = str(s.title) || localized(locale, "Tagged by you", "صوّرتونا");
  const subtitle = str(s.subtitle);
  const ctaText = str(s.cta_text);
  const ctaLink = str(s.cta_link) || "/products";
  const introImage = imageUrl(s.intro_image);
  const badgeText = str(s.badge_text) || localized(locale, "Shop now", "اتسوّق دلوقتي");
  // Opt-out: a section saved before the setting existed gets autoplay.
  const autoplay = s.autoplay !== false;
  const { products: catalog } = useProducts({ fetchIfMissing: true });

  // Embeds render without autoplay on the server and on the first client
  // render (so hydration matches), then switch on if this visitor allows it.
  const [embedAutoplay, setEmbedAutoplay] = useState(false);
  useEffect(() => {
    setEmbedAutoplay(autoplay && autoplayAllowed());
  }, [autoplay]);

  const items: Item[] = [];
  for (let i = 1; i <= 6; i++) {
    const media = imageUrl(s[`item_${i}_media`]);
    const video = resolveVideoEmbed(s[`item_${i}_video`], { autoplay: embedAutoplay });
    if (!media && !video) continue;
    items.push({
      n: i,
      media,
      mediaRaw: s[`item_${i}_media`],
      video,
      caption: str(s[`item_${i}_caption`]),
      productImage: imageUrl(s[`item_${i}_product_image`]),
      productImageRaw: s[`item_${i}_product_image`],
      productLink: str(s[`item_${i}_product_link`]),
    });
  }

  const trackRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        setVisible(true);
        io.disconnect();
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Like the other library sections: an empty carousel shows only in the editor.
  const inEditor = useInsideEditor();
  if (items.length === 0 && !inEditor) return null;

  return (
    <section className="lib-section lib-ugc">
      <LibStyle id="lib-base" css={BASE_CSS} />
      <LibStyle id="lib-ugc-carousel" css={CSS} />
      <div className="lib-container">
        <div className="lib-ugc-head">
          <div>
            {eyebrow && (
              <span className="lib-eyebrow">
                <InlineText sectionId={sectionId} settingKey="eyebrow" value={eyebrow} />
              </span>
            )}
            <h2 className="lib-heading">
              <InlineText sectionId={sectionId} settingKey="title" value={title} />
            </h2>
            {subtitle && (
              <p className="lib-muted">
                <InlineText sectionId={sectionId} settingKey="subtitle" value={subtitle} />
              </p>
            )}
          </div>
          {ctaText && (
            <Link to={ctaLink} className="lib-label lib-ugc-cta">
              <InlineText sectionId={sectionId} settingKey="cta_text" value={ctaText} />
              <ArrowIcon />
            </Link>
          )}
        </div>

        <div ref={trackRef} className="lib-ugc-track" data-visible={visible ? "" : undefined}>
          {(introImage || ctaText) && (
            <div className="lib-ugc-card lib-ugc-intro">
              {introImage && (
                <img
                  {...responsiveImg(introImage, CARD_TRACK_IMG)}
                  alt=""
                  className="lib-ugc-fill"
                  style={applyImageTransform(asImageTransform(s.intro_image), "cover")}
                  loading="lazy"
                  decoding="async"
                />
              )}
              <div className="lib-ugc-intro-body">
                <div>
                  <h3>{title}</h3>
                  {subtitle && <p>{subtitle}</p>}
                </div>
                {ctaText && (
                  <Link to={ctaLink} className="lib-label">
                    {ctaText}
                  </Link>
                )}
              </div>
            </div>
          )}

          {items.map((it, idx) => {
            const key = it.productLink ? productKeyFromLink(it.productLink) : undefined;
            const prod = key ? catalog.find((p) => p.slug === key || p.id === key) : undefined;
            const thumb = it.productImage || (prod ? productImage(prod) : undefined);
            // Poster chain: merchant poster, then the video's own poster, then the
            // tagged product's photo. Vionne's live reels carry no item media.
            const reelPoster = it.media || it.video?.poster || thumb;
            return (
              <div
                key={it.n}
                className="lib-ugc-card"
                style={visible ? { transitionDelay: `${idx * 70}ms` } : undefined}
              >
                <div className="lib-ugc-media">
                  {it.video?.kind === "file" ? (
                    <UgcReel
                      src={it.video.src}
                      poster={reelPoster ? responsiveImg(reelPoster, { widths: [384], sizes: "" }).src : undefined}
                      autoplay={autoplay}
                      label={it.caption || localized(locale, `Play reel ${it.n}`, `شغّل الفيديو ${it.n}`)}
                    />
                  ) : it.video?.kind === "iframe" ? (
                    <iframe
                      src={it.video.src}
                      title={it.caption || `${title} ${it.n}`}
                      className="lib-ugc-fill"
                      loading="lazy"
                      allow="autoplay; encrypted-media; picture-in-picture; clipboard-write; fullscreen"
                      allowFullScreen
                      referrerPolicy="strict-origin-when-cross-origin"
                    />
                  ) : it.media ? (
                    <img
                      {...responsiveImg(it.media, CARD_TRACK_IMG)}
                      alt={it.caption}
                      className="lib-ugc-fill"
                      style={applyImageTransform(asImageTransform(it.mediaRaw), "cover")}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="lib-ugc-shimmer" />
                  )}

                  {it.caption && (
                    <span className="lib-label lib-ugc-caption">
                      <InlineText sectionId={sectionId} settingKey={`item_${it.n}_caption`} value={it.caption} />
                    </span>
                  )}

                  {thumb && (
                    <img
                      {...responsiveImg(thumb, CHIP_IMG)}
                      alt={prod?.name || ""}
                      className="lib-ugc-chip"
                      style={applyImageTransform(asImageTransform(it.productImageRaw), "cover")}
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                </div>

                {it.productLink && (
                  <Link to={it.productLink} className="lib-ugc-shop" data-testid="storefront-ugc-shop">
                    {prod?.name && <span className="lib-ugc-name">{prod.name}</span>}
                    <span className="lib-ugc-badge">{badgeText}</span>
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
