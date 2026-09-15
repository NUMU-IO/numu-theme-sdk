"use client";

/**
 * lib-promo-banner — a promotion, in two looks.
 *
 * - `photo` (default): Genova's `gn-editorial-banner` — one wide photograph
 *   with an optional line and button. The only decoration is a legibility
 *   scrim, shown only when there is copy on the image. The phone crop uses
 *   native `<picture><source media>`, so the browser picks the file with no JS.
 * - `split`: the offer card eleven themes shipped (boutique, modern, bazar,
 *   tech-wave, …) — badge, headline, subtitle and button beside a framed image,
 *   on a soft panel with an accent rule. Works without an image too.
 *
 * Empty state: `photo` needs an image, `split` needs a headline. Otherwise it
 * renders nothing on the storefront and a prompt in the editor.
 */

import { Link } from "../../components/Link";
import { useLocale } from "../../hooks/useLocalization";
import { useResolvedSettings } from "../../hooks/useResolvedSettings";
import { applyImageTransform, asImageTransform } from "../../utils/imageTransform";
import { useInsideEditor } from "../InlineText";
import { BASE_CSS, LibStyle, bool, imageAlt, imageUrl, localized, responsiveImg, str } from "../_shared";
import type { LibrarySectionProps } from "../index";

const HEIGHTS = ["short", "medium", "tall"];
const POSITIONS = ["center", "bottom-start", "bottom-end"];

/** The banner spans the viewport (or the 1200px container), never half of it. */
const BANNER_IMG = { widths: [640, 768, 1024, 1280, 1920], sizes: "100vw" } as const;
const PHONE_IMG = { widths: [640, 768], sizes: "100vw" } as const;
const SPLIT_IMG = { widths: [384, 640, 768], sizes: "(min-width: 768px) 40vw, 100vw" } as const;

const CSS = `
.lib-banner-media{position:relative;overflow:hidden}
.lib-banner.is-short .lib-banner-media{block-size:clamp(220px,38vw,420px)}
.lib-banner.is-medium .lib-banner-media{block-size:clamp(300px,52vw,620px)}
.lib-banner.is-tall .lib-banner-media{block-size:clamp(380px,68vw,820px)}
.lib-banner-media img{position:absolute;inset:0;inline-size:100%;block-size:100%;object-fit:cover}
.lib-banner-scrim{position:absolute;inset:0;background:#000}
.lib-banner-copy{position:absolute;inset:0;display:flex;flex-direction:column;gap:1rem;padding:clamp(1.25rem,4vw,3rem);color:#fff}
.lib-banner-copy.is-center{align-items:center;justify-content:center;text-align:center}
.lib-banner-copy.is-bottom-start{align-items:flex-start;justify-content:flex-end;text-align:start}
.lib-banner-copy.is-bottom-end{align-items:flex-end;justify-content:flex-end;text-align:end}
.lib-banner-heading{font-size:clamp(1.5rem,4vw,3rem);max-inline-size:20ch}
.lib-banner-cta{display:inline-block;padding:.75rem 1.5rem;border:1px solid currentColor;color:#fff;text-decoration:none;font-size:.875rem;font-weight:500}
.lib-banner-cta:hover{background:#fff;color:#111}
.lib-offer{padding-block:2rem}
.lib-offer-card{position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;gap:2rem;padding:2rem;border-radius:1rem;border:1px solid color-mix(in srgb,currentColor 12%,transparent);background:color-mix(in srgb,var(--theme-color-accent,currentColor) 6%,transparent);border-block-start:4px solid var(--theme-color-accent,currentColor)}
@media (min-width:768px){.lib-offer-card{flex-direction:row;padding:3rem}}
.lib-offer-copy{flex:1;display:flex;flex-direction:column;align-items:center;gap:.75rem;text-align:center}
@media (min-width:768px){.lib-offer-copy{align-items:flex-start;text-align:start}}
.lib-offer-badge{display:inline-block;padding:.25rem .75rem;border-radius:999px;font-size:.75rem;font-weight:700;color:var(--theme-color-accent,currentColor);background:color-mix(in srgb,var(--theme-color-accent,currentColor) 14%,transparent)}
.lib-offer-heading{font-size:clamp(1.5rem,3vw,2.25rem)}
.lib-offer-sub{margin:0;opacity:.75;max-inline-size:36rem}
.lib-offer-cta{display:inline-block;margin-block-start:.5rem;padding:.75rem 1.75rem;border-radius:.75rem;background:var(--theme-color-accent,#111);color:var(--theme-color-background,#fff);text-decoration:none;font-weight:600;font-size:.875rem}
.lib-offer-cta:hover{opacity:.9}
.lib-offer-media{position:relative;flex-shrink:0;inline-size:min(100%,15rem);aspect-ratio:1/1;overflow:hidden;border-radius:1rem}
.lib-offer-media img{position:absolute;inset:0;inline-size:100%;block-size:100%;object-fit:cover}
`;

export default function PromoBanner({ instance }: LibrarySectionProps) {
  const locale = useLocale();
  const s = useResolvedSettings(instance);
  const insideEditor = useInsideEditor();
  const split = str(s.style) === "split";

  const image = imageUrl(s.image);
  const heading = str(s.overlay_text);
  const ctaText = str(s.cta_text);
  const ctaLink = str(s.cta_link) || "/products";

  const ready = split ? Boolean(heading) : Boolean(image);
  if (!ready) {
    return insideEditor ? (
      <section className="lib-section lib-empty">
        <LibStyle id="lib-base" css={BASE_CSS} />
        <p className="lib-muted">
          {split
            ? localized(locale, "Write a headline for this offer", "اكتب عنوان للعرض ده")
            : localized(locale, "Choose an image for this banner", "اختار صورة للبانر ده")}
        </p>
      </section>
    ) : null;
  }

  if (split) {
    const badge = str(s.badge_text);
    const subtitle = str(s.subtitle);
    return (
      <section className="lib-section lib-offer">
        <LibStyle id="lib-base" css={BASE_CSS} />
        <LibStyle id="lib-promo-banner" css={CSS} />
        <div className="lib-container">
          <div className="lib-offer-card">
            <div className="lib-offer-copy">
              {badge && <span className="lib-offer-badge">{badge}</span>}
              <h2 className="lib-heading lib-offer-heading">{heading}</h2>
              {subtitle && <p className="lib-offer-sub">{subtitle}</p>}
              <Link to={ctaLink} className="lib-offer-cta">
                {ctaText || localized(locale, "Shop now", "اتسوّق دلوقتي")}
              </Link>
            </div>
            {image && (
              <div className="lib-offer-media">
                <img
                  {...responsiveImg(image, SPLIT_IMG)}
                  alt={imageAlt(s.image, "")}
                  loading="lazy"
                  decoding="async"
                  style={applyImageTransform(asImageTransform(s.image), "cover")}
                />
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  const imageMobile = imageUrl(s.image_mobile);
  const rawOverlay = s.overlay_opacity;
  const overlay = (typeof rawOverlay === "number" && Number.isFinite(rawOverlay) ? rawOverlay : 20) / 100;
  const hasCopy = Boolean(heading || ctaText);
  const height = HEIGHTS.includes(str(s.height)) ? str(s.height) : "medium";
  const position = POSITIONS.includes(str(s.text_position)) ? str(s.text_position) : "center";
  const mobile = imageMobile ? responsiveImg(imageMobile, PHONE_IMG) : null;
  // ponytail: the image editor's framing applies only when no phone image is
  // set; add per-breakpoint framing (like HeroMedia) if merchants ask for it.
  const framing = mobile ? undefined : applyImageTransform(asImageTransform(s.image), "cover");

  return (
    <section className={`lib-section lib-banner is-${height}${bool(s.full_width, true) ? "" : " lib-container"}`}>
      <LibStyle id="lib-base" css={BASE_CSS} />
      <LibStyle id="lib-promo-banner" css={CSS} />
      <div className="lib-banner-media">
        <picture>
          {mobile && <source media="(max-width: 768px)" srcSet={mobile.srcSet ?? mobile.src} sizes={mobile.sizes} />}
          <img
            {...responsiveImg(image, BANNER_IMG)}
            alt={imageAlt(s.image, heading)}
            loading="lazy"
            decoding="async"
            style={framing}
          />
        </picture>
        {hasCopy && overlay > 0 && <div className="lib-banner-scrim" aria-hidden="true" style={{ opacity: overlay }} />}
        {hasCopy && (
          <div className={`lib-banner-copy is-${position}`}>
            {heading && <h2 className="lib-heading lib-banner-heading">{heading}</h2>}
            {ctaText && (
              <Link to={ctaLink} className="lib-banner-cta">
                {ctaText}
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
