// @vitest-environment node
/** lib-rich-text — SSR under plain Node inside the real provider stack. */

import { createElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { describe, expect, it, vi } from "vitest";

import { defineThemeEntry } from "../entry";
import type { ThemeMountContext } from "../mount";
import type { Store } from "../types/entities";
import type { SectionInstance, ThemeSettingsV3 } from "../types/theme";
import Section from "../sections/lib-rich-text/RichTextBlock";

const editor = vi.hoisted(() => ({ on: false }));
vi.mock("../sections/InlineText", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../sections/InlineText")>()),
  useInsideEditor: () => editor.on,
}));

async function render(settings: Record<string, unknown>, { locale = "en" }: { locale?: string } = {}) {
  const type = "lib-rich-text";
  const instance = { type, settings } as SectionInstance;
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

describe("lib-rich-text", () => {
  it("renders nothing on the storefront when empty, and a prompt in the editor", async () => {
    expect(await render({ style: "note", byline_name: "Sara" })).not.toContain('class="lib-section');
    editor.on = true;
    try {
      const html = await render({}, { locale: "ar" });
      expect(html).toContain('class="lib-section lib-empty"');
      expect(html).toContain("اكتب عنوان أو كلام للقسم ده");
    } finally {
      editor.on = false;
    }
  });

  it("treats a cleared editor's markup as empty, but keeps an image-only body", async () => {
    expect(await render({ content: "<p><br></p><p>&nbsp;</p>" })).not.toContain('class="lib-section');
    expect(await render({ content: '<p><img src="https://cdn.numueg.app/a.jpg"></p>' })).toContain('class="lib-rt-body"');
  });

  it("renders plain text with a sanitized body", async () => {
    const html = await render({
      heading: "Our story",
      content: '<p>Hello <strong>world</strong></p><script>alert(1)</script><img src=x onerror="alert(1)">',
    });
    expect(html).toContain('class="lib-section lib-rt is-plain is-narrow is-start"');
    expect(html).toContain('class="lib-heading lib-rt-heading"');
    expect(html).toContain('class="lib-rt-body"');
    expect(html).toContain("<strong>world</strong>");
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain('class="lib-rt-rule"');
  });

  it("renders the note style with kicker, rule and byline, plus width and alignment", async () => {
    const html = await render({
      style: "note",
      content: "<p>Every piece earns the page.</p>",
      byline_name: "Sara",
      byline_role: "Founder",
      width: "wide",
      align: "center",
    });
    expect(html).toContain('class="lib-section lib-rt is-note is-wide is-center"');
    expect(html).toContain('class="lib-rt-rule"');
    expect(html).toContain('class="lib-label lib-rt-byline"');
    expect(html).toContain("Editor&#x27;s note");
    expect(html).toContain("Founder");
  });

  it("uses the Arabic kicker for an Arabic store and ignores invalid options", async () => {
    const html = await render({ style: "note", heading: "أهلا", width: "huge", align: "left" }, { locale: "ar" });
    expect(html).toContain("كلمة المحرر");
    expect(html).toContain('class="lib-section lib-rt is-note is-narrow is-start"');
  });
});
