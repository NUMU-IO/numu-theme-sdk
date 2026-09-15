"use client";

/**
 * lib-materials-care — what a product is made of and how to look after it.
 *
 * Built from Skeuomorphic's `skeu-materials`, without its wax-seal stamp and
 * motion. Rows are `row` blocks (term + description) in a real `<dl>`; the
 * guarantee is a highlighted note under them. `style`: `list` stacks the rows
 * as hairline pairs, `columns` lays them out as a two-column grid of cards.
 */

import { useLocale } from "../../hooks/useLocalization";
import { useResolvedSettings } from "../../hooks/useResolvedSettings";
import { useInsideEditor } from "../InlineText";
import { BASE_CSS, LibStyle, localized, readBlocks, str, type RawBlock } from "../_shared";
import type { LibrarySectionProps } from "../index";

const CSS = `
.lib-mc{padding-block:3rem}
.lib-mc-body{max-inline-size:56rem}
.lib-mc-heading{font-size:clamp(1.5rem,3vw,2.25rem);margin-block-end:1.75rem}
.lib-mc-list{margin:0}
.lib-mc-row dt{font-weight:600}
.lib-mc-row dd{margin:0;line-height:1.7;opacity:.85;white-space:pre-line}
.lib-mc.is-list .lib-mc-row{display:grid;gap:.25rem 2rem;padding-block:1rem;border-block-end:1px solid color-mix(in srgb,currentColor 15%,transparent)}
@media (min-width:768px){.lib-mc.is-list .lib-mc-row{grid-template-columns:12rem 1fr}}
.lib-mc.is-columns .lib-mc-list{display:grid;gap:1rem}
@media (min-width:768px){.lib-mc.is-columns .lib-mc-list{grid-template-columns:repeat(2,minmax(0,1fr))}}
.lib-mc.is-columns .lib-mc-row{display:flex;flex-direction:column;gap:.5rem;padding:1.25rem;border:1px solid color-mix(in srgb,currentColor 15%,transparent)}
.lib-mc-guarantee{margin:1.75rem 0 0;padding:1rem 1.25rem;border-inline-start:3px solid var(--theme-color-accent,currentColor);background:color-mix(in srgb,var(--theme-color-accent,currentColor) 10%,transparent);font-weight:500;line-height:1.7;white-space:pre-line}
`;

export default function MaterialsCare({ instance }: LibrarySectionProps) {
  const locale = useLocale();
  const s = useResolvedSettings(instance);
  const insideEditor = useInsideEditor();

  const rows = readBlocks(instance as RawBlock, "row")
    .map((row, i) => ({ key: `r-${i}`, term: str(row.settings?.term), description: str(row.settings?.description) }))
    .filter((row) => row.term || row.description);
  const guarantee = str(s.guarantee_text);

  if (rows.length === 0 && !guarantee) {
    return insideEditor ? (
      <section className="lib-section lib-empty">
        <LibStyle id="lib-base" css={BASE_CSS} />
        <p className="lib-muted">
          {localized(
            locale,
            "Add rows about materials and care, or a guarantee note.",
            "ضيف صفوف عن الخامات والعناية، أو ملحوظة الضمان.",
          )}
        </p>
      </section>
    ) : null;
  }

  const style = str(s.style) === "columns" ? "columns" : "list";

  return (
    <section className={`lib-section lib-mc is-${style}`}>
      <LibStyle id="lib-base" css={BASE_CSS} />
      <LibStyle id="lib-materials-care" css={CSS} />
      <div className="lib-container lib-mc-body">
        <h2 className="lib-heading lib-mc-heading">
          {str(s.heading) || localized(locale, "Materials & care", "الخامات والعناية")}
        </h2>
        {rows.length > 0 && (
          <dl className="lib-mc-list">
            {rows.map((row) => (
              <div key={row.key} className="lib-mc-row">
                <dt>{row.term}</dt>
                <dd>{row.description}</dd>
              </div>
            ))}
          </dl>
        )}
        {guarantee && <p className="lib-mc-guarantee">{guarantee}</p>}
      </div>
    </section>
  );
}
