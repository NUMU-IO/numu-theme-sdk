"use client";

/**
 * lib-rich-text — a heading and a block of formatted text.
 *
 * Replaces the per-theme rich-text sections and Editorial's "Editor's Note".
 * `plain` is prose at a reading measure; `note` sets it as a signed letter
 * (kicker, accent rule, larger body in the heading face, byline). The drop cap
 * from Editorial is dropped: Arabic letters join, so a first-letter cap breaks.
 *
 * The body goes through the SDK's sanitizing `RichText`. An editor that was
 * cleared saves markup like `<p><br></p>`, which counts as empty.
 */

import { RichText } from "../../components/RichText";
import { useLocale } from "../../hooks/useLocalization";
import { useResolvedSettings } from "../../hooks/useResolvedSettings";
import { InlineText, useInsideEditor } from "../InlineText";
import { BASE_CSS, LibStyle, localized, str } from "../_shared";
import type { LibrarySectionProps } from "../index";

const CSS = `
.lib-rt{padding-block:clamp(3rem,6vw,5rem)}
.lib-rt .lib-rt-inner{max-inline-size:42rem}
.lib-rt.is-wide .lib-rt-inner{max-inline-size:64rem}
.lib-rt.is-center{text-align:center}
.lib-rt-heading{font-size:clamp(1.5rem,3vw,2.25rem);margin-block-end:1.25rem}
.lib-rt-body{line-height:1.75}
.lib-rt-body>*{margin:0}
.lib-rt-body>*+*{margin-block-start:1em}
.lib-rt-body h2,.lib-rt-body h3,.lib-rt-body h4{font-family:var(--theme-font-heading,inherit);font-weight:500;line-height:1.2}
.lib-rt-body ul,.lib-rt-body ol{padding-inline-start:1.25em}
.lib-rt.is-center .lib-rt-body ul,.lib-rt.is-center .lib-rt-body ol{list-style-position:inside;padding-inline-start:0}
.lib-rt-body a{color:inherit;text-decoration:underline;text-underline-offset:3px}
.lib-rt-body img{max-inline-size:100%;block-size:auto}
.lib-rt-body blockquote{padding-inline-start:1rem;border-inline-start:2px solid var(--theme-color-accent,currentColor)}
.lib-rt-kicker{color:var(--theme-color-accent,inherit);opacity:1}
.lib-rt-rule{display:block;inline-size:4rem;block-size:1px;margin-block:0 1.75rem;background:var(--theme-color-accent,currentColor)}
.lib-rt.is-center .lib-rt-rule{margin-inline:auto}
.lib-rt.is-note .lib-rt-body{font-family:var(--theme-font-heading,inherit);font-size:clamp(1.2rem,2.2vw,1.6rem);line-height:1.55}
.lib-rt-byline{margin-block-start:1.75rem;display:flex;flex-wrap:wrap;align-items:baseline;gap:.5rem}
.lib-rt.is-center .lib-rt-byline{justify-content:center}
.lib-rt-byline>span+span{opacity:.6}
`;

/** Markup with no visible text and no image, as a cleared editor saves it. */
const isBlank = (html: string) => !/<img\b/i.test(html) && !html.replace(/<[^>]*>|&nbsp;/g, "").trim();

export default function RichTextBlock({ instance, sectionId }: LibrarySectionProps) {
  const locale = useLocale();
  const s = useResolvedSettings(instance);
  const insideEditor = useInsideEditor();

  const heading = str(s.heading);
  const raw = str(s.content);
  const content = isBlank(raw) ? "" : raw;

  if (!heading && !content) {
    return insideEditor ? (
      <section className="lib-section lib-empty">
        <LibStyle id="lib-base" css={BASE_CSS} />
        <p className="lib-muted">{localized(locale, "Write a heading or some text for this section", "اكتب عنوان أو كلام للقسم ده")}</p>
      </section>
    ) : null;
  }

  const note = str(s.style) === "note";
  const width = str(s.width) === "wide" ? "wide" : "narrow";
  const align = str(s.align) === "center" ? "center" : "start";
  const kicker = str(s.kicker) || localized(locale, "Editor's note", "كلمة المحرر");
  const bylineName = str(s.byline_name);
  const bylineRole = str(s.byline_role);

  return (
    <section className={`lib-section lib-rt is-${note ? "note" : "plain"} is-${width} is-${align}`}>
      <LibStyle id="lib-base" css={BASE_CSS} />
      <LibStyle id="lib-rich-text" css={CSS} />
      <div className="lib-container lib-rt-inner">
        {note && (
          <>
            <p className="lib-eyebrow lib-rt-kicker">
              <InlineText sectionId={sectionId} settingKey="kicker" value={kicker} />
            </p>
            <span className="lib-rt-rule" aria-hidden="true" />
          </>
        )}
        {heading && (
          <h2 className="lib-heading lib-rt-heading">
            <InlineText sectionId={sectionId} settingKey="heading" value={heading} />
          </h2>
        )}
        {content && <RichText html={content} className="lib-rt-body" />}
        {note && (bylineName || bylineRole) && (
          <p className="lib-label lib-rt-byline">
            {bylineName && (
              <span>
                <InlineText sectionId={sectionId} settingKey="byline_name" value={bylineName} />
              </span>
            )}
            {bylineRole && (
              <span>
                <InlineText sectionId={sectionId} settingKey="byline_role" value={bylineRole} />
              </span>
            )}
          </p>
        )}
      </div>
    </section>
  );
}
