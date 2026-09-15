"use client";

/**
 * lib-size-guide — a size chart, measuring tips, fit cards and a WhatsApp ask.
 *
 * One section for Teen's `tn-size-guide`, Genova's `gn-fit-guide`, Rabbitsocks'
 * `rs-fit-guide` and Empire's `size_chart`. The chart is a real `<table>`:
 * `chart_columns` names the columns after the size column and each `row` block
 * carries comma-separated values aligned to them. Missing values render empty
 * cells; extra values are dropped, so a typo never shifts a column.
 *
 * Values show in the unit the merchant picked — no conversion, because the
 * numbers are typed in that unit. The unit sits once in each column header.
 *
 * `style`: `table` shows the chart, then measuring tips, then any fits;
 * `fits` leads with the fit cards, then the chart and tips.
 */

import { Link } from "../../components/Link";
import { useLocale } from "../../hooks/useLocalization";
import { useResolvedSettings } from "../../hooks/useResolvedSettings";
import { applyImageTransform, asImageTransform } from "../../utils/imageTransform";
import { whatsappHref } from "../../utils/routes";
import { useInsideEditor } from "../InlineText";
import { BASE_CSS, LibStyle, imageAlt, imageUrl, localized, readBlocks, responsiveImg, str, type RawBlock } from "../_shared";
import type { LibrarySectionProps } from "../index";

const FIT_IMG = { widths: [384, 640, 768], sizes: "(min-width: 768px) 33vw, 100vw" } as const;

const CSS = `
.lib-sg{padding-block:3rem}
.lib-sg-body{display:flex;flex-direction:column;gap:2rem}
.lib-sg-heading{font-size:clamp(1.5rem,3vw,2.25rem)}
.lib-sg-intro{margin:.75rem 0 0;max-inline-size:60ch;line-height:1.7;opacity:.8;white-space:pre-line}
.lib-sg-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.lib-sg-scroll:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.lib-sg-table{inline-size:100%;min-inline-size:28rem;border-collapse:collapse;font-size:.9375rem}
.lib-sg-table caption{caption-side:top;text-align:start;padding-block-end:.75rem;font-weight:500}
.lib-sg-table th,.lib-sg-table td{padding:.75rem 1rem;text-align:start;white-space:nowrap;border-block-end:1px solid color-mix(in srgb,currentColor 15%,transparent)}
.lib-sg-table thead th{font-weight:600;background:color-mix(in srgb,currentColor 6%,transparent)}
.lib-sg-table tbody th{font-weight:600}
.lib-sg-table td[dir="ltr"]{font-variant-numeric:tabular-nums}
.lib-sg-note{margin:0;font-size:.875rem;opacity:.75}
.lib-sg-sub{margin:0 0 1rem;font-family:var(--theme-font-heading,inherit);font-size:1.25rem;font-weight:500}
.lib-sg-measures{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr))}
.lib-sg-measure{padding:1.25rem;border:1px solid color-mix(in srgb,currentColor 15%,transparent)}
.lib-sg-measure h4{margin:0 0 .5rem;font-size:1rem;font-weight:600}
.lib-sg-measure p{margin:0;line-height:1.7;opacity:.85;white-space:pre-line}
.lib-sg-fits{display:grid;gap:1.5rem;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))}
.lib-sg-fit{display:flex;flex-direction:column;gap:.75rem}
.lib-sg-fit-media{position:relative;overflow:hidden;aspect-ratio:3/4;background:color-mix(in srgb,currentColor 8%,transparent)}
.lib-sg-fit-media img{position:absolute;inset:0;inline-size:100%;block-size:100%;object-fit:cover}
.lib-sg-fit h3{margin:0;font-family:var(--theme-font-heading,inherit);font-size:1.125rem;font-weight:500}
.lib-sg-fit p{margin:0;line-height:1.6;opacity:.8;white-space:pre-line}
.lib-sg-fit a{align-self:flex-start;color:inherit;font-size:.875rem;text-decoration:underline;text-underline-offset:3px}
.lib-sg-wa{display:inline-flex;align-items:center;gap:.5rem;align-self:flex-start;padding:.75rem 1.5rem;border:1px solid currentColor;color:inherit;text-decoration:none;font-size:.875rem;font-weight:500;transition:background-color .2s,color .2s}
.lib-sg-wa:hover{background:var(--theme-color-text,currentColor);color:var(--theme-color-background,#fff)}
.lib-sg-wa:focus-visible{outline:2px solid currentColor;outline-offset:3px}
@media (prefers-reduced-motion:reduce){.lib-sg-wa{transition:none}}
`;

// Arabic keyboards type «،» (U+060C), not ",": both separate.
const splitList = (v: unknown) => str(v).split(/[,،]/).map((x) => x.trim());

export default function SizeGuide({ instance }: LibrarySectionProps) {
  const locale = useLocale();
  const s = useResolvedSettings(instance);
  const insideEditor = useInsideEditor();
  const raw = instance as RawBlock;

  const columns = splitList(s.chart_columns).filter(Boolean);
  const rows = readBlocks(raw, "row")
    .map((row, i) => {
      const values = splitList(row.settings?.values);
      return {
        key: `r-${i}`,
        size: str(row.settings?.size).trim(),
        // Exactly one cell per column: short rows pad empty, extra values drop.
        cells: columns.map((_, c) => values[c] ?? ""),
      };
    })
    .filter((row) => row.size);
  const measures = readBlocks(raw, "measure")
    .map((m, i) => ({ key: `m-${i}`, title: str(m.settings?.title), text: str(m.settings?.text) }))
    .filter((m) => m.title || m.text);
  const fits = readBlocks(raw, "fit")
    .map((f, i) => ({
      key: `f-${i}`,
      name: str(f.settings?.name),
      image: imageUrl(f.settings?.image),
      framing: applyImageTransform(asImageTransform(f.settings?.image), "cover"),
      alt: imageAlt(f.settings?.image, str(f.settings?.name)),
      bestFor: str(f.settings?.best_for),
      link: str(f.settings?.link),
    }))
    .filter((f) => f.name || f.image);

  if (rows.length === 0 && measures.length === 0 && fits.length === 0) {
    return insideEditor ? (
      <section className="lib-section lib-empty">
        <LibStyle id="lib-base" css={BASE_CSS} />
        <p className="lib-muted">
          {localized(
            locale,
            "Add size rows, measuring tips or fits to build your size guide.",
            "ضيف صفوف مقاسات أو نصايح للقياس أو قصّات عشان دليل المقاسات يظهر.",
          )}
        </p>
      </section>
    ) : null;
  }

  const style = str(s.style) === "fits" ? "fits" : "table";
  const heading = str(s.heading) || localized(locale, "Size guide", "دليل المقاسات");
  const intro = str(s.intro);
  const unit = str(s.unit) === "in" ? localized(locale, "in", "بوصة") : localized(locale, "cm", "سم");
  const modelNote = str(s.model_note);
  const whatsapp = whatsappHref(str(s.whatsapp_number));

  const chart = rows.length > 0 && (
    <div key="chart">
      <div
        className="lib-sg-scroll"
        role="region"
        tabIndex={0}
        aria-label={localized(locale, "Size chart", "جدول المقاسات")}
      >
        <table className="lib-sg-table">
          <caption>{`${heading} (${unit})`}</caption>
          <thead>
            <tr>
              <th scope="col">{localized(locale, "Size", "المقاس")}</th>
              {columns.map((col, c) => (
                <th key={c} scope="col">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.size}</th>
                {row.cells.map((cell, c) => (
                  <td key={c} dir="ltr">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modelNote && <p className="lib-sg-note">{modelNote}</p>}
    </div>
  );

  const tips = measures.length > 0 && (
    <div key="tips">
      <h3 className="lib-sg-sub">{str(s.measure_heading) || localized(locale, "How to measure", "طريقة القياس")}</h3>
      <div className="lib-sg-measures">
        {measures.map((m) => (
          <div key={m.key} className="lib-sg-measure">
            {m.title && <h4>{m.title}</h4>}
            {m.text && <p>{m.text}</p>}
          </div>
        ))}
      </div>
    </div>
  );

  const fitCards = fits.length > 0 && (
    <div key="fits" className="lib-sg-fits">
      {fits.map((fit) => (
        <article key={fit.key} className="lib-sg-fit">
          {fit.image && (
            <span className="lib-sg-fit-media">
              {/* Decorative when the fit name sits right under it. */}
              <img
                {...responsiveImg(fit.image, FIT_IMG)}
                alt={fit.name ? "" : fit.alt}
                loading="lazy"
                decoding="async"
                style={fit.framing}
              />
            </span>
          )}
          {fit.name && <h3>{fit.name}</h3>}
          {fit.bestFor && <p>{fit.bestFor}</p>}
          {fit.link && <Link to={fit.link}>{localized(locale, "Shop this fit", "شوف القصّة دي")}</Link>}
        </article>
      ))}
    </div>
  );

  return (
    <section className={`lib-section lib-sg is-${style}`}>
      <LibStyle id="lib-base" css={BASE_CSS} />
      <LibStyle id="lib-size-guide" css={CSS} />
      <div className="lib-container lib-sg-body">
        <header>
          <h2 className="lib-heading lib-sg-heading">{heading}</h2>
          {intro && <p className="lib-sg-intro">{intro}</p>}
        </header>
        {style === "fits" ? [fitCards, chart, tips] : [chart, tips, fitCards]}
        {whatsapp && (
          <a className="lib-sg-wa" href={whatsapp} target="_blank" rel="noopener noreferrer">
            {str(s.whatsapp_text) || localized(locale, "Ask us about your size on WhatsApp", "اسألنا على واتساب عن المقاس")}
          </a>
        )}
      </div>
    </section>
  );
}
