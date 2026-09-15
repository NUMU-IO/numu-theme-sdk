// @vitest-environment node
import { createElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { describe, expect, it } from "vitest";

import { defineThemeEntry } from "../entry";
import type { ThemeMountContext } from "../mount";
import Section from "../sections/lib-gallery/Gallery";
import type { Store } from "../types/entities";
import type { SectionInstance, ThemeSettingsV3 } from "../types/theme";

const type = "lib-gallery";

async function render(settings: Record<string, unknown>, { locale = "en", instance: extra }: { locale?: string; instance?: Partial<SectionInstance> } = {}) {
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

const photos = (list: Array<Record<string, unknown> & { disabled?: boolean }>): { instance: Partial<SectionInstance> } => ({
  instance: {
    blocks: Object.fromEntries(list.map(({ disabled, ...settings }, i) => [`p${i}`, { type: "photo", disabled, settings }])),
    block_order: list.map((_, i) => `p${i}`),
  } as unknown as Partial<SectionInstance>,
});

const THREE = photos([
  { image: "https://cdn.example.com/a.jpg", link: "https://instagram.com/p/1", name: "Farida", caption: "Linen set", product_link: "/products/linen" },
  { image: "https://cdn.example.com/b.jpg", name: "Nour" },
  { image: "https://cdn.example.com/c.jpg" },
]);

describe("lib-gallery", () => {
  it("renders nothing on the storefront without a photo that has an image", async () => {
    expect(await render({})).not.toContain("lib-gal");
    expect(await render({}, photos([{ name: "No image", link: "/x" }]))).not.toContain("lib-gal");
  });

  it("renders square tiles by default, with the handle LTR and a Follow us button", async () => {
    const html = await render({ heading: "On Instagram", handle: "@brand", visit_url: "https://instagram.com/brand", columns_desktop: 9, columns_mobile: 0 }, THREE);
    expect(html).toContain('class="lib-section lib-gal is-grid"');
    expect(html).toContain('class="lib-gal-grid"');
    expect(html.match(/class="lib-gal-tile"/g)).toHaveLength(3);
    expect(html).toContain('<span class="lib-gal-handle" dir="ltr">@brand</span>');
    expect(html).toContain("Follow us");
    expect(html).toContain('target="_blank"');
    // Clamped columns.
    expect(html).toContain("--lib-gal-cols:6");
    expect(html).toContain("--lib-gal-cols-m:1");
    // Grid shows images only.
    expect(html).not.toContain('class="lib-gal-info"');
    expect(html).not.toContain(">Farida<");
    expect(html).toContain('alt="Farida"');
  });

  it("uses masonry columns and portrait looks with name, caption and product link", async () => {
    expect(await render({ style: "masonry" }, THREE)).toContain('class="lib-gal-masonry"');
    const looks = await render({ style: "looks" }, THREE);
    expect(looks).toContain('class="lib-section lib-gal is-looks"');
    expect(looks.match(/class="lib-gal-look"/g)).toHaveLength(3);
    expect(looks).toContain("Farida");
    expect(looks).toContain("Linen set");
    expect(looks).toContain('href="/products/linen"');
    expect(looks).toContain("Shop this look");
  });

  it("ignores an unknown style and skips disabled or image-less photos, keeping order", async () => {
    const html = await render(
      { style: "carousel" },
      photos([
        { image: "https://cdn.example.com/second.jpg", name: "B" },
        { image: "https://cdn.example.com/hidden.jpg", disabled: true },
        { name: "no image" },
        { image: "https://cdn.example.com/third.jpg" },
      ]),
    );
    expect(html).toContain("is-grid");
    expect(html).not.toContain("hidden.jpg");
    expect(html.match(/class="lib-gal-tile"/g)).toHaveLength(2);
    expect(html.indexOf("second.jpg")).toBeLessThan(html.indexOf("third.jpg"));
  });

  it("uses Egyptian Arabic defaults for Arabic stores", async () => {
    const html = await render({ style: "looks", visit_url: "https://instagram.com/brand" }, { ...THREE, locale: "ar" });
    expect(html).toContain("تابعنا");
    expect(html).toContain("اتسوّق اللوك");
  });
});
