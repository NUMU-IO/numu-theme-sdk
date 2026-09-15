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

import Section from "../sections/lib-made-to-order/MadeToOrder";

const TYPE = "lib-made-to-order";

async function render(settings: Record<string, unknown>, { locale = "en" }: { locale?: string } = {}) {
  const instance = { type: TYPE, settings } as SectionInstance;
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

describe("lib-made-to-order", () => {
  beforeEach(() => {
    editor.on = false;
  });

  it("renders nothing on the storefront when every field is empty", async () => {
    const html = await render({ title: "Bespoke", button_label: "Ask" });
    expect(html).not.toContain("lib-mto");
    expect(html).not.toContain("Bespoke");
  });

  it("renders the card with a WhatsApp link built from an Egyptian local number", async () => {
    const html = await render({
      lead_time_text: "Ready in a week.",
      personalization_text: "Add initials.",
      note: "Handmade in Cairo.",
      whatsapp_number: "010 1234 5678",
    });
    expect(html).toContain('class="lib-section lib-mto"');
    expect(html).toContain("Made for you");
    expect(html.match(/class="lib-mto-row"/g)).toHaveLength(2);
    expect(html).toContain('class="lib-mto-note"');
    expect(html).toContain('href="https://wa.me/201012345678"');
    expect(html).toContain('class="lib-mto-btn"');
    expect(html).toContain("Chat with us on WhatsApp");
    expect(html).toMatch(/class="lib-mto-phone" dir="ltr">010 1234 5678</);
  });

  it("drops an invalid WhatsApp number: no button, and nothing if it was the only field", async () => {
    expect(await render({ whatsapp_number: "12" })).not.toContain("lib-mto");
    const html = await render({ note: "Made by hand.", whatsapp_number: "abc" });
    expect(html).toContain('class="lib-mto-note"');
    expect(html).not.toContain('class="lib-mto-btn"');
  });

  it("speaks Egyptian Arabic defaults for an Arabic store", async () => {
    const html = await render({ lead_time_text: "جاهزة في أسبوع", whatsapp_number: "01012345678" }, { locale: "ar" });
    expect(html).toContain("بنفصّلهولك مخصوص");
    expect(html).toContain("كلّمنا على واتساب");
  });

  it("prompts inside the editor when empty", async () => {
    editor.on = true;
    const html = await render({}, { locale: "ar" });
    expect(html).toContain('class="lib-section lib-empty"');
    expect(html).toContain("رقم واتساب");
  });
});
