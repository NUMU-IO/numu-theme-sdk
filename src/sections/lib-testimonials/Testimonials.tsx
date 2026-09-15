"use client";

/**
 * lib-testimonials — customer reviews, in two looks.
 *
 * - `quotes` (default): Editorial's magazine pull-quotes — large quotation
 *   marks in the heading face, a thin accent rule and a quiet attribution,
 *   alternating between the start and end sides.
 * - `cards`: the card grid eleven themes shipped (boutique, modern, kick-game,
 *   tech-wave, …) — a star rating, the review and the name/city in a bordered
 *   card. Same `review_N_*` settings those themes use, so content carries over.
 *
 * On the storefront it renders nothing until a review has both a name and a
 * text. In the editor it shows three sample reviews so the layout is visible.
 */

import { useLocale } from "../../hooks/useLocalization";
import { useResolvedSettings } from "../../hooks/useResolvedSettings";
import { InlineText, useInsideEditor } from "../InlineText";
import { BASE_CSS, LibStyle, localized, str } from "../_shared";
import type { LibrarySectionProps } from "../index";

interface Review {
  n: number;
  name: string;
  city: string;
  text: string;
  rating: number;
}

const SAMPLES: Record<"en" | "ar", Review[]> = {
  en: [
    { n: 1, name: "Farida El-Sherbiny", city: "Cairo", text: "It arrived in two days and looks straight off a magazine page.", rating: 5 },
    { n: 2, name: "Omar Khaled", city: "Alexandria", text: "Sharp cuts, honest fabric. This is my third order this season.", rating: 5 },
    { n: 3, name: "Nour Abdelaziz", city: "Giza", text: "Every piece photographs beautifully. Everyone asks where it's from.", rating: 4 },
  ],
  ar: [
    { n: 1, name: "فريدة الشربيني", city: "القاهرة", text: "الطلبية وصلت في يومين، وشكلها كأنها طالعة من مجلة.", rating: 5 },
    { n: 2, name: "عمر خالد", city: "الإسكندرية", text: "قصّات حلوة وخامة محترمة. دي تالت مرة أطلب الموسم ده.", rating: 5 },
    { n: 3, name: "نور عبد العزيز", city: "الجيزة", text: "كل قطعة بتطلع حلوة في الصور، وكل اللي يشوفها يسأل جبتها منين.", rating: 4 },
  ],
};

const CSS = `
.lib-quotes{padding-block:4rem}
@media (min-width:768px){.lib-quotes{padding-block:6rem}}
.lib-quotes-title{text-align:center;margin:0 0 3rem}
.lib-quotes-list{max-inline-size:56rem;margin-inline:auto;display:flex;flex-direction:column;gap:3.5rem}
@media (min-width:768px){.lib-quotes-list{gap:5rem}}
.lib-quote{margin:0;max-inline-size:34ch}
.lib-quote.is-end{margin-inline-start:auto;text-align:end}
.lib-quote-rule{display:block;inline-size:4rem;block-size:1px;margin-block-end:1.25rem;background:var(--theme-color-accent,currentColor)}
.lib-quote.is-end .lib-quote-rule{margin-inline-start:auto}
.lib-quote-text{margin:0;font-family:var(--theme-font-heading,inherit);font-size:clamp(1.5rem,3vw,2.25rem);line-height:1.25}
.lib-quote-by{margin-block-start:1rem;display:flex;align-items:baseline;gap:.5rem;font-size:.7rem;font-weight:500;letter-spacing:.18em;text-transform:uppercase}
.lib-quote.is-end .lib-quote-by{justify-content:flex-end}
.lib-quote-by>span+span{opacity:.6}
:lang(ar) .lib-quote-by,[dir="rtl"] .lib-quote-by{letter-spacing:normal;text-transform:none;font-size:.85rem}
.lib-quotes.is-cards .lib-quotes-title{font-size:clamp(1.5rem,3vw,2.25rem);letter-spacing:normal;text-transform:none;opacity:1;font-family:var(--theme-font-heading,inherit)}
.lib-rev-grid{display:grid;gap:1rem;grid-template-columns:1fr}
@media (min-width:768px){.lib-rev-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:1.5rem}}
.lib-rev{margin:0;display:flex;flex-direction:column;gap:1rem;padding:1.5rem;border:1px solid color-mix(in srgb,currentColor 14%,transparent);border-radius:.5rem}
.lib-rev-stars{display:flex;gap:.15rem;color:var(--theme-color-accent,currentColor);font-size:1rem;line-height:1}
.lib-rev-star.is-off{opacity:.25}
.lib-rev-text{margin:0;line-height:1.6;flex:1}
.lib-rev-by{display:flex;flex-direction:column;gap:.15rem;font-size:.875rem}
.lib-rev-name{font-weight:600}
.lib-rev-city{opacity:.6}
`;

function Stars({ rating, locale }: { rating: number; locale: string }) {
  return (
    <div
      className="lib-rev-stars"
      role="img"
      aria-label={localized(locale, `${rating} out of 5 stars`, `${rating} من 5 نجوم`)}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= rating ? "lib-rev-star" : "lib-rev-star is-off"} aria-hidden="true">
          ★
        </span>
      ))}
    </div>
  );
}

export default function Testimonials({ instance, sectionId }: LibrarySectionProps) {
  const locale = useLocale();
  const s = useResolvedSettings(instance);
  const insideEditor = useInsideEditor();
  const isAr = localized(locale, "en", "ar") === "ar";
  const cards = str(s.style) === "cards";
  const title = str(s.title) || localized(locale, "What customers say", "آراء عملائنا");

  let reviews: Review[] = [];
  for (let i = 1; i <= 3; i++) {
    const name = str(s[`review_${i}_name`]);
    const text = str(s[`review_${i}_text`]);
    const raw = s[`review_${i}_rating`];
    // 0 or unset means "no stars shown" for that review.
    const rating = typeof raw === "number" && Number.isFinite(raw) ? Math.min(5, Math.max(0, Math.round(raw))) : 0;
    if (name && text) reviews.push({ n: i, name, text, city: str(s[`review_${i}_city`]), rating });
  }
  if (reviews.length === 0 && insideEditor) reviews = SAMPLES[isAr ? "ar" : "en"];
  if (reviews.length === 0) return null;

  const open = isAr ? "«" : "“";
  const close = isAr ? "»" : "”";

  return (
    <section className={cards ? "lib-section lib-quotes is-cards" : "lib-section lib-quotes"}>
      <LibStyle id="lib-base" css={BASE_CSS} />
      <LibStyle id="lib-testimonials" css={CSS} />
      <div className="lib-container">
        <h2 className="lib-eyebrow lib-quotes-title">
          <InlineText sectionId={sectionId} settingKey="title" value={title} />
        </h2>
        {cards ? (
          <div className="lib-rev-grid">
            {reviews.map((review) => (
              <figure key={review.n} className="lib-rev">
                {review.rating > 0 && <Stars rating={review.rating} locale={locale} />}
                <blockquote className="lib-rev-text">
                  <InlineText sectionId={sectionId} settingKey={`review_${review.n}_text`} value={review.text} multiline />
                </blockquote>
                <figcaption className="lib-rev-by">
                  <span className="lib-rev-name">
                    <InlineText sectionId={sectionId} settingKey={`review_${review.n}_name`} value={review.name} />
                  </span>
                  {review.city && (
                    <span className="lib-rev-city">
                      <InlineText sectionId={sectionId} settingKey={`review_${review.n}_city`} value={review.city} />
                    </span>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <div className="lib-quotes-list">
            {reviews.map((review, i) => (
              <blockquote key={review.n} className={i % 2 === 1 ? "lib-quote is-end" : "lib-quote"}>
                <span className="lib-quote-rule" aria-hidden="true" />
                <p className="lib-quote-text">
                  <span aria-hidden="true">{open}</span>
                  <InlineText sectionId={sectionId} settingKey={`review_${review.n}_text`} value={review.text} multiline />
                  <span aria-hidden="true">{close}</span>
                </p>
                <footer className="lib-quote-by">
                  <span>
                    <InlineText sectionId={sectionId} settingKey={`review_${review.n}_name`} value={review.name} />
                  </span>
                  {review.city && (
                    <span>
                      <InlineText sectionId={sectionId} settingKey={`review_${review.n}_city`} value={review.city} />
                    </span>
                  )}
                </footer>
              </blockquote>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
