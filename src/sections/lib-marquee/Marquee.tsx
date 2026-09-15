"use client";

/**
 * lib-marquee — a band of short lines scrolling sideways.
 *
 * One section for the eight themes that each had their own: the `band` style is
 * vionne/editorial's coloured strip of items with separators, `statement` is
 * genova's quiet large sentence, and `tilted` is neo-brutalism's rotated tape.
 *
 * The loop renders the group twice and translates the track by exactly -50%,
 * so the copy lands where the original started: no jump at the seam. The moving
 * track is forced LTR so the direction setting means the same thing in Arabic;
 * each line keeps `dir="auto"`. Motion stops for prefers-reduced-motion.
 */

import { Link } from "../../components/Link";
import { useLocale } from "../../hooks/useLocalization";
import { useResolvedSettings } from "../../hooks/useResolvedSettings";
import { BASE_CSS, LibStyle, bool, localized, str } from "../_shared";
import type { LibrarySectionProps } from "../index";

const SEPARATORS: Record<string, string> = { dot: "•", star: "★", diamond: "◆", slash: "/", dash: "—", none: "" };
const STYLES = ["band", "statement", "tilted"];
const SCHEMES = ["accent", "ink", "light", "none"];
const SIZES = ["sm", "md", "lg", "xl"];

const CSS = `
.lib-marquee{overflow:hidden;background:var(--lib-mq-bg);color:var(--lib-mq-fg)}
.lib-marquee.is-accent{--lib-mq-bg:var(--theme-color-accent,#111);--lib-mq-fg:var(--theme-color-background,#fff)}
.lib-marquee.is-ink{--lib-mq-bg:var(--theme-color-text,#111);--lib-mq-fg:var(--theme-color-background,#fff)}
.lib-marquee.is-light{--lib-mq-bg:var(--theme-color-background,#fff);--lib-mq-fg:var(--theme-color-text,#111)}
.lib-marquee.is-none{--lib-mq-bg:transparent;--lib-mq-fg:inherit}
.lib-marquee.has-borders{border-block:1px solid color-mix(in srgb,currentColor 25%,transparent)}
.lib-marquee.is-tilted{transform:rotate(-1.5deg) scale(1.03);margin-block:1rem}
.lib-mq-viewport{display:flex;overflow:hidden}
.lib-mq-track{display:flex;flex-shrink:0;min-inline-size:100%;animation:lib-marquee var(--lib-mq-dur,30s) linear infinite}
.lib-marquee.is-right .lib-mq-track{animation-direction:reverse}
.lib-marquee.pause-hover:hover .lib-mq-track{animation-play-state:paused}
.lib-mq-item{flex-shrink:0;white-space:nowrap;padding-inline:1.25rem}
.lib-mq-sep{flex-shrink:0;opacity:.6}
.lib-marquee.is-sm .lib-mq-item{font-size:.75rem;letter-spacing:.14em;text-transform:uppercase;font-weight:500}
.lib-marquee.is-md .lib-mq-item{font-size:1rem}
.lib-marquee.is-lg .lib-mq-item{font-size:clamp(1.25rem,2.5vw,1.75rem);font-family:var(--theme-font-heading,inherit)}
.lib-marquee.is-xl .lib-mq-item{font-size:clamp(1.75rem,5vw,3.5rem);font-family:var(--theme-font-heading,inherit);line-height:1.1}
.lib-marquee.is-statement .lib-mq-item{padding-inline:2.5rem;font-family:var(--theme-font-heading,inherit)}
:lang(ar) .lib-marquee .lib-mq-item,[dir="rtl"] .lib-marquee .lib-mq-item{letter-spacing:normal;text-transform:none}
.lib-mq-link{display:block;color:inherit;text-decoration:none}
@keyframes lib-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@media (prefers-reduced-motion:reduce){.lib-mq-track{animation:none}}
`;

function clamp(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, n));
}

export default function Marquee({ instance }: LibrarySectionProps) {
  const locale = useLocale();
  const s = useResolvedSettings(instance);

  const style = STYLES.includes(str(s.style)) ? str(s.style) : "band";
  const typed = [1, 2, 3, 4, 5, 6].map((i) => str(s[`item_${i}`]).trim()).filter(Boolean);
  // Never an empty strip: an editor-added marquee starts with neutral copy.
  const items =
    typed.length > 0
      ? typed
      : style === "statement"
        ? [localized(locale, "Made to be worn, every day.", "معمول عشان يتلبس كل يوم.")]
        : [
            localized(locale, "New arrivals every week", "جديد كل أسبوع"),
            localized(locale, "Cash on delivery", "الدفع عند الاستلام"),
            localized(locale, "Easy exchanges", "استبدال سهل"),
          ];

  const separator = SEPARATORS[str(s.separator) || (style === "statement" ? "none" : "dot")] ?? "•";
  const scheme = SCHEMES.includes(str(s.color_scheme)) ? str(s.color_scheme) : style === "statement" ? "none" : "accent";
  const size = SIZES.includes(str(s.size)) ? str(s.size) : style === "statement" ? "xl" : "sm";
  const duration = clamp(s.speed_seconds, 5, 120, 30);
  const paddingY = clamp(s.padding_y, 0, 64, 12);
  const link = str(s.link_url);

  // Repeat short content so one copy of the group is wider than the viewport.
  const repeats = Math.max(1, Math.ceil(8 / items.length));
  const group = Array.from({ length: repeats }, () => items).flat();
  const renderGroup = (copy: number) =>
    group.flatMap((text, i) => {
      const nodes = [
        <span key={`${copy}-i-${i}`} className="lib-mq-item" dir="auto">
          {text}
        </span>,
      ];
      if (separator) {
        nodes.push(
          <span key={`${copy}-s-${i}`} className="lib-mq-sep" aria-hidden="true">
            {separator}
          </span>,
        );
      }
      return nodes;
    });

  const classes = [
    "lib-section lib-marquee",
    `is-${style}`,
    `is-${scheme}`,
    `is-${size}`,
    str(s.direction) === "right" ? "is-right" : "",
    bool(s.pause_on_hover, true) ? "pause-hover" : "",
    bool(s.show_borders, false) ? "has-borders" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const band = (
    <div className="lib-mq-viewport" dir="ltr">
      <div className="lib-mq-track">{renderGroup(0)}</div>
      <div className="lib-mq-track" aria-hidden="true">
        {renderGroup(1)}
      </div>
    </div>
  );

  return (
    <section
      className={classes}
      aria-label={items.join(" · ")}
      style={{ paddingBlock: `${paddingY}px`, ["--lib-mq-dur" as string]: `${duration}s` }}
    >
      <LibStyle id="lib-base" css={BASE_CSS} />
      <LibStyle id="lib-marquee" css={CSS} />
      {link ? (
        <Link to={link} className="lib-mq-link">
          {band}
        </Link>
      ) : (
        band
      )}
    </section>
  );
}
