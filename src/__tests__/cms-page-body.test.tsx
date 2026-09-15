// @vitest-environment node
/**
 * CmsPageBody — renders the CMS page record on `page` routes only, and never a
 * body-less shell (that would hide the host's empty-page fallback).
 */

import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { defineThemeEntry } from "../entry";
import type { ThemeMountContext } from "../mount";
import type { Store } from "../types/entities";
import type { ThemeSettingsV3 } from "../types/theme";
import { CmsPageBody } from "../sections/CmsPageBody";

function render(page: ThemeMountContext["page"], locale = "en") {
  const entry = defineThemeEntry(() => createElement("main", null, createElement(CmsPageBody)));
  return renderToString(
    entry.createApp({
      themeSettings: { schema_version: 3, theme_id: "fixture", global_settings: {}, templates: {}, section_groups: {} } as unknown as ThemeSettingsV3,
      storeData: { id: "s1", name: "Store", slug: "store", currency: "EGP", default_language: locale, use_nextjs_storefront: true } as Store,
      page,
      locale,
      demo: false,
      navigation: {},
    } as ThemeMountContext),
  );
}

const refund = {
  type: "page",
  title: "Refund policy",
  handle: "refund-policy",
  data: {
    page: {
      title: "Refund policy",
      body: "<p>Refunds within 14 days.</p><script>alert(1)</script>",
      title_i18n: { en: "Refund policy", ar: "سياسة الاسترجاع" },
      body_i18n: { en: "<p>Refunds within 14 days.</p>", ar: "<p>الاسترجاع خلال ١٤ يوم.</p>" },
    },
  },
};

describe("CmsPageBody", () => {
  it("renders the title and sanitized body on a page route", () => {
    const html = render(refund);
    expect(html).toContain('<h1 class="lib-heading lib-cms-title">Refund policy</h1>');
    expect(html).toContain("Refunds within 14 days.");
  });

  it("uses the store language's copy", () => {
    const html = render(refund, "ar");
    expect(html).toContain("سياسة الاسترجاع");
    expect(html).toContain("الاسترجاع خلال ١٤ يوم.");
  });

  it("strips scripts from a body without translations", () => {
    const html = render({ ...refund, data: { page: { title: "T", body: "<p>ok</p><script>alert(1)</script>" } } });
    expect(html).toContain("<p>ok</p>");
    expect(html).not.toContain("<script>alert");
  });

  it("renders nothing without a body, so the host's empty-page fallback still shows", () => {
    expect(render({ type: "page", title: "Shipping", data: { page: { title: "Shipping", body: null } } })).not.toContain("lib-cms-page");
  });

  it("renders nothing outside page routes", () => {
    expect(render({ ...refund, type: "about" })).not.toContain("lib-cms-page");
  });
});
