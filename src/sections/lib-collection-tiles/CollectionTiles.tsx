"use client";

/**
 * lib-collection-tiles — "Shop by category": image tiles that link to collections.
 *
 * Styles: `tiles` (default) is Genova's `gn-collection-rail` as a grid; `card`
 * is teen's collection links (a label card over the image with an item-count
 * pill); `circles` are round images with the name underneath.
 *
 * Built from Genova's `gn-collection-rail`, as a grid only (a scrolling rail
 * needs JS controls; add it when merchants ask). Tiles come from the store's
 * own collections by default, so they stay correct as categories are added, or
 * from hand-made `tile` blocks for a curated set with the merchant's photos.
 *
 * Collections are read with `fetchIfMissing`: the storefront pre-fetches them
 * only on catalog routes, and this section can sit on any page.
 */

import { Link } from "../../components/Link";
import { useCollections } from "../../hooks/useCollections";
import { useLocale } from "../../hooks/useLocalization";
import { useResolvedSettings } from "../../hooks/useResolvedSettings";
import { collectionHref } from "../../utils/routes";
import { useInsideEditor } from "../InlineText";
import { BASE_CSS, LibStyle, imageAlt, imageUrl, localized, readBlocks, responsiveImg, str, type RawBlock } from "../_shared";
import type { LibrarySectionProps } from "../index";

const ASPECTS = ["portrait", "square", "landscape"];
const STYLES = ["tiles", "card", "circles"];
const TILE_IMG = { widths: [256, 384, 640, 768], sizes: "(min-width: 768px) 25vw, 50vw" } as const;

const CSS = `
.lib-tiles{padding-block:3rem}
.lib-tiles-head{display:flex;align-items:baseline;justify-content:space-between;gap:1rem;margin-block-end:1.5rem}
.lib-tiles-title{font-size:clamp(1.5rem,3vw,2.25rem)}
.lib-tiles-all{flex-shrink:0;color:inherit;font-size:.875rem;text-decoration:underline;text-underline-offset:3px}
.lib-tiles-grid{display:grid;gap:1rem;grid-template-columns:repeat(2,minmax(0,1fr))}
@media (min-width:768px){.lib-tiles-grid{grid-template-columns:repeat(var(--lib-tiles-cols,4),minmax(0,1fr))}}
.lib-tile{position:relative;display:flex;flex-direction:column;gap:.625rem;color:inherit;text-decoration:none}
.lib-tile-media{position:relative;overflow:hidden;aspect-ratio:3/4;background:color-mix(in srgb,currentColor 8%,transparent)}
.lib-tiles.is-square .lib-tile-media{aspect-ratio:1/1}
.lib-tiles.is-landscape .lib-tile-media{aspect-ratio:4/3}
.lib-tile-media img{position:absolute;inset:0;inline-size:100%;block-size:100%;object-fit:cover;transition:transform .6s ease}
.lib-tile:hover .lib-tile-media img{transform:scale(1.04)}
.lib-tile-label{font-weight:500}
.lib-tiles.is-overlay .lib-tile-label{position:absolute;inset-inline:0;inset-block-end:0;padding:1rem;color:#fff;background:linear-gradient(transparent,rgba(0,0,0,.55))}
.lib-tile:focus-visible{outline:2px solid currentColor;outline-offset:3px}
.lib-tiles.is-circles .lib-tile{align-items:center;text-align:center}
.lib-tiles.is-circles .lib-tile-media{inline-size:100%;aspect-ratio:1/1;border-radius:50%}
.lib-tile-card{position:absolute;inset-inline:.75rem;inset-block-end:.75rem;display:flex;flex-direction:column;align-items:flex-start;gap:.25rem;padding:.75rem 1rem;border-radius:.5rem;background:var(--theme-color-background,#fff);color:var(--theme-color-text,#111)}
.lib-tile-count{padding:.125rem .5rem;border-radius:999px;font-size:.7rem;font-weight:600;color:var(--theme-color-background,#fff);background:var(--theme-color-accent,#111)}
.lib-tile-more{font-size:.8rem;text-decoration:underline;text-underline-offset:3px;opacity:.8}
.lib-tile-sub{font-size:.8rem;opacity:.6}
@media (prefers-reduced-motion:reduce){.lib-tile-media img{transition:none}}
`;

interface Tile {
  key: string;
  label: string;
  link: string;
  image: string;
  alt: string;
  /** Product count, auto source only. */
  count?: number;
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.min(max, Math.max(min, n));
}

export default function CollectionTiles({ instance }: LibrarySectionProps) {
  const locale = useLocale();
  const s = useResolvedSettings(instance);
  const insideEditor = useInsideEditor();
  const limit = clampInt(s.limit, 2, 16, 8);
  const { collections } = useCollections({ fetchIfMissing: true, limit });

  const manual: Tile[] = readBlocks(instance as RawBlock, "tile")
    .map((tile, i) => ({
      key: `tile-${i}`,
      label: str(tile.settings?.label),
      link: str(tile.settings?.link) || "/collections",
      image: imageUrl(tile.settings?.image),
      alt: imageAlt(tile.settings?.image, str(tile.settings?.label)),
    }))
    .filter((tile) => tile.label || tile.image);
  const auto: Tile[] = collections.slice(0, limit).map((c) => ({
    key: c.id || c.slug,
    label: c.name,
    link: collectionHref(c),
    image: c.image_url ?? "",
    alt: c.name,
    count: c.product_count,
  }));
  const tiles = str(s.source) === "manual" ? manual : auto.length > 0 ? auto : manual;

  if (tiles.length === 0) {
    return insideEditor ? (
      <section className="lib-section lib-empty">
        <LibStyle id="lib-base" css={BASE_CSS} />
        <p className="lib-muted">
          {localized(
            locale,
            "No collections to show yet. Add collections to your store, or tiles here.",
            "مفيش تصنيفات تتعرض لسه. ضيف تصنيفات لمتجرك أو مربعات من هنا.",
          )}
        </p>
      </section>
    ) : null;
  }

  const title = str(s.title) || localized(locale, "Shop by category", "تسوّق حسب التصنيف");
  // Schema defaults aren't applied to unsaved settings: undefined means "never
  // set" (show the default link); an empty string means the merchant cleared it.
  const viewAll = s.view_all_link === undefined ? "/collections" : str(s.view_all_link);
  const aspect = ASPECTS.includes(str(s.aspect)) ? str(s.aspect) : "portrait";
  const overlay = str(s.label_position) === "overlay";
  const columns = clampInt(s.columns_desktop, 2, 6, 4);
  const style = STYLES.includes(str(s.style)) ? str(s.style) : "tiles";
  const showCounts = s.show_counts !== false;
  // A "0 items" pill on a collection the API did not count is worse than none.
  const countLabel = (tile: Tile) =>
    showCounts && tile.count && tile.count > 0 ? localized(locale, `${tile.count} items`, `${tile.count} منتج`) : "";

  return (
    <section className={`lib-section lib-tiles is-${style} is-${aspect}${overlay && style === "tiles" ? " is-overlay" : ""}`}>
      <LibStyle id="lib-base" css={BASE_CSS} />
      <LibStyle id="lib-collection-tiles" css={CSS} />
      <div className="lib-container">
        <div className="lib-tiles-head">
          <h2 className="lib-heading lib-tiles-title">{title}</h2>
          {viewAll && (
            <Link to={viewAll} className="lib-tiles-all">
              {localized(locale, "View all", "شوف الكل")}
            </Link>
          )}
        </div>
        <div className="lib-tiles-grid" style={{ ["--lib-tiles-cols" as string]: String(columns) }}>
          {tiles.map((tile) => (
            <Link key={tile.key} to={tile.link} className="lib-tile">
              <span className="lib-tile-media">
                {tile.image && (
                  // Decorative when the label says the same thing right beside it.
                  <img {...responsiveImg(tile.image, TILE_IMG)} alt={tile.label ? "" : tile.alt} loading="lazy" decoding="async" />
                )}
              </span>
              {style === "card" ? (
                <span className="lib-tile-card">
                  {countLabel(tile) && <span className="lib-tile-count">{countLabel(tile)}</span>}
                  {tile.label && <span className="lib-tile-label">{tile.label}</span>}
                  {/* Not a nested link: the whole tile already is one. */}
                  <span className="lib-tile-more">{localized(locale, "Shop now", "اتسوّق")}</span>
                </span>
              ) : (
                <>
                  {tile.label && <span className="lib-tile-label">{tile.label}</span>}
                  {countLabel(tile) && <span className="lib-tile-sub">{countLabel(tile)}</span>}
                </>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
