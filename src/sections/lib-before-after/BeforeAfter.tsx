"use client";

/**
 * lib-before-after — image comparison slider.
 *
 * Built from Vionne's `vionne-image-comparison`; the 12 setting ids are
 * identical so the same stored settings render in any theme. Looks come from
 * the theme: inherited text colour and fonts, `--theme-font-heading` for the
 * title. Only the handle, divider and labels use fixed colours, because they
 * sit on top of photos.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { useLocale } from "../../hooks/useLocalization";
import { useResolvedSettings } from "../../hooks/useResolvedSettings";
import { applyImageTransform, asImageTransform } from "../../utils/imageTransform";
import { InlineText } from "../InlineText";
import { BASE_CSS, LibStyle, WIDE_IMG, imageUrl, localized, responsiveImg, str } from "../_shared";
import type { LibrarySectionProps } from "../index";

const ASPECT: Record<string, string> = {
  "16-9": "16 / 9",
  "4-3": "4 / 3",
  "1-1": "1 / 1",
  "3-4": "3 / 4",
  "2-3": "2 / 3",
};

/** The entrance sweep starts near the "before" edge so some "after" shows. */
const REVEAL_FROM = 8;

const CSS = `
.lib-ba-head{padding-block:3rem 2rem;text-align:center;max-inline-size:42rem;margin-inline:auto;padding-inline:1rem}
.lib-ba-head .lib-heading{font-size:clamp(1.5rem,3vw,2.25rem)}
.lib-ba-head p{margin:.5rem 0 0}
.lib-ba-frame{position:relative;inline-size:100%;max-block-size:85vh;overflow:hidden;user-select:none;background:color-mix(in srgb,currentColor 6%,transparent)}
@media (min-width:768px){.lib-ba-frame[data-interactive]{cursor:ew-resize}}
.lib-ba-img{position:absolute;inset:0;inline-size:100%;block-size:100%;object-fit:cover;pointer-events:none}
.lib-ba-clip{position:absolute;inset:0;overflow:hidden;pointer-events:none;clip-path:inset(0 var(--lib-clip,50%) 0 0)}
[dir="rtl"] .lib-ba-clip{clip-path:inset(0 0 0 var(--lib-clip,50%))}
.lib-ba-divider{position:absolute;inset-block:0;inset-inline-start:var(--lib-pos,50%);inline-size:1px;margin-inline-start:-.5px;background:#fff;pointer-events:none;z-index:1}
.lib-ba-handle{position:absolute;inset-block-start:50%;inset-inline-start:var(--lib-pos,50%);inline-size:2.75rem;block-size:2.75rem;margin-inline-start:-1.375rem;margin-block-start:-1.375rem;border:0;border-radius:9999px;background:#fff;color:#111;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:ew-resize;z-index:2;touch-action:none}
.lib-ba-handle:focus-visible{outline:2px solid #fff;outline-offset:3px}
.lib-ba-label{position:absolute;inset-block-start:1rem;padding:.35rem .75rem;border-radius:9999px;font-size:.7rem;font-weight:500;pointer-events:none;z-index:1}
.lib-ba-label--before{inset-inline-start:1rem;background:rgba(255,255,255,.92);color:#111}
.lib-ba-label--after{inset-inline-end:1rem;background:rgba(17,17,17,.85);color:#fff}
.lib-ba-empty{position:absolute;inset:0;display:grid;grid-template-columns:1fr 1fr}
.lib-ba-empty>div{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.75rem;font-size:.8rem}
.lib-ba-empty>div+div{background:color-mix(in srgb,currentColor 5%,transparent)}
.lib-ba-shimmer{position:absolute;inset:0;background:linear-gradient(90deg,transparent,color-mix(in srgb,currentColor 8%,transparent),transparent);background-size:200% 100%}
@media (prefers-reduced-motion:no-preference){.lib-ba-shimmer{animation:lib-ba-shimmer 1.6s linear infinite}}
@keyframes lib-ba-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}
`;

const Arrows = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M6 6L2 10L6 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 6L18 10L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function BeforeAfter({ instance, sectionId }: LibrarySectionProps) {
  const locale = useLocale();
  const s = useResolvedSettings(instance);
  const eyebrow = str(s.eyebrow);
  const title = str(s.title);
  const subtitle = str(s.subtitle);
  const beforeImage = imageUrl(s.before_image);
  const afterImage = imageUrl(s.after_image);
  const beforeLabel = str(s.before_label);
  const afterLabel = str(s.after_label);
  const rawPos = Number(s.initial_position ?? 50);
  const initialPos = Math.max(5, Math.min(95, Number.isFinite(rawPos) ? rawPos : 50));
  const animateToCenter = s.animate_to_center !== false;
  const fullWidth = s.full_width !== false;
  const showLabels = s.show_labels === true;
  const aspect = ASPECT[str(s.aspect, "3-4")] ?? ASPECT["3-4"];

  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const isRtlRef = useRef(false);
  const userInteractedRef = useRef(false);
  const [position, setPosition] = useState(animateToCenter ? REVEAL_FROM : initialPos);

  useEffect(() => {
    if (containerRef.current) {
      isRtlRef.current = getComputedStyle(containerRef.current).direction === "rtl";
    }
  }, []);

  // Sweep the divider to its resting place the first time the slider is
  // seen. Stops the moment the shopper touches it.
  useEffect(() => {
    const el = containerRef.current;
    if (!animateToCenter || !el || typeof IntersectionObserver === "undefined") return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setPosition(initialPos);
      return;
    }
    let cancelled = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          if (cancelled || userInteractedRef.current) return;
          const t = Math.min(1, (now - start) / 1100);
          setPosition(REVEAL_FROM + (initialPos - REVEAL_FROM) * (1 - Math.pow(1 - t, 3)));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animateToCenter]);

  // Trackpad horizontal swipe scrubs; vertical wheel still scrolls the page.
  // Native non-passive listener: React's onWheel is passive.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) < 2) return;
      e.preventDefault();
      userInteractedRef.current = true;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return;
      const delta = (e.deltaX / rect.width) * 100;
      setPosition((p) => clamp(p + (isRtlRef.current ? -delta : delta)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const setFromPointer = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const fromStart = isRtlRef.current ? rect.right - clientX : clientX - rect.left;
    setPosition(clamp((fromStart / rect.width) * 100));
  };

  const startDrag = (el: HTMLElement, pointerId: number, clientX: number) => {
    draggingRef.current = true;
    userInteractedRef.current = true;
    try {
      el.setPointerCapture(pointerId);
    } catch {
      // Pointer capture is best-effort (e.g. the pointer already left).
    }
    setFromPointer(clientX);
  };

  // Touch drags only from the handle, so a swipe over the photo scrolls the
  // page. Mouse and pen can scrub anywhere.
  const onFramePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch") startDrag(e.currentTarget, e.pointerId, e.clientX);
  };
  const onHandlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    startDrag(e.currentTarget, e.pointerId, e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (draggingRef.current) setFromPointer(e.clientX);
  };
  const stopDrag = (e: React.PointerEvent<HTMLElement>) => {
    draggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Already released.
    }
  };

  const onHandleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const next = keyboardPosition(position, e.key, e.shiftKey, isRtlRef.current);
    if (next === null) return;
    e.preventDefault();
    userInteractedRef.current = true;
    setPosition(next);
  };

  const dragLabel = localized(locale, "Drag to compare before and after", "اسحب علشان تقارن قبل وبعد");
  const hasMedia = Boolean(beforeImage || afterImage);
  const frameStyle: CSSProperties = { aspectRatio: aspect };

  return (
    <section className="lib-section lib-ba">
      <LibStyle id="lib-base" css={BASE_CSS} />
      <LibStyle id="lib-before-after" css={CSS} />

      {(eyebrow || title || subtitle) && (
        <div className="lib-ba-head">
          {eyebrow && (
            <span className="lib-eyebrow">
              <InlineText sectionId={sectionId} settingKey="eyebrow" value={eyebrow} />
            </span>
          )}
          {title && (
            <h2 className="lib-heading">
              <InlineText sectionId={sectionId} settingKey="title" value={title} />
            </h2>
          )}
          {subtitle && (
            <p className="lib-muted">
              <InlineText sectionId={sectionId} settingKey="subtitle" value={subtitle} multiline />
            </p>
          )}
        </div>
      )}

      <div className={fullWidth ? undefined : "lib-container"}>
        {!hasMedia ? (
          <div className="lib-ba-frame" style={frameStyle}>
            <div className="lib-ba-empty">
              <div>{localized(locale, "Before", "قبل")}</div>
              <div>{localized(locale, "After", "بعد")}</div>
            </div>
            <div className="lib-ba-divider" />
            <div className="lib-ba-handle" aria-hidden="true">
              <Arrows />
            </div>
          </div>
        ) : (
          <div
            ref={containerRef}
            className="lib-ba-frame"
            data-interactive=""
            style={frameStyle}
            onPointerDown={onFramePointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={stopDrag}
            onPointerCancel={stopDrag}
          >
            {afterImage ? (
              <img
                {...responsiveImg(afterImage, WIDE_IMG)}
                alt={afterLabel}
                className="lib-ba-img"
                style={applyImageTransform(asImageTransform(s.after_image), "cover")}
                draggable={false}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="lib-ba-shimmer" />
            )}

            {beforeImage && (
              <div className="lib-ba-clip" style={{ ["--lib-clip" as string]: `${100 - position}%` }}>
                <img
                  {...responsiveImg(beforeImage, WIDE_IMG)}
                  alt={beforeLabel}
                  className="lib-ba-img"
                  style={applyImageTransform(asImageTransform(s.before_image), "cover")}
                  draggable={false}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            )}

            {showLabels && beforeLabel && <span className="lib-ba-label lib-ba-label--before">{beforeLabel}</span>}
            {showLabels && afterLabel && <span className="lib-ba-label lib-ba-label--after">{afterLabel}</span>}

            <div className="lib-ba-divider" style={{ ["--lib-pos" as string]: `${position}%` }} />
            <button
              type="button"
              role="slider"
              className="lib-ba-handle"
              style={{ ["--lib-pos" as string]: `${position}%` }}
              aria-label={dragLabel}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(position)}
              onPointerDown={onHandlePointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={stopDrag}
              onPointerCancel={stopDrag}
              onKeyDown={onHandleKeyDown}
            >
              <Arrows />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

const clamp = (p: number) => Math.max(0, Math.min(100, p));

/**
 * Keyboard control for the handle. Arrow keys move toward the side they point
 * at, so in RTL ArrowLeft grows the "before" share. Returns null for keys the
 * slider does not handle.
 */
export function keyboardPosition(current: number, key: string, shift: boolean, rtl: boolean): number | null {
  const step = shift ? 10 : 2;
  if (key === "Home") return 0;
  if (key === "End") return 100;
  if (key === "ArrowLeft") return clamp(current + (rtl ? step : -step));
  if (key === "ArrowRight") return clamp(current + (rtl ? -step : step));
  return null;
}
