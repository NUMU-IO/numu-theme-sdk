"use client";

/**
 * lib-logo-list — logos: brands the store carries, press, partners.
 *
 * `logo` blocks, each an image with a name (its alt text) and an optional
 * link. Logos sit at one merchant-chosen height so mixed files line up, and are
 * greyscale until hovered by default so a row of loud brand colours stays calm.
 * A logo without an image is skipped. Renders nothing on the storefront until
 * one logo has an image; the editor shows a prompt instead.
 */

import { Link } from "../../components/Link";
import { useLocale } from "../../hooks/useLocalization";
import { useResolvedSettings } from "../../hooks/useResolvedSettings";
import { useInsideEditor } from "../InlineText";
import { BASE_CSS, LibStyle, bool, imageAlt, imageUrl, localized, readBlocks, responsiveImg, str, type RawBlock } from "../_shared";
import type { LibrarySectionProps } from "../index";

/** At most 96px tall; a wide 4:1 wordmark is ~384px, doubled for retina. */
const LOGO_IMG = { widths: [128, 256, 384, 768], sizes: "240px" } as const;

const CSS = `
.lib-logos{padding-block:2.5rem}
.lib-logos-heading{font-size:clamp(1.25rem,2.5vw,1.75rem);text-align:center;margin-block-end:1.75rem}
.lib-logos-list{margin:0;padding:0;list-style:none}
.lib-logos.is-row .lib-logos-list{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:1.5rem 3rem}
.lib-logos.is-grid .lib-logos-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-block-start:1px solid color-mix(in srgb,currentColor 12%,transparent);border-inline-start:1px solid color-mix(in srgb,currentColor 12%,transparent)}
@media (min-width:768px){.lib-logos.is-grid .lib-logos-list{grid-template-columns:repeat(4,minmax(0,1fr))}}
.lib-logos.is-grid .lib-logos-item{display:flex;align-items:center;justify-content:center;padding:1.5rem 1rem;border-block-end:1px solid color-mix(in srgb,currentColor 12%,transparent);border-inline-end:1px solid color-mix(in srgb,currentColor 12%,transparent)}
.lib-logos-item a{display:inline-flex;color:inherit}
.lib-logos-item a:focus-visible{outline:2px solid currentColor;outline-offset:4px}
.lib-logos-item img{display:block;block-size:var(--lib-logos-h,40px);inline-size:auto;max-inline-size:100%;object-fit:contain}
.lib-logos.is-gray .lib-logos-item img{filter:grayscale(1);opacity:.7;transition:filter .3s,opacity .3s}
.lib-logos.is-gray .lib-logos-item:hover img,.lib-logos.is-gray .lib-logos-item:focus-within img{filter:none;opacity:1}
@media (prefers-reduced-motion:reduce){.lib-logos.is-gray .lib-logos-item img{transition:none}}
`;

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.min(max, Math.max(min, n));
}

export default function LogoList({ instance }: LibrarySectionProps) {
  const locale = useLocale();
  const s = useResolvedSettings(instance);
  const insideEditor = useInsideEditor();

  const logos = readBlocks(instance as RawBlock, "logo")
    .map((block, i) => {
      const name = str(block.settings?.name);
      return {
        key: `logo-${i}`,
        image: imageUrl(block.settings?.image),
        alt: name || imageAlt(block.settings?.image),
        link: str(block.settings?.link),
      };
    })
    .filter((logo) => logo.image)
    .slice(0, 16);

  if (logos.length === 0) {
    return insideEditor ? (
      <section className="lib-section lib-empty">
        <LibStyle id="lib-base" css={BASE_CSS} />
        <p className="lib-muted">{localized(locale, "Add logos to show this section", "ضيف لوجوهات علشان القسم يظهر")}</p>
      </section>
    ) : null;
  }

  const heading = str(s.heading);
  const style = str(s.style) === "grid" ? "grid" : "row";
  const height = clampInt(s.logo_height, 24, 96, 40);

  return (
    <section
      className={`lib-section lib-logos is-${style}${bool(s.grayscale, true) ? " is-gray" : ""}`}
      style={{ ["--lib-logos-h" as string]: `${height}px` }}
    >
      <LibStyle id="lib-base" css={BASE_CSS} />
      <LibStyle id="lib-logo-list" css={CSS} />
      <div className="lib-container">
        {heading && <h2 className="lib-heading lib-logos-heading">{heading}</h2>}
        <ul className="lib-logos-list">
          {logos.map((logo) => {
            const img = <img {...responsiveImg(logo.image, LOGO_IMG)} alt={logo.alt} loading="lazy" decoding="async" />;
            return (
              <li key={logo.key} className="lib-logos-item">
                {logo.link ? <Link to={logo.link}>{img}</Link> : img}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
