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

import Section from "../sections/lib-trust-strip/TrustStrip";

const TYPE = "lib-trust-strip";

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

const items = (blocks: Record<string, unknown>, order?: string[]) => ({
  instance: { blocks, ...(order ? { block_order: order } : {}) } as Partial<SectionInstance>,
});

describe("lib-trust-strip", () => {
  beforeEach(() => {
    editor.on = false;
  });

  it("renders nothing on the storefront without items", async () => {
    const html = await render({ style: "cards", heading: "Why us" });
    expect(html).not.toContain("lib-trust");
    expect(html).not.toContain("Why us");
  });

  it("renders items in the merchant's order, skipping disabled and empty ones", async () => {
    const html = await render(
      { heading: "Why shop with us" },
      items(
        {
          a: { type: "item", settings: { icon: "truck", title: "Fast shipping", text: "2 days" } },
          b: { type: "item", settings: { icon: "cash", title: "Cash on delivery" } },
          c: { type: "item", disabled: true, settings: { title: "Hidden" } },
          d: { type: "item", settings: { icon: "gift" } },
        },
        ["b", "a", "c", "d"],
      ),
    );
    expect(html).toContain('class="lib-section lib-trust is-row"');
    expect(html).toContain('class="lib-heading lib-eyebrow lib-trust-heading"');
    expect(html.match(/class="lib-trust-item"/g)).toHaveLength(2);
    expect(html.indexOf("Cash on delivery")).toBeLessThan(html.indexOf("Fast shipping"));
    expect(html).not.toContain("Hidden");
  });

  it("switches to cards, and ignores an unknown style", async () => {
    const one = items({ a: { type: "item", settings: { title: "Original" } } });
    expect(await render({ style: "cards" }, one)).toContain('class="lib-section lib-trust is-cards"');
    expect(await render({ style: "zigzag" }, one)).toContain('class="lib-section lib-trust is-row"');
  });

  it("falls back to the shield icon for an unknown icon value", async () => {
    const html = await render({}, items({ a: { type: "item", settings: { icon: "rocket", title: "X" } } }));
    expect(html).toContain("m9 12 2 2 4-4");
  });

  it("caps the strip at six items", async () => {
    const blocks = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`b${i}`, { type: "item", settings: { title: `T${i}` } }]));
    const html = await render({}, items(blocks));
    expect(html.match(/class="lib-trust-item"/g)).toHaveLength(6);
  });

  it("shows Egyptian Arabic samples in the editor for an Arabic store", async () => {
    editor.on = true;
    const html = await render({}, { locale: "ar" });
    expect(html).toContain("الدفع عند الاستلام");
    expect(html).toContain("استبدال سهل");
    expect(html.match(/class="lib-trust-item"/g)).toHaveLength(4);
  });

  it("shows English samples in the editor for an English store", async () => {
    editor.on = true;
    expect(await render({})).toContain("Cash on delivery");
  });
});
