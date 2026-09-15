// @vitest-environment node
import { createElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defineThemeEntry } from "../entry";
import type { ThemeMountContext } from "../mount";
import type { Store } from "../types/entities";
import type { SectionInstance, ThemeSettingsV3 } from "../types/theme";

const editor = vi.hoisted(() => ({ on: false }));
vi.mock("../sections/InlineText", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../sections/InlineText")>()),
  useInsideEditor: () => editor.on,
}));

import Section, { subscribeNewsletter } from "../sections/lib-newsletter/Newsletter";

const TYPE = "lib-newsletter";

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

const IMAGE = "https://cdn.numueg.app/news.jpg";

describe("lib-newsletter", () => {
  beforeEach(() => {
    editor.on = false;
  });

  it("renders a real, accessible form with English defaults", async () => {
    const html = await render({});
    expect(html).toContain('class="lib-section lib-news is-centered"');
    expect(html).toContain("Be the first to know");
    expect(html).toMatch(/<label for="([^"]+)-email" class="lib-sr">Email address<\/label><input id="\1-email"/);
    expect(html).toMatch(/<input id="[^"]+-email" class="lib-news-input" type="email" required=""[^>]*dir="ltr" placeholder="Your email" name="email"\/>/);
    // honeypot: off-screen, unfocusable, hidden from assistive tech
    expect(html).toContain('class="lib-sr" type="text" tabindex="-1" autoComplete="off" aria-hidden="true" name="website"');
    expect(html).toContain(">Subscribe</button>");
    expect(html).toContain('role="status" aria-live="polite"');
  });

  it("uses Egyptian Arabic defaults for an Arabic store", async () => {
    const html = await render({}, { locale: "ar" });
    expect(html).toContain("اشترك وخليك أول واحد يعرف");
    expect(html).toContain('placeholder="إيميلك"');
    expect(html).toContain(">اشترك</button>");
  });

  it("hides a line the merchant emptied and uses custom copy", async () => {
    const html = await render({ heading: "", text: "Weekly drops", button_text: "Join", placeholder: "you@mail.com", note: "No spam" });
    expect(html).not.toContain('class="lib-heading lib-news-heading"');
    expect(html).toContain("Weekly drops");
    expect(html).toContain(">Join</button>");
    expect(html).toContain('placeholder="you@mail.com"');
    expect(html).toContain('class="lib-news-note">No spam</p>');
  });

  it("shows the image only in the split style", async () => {
    const split = await render({ style: "split", image: IMAGE });
    expect(split).toContain('class="lib-section lib-news is-split"');
    expect(split).toContain('class="lib-news-panel has-image"');
    expect(split).toContain("<img");

    const card = await render({ style: "card", image: IMAGE });
    expect(card).toContain('class="lib-section lib-news is-card"');
    expect(card).not.toContain("<img");

    expect(await render({ style: "zigzag" })).toContain('class="lib-section lib-news is-centered"');
  });
});

describe("subscribeNewsletter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stub = (impl: () => Promise<Response>) => {
    const fetchMock = vi.fn(impl);
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  };

  it("posts the email and honeypot to the host proxy", async () => {
    const fetchMock = stub(async () => new Response('{"data":{"status":"subscribed"}}', { status: 202 }));
    expect(await subscribeNewsletter("sara@example.com", "")).toBe("ok");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/storefront/newsletter");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ email: "sara@example.com", website: "" });
  });

  it.each([
    [422, "invalid"],
    [400, "invalid"],
    [429, "busy"],
    [502, "error"],
  ] as const)("maps HTTP %i to %s", async (status, result) => {
    stub(async () => new Response("{}", { status }));
    expect(await subscribeNewsletter("x@example.com")).toBe(result);
  });

  it("treats a network failure as an error, never as success", async () => {
    stub(async () => {
      throw new TypeError("offline");
    });
    expect(await subscribeNewsletter("x@example.com")).toBe("error");
  });
});
