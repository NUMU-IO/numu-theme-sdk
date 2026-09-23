"use client";

/**
 * lib-review-images — customer review screenshots in a strip that scrolls
 * sideways by itself.
 *
 * Stores here collect reviews as screenshots of WhatsApp chats and Instagram
 * comments; each one is an uploaded `review` block. The loop is two identical
 * tracks that each move exactly their own width, so the second lands where the
 * first began: no jump at the seam, however many screenshots there are. The
 * strip holds no text, so it is forced LTR and the direction setting means the
 * same thing in Arabic. It stops under the mouse so a review can be read, and
 * for prefers-reduced-motion it stands still and scrolls by hand instead.
 * Pure CSS, so the server render is the final render.
 */

import { useLocale } from "../../hooks/useLocalization";
import { useResolvedSettings } from "../../hooks/useResolvedSettings";
import { InlineText, useInsideEditor } from "../InlineText";
import { BASE_CSS, LibStyle, imageAlt, imageUrl, localized, readBlocks, responsiveImg, str, type RawBlock } from "../_shared";
import type { LibrarySectionProps } from "../index";

// Seconds per screenshot, so the strip moves at the same pace however many there are.
const SECONDS_PER_IMAGE: Record<string, number> = { slow: 8, normal: 5, fast: 3 };
// Screenshots per track, repeating the merchant's own: enough for one track to
// be wider than a desktop screen, or the loop shows an empty stretch.
const MIN_PER_TRACK = 10;

const CSS = `
.lib-rv{padding-block:3rem}
.lib-rv-head{text-align:center;margin-block-end:1.75rem}
.lib-rv-title{font-size:clamp(1.5rem,3vw,2.25rem)}
.lib-rv .lib-rv-sub{margin:.5rem auto 0;max-inline-size:60ch;line-height:1.6}
.lib-rv-viewport{display:flex;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 4%,#000 96%,transparent);mask-image:linear-gradient(90deg,transparent,#000 4%,#000 96%,transparent)}
.lib-rv-track{display:flex;flex-shrink:0;min-inline-size:100%;margin:0;padding:0;list-style:none;animation:lib-rv-scroll var(--lib-rv-dur,50s) linear infinite}
.lib-rv.is-right .lib-rv-track{animation-direction:reverse}
.lib-rv-viewport:hover .lib-rv-track{animation-play-state:paused}
.lib-rv-card{flex-shrink:0;block-size:min(var(--lib-rv-h,360px),65vw);margin-inline-end:1rem;overflow:hidden;border:1px solid color-mix(in srgb,currentColor 12%,transparent);border-radius:.75rem;background:color-mix(in srgb,currentColor 5%,transparent)}
.lib-rv .lib-rv-card img{display:block;block-size:100%;inline-size:auto;max-inline-size:none}
@keyframes lib-rv-scroll{to{transform:translateX(-100%)}}
@media (prefers-reduced-motion:reduce){
.lib-rv-track{animation:none}
.lib-rv-track[aria-hidden],.lib-rv-card[aria-hidden]{display:none}
.lib-rv-viewport{overflow-x:auto;-webkit-mask-image:none;mask-image:none}
}
`;

export default function ReviewImages({ instance, sectionId }: LibrarySectionProps) {
  const locale = useLocale();
  const s = useResolvedSettings(instance);
  const insideEditor = useInsideEditor();

  const images = readBlocks(instance as RawBlock, "review")
    .slice(0, 24)
    .map((block) => block.settings?.image)
    .filter((image) => imageUrl(image));

  if (images.length === 0) {
    return insideEditor ? (
      <section className="lib-section lib-empty">
        <LibStyle id="lib-base" css={BASE_CSS} />
        <p className="lib-muted">{localized(locale, "Add your customers' review screenshots", "ضيف صور آراء عملائك هنا")}</p>
      </section>
    ) : null;
  }

  const heading = str(s.heading) || localized(locale, "What our customers say", "آراء عملائنا");
  const subtitle = str(s.subtitle);
  const height =
    typeof s.image_height === "number" && Number.isFinite(s.image_height) ? Math.min(560, Math.max(160, s.image_height)) : 360;
  const perTrack = Math.ceil(MIN_PER_TRACK / images.length) * images.length;
  const duration = perTrack * (SECONDS_PER_IMAGE[str(s.speed)] ?? SECONDS_PER_IMAGE.normal);
  // Cards are sized by height; their width follows each screenshot's shape.
  // Most are tall phone captures, so the height is a generous width estimate.
  const imgPreset = { widths: [256, 384, 640, 768, 1024], sizes: `(max-width: 767px) 65vw, ${height}px` };

  // The first track names each screenshot once; its repeats and the whole
  // second track are copies that only keep the loop full.
  const track = (copy: 0 | 1) => (
    <ul className="lib-rv-track" role={copy ? undefined : "list"} aria-hidden={copy ? true : undefined}>
      {Array.from({ length: perTrack }, (_, i) => {
        const image = images[i % images.length];
        const named = copy === 0 && i < images.length;
        return (
          <li key={i} className="lib-rv-card" aria-hidden={copy === 0 && !named ? true : undefined}>
            <img
              {...responsiveImg(imageUrl(image), imgPreset)}
              alt={named ? imageAlt(image, localized(locale, `Customer review ${i + 1}`, `رأي عميل ${i + 1}`)) : ""}
              loading="lazy"
              decoding="async"
            />
          </li>
        );
      })}
    </ul>
  );

  return (
    <section
      className={str(s.direction) === "right" ? "lib-section lib-rv is-right" : "lib-section lib-rv"}
      style={{ ["--lib-rv-h" as string]: `${height}px`, ["--lib-rv-dur" as string]: `${duration}s` }}
    >
      <LibStyle id="lib-base" css={BASE_CSS} />
      <LibStyle id="lib-review-images" css={CSS} />
      <div className="lib-container lib-rv-head">
        <h2 className="lib-heading lib-rv-title">
          <InlineText sectionId={sectionId} settingKey="heading" value={heading} />
        </h2>
        {subtitle && (
          <p className="lib-rv-sub lib-muted">
            <InlineText sectionId={sectionId} settingKey="subtitle" value={subtitle} />
          </p>
        )}
      </div>
      <div className="lib-rv-viewport" dir="ltr">
        {track(0)}
        {track(1)}
      </div>
    </section>
  );
}
