// @vitest-environment node
import { createElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { defineThemeEntry } from "../entry";
import type { ThemeMountContext } from "../mount";
import type { Store } from "../types/entities";
import type { SectionInstance, ThemeSettingsV3 } from "../types/theme";

const editor = vi.hoisted(() => ({ on: false }));
vi.mock("../sections/InlineText", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../sections/InlineText")>()),
  useInsideEditor: () => editor.on,
}));

import Section from "../sections/lib-logo-list/LogoList";

const TYPE = "lib-logo-list";

async function render(settings: Record<string, unknown>, { locale = "en", instance: extra }: { locale?: string; instance?: Partial<SectionInstance> } = {}) {
  const instance = { type: TYPE, settings, ...extra } as SectionInstance;
  const entry = defineThemeEntry(() => createElement("main", null, createElement(Section, { instance, sectionId: `${TYPE}-0` })));
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

const logos = {
  instance: {
    blocks: {
      a: { type: "logo", settings: { image: "https://cdn.numueg.app/a.png", name: "Alpha", link: "https://alpha.example" } },
      b: { type: "logo", settings: { image: { url: "/b.png", alt: "Beta mark" } } },
      c: { type: "logo", settings: { name: "No image" } },
      d: { type: "logo", disabled: true, settings: { image: "/d.png", name: "Disabled" } },
    },
    block_order: ["b", "a", "c", "d"],
  } as Partial<SectionInstance>,
};

describe("lib-logo-list", () => {
  beforeEach(() => {
    editor.on = false;
  });

  it("renders nothing on the storefront without a logo image", async () => {
    const html = await render({ heading: "As seen in" }, { instance: { blocks: { c: { type: "logo", settings: { name: "X" } } } } as Partial<SectionInstance> });
    expect(html).not.toContain("lib-logos");
    expect(html).not.toContain("As seen in");
  });

  it("renders logos in order with alt text, links, and skips imageless or disabled logos", async () => {
    const html = await render({ heading: "Brands we carry" }, logos);
    expect(html).toContain('class="lib-section lib-logos is-row is-gray"');
    expect(html).toContain('class="lib-heading lib-logos-heading"');
    expect(html.match(/class="lib-logos-item"/g)).toHaveLength(2);
    expect(html.indexOf('alt="Beta mark"')).toBeLessThan(html.indexOf('alt="Alpha"'));
    expect(html).toContain('href="https://alpha.example"');
    expect(html).toContain("/api/image-transform");
    expect(html).not.toContain("Disabled");
    expect(html).toContain("--lib-logos-h:40px");
  });

  it("switches to the grid style and turns greyscale off", async () => {
    const html = await render({ style: "grid", grayscale: false }, logos);
    expect(html).toContain('class="lib-section lib-logos is-grid"');
  });

  it("clamps the logo height and ignores garbage", async () => {
    expect(await render({ logo_height: 400 }, logos)).toContain("--lib-logos-h:96px");
    expect(await render({ logo_height: 2 }, logos)).toContain("--lib-logos-h:24px");
    expect(await render({ logo_height: "big" }, logos)).toContain("--lib-logos-h:40px");
  });

  it("prompts in Egyptian Arabic inside the editor for an Arabic store", async () => {
    editor.on = true;
    const html = await render({}, { locale: "ar" });
    expect(html).toContain('class="lib-section lib-empty"');
    expect(html).toContain("ضيف لوجوهات علشان القسم يظهر");
  });
});
