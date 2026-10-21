// @vitest-environment node
/**
 * lib-faq's product source: a product's public `faq.items` metafield shows
 * first, in the visitor's language (else the other), malformed data is
 * ignored, and the section renders nothing when there is nothing to show.
 */

import { createElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { describe, expect, it } from "vitest";

import { defineThemeEntry } from "../entry";
import type { ThemeMountContext } from "../mount";
import Faq, { productQuestions } from "../sections/lib-faq/Faq";
import type { Store } from "../types/entities";
import type { SectionInstance, ThemeSettingsV3 } from "../types/theme";

const FAQ = {
  ar: [{ question: "المقاس مظبوط؟", answer: "أيوه، على المقاس." }],
  en: [{ question: "Does it run true to size?", answer: "Yes." }],
};
const TYPED = {
  blocks: { g: { type: "group", settings: { title: "Shipping" }, blocks: { q: { type: "qa", settings: { question: "How long?", answer: "Two days." } } } } },
  block_order: ["g"],
};

async function render({ value, locale = "en", typed = false }: { value?: unknown; locale?: string; typed?: boolean } = {}) {
  const instance = { type: "lib-faq", settings: {}, ...(typed ? TYPED : {}) } as unknown as SectionInstance;
  const product = {
    id: "p1",
    name: "Dress",
    slug: "dress",
    images: [],
    variants: [],
    metafields: value === undefined ? [] : [{ namespace: "faq", key: "items", type: "json", value }],
  };
  const entry = defineThemeEntry(() => createElement("main", null, createElement(Faq, { instance, sectionId: "f-0" })));
  const ctx = {
    themeSettings: { schema_version: 3, theme_id: "fixture", global_settings: {}, templates: {}, section_groups: {} } as unknown as ThemeSettingsV3,
    storeData: { id: "s1", name: "Store", slug: "store", currency: "EGP", default_language: locale, use_nextjs_storefront: true } as Store,
    page: { type: "product", data: { product } },
    locale,
    demo: false,
    navigation: {},
  } as ThemeMountContext;
  const { prelude } = await prerenderToNodeStream(entry.createApp(ctx), { progressiveChunkSize: Number.MAX_SAFE_INTEGER });
  let html = "";
  for await (const chunk of prelude) html += chunk;
  return html;
}

describe("lib-faq product questions", () => {
  it("shows the product's own questions in the visitor's language, with FAQPage microdata", async () => {
    const en = await render({ value: FAQ });
    expect(en).toContain("Does it run true to size?");
    expect(en).not.toContain("المقاس مظبوط؟");
    expect(en).toContain("https://schema.org/FAQPage");
    expect(await render({ value: FAQ, locale: "ar" })).toContain("المقاس مظبوط؟");
  });

  it("puts them before the questions typed into the section", async () => {
    const html = await render({ value: FAQ, typed: true });
    expect(html.indexOf("Does it run true to size?")).toBeLessThan(html.indexOf("How long?"));
  });

  it("falls back to the other language, and takes a plain list or a JSON string", () => {
    expect(productQuestions({ ar: [], en: FAQ.en }, "ar").map((i) => i.q)).toEqual(["Does it run true to size?"]);
    expect(productQuestions(FAQ.en, "ar")).toHaveLength(1);
    expect(productQuestions(JSON.stringify(FAQ), "ar")[0].q).toBe("المقاس مظبوط؟");
  });

  it("ignores malformed data and items without both texts, and caps the list", () => {
    for (const bad of [null, 42, "not json", { ar: "x" }, [null, { question: "Q only" }, { answer: "A only" }]]) {
      expect(productQuestions(bad, "en")).toEqual([]);
    }
    const many = Array.from({ length: 12 }, (_, i) => ({ question: `Q${i}`, answer: "x".repeat(2000) }));
    const capped = productQuestions(many, "en");
    expect(capped).toHaveLength(8);
    expect(capped[0].a).toHaveLength(1000);
  });

  it("renders nothing on the storefront with nothing to show", async () => {
    expect(await render({ value: { ar: [], en: [] } })).not.toContain('class="lib-section');
  });
});
