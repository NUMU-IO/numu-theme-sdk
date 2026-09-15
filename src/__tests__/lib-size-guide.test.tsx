// @vitest-environment node
/** lib-size-guide — SSR under plain Node inside the real provider stack. */

import { createElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { describe, expect, it } from "vitest";

import { defineThemeEntry } from "../entry";
import type { ThemeMountContext } from "../mount";
import Section from "../sections/lib-size-guide/SizeGuide";
import type { Store } from "../types/entities";
import type { SectionInstance, ThemeSettingsV3 } from "../types/theme";

async function render(settings: Record<string, unknown>, { locale = "en", instance: extra }: { locale?: string; instance?: Partial<SectionInstance> } = {}) {
  const type = "lib-size-guide";
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

const blocks = (map: Record<string, unknown>, order?: string[]) => ({
  instance: { blocks: map, block_order: order ?? Object.keys(map) } as Partial<SectionInstance>,
});

const chart = blocks(
  {
    r1: { type: "row", settings: { size: "S", values: "70, 94, 100" } },
    r2: { type: "row", settings: { size: "M", values: "76" } },
    r3: { type: "row", settings: { size: "L", values: "82, 100, 104, 999" } },
    r4: { type: "row", settings: { size: "", values: "1, 2, 3" } },
    r5: { type: "row", disabled: true, settings: { size: "XL", values: "88" } },
    m1: { type: "measure", settings: { title: "Waist", text: "Measure at the narrowest point." } },
    f1: { type: "fit", settings: { name: "Slim", best_for: "Narrow hips", link: "/collections/slim" } },
  },
  ["r1", "r2", "r3", "r4", "r5", "m1", "f1"],
);

describe("lib-size-guide", () => {
  it("renders nothing on the storefront when empty", async () => {
    expect(await render({ heading: "Sizes", whatsapp_number: "01012345678" })).not.toContain('class="lib-section');
    // Rows without a size, and disabled blocks, don't count.
    const html = await render({}, blocks({ r: { type: "row", settings: { values: "1" } }, d: { type: "fit", disabled: true, settings: { name: "X" } } }));
    expect(html).not.toContain('class="lib-section');
  });

  it("renders an accessible table, tips, fits and the WhatsApp button", async () => {
    const html = await render({ chart_columns: "Waist, Hip, Length", unit: "in", model_note: "Model wears M.", whatsapp_number: "01012345678", whatsapp_text: "Ask us" }, chart);
    expect(html).toContain('class="lib-section lib-sg is-table"');
    expect(html).toContain('class="lib-heading lib-sg-heading"');
    expect(html).toContain("<caption>Size guide (in)</caption>");
    expect(html.match(/<th scope="col">/g)).toHaveLength(4);
    expect(html.match(/<th scope="row">/g)).toHaveLength(3);
    expect(html).toContain('<td dir="ltr">94</td>');
    expect(html).toContain('class="lib-sg-scroll"');
    expect(html).toContain('class="lib-sg-measure"');
    expect(html).toContain('class="lib-sg-fit"');
    expect(html).toContain('href="/collections/slim"');
    expect(html).toContain('href="https://wa.me/201012345678"');
    expect(html).toContain("Model wears M.");
    expect(html).not.toContain("<h1");
    // Table precedes fits in the default style.
    expect(html.indexOf('class="lib-sg-table"')).toBeLessThan(html.indexOf('class="lib-sg-fits"'));
  });

  it("pads short rows with empty cells and drops extra values", async () => {
    const html = await render({ chart_columns: "Waist, Hip, Length" }, chart);
    const rowM = html.slice(html.indexOf('<th scope="row">M</th>'), html.indexOf('<th scope="row">L</th>'));
    expect(rowM.match(/<td dir="ltr">/g)).toHaveLength(3);
    expect(rowM).toContain('<td dir="ltr"></td>');
    expect(html).not.toContain("999");
    expect(html).not.toContain("XL");
  });

  it("puts fits first in the fits style and hides WhatsApp without a usable number", async () => {
    const html = await render({ style: "fits", chart_columns: "Waist", whatsapp_number: "12" }, chart);
    expect(html).toContain('class="lib-section lib-sg is-fits"');
    expect(html.indexOf('class="lib-sg-fits"')).toBeLessThan(html.indexOf('class="lib-sg-table"'));
    expect(html).not.toContain('class="lib-sg-wa"');
    expect(await render({ style: "bogus", chart_columns: "Waist" }, chart)).toContain('class="lib-section lib-sg is-table"');
  });

  it("uses Arabic defaults and splits columns on the Arabic comma", async () => {
    const html = await render({ chart_columns: "الوسط، الهيب", whatsapp_number: "01012345678" }, { ...chart, locale: "ar" });
    expect(html).toContain("دليل المقاسات (سم)");
    expect(html).toContain('<th scope="col">المقاس</th>');
    expect(html).toContain('<th scope="col">الوسط</th>');
    expect(html).toContain('<th scope="col">الهيب</th>');
    expect(html).toContain("طريقة القياس");
    expect(html).toContain("شوف القصّة دي");
    expect(html).toContain("اسألنا على واتساب عن المقاس");
  });
});
