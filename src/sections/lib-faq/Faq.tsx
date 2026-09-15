"use client";

/**
 * lib-faq — grouped questions and answers.
 *
 * Built from Genova's `gn-faq`. Groups and questions are nested blocks
 * (`group` → `qa`). Each answer is a native `<details>`: it works before
 * hydration, is keyboard and screen-reader correct, and a closed answer is
 * still found by the browser's in-page search.
 *
 * FAQPage microdata annotates the visible text — no script tag, which the theme
 * contract forbids — and is emitted only when there are questions. Uses an h2,
 * not an h1, because the section can sit on any page.
 */

import { Link } from "../../components/Link";
import { useLocale } from "../../hooks/useLocalization";
import { useResolvedSettings } from "../../hooks/useResolvedSettings";
import { useInsideEditor } from "../InlineText";
import { BASE_CSS, LibStyle, bool, localized, readBlocks, str, type RawBlock } from "../_shared";
import type { LibrarySectionProps } from "../index";

const CSS = `
.lib-faq{padding-block:3rem}
.lib-faq-body{max-inline-size:48rem}
.lib-faq-heading{font-size:clamp(1.5rem,3vw,2.25rem);margin-block-end:2rem}
.lib-faq-group+.lib-faq-group{margin-block-start:2.5rem}
.lib-faq-group-title{margin:0 0 .75rem;font-size:.75rem;font-weight:600;letter-spacing:.14em;text-transform:uppercase;opacity:.7}
:lang(ar) .lib-faq-group-title,[dir="rtl"] .lib-faq-group-title{letter-spacing:normal;text-transform:none;font-size:.95rem}
.lib-faq-item{border-block-end:1px solid color-mix(in srgb,currentColor 15%,transparent)}
.lib-faq-item summary{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding-block:1rem;cursor:pointer;list-style:none;font-weight:500}
.lib-faq-item summary::-webkit-details-marker{display:none}
.lib-faq-item summary:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.lib-faq-chevron{flex-shrink:0;transition:transform .2s}
.lib-faq-item[open] .lib-faq-chevron{transform:rotate(180deg)}
.lib-faq-answer{margin:0 0 1rem;line-height:1.7;opacity:.85;white-space:pre-line}
.lib-faq-contact{margin-block-start:2rem}
.lib-faq-contact a{color:inherit;text-decoration:underline;text-underline-offset:3px}
@media (prefers-reduced-motion:reduce){.lib-faq-chevron{transition:none}}
`;

const Chevron = () => (
  <svg className="lib-faq-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export default function Faq({ instance }: LibrarySectionProps) {
  const locale = useLocale();
  const s = useResolvedSettings(instance);
  const insideEditor = useInsideEditor();

  const groups = readBlocks(instance as RawBlock, "group")
    .map((group, i) => ({
      id: `g-${i}`,
      title: str(group.settings?.title),
      items: readBlocks(group, "qa")
        .map((qa, j) => ({ id: `g-${i}-${j}`, q: str(qa.settings?.question), a: str(qa.settings?.answer) }))
        .filter((item) => item.q),
    }))
    // A seeded group can arrive with a title and no questions.
    .filter((group) => group.items.length > 0);
  const total = groups.reduce((n, group) => n + group.items.length, 0);

  if (total === 0 && !insideEditor) return null;

  const contactText = str(s.contact_text);

  return (
    <section
      className="lib-section lib-faq"
      {...(total > 0 ? { itemScope: true, itemType: "https://schema.org/FAQPage" } : {})}
    >
      <LibStyle id="lib-base" css={BASE_CSS} />
      <LibStyle id="lib-faq" css={CSS} />
      <div className="lib-container lib-faq-body">
        <h2 className="lib-heading lib-faq-heading">
          {str(s.heading) || localized(locale, "Frequently asked questions", "الأسئلة الشائعة")}
        </h2>

        {total === 0 ? (
          <p className="lib-muted">{localized(locale, "No questions added yet.", "لسه مفيش أسئلة.")}</p>
        ) : (
          groups.map((group) => (
            <div key={group.id} className="lib-faq-group">
              {bool(s.show_group_headings, true) && group.title && <h3 className="lib-faq-group-title">{group.title}</h3>}
              {/* Every answer starts closed: opening one makes the rest look answered. */}
              {group.items.map((item) => (
                <div key={item.id} itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
                  <details className="lib-faq-item">
                    <summary>
                      <span itemProp="name">{item.q}</span>
                      <Chevron />
                    </summary>
                    <div itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                      <p className="lib-faq-answer" itemProp="text">
                        {item.a}
                      </p>
                    </div>
                  </details>
                </div>
              ))}
            </div>
          ))
        )}

        {contactText && (
          <p className="lib-faq-contact">
            {contactText}{" "}
            <Link to={str(s.contact_link) || "/contact"}>{localized(locale, "Get in touch", "كلّمنا")}</Link>
          </p>
        )}
      </div>
    </section>
  );
}
