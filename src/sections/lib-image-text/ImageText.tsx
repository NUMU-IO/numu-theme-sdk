"use client";

/**
 * lib-image-text — a photograph with a few lines of brand copy.
 *
 * Replaces the per-theme about / image-with-text / philosophy sections. Three
 * looks: `split` (image beside the copy, Bazar / Empire), `overlay` (copy on the
 * image under a scrim, Empire's background mode) and `story` (centred heading,
 * copy beside the image, a large quote and value cards, Vionne's about).
 *
 * On phones the image always sits above the copy: it comes first in the DOM,
 * and only the desktop grid moves it. `overlay` without an image falls back to
 * `split`, since there is nothing to lay the copy on.
 */

import { Link } from "../../components/Link";
import { useLocale } from "../../hooks/useLocalization";
import { useResolvedSettings } from "../../hooks/useResolvedSettings";
import { applyImageTransform, asImageTransform } from "../../utils/imageTransform";
import { InlineText, useInsideEditor } from "../InlineText";
import { BASE_CSS, LibStyle, WIDE_IMG, imageAlt, imageUrl, localized, readBlocks, responsiveImg, str, type RawBlock } from "../_shared";
import type { LibrarySectionProps } from "../index";

const STYLES = ["split", "overlay", "story"];
const MAX_VALUES = 4;
const FULL_IMG = { widths: [640, 768, 1024, 1280, 1920], sizes: "100vw" } as const;

const CSS = `
.lib-it{padding-block:clamp(3rem,6vw,5rem)}
.lib-it-grid{display:grid;gap:clamp(1.5rem,4vw,3.5rem);align-items:center}
@media (min-width:768px){
.lib-it-grid.has-media{grid-template-columns:1fr 1fr}
.lib-it.is-end .lib-it-media,.lib-it.is-story .lib-it-media{order:2}
}
.lib-it-media{position:relative;aspect-ratio:4/5;overflow:hidden;background:color-mix(in srgb,currentColor 6%,transparent)}
.lib-it-media img,.lib-it-bg img{position:absolute;inset:0;inline-size:100%;block-size:100%;object-fit:cover}
.lib-it-copy{display:flex;flex-direction:column;align-items:flex-start;gap:1rem;max-inline-size:36rem}
.lib-it-title{font-size:clamp(1.75rem,3.5vw,2.75rem)}
.lib-it-quote{margin:0;font-family:var(--theme-font-heading,inherit);font-size:clamp(1.125rem,2vw,1.375rem);line-height:1.45;font-style:italic}
.lib-it-body{margin:0;line-height:1.75;opacity:.85;white-space:pre-line}
.lib-it-cta{display:inline-block;margin-block-start:.5rem;padding:.75rem 1.5rem;border:1px solid currentColor;color:inherit;text-decoration:none;font-size:.875rem;font-weight:500}
.lib-it-cta:hover{background:color-mix(in srgb,currentColor 10%,transparent)}
.lib-it.is-overlay{position:relative;display:grid;place-items:center;min-block-size:clamp(360px,60vw,640px);padding-block:0;overflow:hidden;color:#fff}
.lib-it-bg,.lib-it-scrim{position:absolute;inset:0}
.lib-it-scrim{background:#000}
.lib-it.is-overlay .lib-it-copy{position:relative;align-items:center;text-align:center;padding:clamp(1.5rem,5vw,4rem)}
.lib-it-head{max-inline-size:48rem;margin-inline:auto;margin-block-end:clamp(2rem,4vw,3.5rem);text-align:center}
.lib-it-figure{max-inline-size:48rem;margin:clamp(2.5rem,5vw,4rem) auto 0;padding:clamp(1.5rem,3vw,2.25rem);text-align:center;border:1px solid color-mix(in srgb,currentColor 15%,transparent)}
.lib-it-figure blockquote{margin:0;font-family:var(--theme-font-heading,inherit);font-size:clamp(1.25rem,2.5vw,1.75rem);line-height:1.4}
.lib-it-values{display:grid;gap:1.25rem;margin:clamp(2.5rem,5vw,4rem) 0 0;padding:0;list-style:none}
@media (min-width:768px){.lib-it-values{grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))}}
.lib-it-value{padding:1.5rem;border:1px solid color-mix(in srgb,currentColor 15%,transparent)}
.lib-it-value h3{margin:0 0 .5rem;font-family:var(--theme-font-heading,inherit);font-size:1.125rem;font-weight:500}
.lib-it-value p{margin:0;font-size:.9rem;line-height:1.7;opacity:.8;white-space:pre-line}
:lang(ar) .lib-it-quote,[dir="rtl"] .lib-it-quote{font-style:normal}
`;

export default function ImageText({ instance, sectionId }: LibrarySectionProps) {
  const locale = useLocale();
  const s = useResolvedSettings(instance);
  const insideEditor = useInsideEditor();

  const image = imageUrl(s.image);
  const title = str(s.title);
  const body = str(s.body);
  const quote = str(s.quote);

  if (!image && !title && !body && !quote) {
    return insideEditor ? (
      <section className="lib-section lib-empty">
        <LibStyle id="lib-base" css={BASE_CSS} />
        <p className="lib-muted">{localized(locale, "Add an image or some text to this section", "ضيف صورة أو كلام للقسم ده")}</p>
      </section>
    ) : null;
  }

  const picked = STYLES.includes(str(s.style)) ? str(s.style) : "split";
  const style = picked === "overlay" && !image ? "split" : picked;
  const side = str(s.image_position) === "end" ? "end" : "start";
  const eyebrow = str(s.eyebrow);
  const ctaText = str(s.cta_text);
  const isAr = localized(locale, "en", "ar") === "ar";
  const [open, close] = isAr ? ["«", "»"] : ["“", "”"];

  const eyebrowEl = eyebrow && <span className="lib-eyebrow">{eyebrow}</span>;
  const titleEl = title && (
    <h2 className="lib-heading lib-it-title">
      <InlineText sectionId={sectionId} settingKey="title" value={title} />
    </h2>
  );
  const bodyEl = body && (
    <p className="lib-it-body">
      <InlineText sectionId={sectionId} settingKey="body" value={body} multiline />
    </p>
  );
  const ctaEl = ctaText && (
    <Link to={str(s.cta_link) || "/products"} className="lib-it-cta">
      {ctaText}
    </Link>
  );
  const imgProps = {
    ...responsiveImg(image, style === "overlay" ? FULL_IMG : WIDE_IMG),
    alt: imageAlt(s.image, ""),
    loading: "lazy" as const,
    decoding: "async" as const,
    style: applyImageTransform(asImageTransform(s.image), "cover"),
  };
  const media = image && (
    <div className="lib-it-media">
      <img {...imgProps} />
    </div>
  );
  const styles = (
    <>
      <LibStyle id="lib-base" css={BASE_CSS} />
      <LibStyle id="lib-image-text" css={CSS} />
    </>
  );

  if (style === "overlay") {
    const raw = s.overlay_opacity;
    const scrim = (typeof raw === "number" && Number.isFinite(raw) ? Math.min(70, Math.max(0, raw)) : 35) / 100;
    return (
      <section className="lib-section lib-it is-overlay">
        {styles}
        <div className="lib-it-bg">
          <img {...imgProps} />
        </div>
        {scrim > 0 && <div className="lib-it-scrim" aria-hidden="true" style={{ opacity: scrim }} />}
        {(eyebrowEl || titleEl || quote || bodyEl || ctaEl) && (
          <div className="lib-it-copy">
            {eyebrowEl}
            {titleEl}
            {quote && <p className="lib-it-quote">{`${open}${quote}${close}`}</p>}
            {bodyEl}
            {ctaEl}
          </div>
        )}
      </section>
    );
  }

  if (style === "story") {
    const values = readBlocks(instance as RawBlock, "value")
      .map((b) => ({ title: str(b.settings?.title), text: str(b.settings?.text) }))
      .filter((v) => v.title || v.text)
      .slice(0, MAX_VALUES);
    return (
      <section className="lib-section lib-it is-story">
        {styles}
        <div className="lib-container">
          {(eyebrowEl || titleEl) && (
            <div className="lib-it-head">
              {eyebrowEl}
              {titleEl}
            </div>
          )}
          {(media || bodyEl || ctaEl) && (
            <div className={media ? "lib-it-grid has-media" : "lib-it-grid"}>
              {media}
              {(bodyEl || ctaEl) && (
                <div className="lib-it-copy">
                  {bodyEl}
                  {ctaEl}
                </div>
              )}
            </div>
          )}
          {quote && (
            <figure className="lib-it-figure">
              <blockquote>{`${open}${quote}${close}`}</blockquote>
            </figure>
          )}
          {values.length > 0 && (
            <ul className="lib-it-values">
              {values.map((v, i) => (
                <li key={i} className="lib-it-value">
                  {v.title && <h3>{v.title}</h3>}
                  {v.text && <p>{v.text}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className={`lib-section lib-it is-split is-${side}`}>
      {styles}
      <div className="lib-container">
        <div className={media ? "lib-it-grid has-media" : "lib-it-grid"}>
          {media}
          <div className="lib-it-copy">
            {eyebrowEl}
            {titleEl}
            {quote && <p className="lib-it-quote">{`${open}${quote}${close}`}</p>}
            {bodyEl}
            {ctaEl}
          </div>
        </div>
      </div>
    </section>
  );
}
