"use client";

/**
 * lib-product-rail — "Products": newest, a collection, a tag, or a hand-picked
 * list, as a scrolling rail or a grid of `LibProductCard`s.
 *
 * Data comes from `page.data.products` (server-rendered) or, on pages that
 * don't pre-fetch products, from `/api/products` after mount, with skeleton
 * cards holding the space meanwhile. Filtering is client-side, on the shapes
 * the storefront actually sends:
 *   - newest:       sorted by `created_at`, newest first. The unfiltered API
 *                   list is created_at ASCENDING (`_apply_sort` default), so
 *                   "as returned" would show the oldest products.
 *   - collection:   the hub's collection picker stores the category id; list
 *                   products carry `category_id`. Exact match only: a parent
 *                   category's child-category products are not included.
 *   - tag:          `tags` contains the tag, case-insensitive.
 *   - product_list: the picker stores product ids (slugs also match), in the
 *                   merchant's order; ids no longer in the list are skipped.
 */

import { useRef } from "react";

import { LibProductCard } from "../../commerce/LibProductCard";
import { Link } from "../../components/Link";
import { useLocale } from "../../hooks/useLocalization";
import { usePage } from "../../hooks/usePage";
import { useProducts } from "../../hooks/useProducts";
import { useResolvedSettings } from "../../hooks/useResolvedSettings";
import type { Product } from "../../types/entities";
import { InlineText, useInsideEditor } from "../InlineText";
import { BASE_CSS, LibStyle, localized, str } from "../_shared";
import type { LibrarySectionProps } from "../index";

const SOURCES = ["newest", "collection", "tag", "product_list"];
const STYLES = ["rail", "grid"];
const RATIOS: Record<string, string> = { "3-4": "3/4", "1-1": "1/1", "4-5": "4/5" };

const CSS = `
.lib-rail{padding-block:3rem}
.lib-rail-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:1rem;margin-block-end:1.5rem}
.lib-rail-title{font-size:clamp(1.5rem,3vw,2.25rem)}
.lib-rail-sub{margin:.5rem 0 0}
.lib-rail-tools{display:flex;align-items:center;gap:.5rem}
.lib-rail-all{margin-inline-end:.5rem;color:inherit;font-size:.875rem;text-decoration:underline;text-underline-offset:3px}
.lib-rail-btn{display:inline-flex;align-items:center;justify-content:center;inline-size:2.5rem;block-size:2.5rem;padding:0;border:1px solid color-mix(in srgb,currentColor 25%,transparent);border-radius:999px;background:transparent;color:inherit;cursor:pointer}
.lib-rail-btn:hover{background:color-mix(in srgb,currentColor 8%,transparent)}
.lib-rail-btn:focus-visible{outline:2px solid currentColor;outline-offset:2px}
[dir="rtl"] .lib-rail-btn svg{transform:scaleX(-1)}
.lib-rail-track{--lib-rail-n:var(--lib-rail-cols-m,2);display:grid;gap:1rem}
@media (min-width:768px){.lib-rail-track{--lib-rail-n:var(--lib-rail-cols,4)}}
.lib-rail.is-grid .lib-rail-track{grid-template-columns:repeat(var(--lib-rail-n),minmax(0,1fr))}
.lib-rail.is-rail .lib-rail-track{grid-auto-flow:column;grid-auto-columns:calc((100% - (var(--lib-rail-n) - 1) * 1rem) / var(--lib-rail-n));overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;scrollbar-width:none}
.lib-rail.is-rail .lib-rail-track::-webkit-scrollbar{display:none}
.lib-rail.is-rail .lib-rail-track>*{scroll-snap-align:start}
.lib-rail-ghost{display:flex;flex-direction:column;gap:.5rem}
.lib-rail-ghost-media{display:block;aspect-ratio:var(--lib-card-ratio,3/4);background:color-mix(in srgb,currentColor 8%,transparent)}
.lib-rail-ghost-line{display:block;block-size:.9rem;inline-size:70%;background:color-mix(in srgb,currentColor 8%,transparent)}
.lib-rail-ghost-line.is-short{inline-size:40%}
@media (prefers-reduced-motion:no-preference){.lib-rail-ghost{animation:lib-rail-pulse 1.4s ease-in-out infinite}}
@keyframes lib-rail-pulse{50%{opacity:.5}}
`;

type ListedProduct = Product & { category_id?: string | null; created_at?: string };

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.min(max, Math.max(min, n));
}

function Chevron({ back }: { back?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d={back ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
    </svg>
  );
}

export default function ProductRail({ instance, sectionId }: LibrarySectionProps) {
  const locale = useLocale();
  const s = useResolvedSettings(instance);
  const insideEditor = useInsideEditor();
  const trackRef = useRef<HTMLDivElement>(null);
  const page = usePage();
  const { products: fetched, loading } = useProducts({ limit: 100, fetchIfMissing: true });
  // The home page pre-fetches up to 300 products, oldest first; useProducts'
  // `limit` would keep only the oldest 100 before "newest" could sort them.
  const pageProducts = page?.data?.products;
  const pool = (Array.isArray(pageProducts) ? pageProducts : fetched) as ListedProduct[];

  // ponytail: filters run over at most the first 100 products of the client
  // fetch (API max page), and over whatever the page pre-fetched (a collection
  // page holds only that collection). Catalogs over 100 products can show an
  // incomplete collection/tag/newest rail until the host proxy forwards
  // category_id / tag / sort to the API.
  const source = SOURCES.includes(str(s.source)) ? str(s.source) : "newest";
  let picked: ListedProduct[];
  if (source === "collection") {
    const id = str(s.collection);
    picked = id ? pool.filter((p) => p.category_id === id || p.category === id) : [];
  } else if (source === "tag") {
    const tag = str(s.tag).trim().toLowerCase();
    picked = tag ? pool.filter((p) => (p.tags ?? []).some((t) => typeof t === "string" && t.toLowerCase() === tag)) : [];
  } else if (source === "product_list") {
    const keys = Array.isArray(s.product_list) ? [...new Set(s.product_list.filter((k): k is string => typeof k === "string"))] : [];
    picked = keys.map((k) => pool.find((p) => p.id === k || p.slug === k)).filter((p): p is ListedProduct => !!p);
  } else {
    picked = pool.some((p) => p.created_at)
      ? [...pool].sort((a, b) => str(b.created_at).localeCompare(str(a.created_at)))
      : pool;
  }

  const limit = clampInt(s.limit, 2, 24, 8);
  const items = picked.slice(0, limit);
  const waiting = loading && pool.length === 0;

  if (!waiting && items.length === 0) {
    return insideEditor ? (
      <section className="lib-section lib-empty">
        <LibStyle id="lib-base" css={BASE_CSS} />
        <p className="lib-muted">
          {localized(
            locale,
            "No products to show yet. Pick a source that has products, or add products to your store.",
            "مفيش منتجات تتعرض هنا لسه. اختار مصدر فيه منتجات، أو ضيف منتجات لمتجرك.",
          )}
        </p>
      </section>
    ) : null;
  }

  const style = STYLES.includes(str(s.style)) ? str(s.style) : "rail";
  const colsDesktop = clampInt(s.columns_desktop, 2, 6, 4);
  const colsMobile = clampInt(s.columns_mobile, 1, 2, 2);
  const ratio = RATIOS[str(s.image_ratio)] ?? "3/4";
  const heading =
    str(s.heading) ||
    (source === "newest" ? localized(locale, "New arrivals", "وصل جديد") : localized(locale, "Featured products", "اخترنالك"));
  const subheading = str(s.subheading);
  // Unsaved (undefined) shows the default link; an empty string hides it.
  const viewAll = s.view_all_link === undefined ? "/products" : str(s.view_all_link);
  const sizes = `(min-width: 768px) ${Math.round(100 / colsDesktop)}vw, ${Math.round(100 / colsMobile)}vw`;

  const scroll = (step: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const computed = getComputedStyle(track);
    const card = track.firstElementChild as HTMLElement | null;
    const distance = (card?.offsetWidth ?? track.clientWidth) + (parseFloat(computed.columnGap) || 0);
    // RTL scrolls toward negative scrollLeft, so "next" is a negative offset.
    const rtl = computed.direction === "rtl";
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({ left: distance * step * (rtl ? -1 : 1), behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <section
      className={`lib-section lib-rail is-${style}`}
      style={{
        ["--lib-rail-cols" as string]: String(colsDesktop),
        ["--lib-rail-cols-m" as string]: String(colsMobile),
        ["--lib-card-ratio" as string]: ratio,
      }}
    >
      <LibStyle id="lib-base" css={BASE_CSS} />
      <LibStyle id="lib-product-rail" css={CSS} />
      <div className="lib-container">
        <div className="lib-rail-head">
          <div>
            <h2 className="lib-heading lib-rail-title">
              <InlineText sectionId={sectionId} settingKey="heading" value={heading} />
            </h2>
            {subheading && <p className="lib-muted lib-rail-sub">{subheading}</p>}
          </div>
          <div className="lib-rail-tools">
            {viewAll && (
              <Link to={viewAll} className="lib-rail-all">
                {str(s.view_all_label) || localized(locale, "View all", "شوف الكل")}
              </Link>
            )}
            {style === "rail" && (
              <>
                <button type="button" className="lib-rail-btn" aria-label={localized(locale, "Previous products", "المنتجات اللي قبل")} onClick={() => scroll(-1)}>
                  <Chevron back />
                </button>
                <button type="button" className="lib-rail-btn" aria-label={localized(locale, "Next products", "المنتجات اللي بعد")} onClick={() => scroll(1)}>
                  <Chevron />
                </button>
              </>
            )}
          </div>
        </div>
        <div ref={trackRef} className="lib-rail-track" aria-busy={waiting || undefined}>
          {waiting
            ? Array.from({ length: limit }, (_, i) => (
                <div key={i} className="lib-rail-ghost" aria-hidden="true">
                  <span className="lib-rail-ghost-media" />
                  <span className="lib-rail-ghost-line" />
                  <span className="lib-rail-ghost-line is-short" />
                </div>
              ))
            : items.map((product) => (
                <LibProductCard
                  key={product.id}
                  product={product}
                  showQuickAdd={s.show_quick_add !== false}
                  showDiscountBadge={s.show_discount_badge !== false}
                  imageSizes={sizes}
                />
              ))}
        </div>
      </div>
    </section>
  );
}
