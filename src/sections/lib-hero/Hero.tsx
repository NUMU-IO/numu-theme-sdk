"use client";

/**
 * lib-hero — the top-of-page hero, in four looks. Built from the heroes the
 * 19 themes ship (vionne-slideshow, gn-hero-carousel, modern-hero, ed-hero,
 * lux-hero, nbhero).
 *
 * - `full` (default): one full-bleed photo, copy over a scrim.
 * - `split`: photo on one side, copy on a soft solid panel on the other.
 * - `slideshow`: full-bleed slides that crossfade, with prev/next and dots.
 * - `minimal`: an editorial headline with a small photo beside it, or none.
 *
 * Every image goes through `HeroMedia` (mobile art direction that survives
 * SSR hydration). Slide 1 is the LCP element: eager + fetchpriority high;
 * later slides are lazy. Slides are `slide` blocks; styles other than
 * `slideshow` show the first enabled one.
 *
 * Headlines are h2 — the page h1 belongs to the host/theme.
 */

import { useEffect, useState, type FocusEvent, type TouchEvent } from "react";
import { HeroMedia } from "../../components/HeroMedia";
import { Link } from "../../components/Link";
import { useLocale } from "../../hooks/useLocalization";
import { useResolvedSettings } from "../../hooks/useResolvedSettings";
import { asImageTransform } from "../../utils/imageTransform";
import { useInsideEditor } from "../InlineText";
import { BASE_CSS, LibStyle, bool, imageAlt, imageUrl, localized, readBlocks, str, type RawBlock } from "../_shared";
import type { LibrarySectionProps } from "../index";

const STYLES = ["full", "split", "slideshow", "minimal"];
const HEIGHTS = ["medium", "large", "screen"];
const ALIGNS = ["start", "center", "end"];

const CSS = `
.lib-hero{position:relative}
.lib-hero-frame{position:relative;display:grid;overflow:hidden;background:color-mix(in srgb,currentColor 8%,transparent)}
.lib-hero.is-h-medium .lib-hero-frame,.lib-hero.is-h-medium .lib-hero-split{min-block-size:clamp(360px,60vh,560px)}
.lib-hero.is-h-large .lib-hero-frame,.lib-hero.is-h-large .lib-hero-split{min-block-size:clamp(440px,80vh,780px)}
.lib-hero.is-h-screen .lib-hero-frame,.lib-hero.is-h-screen .lib-hero-split{min-block-size:100vh;min-block-size:100svh}
.lib-hero-slide{grid-area:1/1;position:relative;display:flex;color:#fff}
.lib-hero-slide.is-dark{color:#111}
.lib-hero-media{position:absolute;inset:0;overflow:hidden}
.lib-hero-img{position:absolute;inset:0}
.lib-hero-scrim{position:absolute;inset:0;background:#000}
.lib-hero-slide.is-dark .lib-hero-scrim{background:#fff}
.lib-hero-copy{position:relative;flex:1;display:flex;flex-direction:column;justify-content:center;gap:1rem;inline-size:100%;max-inline-size:1200px;margin-inline:auto;padding-block:clamp(2rem,6vw,4.5rem);padding-inline:clamp(1rem,4vw,3rem)}
.is-align-start .lib-hero-copy{align-items:flex-start;text-align:start}
.is-align-center .lib-hero-copy{align-items:center;text-align:center}
.is-align-end .lib-hero-copy{align-items:flex-end;text-align:end}
.lib-hero-copy .lib-eyebrow{margin:0}
.lib-hero-heading{max-inline-size:18ch;text-wrap:balance}
.is-h-medium .lib-hero-heading{font-size:clamp(1.75rem,4vw,3rem)}
.is-h-large .lib-hero-heading{font-size:clamp(2rem,5.5vw,4.25rem)}
.is-h-screen .lib-hero-heading{font-size:clamp(2.25rem,7vw,5.75rem)}
.lib-hero.is-minimal .lib-hero-heading{max-inline-size:22ch}
.lib-hero.is-minimal.is-h-medium .lib-hero-heading{font-size:clamp(2.25rem,6vw,4.5rem)}
.lib-hero.is-minimal.is-h-large .lib-hero-heading{font-size:clamp(2.5rem,8vw,6rem)}
.lib-hero.is-minimal.is-h-screen .lib-hero-heading{font-size:clamp(2.75rem,10vw,8rem)}
.lib-hero-sub{margin:0;max-inline-size:40rem;font-size:clamp(1rem,1.6vw,1.2rem);line-height:1.6;opacity:.9;white-space:pre-line}
.lib-hero-actions{display:flex;flex-wrap:wrap;gap:.75rem;margin-block-start:.5rem}
.is-align-center .lib-hero-actions{justify-content:center}
.is-align-end .lib-hero-actions{justify-content:flex-end}
.lib-hero-btn{display:inline-flex;align-items:center;justify-content:center;min-block-size:2.75rem;padding:.75rem 1.75rem;border:1px solid currentColor;color:inherit;font-size:.9rem;font-weight:600;text-decoration:none}
.lib-hero-slide .lib-hero-btn.is-primary{background:#fff;border-color:#fff;color:#111}
.lib-hero-slide.is-dark .lib-hero-btn.is-primary{background:#111;border-color:#111;color:#fff}
.lib-hero-panel .lib-hero-btn.is-primary,.lib-hero.is-minimal .lib-hero-btn.is-primary{background:var(--theme-color-accent,#111);border-color:var(--theme-color-accent,#111);color:var(--theme-color-background,#fff)}
.lib-hero-btn.is-primary:hover{opacity:.88}
.lib-hero-btn.is-secondary:hover{background:color-mix(in srgb,currentColor 12%,transparent)}
.lib-hero-btn:focus-visible,.lib-hero-ctl:focus-visible{outline:2px solid currentColor;outline-offset:3px}
.lib-hero.is-slideshow .lib-hero-slide:not(.is-active){opacity:0;visibility:hidden}
.lib-hero.is-slideshow .lib-hero-slide.is-active{z-index:1}
.lib-hero.is-slideshow .lib-hero-copy{padding-block-end:4.5rem}
@media (min-width:640px){.lib-hero.is-slideshow .lib-hero-copy{padding-inline:4.5rem}}
.lib-hero-ctl{position:absolute;z-index:2;border:0;padding:0;cursor:pointer;color:#fff}
.lib-hero-arrow{inset-block-start:50%;translate:0 -50%;display:none;place-items:center;inline-size:2.75rem;block-size:2.75rem;border-radius:999px;background:color-mix(in srgb,#000 35%,transparent)}
@media (min-width:640px){.lib-hero-arrow{display:grid}}
.lib-hero-arrow:hover{background:color-mix(in srgb,#000 55%,transparent)}
.lib-hero-prev{inset-inline-start:clamp(.5rem,2vw,1.25rem)}
.lib-hero-next{inset-inline-end:clamp(.5rem,2vw,1.25rem)}
[dir="rtl"] .lib-hero-arrow svg,:lang(ar) .lib-hero-arrow svg{transform:scaleX(-1)}
.lib-hero-dots{position:absolute;z-index:2;inset-block-end:1rem;inset-inline:0;display:flex;justify-content:center;gap:.25rem}
.lib-hero-dot{position:static;display:grid;place-items:center;inline-size:1.75rem;block-size:1.75rem;background:none}
.lib-hero-frame.is-ui-dark .lib-hero-dot{color:#111}
.lib-hero-dot::before{content:"";display:block;inline-size:.5rem;block-size:.5rem;border-radius:999px;background:currentColor;opacity:.5}
.lib-hero-dot[aria-current="true"]::before{inline-size:1.5rem;opacity:1}
@media (prefers-reduced-motion:no-preference){
.lib-hero.is-slideshow .lib-hero-slide{transition:opacity .7s ease,visibility .7s}
.lib-hero-dot::before{transition:inline-size .3s,opacity .3s}
.lib-hero-btn{transition:background-color .2s,opacity .2s}
}
.lib-hero-split{display:grid;grid-template-columns:minmax(0,1fr)}
.lib-hero-splitmedia{position:relative;order:-1;min-block-size:clamp(280px,90vw,520px)}
.lib-hero-panel{display:flex;background:color-mix(in srgb,var(--theme-color-text,currentColor) 5%,var(--theme-color-background,transparent))}
@media (min-width:768px){
.lib-hero-split{grid-template-columns:repeat(2,minmax(0,1fr))}
.lib-hero-splitmedia{min-block-size:auto}
.lib-hero.is-img-end .lib-hero-splitmedia{order:1}
}
.lib-hero.is-minimal{padding-block:clamp(3rem,8vw,7rem)}
.lib-hero.is-minimal.is-h-screen{display:flex;align-items:center;min-block-size:100vh;min-block-size:100svh}
.lib-hero.is-minimal>.lib-container{inline-size:100%}
.lib-hero-minimal{display:grid;gap:2rem;align-items:end}
@media (min-width:768px){.lib-hero-minimal.has-image{grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:4rem}}
.lib-hero-minimal .lib-hero-copy{padding:0;margin:0;max-inline-size:none}
.lib-hero-minimg{position:relative;aspect-ratio:4/5;overflow:hidden}
`;

interface Slide {
  image: string;
  imageRaw: unknown;
  mobile: string;
  mobileRaw: unknown;
  eyebrow: string;
  headline: string;
  sub: string;
  cta: string;
  ctaLink: string;
  cta2: string;
  cta2Link: string;
  dark: boolean;
}

/** A finite number clamped to [min, max], or `fallback`. */
function num(v: unknown, fallback: number, min: number, max: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

function Copy({ slide }: { slide: Slide }) {
  return (
    <div className="lib-hero-copy">
      {slide.eyebrow && <span className="lib-eyebrow">{slide.eyebrow}</span>}
      {slide.headline && <h2 className="lib-heading lib-hero-heading">{slide.headline}</h2>}
      {slide.sub && <p className="lib-hero-sub">{slide.sub}</p>}
      {(slide.cta || slide.cta2) && (
        <div className="lib-hero-actions">
          {slide.cta && (
            <Link to={slide.ctaLink} className="lib-hero-btn is-primary">
              {slide.cta}
            </Link>
          )}
          {slide.cta2 && (
            <Link to={slide.cta2Link} className="lib-hero-btn is-secondary">
              {slide.cta2}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/** A chevron; both mirror in RTL via CSS so "previous" points to the start side. */
const Arrow = ({ d }: { d: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

export default function Hero({ instance }: LibrarySectionProps) {
  const locale = useLocale();
  const s = useResolvedSettings(instance);
  const insideEditor = useInsideEditor();

  const style = STYLES.includes(str(s.style)) ? str(s.style) : "full";
  const height = HEIGHTS.includes(str(s.height)) ? str(s.height) : "large";
  const align = ALIGNS.includes(str(s.text_align)) ? str(s.text_align) : "center";
  const overlay = num(s.overlay_opacity, 30, 0, 80) / 100;
  const interval = num(s.interval, 6, 3, 12) * 1000;
  const imageSide = str(s.image_side) === "start" ? "start" : "end";

  const all: Slide[] = readBlocks(instance as RawBlock, "slide")
    .map((block) => {
      const b = block.settings ?? {};
      return {
        image: imageUrl(b.image),
        imageRaw: b.image,
        mobile: imageUrl(b.image_mobile),
        mobileRaw: b.image_mobile,
        eyebrow: str(b.eyebrow),
        headline: str(b.headline),
        sub: str(b.subheading),
        cta: str(b.cta_text),
        ctaLink: str(b.cta_link) || "/products",
        cta2: str(b.cta2_text),
        cta2Link: str(b.cta2_link) || "/products",
        dark: str(b.text_color) === "dark",
      };
    })
    .filter((slide) => slide.image || slide.headline);
  const slides = style === "slideshow" ? all : all.slice(0, 1);
  const count = slides.length;

  // Slideshow state. The server and the first client render show slide 1 with
  // autoplay off; motion is allowed only after mount, once matchMedia is known.
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [motionOk, setMotionOk] = useState(false);
  const [touchX, setTouchX] = useState<number | null>(null);
  const active = index < count ? index : 0;
  const running = style === "slideshow" && bool(s.autoplay, true) && motionOk && !paused && count > 1;

  useEffect(() => {
    setMotionOk(!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => setIndex((active + 1) % count), interval);
    return () => window.clearTimeout(t);
  }, [running, active, count, interval]);

  if (count === 0) {
    return insideEditor ? (
      <section className="lib-section lib-empty">
        <LibStyle id="lib-base" css={BASE_CSS} />
        <p className="lib-muted">
          {localized(locale, "Add a slide with an image or a headline", "ضيف شريحة فيها صورة أو عنوان")}
        </p>
      </section>
    ) : null;
  }

  const rootClass = `lib-section lib-hero is-${style} is-h-${height} is-align-${align}${style === "split" ? ` is-img-${imageSide}` : ""}`;
  const media = (slide: Slide, i: number, sizes: string) => (
    <HeroMedia
      src={slide.image}
      alt={imageAlt(slide.imageRaw, "")}
      transform={asImageTransform(slide.imageRaw)}
      mobileSrc={slide.mobile || undefined}
      mobileTransform={asImageTransform(slide.mobileRaw)}
      priority={i === 0}
      sizes={sizes}
      // Pre-warming the other breakpoint's bitmap only pays off in the editor's
      // Desktop/Mobile toggle; on a phone it is a wasted desktop download.
      preloadAlternate={insideEditor}
      className="lib-hero-img"
    />
  );
  const styles = (
    <>
      <LibStyle id="lib-base" css={BASE_CSS} />
      <LibStyle id="lib-hero" css={CSS} />
    </>
  );

  if (style === "split" || style === "minimal") {
    const slide = slides[0];
    const split = style === "split";
    return (
      <section className={rootClass}>
        {styles}
        {split ? (
          <div className="lib-hero-split">
            <div className="lib-hero-panel">
              <Copy slide={slide} />
            </div>
            {slide.image && <div className="lib-hero-splitmedia">{media(slide, 0, "(min-width: 768px) 50vw, 100vw")}</div>}
          </div>
        ) : (
          <div className="lib-container">
            <div className={slide.image ? "lib-hero-minimal has-image" : "lib-hero-minimal"}>
              <Copy slide={slide} />
              {slide.image && <div className="lib-hero-minimg">{media(slide, 0, "(min-width: 768px) 33vw, 100vw")}</div>}
            </div>
          </div>
        )}
      </section>
    );
  }

  const slideshow = style === "slideshow" && count > 1;
  const go = (i: number) => setIndex(((i % count) + count) % count);
  const ofLabel = (i: number) => localized(locale, `${i + 1} of ${count}`, `${i + 1} من ${count}`);

  const frame = (
    <div
      className={slides[active].dark ? "lib-hero-frame is-ui-dark" : "lib-hero-frame"}
      aria-live={slideshow ? (running ? "off" : "polite") : undefined}
    >
      {slides.map((slide, i) => {
        const isActive = i === active;
        return (
          <div
            key={i}
            className={`lib-hero-slide${isActive ? " is-active" : ""}${slide.dark ? " is-dark" : ""}`}
            {...(slideshow
              ? {
                  role: "group",
                  "aria-roledescription": localized(locale, "slide", "شريحة"),
                  "aria-label": ofLabel(i),
                  ...(isActive ? {} : { inert: true, "aria-hidden": true }),
                }
              : {})}
          >
            {slide.image && (
              <div className="lib-hero-media">
                {media(slide, i, "100vw")}
                {overlay > 0 && (slide.headline || slide.eyebrow || slide.sub || slide.cta || slide.cta2) && (
                  <div className="lib-hero-scrim" aria-hidden="true" style={{ opacity: overlay }} />
                )}
              </div>
            )}
            <Copy slide={slide} />
          </div>
        );
      })}
    </div>
  );

  if (!slideshow) {
    return (
      <section className={rootClass}>
        {styles}
        {frame}
      </section>
    );
  }

  const onBlur = (e: FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
  };
  const onTouchEnd = (e: TouchEvent<HTMLElement>) => {
    if (touchX === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? touchX) - touchX;
    setTouchX(null);
    if (Math.abs(dx) < 40) return;
    // A swipe towards the inline end goes back, in either direction.
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    go((dx < 0) !== rtl ? active + 1 : active - 1);
  };

  return (
    <section
      className={rootClass}
      aria-roledescription={localized(locale, "carousel", "سلايدر")}
      aria-label={localized(locale, "Featured", "البانر الرئيسي")}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={onBlur}
      onTouchStart={(e) => setTouchX(e.touches[0]?.clientX ?? null)}
      onTouchEnd={onTouchEnd}
    >
      {styles}
      {frame}
      <button type="button" className="lib-hero-ctl lib-hero-arrow lib-hero-prev" aria-label={localized(locale, "Previous slide", "الشريحة اللي قبلها")} onClick={() => go(active - 1)}>
        <Arrow d="m15 18-6-6 6-6" />
      </button>
      <button type="button" className="lib-hero-ctl lib-hero-arrow lib-hero-next" aria-label={localized(locale, "Next slide", "الشريحة اللي بعدها")} onClick={() => go(active + 1)}>
        <Arrow d="m9 18 6-6-6-6" />
      </button>
      <div className="lib-hero-dots">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            className="lib-hero-ctl lib-hero-dot"
            aria-label={localized(locale, `Slide ${i + 1} of ${count}`, `شريحة ${i + 1} من ${count}`)}
            aria-current={i === active ? "true" : undefined}
            onClick={() => go(i)}
          />
        ))}
      </div>
    </section>
  );
}
