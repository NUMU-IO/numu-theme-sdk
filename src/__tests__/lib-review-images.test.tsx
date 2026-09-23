// @vitest-environment node
import { createElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { describe, expect, it } from "vitest";

import { defineThemeEntry } from "../entry";
import type { ThemeMountContext } from "../mount";
import Section from "../sections/lib-review-images/ReviewImages";
import type { Store } from "../types/entities";
import type { SectionInstance, ThemeSettingsV3 } from "../types/theme";

const type = "lib-review-images";

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

const reviews = (list: Array<{ image?: unknown; disabled?: boolean }>): { instance: Partial<SectionInstance> } => ({
  instance: {
    blocks: Object.fromEntries(list.map(({ disabled, ...settings }, i) => [`r${i}`, { type: "review", disabled, settings }])),
    block_order: list.map((_, i) => `r${i}`),
  } as unknown as Partial<SectionInstance>,
});

const THREE = reviews([
  { image: { url: "https://cdn.numueg.app/r1.jpg", alt: "Mona on WhatsApp" } },
  { image: "https://cdn.numueg.app/r2.jpg" },
  { image: "https://cdn.numueg.app/r3.jpg" },
]);

const alts = (html: string) => [...html.matchAll(/<img[^>]*\salt="([^"]*)"/g)].map((m) => m[1]);

describe("lib-review-images", () => {
  it("renders nothing on the storefront without a screenshot", async () => {
    expect(await render({})).not.toContain("lib-rv");
    expect(await render({}, reviews([{ image: "" }, { image: { url: "" } }]))).not.toContain("lib-rv");
  });

  it("fills two identical tracks and names each screenshot once", async () => {
    const html = await render({}, THREE);
    expect(html).toContain('class="lib-section lib-rv"');
    expect(html).toContain('<div class="lib-rv-viewport" dir="ltr">');
    // 3 screenshots repeat to 12 per track (at least 10), in two tracks.
    expect(html.match(/<li class="lib-rv-card"/g)).toHaveLength(24);
    expect(html.match(/<ul class="lib-rv-track" role="list">/g)).toHaveLength(1);
    expect(html.match(/<ul class="lib-rv-track" aria-hidden="true">/g)).toHaveLength(1);
    expect(alts(html).filter(Boolean)).toEqual(["Mona on WhatsApp", "Customer review 2", "Customer review 3"]);
    // Platform images go through the transform proxy.
    expect(html).toContain("/api/image-transform");
    expect(html).toContain("What our customers say");
  });

  it("paces the loop per screenshot, clamps the height and reads the direction", async () => {
    const html = await render({ speed: "fast", image_height: 900, direction: "right", heading: "Loved by you", subtitle: "Real messages" }, THREE);
    expect(html).toContain('class="lib-section lib-rv is-right"');
    expect(html).toContain("--lib-rv-h:560px");
    expect(html).toContain("--lib-rv-dur:36s");
    expect(html).toContain("Loved by you");
    expect(html).toContain("Real messages");

    const fallback = await render({ speed: "warp", image_height: "tall" }, THREE);
    expect(fallback).toContain("--lib-rv-h:360px");
    expect(fallback).toContain("--lib-rv-dur:60s");
  });

  it("skips disabled or image-less blocks, keeping the merchant's order", async () => {
    const html = await render(
      {},
      reviews([
        { image: "https://cdn.numueg.app/first.jpg" },
        { image: "https://cdn.numueg.app/hidden.jpg", disabled: true },
        {},
        { image: "https://cdn.numueg.app/second.jpg" },
      ]),
    );
    expect(html).not.toContain("hidden.jpg");
    expect(html.match(/<li class="lib-rv-card"/g)).toHaveLength(20);
    expect(html.indexOf("first.jpg")).toBeLessThan(html.indexOf("second.jpg"));
  });

  it("uses Egyptian Arabic defaults for Arabic stores", async () => {
    const html = await render({}, { ...THREE, locale: "ar" });
    expect(html).toContain("آراء عملائنا");
    expect(alts(html).filter(Boolean)).toEqual(["Mona on WhatsApp", "رأي عميل 2", "رأي عميل 3"]);
  });
});
