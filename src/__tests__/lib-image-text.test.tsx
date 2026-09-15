// @vitest-environment node
/** lib-image-text — SSR under plain Node inside the real provider stack. */

import { createElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { describe, expect, it, vi } from "vitest";

import { defineThemeEntry } from "../entry";
import type { ThemeMountContext } from "../mount";
import type { Store } from "../types/entities";
import type { SectionInstance, ThemeSettingsV3 } from "../types/theme";
import Section from "../sections/lib-image-text/ImageText";

const editor = vi.hoisted(() => ({ on: false }));
vi.mock("../sections/InlineText", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../sections/InlineText")>()),
  useInsideEditor: () => editor.on,
}));

async function render(settings: Record<string, unknown>, { locale = "en", instance: extra }: { locale?: string; instance?: Partial<SectionInstance> } = {}) {
  const type = "lib-image-text";
  const instance = { type, settings, ...extra } as SectionInstance;
  const entry = defineThemeEntry(() => createElement("main", null, createElement(Section, { instance, sectionId: `${type}-0` })));
  const ctx = {
    themeSettings: { schema_version: 3, theme_id: "library-fixture", global_settings: {}, templates: {}, section_groups: {} } as unknown as ThemeSettingsV3,
    storeData: { id: "s1", name: "Store", slug: "store", currency: "EGP", default_language: locale, use_nextjs_storefront: true } as Store,
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

const full = {
  image: { url: "https://cdn.numueg.app/about.jpg", alt: "Workshop" },
  eyebrow: "About",
  title: "Made to last",
  quote: "We refine the details.",
  body: "Sourced from the finest mills.",
  cta_text: "Learn more",
  cta_link: "/about",
};

describe("lib-image-text", () => {
  it("renders nothing on the storefront when empty, and a prompt in the editor", async () => {
    expect(await render({ cta_text: "Shop", eyebrow: "x" })).not.toContain('class="lib-section');
    editor.on = true;
    try {
      const html = await render({}, { locale: "ar" });
      expect(html).toContain('class="lib-section lib-empty"');
      expect(html).toContain("ضيف صورة أو كلام للقسم ده");
    } finally {
      editor.on = false;
    }
  });

  it("renders split by default: image first, then copy, through the proxy", async () => {
    const html = await render(full);
    expect(html).toContain('class="lib-section lib-it is-split is-start"');
    expect(html).toContain('class="lib-it-grid has-media"');
    expect(html.indexOf('class="lib-it-media"')).toBeLessThan(html.indexOf('class="lib-it-copy"'));
    expect(html).toContain("/api/image-transform");
    expect(html).toContain('alt="Workshop"');
    expect(html).toContain('class="lib-heading lib-it-title"');
    expect(html).toContain('class="lib-it-body"');
    expect(html).toContain('href="/about"');
    expect(html).toContain("“We refine the details.”");
  });

  it("renders each style's class; overlay without an image falls back to split", async () => {
    expect(await render({ ...full, image_position: "end" })).toContain('class="lib-section lib-it is-split is-end"');
    const overlay = await render({ ...full, style: "overlay" });
    expect(overlay).toContain('class="lib-section lib-it is-overlay"');
    expect(overlay).toContain('class="lib-it-scrim"');
    expect(overlay).toContain("opacity:0.35");
    expect(await render({ ...full, style: "story" })).toContain('class="lib-section lib-it is-story"');
    expect(await render({ title: "Only text", style: "overlay" })).toContain('class="lib-section lib-it is-split is-start"');
    expect(await render({ ...full, style: "bogus" })).toContain("is-split");
  });

  it("clamps the overlay darkening and drops the scrim at zero", async () => {
    expect(await render({ ...full, style: "overlay", overlay_opacity: 95 })).toContain("opacity:0.7");
    expect(await render({ ...full, style: "overlay", overlay_opacity: 0 })).not.toContain('class="lib-it-scrim"');
  });

  it("uses Arabic quote marks for an Arabic store", async () => {
    const html = await render({ title: "صنع ليدوم", quote: "بنتقن التفاصيل" }, { locale: "ar" });
    expect(html).toContain("«بنتقن التفاصيل»");
  });

  it("story shows up to four value cards in block order, skipping disabled and empty ones", async () => {
    const card = (title: string, extra: Record<string, unknown> = {}) => ({ type: "value", settings: { title }, ...extra });
    const html = await render(
      { ...full, style: "story" },
      {
        instance: {
          blocks: {
            a: card("A"),
            b: card("B"),
            c: card("C", { disabled: true }),
            d: card(""),
            e: card("E"),
            f: card("F"),
            g: card("G"),
          },
          block_order: ["g", "a", "b", "c", "d", "e", "f"],
        } as unknown as Partial<SectionInstance>,
      },
    );
    const titles = [...html.matchAll(/<li class="lib-it-value"><h3>([^<]*)<\/h3>/g)].map((m) => m[1]);
    expect(titles).toEqual(["G", "A", "B", "E"]);
    expect(html).toContain('class="lib-it-figure"');
    // Split ignores the cards.
    expect(await render(full, { instance: { blocks: { a: card("A") } } as unknown as Partial<SectionInstance> })).not.toContain('class="lib-it-value"');
  });
});
