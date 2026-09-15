/**
 * lib-video — SSR output per style/aspect/source, the empty state, Arabic
 * defaults, and autoplay decided only after mount.
 */

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { prerenderToNodeStream } from "react-dom/static";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defineThemeEntry } from "../entry";
import type { ThemeMountContext } from "../mount";
import type { Store } from "../types/entities";
import type { SectionInstance, ThemeSettingsV3 } from "../types/theme";
import Section from "../sections/lib-video/Video";

const TYPE = "lib-video";

function app(settings: Record<string, unknown>, locale = "en") {
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
  return entry.createApp(ctx);
}

async function render(settings: Record<string, unknown>, { locale = "en" } = {}) {
  const { prelude } = await prerenderToNodeStream(app(settings, locale), { progressiveChunkSize: Number.MAX_SAFE_INTEGER });
  let html = "";
  for await (const chunk of prelude) html += chunk;
  return html;
}

async function mount(settings: Record<string, unknown>) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
  // Unit tests never reach the network: happy-dom would load the embed page.
  (window as unknown as { happyDOM: { settings: { disableIframePageLoading: boolean } } }).happyDOM.settings.disableIframePageLoading = true;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const el = document.createElement("div");
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => root.render(app(settings)));
  return { el, unmount: () => act(async () => root.unmount()) };
}

const YT = "https://www.youtube.com/watch?v=abc123";

describe("lib-video", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("renders nothing on the storefront without a video (a poster alone is not enough)", async () => {
    expect(await render({})).not.toContain("<section");
    expect(await render({ poster: "/p.jpg", heading: "Hi", video: { url: "" } })).not.toContain("<section");
  });

  it("renders an uploaded file contained, with controls, preload none and the poster", async () => {
    const html = await render({ video: { url: "/clip.mp4" }, poster: "/p.jpg", heading: "Our atelier", text: "How it's made" });
    expect(html).toContain('class="lib-section lib-video is-contained"');
    expect(html).toContain('class="lib-container"');
    expect(html).toContain('class="lib-video-head"');
    expect(html).toContain('class="lib-video-frame is-16-9"');
    expect(html).toMatch(/<video[^>]*preload="none"/);
    expect(html).toMatch(/<video[^>]*controls=""/);
    expect(html).toMatch(/<video[^>]*playsInline=""|<video[^>]*playsinline=""/);
    expect(html).toMatch(/<video[^>]*poster="\/api\/image-transform[^"]*p\.jpg/);
    expect(html).toContain("<h2");
    expect(html).toContain("Our atelier");
    expect(html).not.toContain('class="lib-video-overlay"');
  });

  it("full style puts the copy over the video and drops the container", async () => {
    const html = await render({ video: "/clip.mp4", style: "full", heading: "Eid drop" });
    expect(html).toContain('class="lib-section lib-video is-full"');
    expect(html).toContain('class="lib-video-overlay"');
    expect(html).not.toContain('class="lib-container"');
  });

  it("uses the chosen aspect and ignores an unknown one", async () => {
    expect(await render({ video: "/clip.mp4", aspect: "9-16" })).toContain('class="lib-video-frame is-9-16"');
    expect(await render({ video: "/clip.mp4", aspect: "21-9", style: "wild" })).toContain('class="lib-section lib-video is-contained"');
    expect(await render({ video: "/clip.mp4", aspect: "21-9" })).toContain('class="lib-video-frame is-16-9"');
  });

  it("embeds a YouTube link without autoplay on the server even when autoplay is on", async () => {
    const html = await render({ video: YT, autoplay: true });
    expect(html).toMatch(/<iframe[^>]*src="https:\/\/www\.youtube-nocookie\.com\/embed\/abc123\?[^"]*controls=1/);
    expect(html).not.toContain("autoplay=1");
  });

  it("uses Arabic defaults for an Arabic store", async () => {
    const html = await render({ video: YT }, { locale: "ar" });
    expect(html).toContain('title="فيديو"');
  });

  it("switches the embed to autoplay after mount when the visitor allows motion", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const { el, unmount } = await mount({ video: YT, autoplay: true });
    expect(el.querySelector("iframe")?.getAttribute("src")).toContain("autoplay=1");
    await unmount();
  });

  it("never autoplays under prefers-reduced-motion", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce") }));
    const { el, unmount } = await mount({ video: YT, autoplay: true });
    expect(el.querySelector("iframe")?.getAttribute("src")).not.toContain("autoplay=1");
    await unmount();
  });
});
