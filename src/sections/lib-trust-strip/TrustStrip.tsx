"use client";

/**
 * lib-trust-strip — "Why shop with us": a short row of reassurance points.
 *
 * Cash on delivery, fast shipping, easy exchange, original products: the four
 * questions an Egyptian shopper asks before a first order, answered before
 * they ask. Items are `item` blocks with an icon from a small inline SVG set
 * (no icon dependency). On the storefront it renders nothing until an item has
 * a title or text; in the editor it shows four sample items.
 */

import type { ReactNode } from "react";

import { useLocale } from "../../hooks/useLocalization";
import { useResolvedSettings } from "../../hooks/useResolvedSettings";
import { InlineText, useInsideEditor } from "../InlineText";
import { BASE_CSS, LibStyle, localized, readBlocks, str, type RawBlock } from "../_shared";
import type { LibrarySectionProps } from "../index";

const ICONS: Record<string, ReactNode> = {
  truck: (
    <>
      <path d="M3 6h11v10H3z" />
      <path d="M14 10h4l3 3v3h-7" />
      <circle cx="7" cy="17.5" r="1.5" />
      <circle cx="17" cy="17.5" r="1.5" />
    </>
  ),
  cash: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01M18 12h.01" />
    </>
  ),
  return: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z" />,
  chat: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />,
  gift: (
    <>
      <rect x="3" y="8" width="18" height="4" />
      <path d="M5 12v9h14v-9M12 8v13" />
      <path d="M12 8S10.5 3 8 4s0 4 4 4zm0 0s1.5-5 4-4 0 4-4 4z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
};

interface Item {
  key: string;
  icon: string;
  title: string;
  text: string;
}

const SAMPLES: Record<"en" | "ar", Item[]> = {
  en: [
    { key: "s1", icon: "cash", title: "Cash on delivery", text: "Pay when your order arrives" },
    { key: "s2", icon: "truck", title: "Fast shipping", text: "Delivered to your door, quickly" },
    { key: "s3", icon: "return", title: "Easy exchange", text: "Wrong size? We'll swap it" },
    { key: "s4", icon: "shield", title: "Original products", text: "Every item is genuine and guaranteed" },
  ],
  ar: [
    { key: "s1", icon: "cash", title: "الدفع عند الاستلام", text: "ادفع كاش لما الطلب يوصلك" },
    { key: "s2", icon: "truck", title: "شحن سريع", text: "بيوصلك لحد باب البيت في أسرع وقت" },
    { key: "s3", icon: "return", title: "استبدال سهل", text: "المقاس مش مظبوط؟ بنبدّلهولك" },
    { key: "s4", icon: "shield", title: "منتجات أصلية", text: "كل منتج أصلي ومضمون" },
  ],
};

const CSS = `
.lib-trust{padding-block:2rem}
.lib-trust-heading{margin-block-end:1.25rem;text-align:center}
.lib-trust-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.5rem 1rem;margin:0;padding:0;list-style:none}
.lib-trust-item{display:flex;flex-direction:column;align-items:center;gap:.375rem;text-align:center}
.lib-trust-icon{color:var(--theme-color-accent,currentColor);margin-block-end:.25rem}
.lib-trust-title{font-weight:600;line-height:1.3}
.lib-trust-text{font-size:.875rem;line-height:1.5;opacity:.7}
@media (min-width:768px){
.lib-trust.is-row .lib-trust-list{display:flex}
.lib-trust.is-row .lib-trust-item{flex:1 1 0;padding-inline:1rem}
.lib-trust.is-row .lib-trust-item+.lib-trust-item{border-inline-start:1px solid color-mix(in srgb,currentColor 15%,transparent)}
.lib-trust.is-cards .lib-trust-list{grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))}
}
.lib-trust.is-cards .lib-trust-item{padding:1.25rem 1rem;border:1px solid color-mix(in srgb,currentColor 15%,transparent);border-radius:.5rem}
`;

export default function TrustStrip({ instance, sectionId }: LibrarySectionProps) {
  const locale = useLocale();
  const s = useResolvedSettings(instance);
  const insideEditor = useInsideEditor();

  let items: Item[] = readBlocks(instance as RawBlock, "item")
    .map((block, i) => ({
      key: `item-${i}`,
      icon: str(block.settings?.icon),
      title: str(block.settings?.title),
      text: str(block.settings?.text),
    }))
    .filter((item) => item.title || item.text)
    .slice(0, 6);
  if (items.length === 0 && insideEditor) items = SAMPLES[localized(locale, "en", "ar") as "en" | "ar"];
  if (items.length === 0) return null;

  const heading = str(s.heading);
  const style = str(s.style) === "cards" ? "cards" : "row";

  return (
    <section className={`lib-section lib-trust is-${style}`}>
      <LibStyle id="lib-base" css={BASE_CSS} />
      <LibStyle id="lib-trust-strip" css={CSS} />
      <div className="lib-container">
        {heading && (
          <h2 className="lib-heading lib-eyebrow lib-trust-heading">
            <InlineText sectionId={sectionId} settingKey="heading" value={heading} />
          </h2>
        )}
        <ul className="lib-trust-list">
          {items.map((item) => (
            <li key={item.key} className="lib-trust-item">
              <svg className="lib-trust-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {ICONS[item.icon] ?? ICONS.shield}
              </svg>
              {item.title && <span className="lib-trust-title">{item.title}</span>}
              {item.text && <span className="lib-trust-text">{item.text}</span>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
