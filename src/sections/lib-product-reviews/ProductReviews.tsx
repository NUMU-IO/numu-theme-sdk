"use client";

/**
 * lib-product-reviews — the Reviews app's reviews of the current product:
 * the average, the spread of stars, then the reviews with the buyers'
 * photos and the store's replies.
 *
 * Renders nothing unless the store has the Reviews app (`useHasApp`), and
 * nothing on a page without a product. One request, to the host's
 * same-origin `/api/apps/reviews/products/<id>`, made only once the section
 * nears the screen, so a product page loads no review data up front; a
 * fixed-height placeholder holds the space meanwhile. A failed request hides
 * the section. In the editor it shows a note instead.
 *
 * Colours are the theme's (`currentColor`). Stars run in the reading
 * direction and a part star fills from the start side, so 4.5 reads right in
 * Arabic; the glyph itself is symmetric.
 */

import { useEffect, useRef, useState } from "react";

import { useHasApp } from "../../hooks/useInstalledApp";
import { useLocale } from "../../hooks/useLocalization";
import { useProductOptional } from "../../hooks/useProduct";
import { useResolvedSettings } from "../../hooks/useResolvedSettings";
import { InlineText, useInsideEditor } from "../InlineText";
import { BASE_CSS, LibStyle, localized, str } from "../_shared";
import type { LibrarySectionProps } from "../index";

const BASE = "/api/apps/reviews/products";

interface Review {
  id: string;
  name: string;
  rating: number;
  title: string | null;
  body: string | null;
  verified: boolean;
  photos: { url: string; thumb_url: string }[];
  reply: { body: string; at: string | null } | null;
  created_at: string | null;
}

interface Page {
  summary: { average: number; count: number; distribution: Record<string, number> };
  reviews: Review[];
  page: number;
  has_more: boolean;
}

const CSS = `
.lib-prv{padding-block:3rem}
.lib-prv-title{font-size:clamp(1.5rem,3vw,2rem);margin:0 0 1.5rem}
.lib-prv-head{display:flex;flex-wrap:wrap;gap:2rem;align-items:center;margin-block-end:2rem}
.lib-prv-avg{font-size:2.5rem;font-weight:600;line-height:1}
.lib-prv-stars{display:inline-flex;gap:.1rem;line-height:1}
.lib-prv-star{position:relative;display:inline-block;color:color-mix(in srgb,currentColor 25%,transparent)}
.lib-prv-star>span{position:absolute;inset-block:0;inset-inline-start:0;overflow:hidden;color:currentColor}
.lib-prv-dist{display:grid;gap:.25rem;min-inline-size:12rem;font-size:.8rem}
.lib-prv-bar{display:grid;grid-template-columns:2rem 1fr 2.5rem;gap:.5rem;align-items:center}
.lib-prv-track{block-size:.4rem;background:color-mix(in srgb,currentColor 12%,transparent)}
.lib-prv-fill{display:block;block-size:100%;background:currentColor}
.lib-prv-list{display:grid;gap:1.5rem;margin:0;padding:0;list-style:none}
.lib-prv-item{display:grid;gap:.5rem;padding-block-end:1.5rem;border-block-end:1px solid color-mix(in srgb,currentColor 12%,transparent)}
.lib-prv-by{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;font-size:.875rem}
.lib-prv-name{font-weight:600}
.lib-prv-badge{font-size:.75rem;opacity:.7}
.lib-prv-text{margin:0;line-height:1.6;white-space:pre-line}
.lib-prv-photos{display:flex;flex-wrap:wrap;gap:.5rem}
.lib-prv-photos img{inline-size:5rem;block-size:5rem;object-fit:cover;border-radius:.25rem}
.lib-prv-reply{margin:0;padding-inline-start:1rem;border-inline-start:2px solid color-mix(in srgb,currentColor 25%,transparent);font-size:.9rem}
.lib-prv-more{min-block-size:2.75rem;padding:.5rem 1.25rem;border:1px solid currentColor;border-radius:999px;background:transparent;color:inherit;cursor:pointer}
.lib-prv-ghost{min-block-size:16rem;background:color-mix(in srgb,currentColor 5%,transparent)}
`;

/** Five stars filled to `value` (halves and tenths too), from the reading start. */
function Stars({ value, label }: { value: number; label: string }) {
  return (
    <span className="lib-prv-stars" role="img" aria-label={label}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="lib-prv-star" aria-hidden="true">
          ★<span style={{ inlineSize: `${Math.max(0, Math.min(1, value - i)) * 100}%` }}>★</span>
        </span>
      ))}
    </span>
  );
}

function number(locale: string, n: number, digits = 0): string {
  return n.toLocaleString(localized(locale, "en", "ar-EG"), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export default function ProductReviews({ instance, sectionId }: LibrarySectionProps) {
  const locale = useLocale();
  const s = useResolvedSettings(instance);
  const insideEditor = useInsideEditor();
  const installed = useHasApp("reviews");
  const product = useProductOptional();
  const ref = useRef<HTMLElement>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [failed, setFailed] = useState(false);
  const [wanted, setWanted] = useState(0);
  const productId = product?.id;
  const title = str(s.title) || localized(locale, "Customer reviews", "آراء العملاء");

  // Ask for page 1 when the section nears the screen.
  useEffect(() => {
    if (!installed || !productId || insideEditor || wanted) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setWanted(1);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setWanted(1);
          io.disconnect();
        }
      },
      { rootMargin: "400px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [installed, productId, insideEditor, wanted]);

  useEffect(() => {
    if (!wanted || !productId || pages.length >= wanted) return;
    let live = true;
    const path = wanted === 1 ? `${BASE}/${productId}` : `${BASE}/${productId}/${wanted}`;
    fetch(path, { headers: { Accept: "application/json" } })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((page: Page) => live && setPages((prev) => [...prev, page]))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [wanted, productId, pages.length]);

  if (insideEditor) {
    return (
      <section className="lib-section">
        <LibStyle id="lib-base" css={BASE_CSS} />
        <p className="lib-empty">
          {installed
            ? localized(
                locale,
                "The product's reviews show here, from the Reviews app.",
                "تقييمات المنتج هتظهر هنا، من تطبيق آراء العملاء.",
              )
            : localized(
                locale,
                "Install the Reviews app to show your customers' reviews here.",
                "نزّل تطبيق آراء العملاء علشان تقييمات عملائك تظهر هنا.",
              )}
        </p>
      </section>
    );
  }
  if (!installed || !productId || failed) return null;

  const first = pages[0];
  if (first && first.summary.count === 0) return null;
  const reviews = pages.flatMap((p) => p.reviews);
  const last = pages[pages.length - 1];

  return (
    <section ref={ref} className="lib-section lib-prv">
      <LibStyle id="lib-base" css={BASE_CSS} />
      <LibStyle id="lib-product-reviews" css={CSS} />
      <div className="lib-container">
        <h2 className="lib-heading lib-prv-title">
          <InlineText sectionId={sectionId} settingKey="title" value={title} />
        </h2>
        {!first ? (
          <div className="lib-prv-ghost" aria-hidden="true" />
        ) : (
          <>
            <div className="lib-prv-head">
              <div>
                <div className="lib-prv-avg">
                  <bdi dir="ltr">{number(locale, first.summary.average, 1)}</bdi>
                </div>
                <Stars
                  value={first.summary.average}
                  label={localized(
                    locale,
                    `Rated ${first.summary.average} out of 5`,
                    `التقييم ${number(locale, first.summary.average, 1)} من ٥`,
                  )}
                />
                <div className="lib-muted">
                  {localized(locale, "Based on ", "من ")}
                  <bdi dir="ltr">{number(locale, first.summary.count)}</bdi>
                  {localized(locale, " reviews", " تقييم")}
                </div>
              </div>
              <div className="lib-prv-dist">
                {[5, 4, 3, 2, 1].map((star) => {
                  const n = first.summary.distribution[String(star)] ?? 0;
                  return (
                    <div key={star} className="lib-prv-bar">
                      <bdi dir="ltr">{number(locale, star)} ★</bdi>
                      <span className="lib-prv-track">
                        <span
                          className="lib-prv-fill"
                          style={{ inlineSize: `${(n / first.summary.count) * 100}%` }}
                        />
                      </span>
                      <bdi dir="ltr">{number(locale, n)}</bdi>
                    </div>
                  );
                })}
              </div>
            </div>
            <ul className="lib-prv-list">
              {reviews.map((r) => (
                <li key={r.id} className="lib-prv-item">
                  <Stars
                    value={r.rating}
                    label={localized(locale, `${r.rating} out of 5 stars`, `${number(locale, r.rating)} من ٥ نجوم`)}
                  />
                  <div className="lib-prv-by">
                    <span className="lib-prv-name">{r.name}</span>
                    {r.verified && (
                      <span className="lib-prv-badge">{localized(locale, "✓ Verified buyer", "✓ اشترى المنتج")}</span>
                    )}
                    {r.created_at && (
                      <span className="lib-muted">
                        <bdi dir="ltr">
                          {new Date(r.created_at).toLocaleDateString(localized(locale, "en", "ar-EG"))}
                        </bdi>
                      </span>
                    )}
                  </div>
                  {r.title && <strong>{r.title}</strong>}
                  {r.body && <p className="lib-prv-text">{r.body}</p>}
                  {r.photos.length > 0 && (
                    <div className="lib-prv-photos">
                      {r.photos.map((p) => (
                        <a key={p.url} href={p.url} target="_blank" rel="noreferrer">
                          <img
                            src={p.thumb_url}
                            alt={localized(locale, `Photo from ${r.name}'s review`, `صورة من تقييم ${r.name}`)}
                            loading="lazy"
                            width={80}
                            height={80}
                          />
                        </a>
                      ))}
                    </div>
                  )}
                  {r.reply && (
                    <p className="lib-prv-reply">
                      <strong>{localized(locale, "The store replied: ", "رد المتجر: ")}</strong>
                      {r.reply.body}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            {last?.has_more && (
              <p>
                <button
                  type="button"
                  className="lib-prv-more"
                  disabled={wanted > pages.length}
                  onClick={() => setWanted(pages.length + 1)}
                >
                  {localized(locale, "More reviews", "تقييمات أكتر")}
                </button>
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
