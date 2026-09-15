"use client";

/**
 * lib-process — numbered steps: how an order is made, packed or delivered.
 *
 * Built from Skeuomorphic's `skeu-process`. The workshop textures, brass tags
 * and motion are gone; the number badge takes the theme's accent colour. The
 * list is a real `<ol>`, so screen readers get the sequence and the visible
 * numbers are decoration. Arabic stores get Arabic-Indic numerals, as
 * DESIGN.md does for prices.
 *
 * On the storefront it renders nothing until a step has a title or text. In
 * the editor it shows three sample steps so the layout is visible.
 */

import { useLocale } from "../../hooks/useLocalization";
import { useResolvedSettings } from "../../hooks/useResolvedSettings";
import { applyImageTransform, asImageTransform } from "../../utils/imageTransform";
import { InlineText, useInsideEditor } from "../InlineText";
import { BASE_CSS, LibStyle, imageAlt, imageUrl, localized, responsiveImg, str } from "../_shared";
import type { LibrarySectionProps } from "../index";

interface Step {
  n: number;
  title: string;
  text: string;
  image: string;
  imageRaw?: unknown;
  alt: string;
}

const SAMPLES: Array<{ title: [string, string]; text: [string, string] }> = [
  {
    title: ["Pick your piece", "اختار اللي عاجبك"],
    text: ["Browse the collection and choose your size and colour.", "لفّ على المنتجات واختار المقاس واللون."],
  },
  {
    title: ["We prepare it with care", "بنجهّزه بعناية"],
    text: ["Every order is checked and packed by hand.", "كل طلب بيتراجع ويتغلّف بإيدينا."],
  },
  {
    title: ["Straight to your door", "لحد باب البيت"],
    text: ["We ship it straight to you.", "بنشحنه لحد عندك."],
  },
];

const STEP_IMG = { widths: [384, 640, 768], sizes: "(min-width: 768px) 33vw, 100vw" } as const;

const CSS = `
.lib-steps{padding-block:4rem}
@media (min-width:768px){.lib-steps{padding-block:6rem}}
.lib-steps-head{max-inline-size:42rem;margin-block-end:2.5rem}
.lib-steps-head .lib-heading{font-size:clamp(1.75rem,3.5vw,2.25rem)}
.lib-steps-head p{margin:.75rem 0 0;line-height:1.7;max-inline-size:52ch}
.lib-steps-list{display:grid;gap:1.5rem;margin:0;padding:0;list-style:none}
@media (min-width:768px){.lib-steps-list{grid-template-columns:repeat(3,1fr);gap:2rem}}
.lib-step{padding:1.25rem;border:1px solid color-mix(in srgb,currentColor 15%,transparent);border-radius:.5rem}
.lib-step-media{position:relative;aspect-ratio:7/5;overflow:hidden;margin-block-end:1.25rem;border-radius:.25rem}
.lib-step-media img{position:absolute;inset:0;inline-size:100%;block-size:100%;object-fit:cover}
.lib-step-row{display:flex;align-items:flex-start;gap:.75rem}
.lib-step-num{flex-shrink:0;display:grid;place-items:center;inline-size:2.25rem;block-size:2.25rem;border-radius:9999px;border:1px solid var(--theme-color-accent,currentColor);color:var(--theme-color-accent,currentColor);font-weight:600;font-variant-numeric:tabular-nums}
.lib-step h3{margin:0 0 .375rem;font-family:var(--theme-font-heading,inherit);font-size:1.125rem;font-weight:500}
.lib-step p{margin:0;font-size:.875rem;line-height:1.7}
`;

export default function Process({ instance, sectionId }: LibrarySectionProps) {
  const locale = useLocale();
  const s = useResolvedSettings(instance);
  const insideEditor = useInsideEditor();

  const steps: Step[] = [];
  for (let i = 1; i <= 5; i++) {
    const title = str(s[`step_${i}_title`]);
    const text = str(s[`step_${i}_text`]);
    if (!title && !text) continue;
    const imageRaw = s[`step_${i}_image`];
    steps.push({ n: i, title, text, image: imageUrl(imageRaw), imageRaw, alt: imageAlt(imageRaw, title) });
  }
  if (steps.length === 0 && insideEditor) {
    SAMPLES.forEach((sample, i) =>
      steps.push({
        n: i + 1,
        title: localized(locale, ...sample.title),
        text: localized(locale, ...sample.text),
        image: "",
        alt: "",
      }),
    );
  }
  if (steps.length === 0) return null;

  const title = str(s.title) || localized(locale, "How it works", "بنشتغل إزاي");
  const intro = str(s.intro);
  const numerals = new Intl.NumberFormat(localized(locale, "en-US", "ar-EG"));

  return (
    <section className="lib-section lib-steps">
      <LibStyle id="lib-base" css={BASE_CSS} />
      <LibStyle id="lib-process" css={CSS} />
      <div className="lib-container">
        <div className="lib-steps-head">
          <h2 className="lib-heading">
            <InlineText sectionId={sectionId} settingKey="title" value={title} />
          </h2>
          {intro && (
            <p className="lib-muted">
              <InlineText sectionId={sectionId} settingKey="intro" value={intro} multiline />
            </p>
          )}
        </div>

        <ol className="lib-steps-list">
          {steps.map((step, i) => (
            <li key={step.n} className="lib-step">
              {step.image && (
                <div className="lib-step-media">
                  <img
                    {...responsiveImg(step.image, STEP_IMG)}
                    alt={step.alt}
                    loading="lazy"
                    decoding="async"
                    style={applyImageTransform(asImageTransform(step.imageRaw), "cover")}
                  />
                </div>
              )}
              <div className="lib-step-row">
                <span className="lib-step-num" aria-hidden="true">
                  {numerals.format(i + 1)}
                </span>
                <div>
                  {step.title && (
                    <h3>
                      <InlineText sectionId={sectionId} settingKey={`step_${step.n}_title`} value={step.title} />
                    </h3>
                  )}
                  {step.text && (
                    <p className="lib-muted">
                      <InlineText sectionId={sectionId} settingKey={`step_${step.n}_text`} value={step.text} multiline />
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
