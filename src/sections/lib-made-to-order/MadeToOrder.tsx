"use client";

/**
 * lib-made-to-order — how long a piece takes, whether it can be personalised,
 * and a WhatsApp button to ask the maker.
 *
 * Built from Skeuomorphic's `skeu-made-to-order`, without the kraft card and
 * motion: a quiet bordered card in the theme's own colours. Renders nothing on
 * the storefront until the merchant writes a lead time, personalisation line,
 * note or a valid WhatsApp number; the editor shows a prompt instead.
 */

import { useLocale } from "../../hooks/useLocalization";
import { useResolvedSettings } from "../../hooks/useResolvedSettings";
import { whatsappHref } from "../../utils/routes";
import { InlineText, useInsideEditor } from "../InlineText";
import { BASE_CSS, LibStyle, localized, str } from "../_shared";
import type { LibrarySectionProps } from "../index";

const CSS = `
.lib-mto{padding-block:3rem}
@media (min-width:768px){.lib-mto{padding-block:4.5rem}}
.lib-mto-card{max-inline-size:48rem;margin-inline:auto;padding:clamp(1.5rem,4vw,2.5rem);border:1px solid color-mix(in srgb,currentColor 15%,transparent);border-radius:.5rem}
.lib-mto-card .lib-heading{font-size:clamp(1.5rem,3vw,2.25rem);margin-block-end:1.5rem}
.lib-mto-row{display:flex;align-items:flex-start;gap:.875rem;margin:0}
.lib-mto-row+.lib-mto-row{margin-block-start:1.25rem}
.lib-mto-icon{flex-shrink:0;color:var(--theme-color-accent,currentColor)}
.lib-mto-text{line-height:1.7;white-space:pre-line}
.lib-mto-actions{display:flex;flex-wrap:wrap;align-items:center;gap:.75rem 1rem;margin-block-start:1.75rem}
.lib-mto-btn{display:inline-flex;align-items:center;gap:.5rem;padding:.75rem 1.25rem;border-radius:.25rem;background:var(--theme-color-text,CanvasText);color:var(--theme-color-background,Canvas);text-decoration:none;font-size:.875rem;font-weight:500}
.lib-mto-btn:focus-visible{outline:2px solid currentColor;outline-offset:3px}
.lib-mto-phone{font-size:.875rem;opacity:.7}
.lib-mto-note{margin:1.25rem 0 0;font-size:.875rem;line-height:1.7;opacity:.7;white-space:pre-line}
`;

const Icon = ({ d }: { d: string }) => (
  <svg className="lib-mto-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const CLOCK = "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4v5l3 2";
const PEN = "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z";

const WhatsAppIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.5 11.7a8.4 8.4 0 0 1-12.4 7.4L3.5 20.5l1.4-4.5A8.4 8.4 0 1 1 20.5 11.7Z" />
    <path d="M9 9.4c0 3 2.5 5.5 5.5 5.5.6 0 1.1-.5 1.1-1.1l-1.7-.8-.9.9a5.8 5.8 0 0 1-2.5-2.5l.9-.9-.8-1.7c-.6 0-1.6.1-1.6 1.1Z" />
  </svg>
);

export default function MadeToOrder({ instance, sectionId }: LibrarySectionProps) {
  const locale = useLocale();
  const s = useResolvedSettings(instance);
  const insideEditor = useInsideEditor();

  const leadTime = str(s.lead_time_text);
  const personalization = str(s.personalization_text);
  const note = str(s.note);
  const number = str(s.whatsapp_number).trim();
  // An unusable number counts as empty: a card with no way to reach anyone is noise.
  const waHref = whatsappHref(number);

  if (!leadTime && !personalization && !note && !waHref) {
    return insideEditor ? (
      <section className="lib-section lib-empty">
        <LibStyle id="lib-base" css={BASE_CSS} />
        <p className="lib-muted">
          {localized(
            locale,
            "Write the lead time, personalisation details or a WhatsApp number to show this section",
            "اكتب مدة التجهيز أو تفاصيل التخصيص أو رقم واتساب علشان القسم يظهر",
          )}
        </p>
      </section>
    ) : null;
  }

  const title = str(s.title) || localized(locale, "Made for you", "بنفصّلهولك مخصوص");
  const buttonLabel = str(s.button_label) || localized(locale, "Chat with us on WhatsApp", "كلّمنا على واتساب");

  return (
    <section className="lib-section lib-mto">
      <LibStyle id="lib-base" css={BASE_CSS} />
      <LibStyle id="lib-made-to-order" css={CSS} />
      <div className="lib-container">
        <div className="lib-mto-card">
          <h2 className="lib-heading">
            <InlineText sectionId={sectionId} settingKey="title" value={title} />
          </h2>
          {leadTime && (
            <p className="lib-mto-row">
              <Icon d={CLOCK} />
              <span className="lib-mto-text">
                <InlineText sectionId={sectionId} settingKey="lead_time_text" value={leadTime} multiline />
              </span>
            </p>
          )}
          {personalization && (
            <p className="lib-mto-row">
              <Icon d={PEN} />
              <span className="lib-mto-text">
                <InlineText sectionId={sectionId} settingKey="personalization_text" value={personalization} multiline />
              </span>
            </p>
          )}
          {waHref && (
            <div className="lib-mto-actions">
              <a href={waHref} className="lib-mto-btn" target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon />
                <InlineText sectionId={sectionId} settingKey="button_label" value={buttonLabel} />
              </a>
              {!/^https?:\/\//i.test(number) && (
                <span className="lib-mto-phone" dir="ltr">
                  {number}
                </span>
              )}
            </div>
          )}
          {note && (
            <p className="lib-mto-note">
              <InlineText sectionId={sectionId} settingKey="note" value={note} multiline />
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
