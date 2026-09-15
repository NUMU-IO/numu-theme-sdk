"use client";

/**
 * lib-lookbook — an editorial spread of up to six looks.
 *
 * Built from Editorial's `ed-lookbook`: magazine figures, wide and narrow in
 * turn, each with a hung caption and an optional shop link. The paper-curtain
 * reveal is CSS only — a scroll-driven animation, applied where the browser
 * supports it and motion is allowed — so there is no JS to hydrate and no
 * content hidden where it is unsupported.
 *
 * A look shows only when it has an image. On the storefront the section renders
 * nothing without one; the editor shows a prompt instead.
 */

import { Link } from "../../components/Link";
import { useLocale } from "../../hooks/useLocalization";
import { useResolvedSettings } from "../../hooks/useResolvedSettings";
import { applyImageTransform, asImageTransform } from "../../utils/imageTransform";
import { InlineText, useInsideEditor } from "../InlineText";
import { BASE_CSS, LibStyle, imageAlt, imageUrl, localized, responsiveImg, str } from "../_shared";
import type { LibrarySectionProps } from "../index";

interface Look {
  n: number;
  image: string;
  imageRaw: unknown;
  caption: string;
  link: string;
  linkLabel: string;
}

const WIDE_LOOK_IMG = { widths: [640, 768, 1024, 1280], sizes: "(min-width: 768px) 58vw, 100vw" } as const;
const NARROW_LOOK_IMG = { widths: [384, 640, 768, 1024], sizes: "(min-width: 768px) 42vw, 100vw" } as const;

const CSS = `
.lib-lookbook{padding-block:4rem}
@media (min-width:768px){.lib-lookbook{padding-block:6rem}}
.lib-lookbook-head{max-inline-size:48rem;margin-block-end:2.5rem}
@media (min-width:768px){.lib-lookbook-head{margin-block-end:4rem}}
.lib-lookbook-rule{display:block;inline-size:5rem;block-size:4px;margin-block-end:1.25rem;border-block:1px solid currentColor}
.lib-lookbook-head .lib-heading{font-size:clamp(2.25rem,6vw,4.5rem)}
.lib-lookbook-head p{margin:1rem 0 0;font-size:1.0625rem;line-height:1.7;max-inline-size:60ch}
.lib-lookbook-grid{display:grid;gap:3rem 2rem;align-items:start}
@media (min-width:768px){
.lib-lookbook-grid{grid-template-columns:repeat(12,1fr);row-gap:5rem}
.lib-look.is-wide{grid-column:span 7}
.lib-look.is-narrow{grid-column:span 5;margin-block-start:4rem}
}
.lib-look{display:block;color:inherit;text-decoration:none}
.lib-look figure{margin:0}
.lib-look-media{position:relative;overflow:hidden;aspect-ratio:3/4;background:color-mix(in srgb,currentColor 6%,transparent)}
.lib-look.is-wide .lib-look-media{aspect-ratio:4/5}
.lib-look-media img{position:absolute;inset:0;inline-size:100%;block-size:100%;object-fit:cover}
.lib-look figcaption{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-block-start:.75rem;padding-block-start:.75rem;border-block-start:1px solid currentColor}
.lib-look-caption{margin:0;font-size:.85rem;line-height:1.5;max-inline-size:38ch}
.lib-look-shop{white-space:nowrap;text-decoration:underline;text-underline-offset:4px;text-decoration-thickness:2px;text-decoration-color:var(--theme-color-accent,currentColor)}
@media (prefers-reduced-motion:no-preference){
.lib-look-media img{transition:transform .7s ease}
a.lib-look:hover .lib-look-media img{transform:scale(1.04)}
@supports (animation-timeline:view()){
.lib-look-media::after{content:"";position:absolute;inset:0;background:var(--theme-color-background,Canvas);transform-origin:top;animation:lib-curtain linear both;animation-timeline:view();animation-range:entry 10% cover 35%}
}
}
@keyframes lib-curtain{to{transform:scaleY(0)}}
`;

export default function Lookbook({ instance, sectionId }: LibrarySectionProps) {
  const locale = useLocale();
  const s = useResolvedSettings(instance);
  const insideEditor = useInsideEditor();

  const looks: Look[] = [];
  for (let i = 1; i <= 6; i++) {
    const imageRaw = s[`look_${i}_image`];
    const image = imageUrl(imageRaw);
    // A look is its photograph: a caption alone would leave an empty frame.
    if (!image) continue;
    looks.push({
      n: i,
      image,
      imageRaw,
      caption: str(s[`look_${i}_caption`]),
      link: str(s[`look_${i}_link`]),
      linkLabel: str(s[`look_${i}_link_label`]),
    });
  }

  if (looks.length === 0) {
    return insideEditor ? (
      <section className="lib-section lib-empty">
        <LibStyle id="lib-base" css={BASE_CSS} />
        <p className="lib-muted">{localized(locale, "Add a look image to start the lookbook", "ضيف صورة لوك علشان تبدأ اللوك بوك")}</p>
      </section>
    ) : null;
  }

  const title = str(s.title) || localized(locale, "The lookbook", "اللوك بوك");
  const intro = str(s.intro);
  const shopLabel = localized(locale, "Shop the look", "اتسوّق اللوك");

  return (
    <section className="lib-section lib-lookbook">
      <LibStyle id="lib-base" css={BASE_CSS} />
      <LibStyle id="lib-lookbook" css={CSS} />
      <div className="lib-container">
        <header className="lib-lookbook-head">
          <span className="lib-lookbook-rule" aria-hidden="true" />
          <h2 className="lib-heading">
            <InlineText sectionId={sectionId} settingKey="title" value={title} />
          </h2>
          {intro && (
            <p className="lib-muted">
              <InlineText sectionId={sectionId} settingKey="intro" value={intro} multiline />
            </p>
          )}
        </header>

        <div className="lib-lookbook-grid">
          {looks.map((look, i) => {
            const wide = i % 2 === 0;
            const className = `lib-look ${wide ? "is-wide" : "is-narrow"}`;
            const figure = (
              <figure>
                <div className="lib-look-media">
                  <img
                    {...responsiveImg(look.image, wide ? WIDE_LOOK_IMG : NARROW_LOOK_IMG)}
                    alt={imageAlt(look.imageRaw, look.caption)}
                    loading="lazy"
                    decoding="async"
                    style={applyImageTransform(asImageTransform(look.imageRaw), "cover")}
                  />
                </div>
                {(look.caption || look.link) && (
                  <figcaption>
                    {look.caption && (
                      <p className="lib-look-caption lib-muted">
                        <InlineText sectionId={sectionId} settingKey={`look_${look.n}_caption`} value={look.caption} multiline />
                      </p>
                    )}
                    {look.link && <span className="lib-label lib-look-shop">{look.linkLabel || shopLabel}</span>}
                  </figcaption>
                )}
              </figure>
            );
            return look.link ? (
              <Link key={look.n} to={look.link} className={className}>
                {figure}
              </Link>
            ) : (
              <div key={look.n} className={className}>
                {figure}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
