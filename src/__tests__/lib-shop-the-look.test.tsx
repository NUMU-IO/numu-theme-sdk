// @vitest-environment node
import { createElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { describe, expect, it } from "vitest";

import { defineThemeEntry } from "../entry";
import type { ThemeMountContext } from "../mount";
import Section from "../sections/lib-shop-the-look/ShopTheLook";
import type { Store } from "../types/entities";
import type { SectionInstance, ThemeSettingsV3 } from "../types/theme";

const type = "lib-shop-the-look";

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

const spots = (list: Array<Record<string, unknown>>): { instance: Partial<SectionInstance> } => ({
  instance: {
    blocks: Object.fromEntries(list.map((settings, i) => [`h${i}`, { type: "hotspot", settings }])),
    block_order: list.map((_, i) => `h${i}`),
  } as unknown as Partial<SectionInstance>,
});

const LOOK = spots([
  { x: 20, y: 30, label: "Denim jacket", price_text: "EGP 1,200", link: "/products/jacket" },
  { x: 60, y: 70, label: "Tote" },
]);

describe("lib-shop-the-look", () => {
  it("renders nothing on the storefront without an image", async () => {
    expect(await render({}, LOOK)).not.toContain("lib-stl");
  });

  it("renders numbered dots and a matching list, with no highlight on the server", async () => {
    const html = await render({ heading: "The look", image: "https://cdn.example.com/look.jpg" }, LOOK);
    expect(html).toContain('class="lib-section lib-stl is-image-start"');
    expect(html).toContain('<h2 class="lib-heading lib-stl-title">The look</h2>');
    // A linked dot is an <a>, an unlinked one a button; both named.
    expect(html).toMatch(/<a href="\/products\/jacket" class="lib-stl-dot" style="left:20%;top:30%" aria-label="1. Denim jacket — EGP 1,200"/);
    expect(html).toMatch(/<button class="lib-stl-dot"[^>]*aria-label="2. Tote"[^>]*type="button"|<button type="button" class="lib-stl-dot"[^>]*aria-label="2. Tote"/);
    expect(html.match(/class="lib-stl-item"/g)).toHaveLength(2);
    expect(html).toContain('<span class="lib-stl-price" dir="ltr">EGP 1,200</span>');
    expect(html).not.toMatch(/class="[^"]*is-active/);
  });

  it("uses a native mobile source and the image-end layout", async () => {
    const html = await render({ image: "https://cdn.example.com/look.jpg", image_mobile: "https://cdn.example.com/phone.jpg", layout: "image-end" }, LOOK);
    expect(html).toContain('class="lib-section lib-stl is-image-end"');
    expect(html).toMatch(/<source media="\(max-width: 768px\)" srcSet="https:\/\/cdn.example.com\/phone.jpg"/);
  });

  it("clamps positions, ignores an unknown layout and skips empty hotspots", async () => {
    const html = await render(
      { image: "https://cdn.example.com/look.jpg", layout: "sideways" },
      spots([{ x: 140, y: -5, label: "Scarf" }, { x: 10, y: 10 }, { y: "top", label: "Belt" }]),
    );
    expect(html).toContain("is-image-start");
    expect(html).toContain("left:100%;top:0%");
    expect(html).toContain("left:50%;top:50%");
    expect(html.match(/class="lib-stl-dot"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="2. Belt"');
  });

  it("names an unlabelled dot in Egyptian Arabic for Arabic stores", async () => {
    const html = await render({ image: "https://cdn.example.com/look.jpg" }, { ...spots([{ price_text: "٤٥٠ ج.م", link: "/products/x" }]), locale: "ar" });
    expect(html).toContain('aria-label="1. قطعة — ٤٥٠ ج.م"');
  });
});
