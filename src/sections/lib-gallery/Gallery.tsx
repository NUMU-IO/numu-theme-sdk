"use client";

/**
 * lib-gallery — a photo gallery in three looks.
 *
 * Built from Genova's `gn-instagram-grid` (square tiles), `gn-genova-girls`
 * (customer looks credited by name, linked to the piece) and Rabbitsocks'
 * `rs-gallery-wall`. Photos are merchant-uploaded blocks, never a live feed: a
 * feed token expires and silently empties the storefront.
 *
 * Masonry is plain CSS columns, so there is no JS layout and SSR is exact. A
 * photo without an image is skipped; with none left the section renders
 * nothing on the storefront and a prompt in the editor.
 */

import { Link } from "../../components/Link";
import { useLocale } from "../../hooks/useLocalization";
import { useResolvedSettings } from "../../hooks/useResolvedSettings";
import { useInsideEditor } from "../InlineText";
import { BASE_CSS, LibStyle, imageAlt, imageUrl, localized, readBlocks, responsiveImg, str, type RawBlock } from "../_shared";
import type { LibrarySectionProps } from "../index";

const STYLES = ["grid", "looks", "masonry"];
const TILE_IMG = { widths: [256, 384, 640, 768], sizes: "(min-width: 768px) 25vw, 50vw" } as const;

const CSS = `
.lib-gal{padding-block:3rem}
.lib-gal-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:1rem;margin-block-end:1.5rem}
.lib-gal-title{display:flex;flex-wrap:wrap;align-items:baseline;gap:.5rem 1rem;font-size:clamp(1.5rem,3vw,2.25rem)}
.lib-gal-handle{font-family:inherit;font-size:.9rem;font-weight:500;opacity:.7}
.lib-gal-sub{margin:.5rem 0 0;max-inline-size:60ch;line-height:1.6}
.lib-gal-follow{flex-shrink:0;display:inline-block;padding:.6rem 1.25rem;border:1px solid currentColor;color:inherit;text-decoration:none;font-size:.875rem;font-weight:500}
.lib-gal-follow:hover{background:var(--theme-color-text,currentColor);color:var(--theme-color-background,#fff)}
.lib-gal-grid{display:grid;gap:.5rem;grid-template-columns:repeat(var(--lib-gal-cols-m,2),minmax(0,1fr))}
.lib-gal.is-looks .lib-gal-grid{gap:1.5rem 1rem}
.lib-gal-masonry{column-count:var(--lib-gal-cols-m,2);column-gap:.5rem}
@media (min-width:768px){
.lib-gal-grid{grid-template-columns:repeat(var(--lib-gal-cols,4),minmax(0,1fr))}
.lib-gal-masonry{column-count:var(--lib-gal-cols,4)}
}
.lib-gal-tile{display:block;color:inherit;text-decoration:none}
.lib-gal-masonry .lib-gal-tile{break-inside:avoid;margin-block-end:.5rem}
.lib-gal-media{position:relative;display:block;overflow:hidden;background:color-mix(in srgb,currentColor 6%,transparent)}
.lib-gal.is-grid .lib-gal-media{aspect-ratio:1/1}
.lib-gal.is-looks .lib-gal-media{aspect-ratio:3/4}
.lib-gal-media img{display:block;inline-size:100%;block-size:auto}
.lib-gal.is-grid .lib-gal-media img,.lib-gal.is-looks .lib-gal-media img{position:absolute;inset:0;block-size:100%;object-fit:cover}
a.lib-gal-tile:focus-visible,.lib-gal-look a:focus-visible{outline:2px solid currentColor;outline-offset:3px}
.lib-gal-info{display:flex;flex-direction:column;gap:.25rem;margin-block-start:.75rem}
.lib-gal-name{margin:0}
.lib-gal-caption{margin:0;font-size:.9rem;line-height:1.5}
.lib-gal-shop{align-self:flex-start;color:inherit;font-size:.875rem;text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--theme-color-accent,currentColor)}
@media (prefers-reduced-motion:no-preference){
.lib-gal-media img{transition:transform .6s ease}
.lib-gal-media:hover img{transform:scale(1.05)}
}
`;

const ABSOLUTE_URL = /^[a-z]+:|^\/\//i;

/** Off-site links (Instagram, TikTok) open in a new tab. */
const external = (url: string) => (ABSOLUTE_URL.test(url) ? { target: "_blank", rel: "noopener noreferrer" } : {});

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.min(max, Math.max(min, n));
}

export default function Gallery({ instance }: LibrarySectionProps) {
  const locale = useLocale();
  const s = useResolvedSettings(instance);
  const insideEditor = useInsideEditor();

  const photos = readBlocks(instance as RawBlock, "photo")
    .slice(0, 24)
    .map((photo, i) => {
      const p = photo.settings ?? {};
      const name = str(p.name);
      return {
        key: `photo-${i}`,
        image: imageUrl(p.image),
        alt: imageAlt(p.image, name || str(p.caption)),
        link: str(p.link),
        name,
        caption: str(p.caption),
        productLabel: str(p.product_label),
        productLink: str(p.product_link),
      };
    })
    .filter((photo) => photo.image);

  if (photos.length === 0) {
    return insideEditor ? (
      <section className="lib-section lib-empty">
        <LibStyle id="lib-base" css={BASE_CSS} />
        <p className="lib-muted">{localized(locale, "Add photos to this gallery", "ضيف صور للمعرض ده")}</p>
      </section>
    ) : null;
  }

  const style = STYLES.includes(str(s.style)) ? str(s.style) : "grid";
  const heading = str(s.heading);
  const subtitle = str(s.subtitle);
  const handle = str(s.handle);
  const visitUrl = str(s.visit_url);
  const vars = {
    ["--lib-gal-cols" as string]: String(clampInt(s.columns_desktop, 2, 6, 4)),
    ["--lib-gal-cols-m" as string]: String(clampInt(s.columns_mobile, 1, 3, 2)),
  };

  return (
    <section className={`lib-section lib-gal is-${style}`}>
      <LibStyle id="lib-base" css={BASE_CSS} />
      <LibStyle id="lib-gallery" css={CSS} />
      <div className="lib-container">
        {(heading || subtitle || handle || visitUrl) && (
          <div className="lib-gal-head">
            <div>
              {(heading || handle) && (
                <h2 className="lib-heading lib-gal-title">
                  {heading && <span>{heading}</span>}
                  {handle && (
                    <span className="lib-gal-handle" dir="ltr">
                      {handle}
                    </span>
                  )}
                </h2>
              )}
              {subtitle && <p className="lib-gal-sub lib-muted">{subtitle}</p>}
            </div>
            {visitUrl && (
              <Link to={visitUrl} className="lib-gal-follow" {...external(visitUrl)}>
                {localized(locale, "Follow us", "تابعنا")}
              </Link>
            )}
          </div>
        )}

        <div className={style === "masonry" ? "lib-gal-masonry" : "lib-gal-grid"} style={vars}>
          {photos.map((photo) => {
            const media = (
              <span className="lib-gal-media">
                <img {...responsiveImg(photo.image, TILE_IMG)} alt={photo.alt} loading="lazy" decoding="async" />
              </span>
            );
            const tile = photo.link ? (
              <Link key={photo.key} to={photo.link} className="lib-gal-tile" {...external(photo.link)}>
                {media}
              </Link>
            ) : (
              <span key={photo.key} className="lib-gal-tile">
                {media}
              </span>
            );
            if (style !== "looks") return tile;
            return (
              <article key={photo.key} className="lib-gal-look">
                {tile}
                {(photo.name || photo.caption || photo.productLink) && (
                  <div className="lib-gal-info">
                    {photo.name && <p className="lib-label lib-gal-name">{photo.name}</p>}
                    {photo.caption && <p className="lib-gal-caption lib-muted">{photo.caption}</p>}
                    {photo.productLink && (
                      <Link to={photo.productLink} className="lib-gal-shop">
                        {photo.productLabel || localized(locale, "Shop this look", "اتسوّق اللوك")}
                      </Link>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
