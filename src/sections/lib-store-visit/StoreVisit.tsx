"use client";

/**
 * lib-store-visit — a physical shop: photo, address, hours, map and WhatsApp.
 *
 * Built from Genova's `gn-store-visit`. A shop someone can walk into is the
 * strongest trust signal a small store has, so it gets a photo, an address in
 * both languages, hours and direct ways to reach it — not a footer line. Store
 * microdata annotates the visible text only.
 *
 * Address and hours are free text in either language, so they take
 * `dir="auto"`; the phone number is always LTR. Renders nothing on the
 * storefront until an address exists; the editor shows a prompt instead.
 */

import { useLocale } from "../../hooks/useLocalization";
import { useResolvedSettings } from "../../hooks/useResolvedSettings";
import { useShop } from "../../hooks/useShop";
import { applyImageTransform, asImageTransform } from "../../utils/imageTransform";
import { whatsappHref } from "../../utils/routes";
import { useInsideEditor } from "../InlineText";
import { BASE_CSS, LibStyle, bool, imageAlt, imageUrl, localized, responsiveImg, str } from "../_shared";
import type { LibrarySectionProps } from "../index";

const SHOP_IMG = { widths: [384, 640, 768, 1024], sizes: "(min-width: 768px) 50vw, 100vw" } as const;

const CSS = `
.lib-visit{padding-block:2.5rem;border-block-start:1px solid color-mix(in srgb,currentColor 12%,transparent)}
@media (min-width:768px){.lib-visit{padding-block:4rem}}
.lib-visit-inner{display:grid;gap:1.75rem;align-items:center}
@media (min-width:768px){.lib-visit-inner.has-image{grid-template-columns:1fr 1fr;gap:3rem}}
.lib-visit-media{position:relative;aspect-ratio:4/3;overflow:hidden;border-radius:.25rem}
.lib-visit-media img{position:absolute;inset:0;inline-size:100%;block-size:100%;object-fit:cover}
.lib-visit-copy{display:flex;flex-direction:column;align-items:flex-start;gap:1rem}
.lib-visit-copy .lib-heading{font-size:clamp(1.5rem,3vw,2.25rem)}
.lib-visit-address{margin:0;font-style:normal;font-size:1.0625rem;line-height:1.7;white-space:pre-line}
.lib-visit-hours{margin:0;display:flex;flex-direction:column;gap:.25rem}
.lib-visit-actions{display:flex;flex-wrap:wrap;gap:.75rem}
.lib-visit-btn{display:inline-flex;align-items:center;gap:.5rem;padding:.75rem 1.25rem;border:1px solid currentColor;border-radius:.25rem;color:inherit;text-decoration:none;font-size:.875rem;font-weight:500}
.lib-visit-btn.is-primary{background:var(--theme-color-text,CanvasText);border-color:var(--theme-color-text,CanvasText);color:var(--theme-color-background,Canvas)}
.lib-visit-phone{color:inherit;text-decoration:underline;text-underline-offset:3px}
`;

const WhatsAppIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.5 11.7a8.4 8.4 0 0 1-12.4 7.4L3.5 20.5l1.4-4.5A8.4 8.4 0 1 1 20.5 11.7Z" />
    <path d="M9 9.4c0 3 2.5 5.5 5.5 5.5.6 0 1.1-.5 1.1-1.1l-1.7-.8-.9.9a5.8 5.8 0 0 1-2.5-2.5l.9-.9-.8-1.7c-.6 0-1.6.1-1.6 1.1Z" />
  </svg>
);

export default function StoreVisit({ instance }: LibrarySectionProps) {
  const locale = useLocale();
  const s = useResolvedSettings(instance);
  const shop = useShop();
  const insideEditor = useInsideEditor();

  // Authored per language; a store that filled in only one still renders.
  const addressEn = str(s.address);
  const addressAr = str(s.address_ar);
  const address = localized(locale, addressEn || addressAr, addressAr || addressEn);

  if (!address) {
    return insideEditor ? (
      <section className="lib-section lib-empty">
        <LibStyle id="lib-base" css={BASE_CSS} />
        <p className="lib-muted">
          {localized(locale, "Add the shop's address to show this section", "اكتب عنوان المحل علشان القسم يظهر")}
        </p>
      </section>
    ) : null;
  }

  const heading = str(s.heading) || localized(locale, "Visit our shop", "زورنا في المحل");
  const image = imageUrl(s.image);
  const hours = str(s.hours);
  const phone = str(s.phone);
  const mapLink = bool(s.show_directions_button, true) ? str(s.map_link) : "";
  const whatsapp = whatsappHref(str(s.whatsapp));

  return (
    <section className="lib-section lib-visit" itemScope itemType="https://schema.org/Store">
      <LibStyle id="lib-base" css={BASE_CSS} />
      <LibStyle id="lib-store-visit" css={CSS} />
      <meta itemProp="name" content={shop.name} />
      <div className={`lib-container lib-visit-inner${image ? " has-image" : ""}`}>
        {image && (
          <div className="lib-visit-media">
            <img
              {...responsiveImg(image, SHOP_IMG)}
              alt={imageAlt(s.image, heading)}
              loading="lazy"
              decoding="async"
              style={applyImageTransform(asImageTransform(s.image), "cover")}
            />
          </div>
        )}

        <div className="lib-visit-copy">
          <h2 className="lib-heading">{heading}</h2>
          <address className="lib-visit-address" itemProp="address" dir="auto">
            {address}
          </address>

          {hours && (
            <p className="lib-visit-hours">
              <span className="lib-label lib-muted">{localized(locale, "Opening hours", "مواعيد الشغل")}</span>
              <span dir="auto">{hours}</span>
            </p>
          )}

          {(mapLink || whatsapp) && (
            <div className="lib-visit-actions">
              {mapLink && (
                <a href={mapLink} className="lib-visit-btn" target="_blank" rel="noopener noreferrer">
                  {localized(locale, "Get directions", "افتح الخريطة")}
                </a>
              )}
              {whatsapp && (
                <a href={whatsapp} className="lib-visit-btn is-primary" target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon />
                  {localized(locale, "Message us on WhatsApp", "كلّمنا على واتساب")}
                </a>
              )}
            </div>
          )}

          {phone && (
            // Microdata reads an <a>'s href, so the number sits in a span.
            <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="lib-visit-phone" dir="ltr">
              <span itemProp="telephone">{phone}</span>
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
