"use client";

/**
 * lib-shop-the-look — one styled photo with numbered hotspots and a matching list.
 *
 * Built from Teen's `tn-shop-the-look`, without the product lookup: each
 * hotspot carries its own label, price text and link. Every dot is a real
 * focusable control (a link when it has one) with an accessible name, and the
 * same items render as an ordinary list beside the photo on desktop and below
 * it on phones — the list is what a crawler, a screen reader and a thumb get.
 *
 * Dot positions are percentages from the photo's LEFT and TOP edges — physical,
 * not logical, on purpose: the photo does not mirror in Arabic, so a dot placed
 * on an item must stay on it in both languages. Centred with `translate`. Hovering or focusing a dot highlights its
 * list item and vice versa; that state starts empty, so server output and the
 * first client render match.
 */

import { useState } from "react";
import { Link } from "../../components/Link";
import { useLocale } from "../../hooks/useLocalization";
import { useResolvedSettings } from "../../hooks/useResolvedSettings";
import { useInsideEditor } from "../InlineText";
import { BASE_CSS, LibStyle, imageAlt, imageUrl, localized, readBlocks, responsiveImg, str, type RawBlock } from "../_shared";
import type { LibrarySectionProps } from "../index";

const LOOK_IMG = { widths: [640, 768, 1024, 1280], sizes: "(min-width: 768px) 60vw, 100vw" } as const;
const PHONE_IMG = { widths: [640, 768], sizes: "100vw" } as const;

const CSS = `
.lib-stl{padding-block:3rem}
.lib-stl-title{font-size:clamp(1.5rem,3vw,2.25rem);margin-block-end:1.5rem}
.lib-stl-body{display:grid;gap:1.5rem;align-items:center}
@media (min-width:768px){
.lib-stl-body{grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:3rem}
.lib-stl.is-image-end .lib-stl-media{order:2}
}
.lib-stl-media{position:relative}
.lib-stl-media img{display:block;inline-size:100%;block-size:auto}
.lib-stl-dot{position:absolute;display:grid;place-items:center;inline-size:1.75rem;block-size:1.75rem;translate:-50% -50%;padding:0;border:2px solid #fff;border-radius:50%;background:var(--theme-color-accent,#111);color:#fff;font-size:.75rem;font-weight:600;line-height:1;text-decoration:none;cursor:pointer;box-shadow:0 1px 6px rgba(0,0,0,.35)}
.lib-stl-dot.is-active,.lib-stl-dot:focus-visible{outline:2px solid #fff;outline-offset:2px;transform:scale(1.15)}
.lib-stl-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.lib-stl-item{display:flex;align-items:center;gap:.875rem;padding:.875rem .5rem;border-block-end:1px solid color-mix(in srgb,currentColor 15%,transparent);color:inherit;text-decoration:none}
.lib-stl-item.is-active{background:color-mix(in srgb,currentColor 7%,transparent)}
a.lib-stl-item:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.lib-stl-num{flex-shrink:0;display:grid;place-items:center;inline-size:1.75rem;block-size:1.75rem;border-radius:50%;border:1px solid currentColor;font-size:.75rem;font-weight:600}
.lib-stl-item.is-active .lib-stl-num{background:var(--theme-color-accent,currentColor);border-color:var(--theme-color-accent,currentColor);color:#fff}
.lib-stl-label{flex:1;font-weight:500}
.lib-stl-price{flex-shrink:0;font-size:.9rem;opacity:.8}
@media (prefers-reduced-motion:no-preference){.lib-stl-dot{transition:transform .2s}.lib-stl-item{transition:background-color .2s}}
`;

function clampPercent(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 50;
  return Math.min(100, Math.max(0, n));
}

export default function ShopTheLook({ instance }: LibrarySectionProps) {
  const locale = useLocale();
  const s = useResolvedSettings(instance);
  const insideEditor = useInsideEditor();
  const [active, setActive] = useState<number | null>(null);

  const image = imageUrl(s.image);
  if (!image) {
    return insideEditor ? (
      <section className="lib-section lib-empty">
        <LibStyle id="lib-base" css={BASE_CSS} />
        <p className="lib-muted">
          {localized(locale, "Choose a photo, then place a hotspot over each piece in it", "اختار صورة، وبعدها حط نقطة على كل قطعة فيها")}
        </p>
      </section>
    ) : null;
  }

  const spots = readBlocks(instance as RawBlock, "hotspot")
    .slice(0, 8)
    .map((spot) => {
      const h = spot.settings ?? {};
      return { x: clampPercent(h.x), y: clampPercent(h.y), label: str(h.label), price: str(h.price_text), link: str(h.link) };
    })
    // A hotspot with nothing to say would be a dot that names nothing.
    .filter((spot) => spot.label || spot.price || spot.link);

  const heading = str(s.heading);
  const imageMobile = imageUrl(s.image_mobile);
  const mobile = imageMobile ? responsiveImg(imageMobile, PHONE_IMG) : null;
  const layout = str(s.layout) === "image-end" ? "image-end" : "image-start";

  return (
    <section className={`lib-section lib-stl is-${layout}`}>
      <LibStyle id="lib-base" css={BASE_CSS} />
      <LibStyle id="lib-shop-the-look" css={CSS} />
      <div className="lib-container">
        {heading && <h2 className="lib-heading lib-stl-title">{heading}</h2>}
        <div className="lib-stl-body">
          <div className="lib-stl-media">
            <picture>
              {mobile && <source media="(max-width: 768px)" srcSet={mobile.srcSet ?? mobile.src} sizes={mobile.sizes} />}
              <img {...responsiveImg(image, LOOK_IMG)} alt={imageAlt(s.image, heading)} loading="lazy" decoding="async" />
            </picture>
            {spots.map((spot, i) => {
              const n = i + 1;
              const props = {
                className: `lib-stl-dot${active === i ? " is-active" : ""}`,
                style: { left: `${spot.x}%`, top: `${spot.y}%` },
                "aria-label": `${n}. ${spot.label || localized(locale, "Item", "قطعة")}${spot.price ? ` — ${spot.price}` : ""}`,
                onMouseEnter: () => setActive(i),
                onMouseLeave: () => setActive(null),
                onFocus: () => setActive(i),
                onBlur: () => setActive(null),
              };
              return spot.link ? (
                <Link key={n} to={spot.link} {...props}>
                  <span dir="ltr">{n}</span>
                </Link>
              ) : (
                <button key={n} type="button" {...props}>
                  <span dir="ltr">{n}</span>
                </button>
              );
            })}
          </div>

          {spots.length > 0 && (
            <ol className="lib-stl-list">
              {spots.map((spot, i) => {
                const n = i + 1;
                const props = {
                  className: `lib-stl-item${active === i ? " is-active" : ""}`,
                  onMouseEnter: () => setActive(i),
                  onMouseLeave: () => setActive(null),
                  onFocus: () => setActive(i),
                  onBlur: () => setActive(null),
                };
                const content = (
                  <>
                    <span className="lib-stl-num" dir="ltr" aria-hidden="true">
                      {n}
                    </span>
                    <span className="lib-stl-label">{spot.label}</span>
                    {spot.price && (
                      <span className="lib-stl-price" dir="ltr">
                        {spot.price}
                      </span>
                    )}
                  </>
                );
                return (
                  <li key={n}>
                    {spot.link ? (
                      <Link to={spot.link} {...props}>
                        {content}
                      </Link>
                    ) : (
                      <div {...props}>{content}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
