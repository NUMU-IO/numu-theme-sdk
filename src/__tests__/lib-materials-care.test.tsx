// @vitest-environment node
/** lib-materials-care — SSR under plain Node inside the real provider stack. */

import { createElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { describe, expect, it } from "vitest";

import { defineThemeEntry } from "../entry";
import type { ThemeMountContext } from "../mount";
import Section from "../sections/lib-materials-care/MaterialsCare";
import type { Store } from "../types/entities";
import type { SectionInstance, ThemeSettingsV3 } from "../types/theme";

async function render(settings: Record<string, unknown>, { locale = "en", instance: extra }: { locale?: string; instance?: Partial<SectionInstance> } = {}) {
  const type = "lib-materials-care";
  const instance = { type, settings, ...extra } as SectionInstance;
  const entry = defineThemeEntry(() => createElement("main", null, createElement(Section, { instance, sectionId: `${type}-0` })));
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

const rows = {
  instance: {
    blocks: {
      a: { type: "row", settings: { term: "Fabric", description: "100% Egyptian cotton." } },
      b: { type: "row", settings: { term: "Washing", description: "Cold, inside out." } },
      c: { type: "row", settings: { term: "", description: "" } },
      d: { type: "row", disabled: true, settings: { term: "Hidden", description: "x" } },
    },
    // Not key order: the merchant moved Washing to the top.
    block_order: ["b", "a", "c", "d"],
  } as Partial<SectionInstance>,
};

describe("lib-materials-care", () => {
  it("renders nothing on the storefront when empty", async () => {
    expect(await render({ heading: "Care" })).not.toContain('class="lib-section');
    expect(await render({}, { instance: { blocks: { c: { type: "row", settings: {} } } } as Partial<SectionInstance> })).not.toContain('class="lib-section');
  });

  it("renders rows as a definition list in the merchant's order", async () => {
    const html = await render({ guarantee_text: "Free repairs for a year." }, rows);
    expect(html).toContain('class="lib-section lib-mc is-list"');
    expect(html).toContain('<dl class="lib-mc-list">');
    expect(html.match(/<div class="lib-mc-row">/g)).toHaveLength(2);
    expect(html.indexOf("Washing")).toBeLessThan(html.indexOf("Fabric"));
    expect(html).not.toContain("Hidden");
    expect(html).toContain('<p class="lib-mc-guarantee">Free repairs for a year.</p>');
    expect(html).toContain("Materials &amp; care");
    expect(html).not.toContain("<h1");
  });

  it("applies the columns style and falls back to list for unknown values", async () => {
    expect(await render({ style: "columns" }, rows)).toContain('class="lib-section lib-mc is-columns"');
    expect(await render({ style: "grid" }, rows)).toContain('class="lib-section lib-mc is-list"');
  });

  it("renders a guarantee-only section with Arabic defaults, without an empty list", async () => {
    const html = await render({ guarantee_text: "التصليح علينا." }, { locale: "ar" });
    expect(html).toContain("الخامات والعناية");
    expect(html).toContain('class="lib-mc-guarantee"');
    expect(html).not.toContain("<dl");
  });
});
