// @vitest-environment node
/**
 * lib-product-reviews — server render: nothing without the Reviews app or off
 * a product page; with both, the heading and a fixed placeholder, and no
 * request until the section nears the screen in the browser.
 */

import { createElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { describe, expect, it } from "vitest";

import { defineThemeEntry } from "../entry";
import type { ThemeMountContext } from "../mount";
import ProductReviews from "../sections/lib-product-reviews/ProductReviews";
import type { Store } from "../types/entities";
import type { SectionInstance, ThemeSettingsV3 } from "../types/theme";

const PRODUCT = { id: "p1", name: "Dress", slug: "dress", images: [], variants: [] };

async function render({
  app = true,
  product = true,
  locale = "en",
}: { app?: boolean; product?: boolean; locale?: string } = {}) {
  const instance = { type: "lib-product-reviews", settings: {} } as SectionInstance;
  const entry = defineThemeEntry(() =>
    createElement("main", null, createElement(ProductReviews, { instance, sectionId: "r-0" })),
  );
  const ctx = {
    themeSettings: { schema_version: 3, theme_id: "fixture", global_settings: {}, templates: {}, section_groups: {} } as unknown as ThemeSettingsV3,
    storeData: {
      id: "s1",
      name: "Store",
      slug: "store",
      currency: "EGP",
      default_language: locale,
      use_nextjs_storefront: true,
      installed_apps: app ? [{ slug: "reviews", settings: {} }] : [],
    } as Store,
    page: product ? { type: "product", data: { product: PRODUCT } } : { type: "home", data: {} },
    locale,
    demo: false,
    navigation: {},
  } as ThemeMountContext;
  const { prelude } = await prerenderToNodeStream(entry.createApp(ctx), { progressiveChunkSize: Number.MAX_SAFE_INTEGER });
  let html = "";
  for await (const chunk of prelude) html += chunk;
  return html;
}

describe("lib-product-reviews", () => {
  it("renders nothing without the app or off a product page", async () => {
    expect(await render({ app: false })).not.toContain("lib-prv");
    expect(await render({ product: false })).not.toContain("lib-prv");
  });

  it("holds the space under its heading until the reviews load", async () => {
    const html = await render();
    expect(html).toContain("Customer reviews");
    expect(html).toContain("lib-prv-ghost");
  });

  it("speaks Arabic on an Arabic store", async () => {
    expect(await render({ locale: "ar" })).toContain("آراء العملاء");
  });
});
