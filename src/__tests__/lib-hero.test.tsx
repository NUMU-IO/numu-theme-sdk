// @vitest-environment node
/** lib-hero — SSR output of every style, under the real provider stack. */

import { createElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { describe, expect, it } from "vitest";

import { defineThemeEntry } from "../entry";
import type { ThemeMountContext } from "../mount";
import type { Store } from "../types/entities";
import type { SectionInstance, ThemeSettingsV3 } from "../types/theme";
import Hero from "../sections/lib-hero/Hero";

type Blocks = Record<string, { type: string; disabled?: boolean; settings: Record<string, unknown> }>;

async function render(settings: Record<string, unknown>, blocks: Blocks = {}, { locale = "en", order }: { locale?: string; order?: string[] } = {}) {
  const instance = { type: "lib-hero", settings, blocks, block_order: order ?? Object.keys(blocks) } as unknown as SectionInstance;
  const entry = defineThemeEntry(() => createElement("main", null, createElement(Hero, { instance, sectionId: "lib-hero-0" })));
  const ctx = {
    themeSettings: {
      schema_version: 3,
      theme_id: "library-fixture",
      global_settings: {},
      templates: {},
      section_groups: {},
    } as unknown as ThemeSettingsV3,
    storeData: {
      id: "s1",
      name: "Store",
      slug: "store",
      currency: "EGP",
      default_language: locale,
      use_nextjs_storefront: true,
    } as Store,
    page: { type: "home", data: { products: [], collections: [] } },
    locale,
    demo: false,
    navigation: {},
  } as ThemeMountContext;
  const { prelude } = await prerenderToNodeStream(entry.createApp(ctx), { progressiveChunkSize: Number.MAX_SAFE_INTEGER });
  let html = "";
  for await (const chunk of prelude) html += chunk;
  return html;
}

const IMG = "https://cdn.numueg.app/hero/a.jpg";
const slide = (settings: Record<string, unknown>) => ({ type: "slide", settings });
const three: Blocks = {
  a: slide({ image: IMG, headline: "First", cta_text: "Shop", cta_link: "/collections/new" }),
  b: slide({ image: "https://cdn.numueg.app/hero/b.jpg", headline: "Second", text_color: "dark" }),
  c: slide({ headline: "Third" }),
};
const imgs = (html: string) => html.match(/<img[^>]*>/g) ?? [];

describe("lib-hero", () => {
  it("renders nothing on the storefront without a slide that has an image or headline", async () => {
    expect(await render({})).not.toContain('class="lib-section');
    expect(await render({}, { a: slide({ eyebrow: "Only an eyebrow", cta_text: "Shop" }) })).not.toContain('class="lib-section');
  });

  it("full: one slide over a scrim, h2 headline, HeroMedia with LCP priority, no invented buttons", async () => {
    const html = await render({}, { a: slide({ image: IMG, headline: "Summer", cta2_text: "", cta_link: "/sale" }) });
    expect(html).toContain('class="lib-section lib-hero is-full is-h-large is-align-center"');
    expect(html).toContain('<h2 class="lib-heading lib-hero-heading">Summer</h2>');
    expect(html).toContain('class="lib-hero-scrim"');
    expect(html).toContain("opacity:0.3");
    const [img, ...rest] = imgs(html);
    expect(rest).toHaveLength(0);
    expect(img).toContain('class="lib-hero-img"');
    expect(img).toContain('loading="eager"');
    expect(img).toContain('fetchPriority="high"');
    expect(img).toContain("/api/image-transform?url=");
    expect(html).not.toContain('class="lib-hero-btn');
    expect(html).not.toContain("<h1");
  });

  it("full shows only the first enabled slide, in block order", async () => {
    const html = await render({ style: "full" }, three, { order: ["c", "a", "b"] });
    expect(html).toContain(">Third</h2>");
    expect(html).not.toContain(">First</h2>");
    expect(html).not.toContain('class="lib-hero-arrow');
  });

  it("split puts the image on the chosen side and uses a solid panel", async () => {
    const end = await render({ style: "split" }, three);
    expect(end).toContain('class="lib-section lib-hero is-split is-h-large is-align-center is-img-end"');
    expect(end).toContain('class="lib-hero-panel"');
    expect(end).toContain('class="lib-hero-splitmedia"');
    expect(end).not.toContain('class="lib-hero-scrim"');
    expect(end).toContain('href="/collections/new"');
    const start = await render({ style: "split", image_side: "start", text_align: "start" }, three);
    expect(start).toContain('class="lib-section lib-hero is-split is-h-large is-align-start is-img-start"');
    expect(await render({ style: "split", image_side: "sideways" }, three)).toContain("is-img-end");
  });

  it("slideshow: all slides on the server, only the first active, controls, no autoplay", async () => {
    const html = await render({ style: "slideshow", autoplay: true, interval: 4 }, three);
    expect(html).toContain('aria-roledescription="carousel"');
    expect(html.match(/class="lib-hero-slide[ "]/g)).toHaveLength(3);
    expect(html).toContain('class="lib-hero-slide is-active"');
    expect(html.match(/ inert=""/g)).toHaveLength(2);
    expect(html.match(/class="lib-hero-slide[^"]*"[^>]*aria-hidden="true"/g)).toHaveLength(2);
    // Server output never claims autoplay: the live region is polite.
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain('aria-live="off"');
    expect(html.match(/class="lib-hero-ctl lib-hero-dot"/g)).toHaveLength(3);
    // Match the element, not the `[aria-current="true"]` rule in the hoisted CSS.
    expect(html.match(/<button[^>]*aria-current="true"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Previous slide"');
    expect(html).toContain('aria-label="Next slide"');
    expect(html).toContain('aria-label="Slide 2 of 3"');
    // Slide 1 is the LCP image; slide 2 is lazy.
    const [first, second] = imgs(html);
    expect(first).toContain('loading="eager"');
    expect(second).toContain('loading="lazy"');
    expect(second).not.toContain("fetchPriority");
    expect(html).toContain('class="lib-hero-slide is-dark"');
  });

  it("slideshow skips disabled slides and drops controls when one slide remains", async () => {
    const html = await render({ style: "slideshow" }, { ...three, b: { ...three.b, disabled: true }, c: slide({}) });
    expect(html).not.toContain(">Second</h2>");
    expect(html).not.toContain('class="lib-hero-ctl');
    expect(html).not.toContain("aria-roledescription");
  });

  it("minimal: big headline, small image or none", async () => {
    const withImg = await render({ style: "minimal", height: "screen" }, three);
    expect(withImg).toContain('class="lib-section lib-hero is-minimal is-h-screen is-align-center"');
    expect(withImg).toContain('class="lib-hero-minimal has-image"');
    const noImg = await render({ style: "minimal", height: "bogus" }, { c: three.c });
    expect(noImg).toContain('class="lib-hero-minimal"');
    expect(noImg).toContain("is-h-large");
    expect(imgs(noImg)).toHaveLength(0);
  });

  it("clamps the overlay and hides the scrim at 0", async () => {
    expect(await render({ overlay_opacity: 150 }, three)).toContain("opacity:0.8");
    expect(await render({ overlay_opacity: 0 }, three)).not.toContain('class="lib-hero-scrim"');
    expect(await render({ overlay_opacity: "x" }, three)).toContain("opacity:0.3");
  });

  it("uses Egyptian Arabic labels for the slideshow controls", async () => {
    const html = await render({ style: "slideshow" }, three, { locale: "ar" });
    expect(html).toContain('aria-label="الشريحة اللي قبلها"');
    expect(html).toContain('aria-label="الشريحة اللي بعدها"');
    expect(html).toContain('aria-label="شريحة 1 من 3"');
    expect(html).toContain('aria-roledescription="سلايدر"');
    expect(html).toContain('aria-label="البانر الرئيسي"');
  });
});
