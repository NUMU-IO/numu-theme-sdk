/**
 * lib-countdown — the SSR placeholder, invalid dates, Cairo-time parsing, the
 * live tick after mount, and both after-end behaviours.
 */

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { prerenderToNodeStream } from "react-dom/static";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defineThemeEntry } from "../entry";
import type { ThemeMountContext } from "../mount";
import type { Store } from "../types/entities";
import type { SectionInstance, ThemeSettingsV3 } from "../types/theme";
import Section, { parseEndsAt } from "../sections/lib-countdown/Countdown";

const TYPE = "lib-countdown";

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

async function mount(settings: Record<string, unknown>, locale = "en") {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const el = document.createElement("div");
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => root.render(app(settings, locale)));
  return { el, unmount: () => act(async () => root.unmount()) };
}

const nums = (el: HTMLElement) => [...el.querySelectorAll(".lib-cd-num")].map((n) => n.textContent);

// 2026-10-01 is Egyptian summer time (UTC+3), so 23:59 Cairo = 20:59 UTC.
const ENDS_AT = "2026-10-01T23:59";
const END_MS = Date.UTC(2026, 9, 1, 20, 59);

describe("lib-countdown", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("renders nothing on the storefront with an empty or invalid end date", async () => {
    expect(await render({})).not.toContain("<section");
    expect(await render({ ends_at: "next Friday", heading: "Sale" })).not.toContain("<section");
    expect(await render({ ends_at: "2026-02-30T10:00" })).not.toContain("<section");
  });

  it("server output is a stable placeholder: -- in every unit, with labels", async () => {
    const html = await render({ ends_at: ENDS_AT, heading: "White Friday", text: "Up to 50% off", cta_text: "Shop", cta_link: "/collections/sale" });
    expect(html).toContain('class="lib-section lib-cd is-band"');
    expect(html).toContain('role="timer"');
    expect(html.match(/<span class="lib-cd-num" dir="ltr">--<\/span>/g)).toHaveLength(4);
    for (const label of ["days", "hours", "minutes", "seconds"]) expect(html).toContain(`<span class="lib-label">${label}</span>`);
    expect(html).toContain('class="lib-heading lib-cd-heading"');
    expect(html).toMatch(/<a[^>]*href="\/collections\/sale"[^>]*class="lib-cd-cta"|<a[^>]*class="lib-cd-cta"[^>]*href="\/collections\/sale"/);
  });

  it("card style produces its class", async () => {
    expect(await render({ ends_at: ENDS_AT, style: "card" })).toContain('class="lib-section lib-cd is-card"');
    expect(await render({ ends_at: ENDS_AT, style: "bogus" })).toContain('class="lib-section lib-cd is-band"');
  });

  it("uses Arabic unit labels for an Arabic store", async () => {
    const html = await render({ ends_at: ENDS_AT }, { locale: "ar" });
    for (const label of ["يوم", "ساعة", "دقيقة", "ثانية"]) expect(html).toContain(`<span class="lib-label">${label}</span>`);
  });

  it("parses wall-clock times in Cairo time across DST, and rejects nonsense", () => {
    expect(parseEndsAt(ENDS_AT)).toBe(END_MS);
    expect(parseEndsAt("2026-01-15T12:00")).toBe(Date.UTC(2026, 0, 15, 10, 0)); // winter, UTC+2
    expect(parseEndsAt("2026-01-15")).toBe(Date.UTC(2026, 0, 14, 22, 0));
    expect(parseEndsAt("2026-10-01T23:59Z")).toBe(Date.UTC(2026, 9, 1, 23, 59));
    expect(parseEndsAt("2026-10-01T23:59:00+02:00")).toBe(Date.UTC(2026, 9, 1, 21, 59));
    for (const bad of ["", "   ", "tomorrow", "2026-13-01", "2026-02-30", "2026-10-01T24:00", "01/10/2026", 42, null]) {
      expect(parseEndsAt(bad)).toBeNull();
    }
  });

  it("ticks the live time after mount and stops on unmount", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(END_MS - (1 * 86_400_000 + 2 * 3_600_000 + 3 * 60_000 + 4_000));
    const { el, unmount } = await mount({ ends_at: ENDS_AT });
    expect(nums(el)).toEqual(["01", "02", "03", "04"]);
    await act(async () => vi.advanceTimersByTime(1000));
    expect(nums(el)).toEqual(["01", "02", "03", "03"]);
    await unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("hides after mount when the offer has already ended (after_end: hide)", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(END_MS + 60_000);
    const { el, unmount } = await mount({ ends_at: ENDS_AT, heading: "Sale" });
    expect(el.querySelector("section")).toBeNull();
    await unmount();
  });

  it("shows the ended message without the button (after_end: message)", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(END_MS - 1000);
    const { el, unmount } = await mount({ ends_at: ENDS_AT, after_end: "message", cta_text: "Shop" }, "ar");
    expect(el.querySelector(".lib-cd-cta")).not.toBeNull();
    await act(async () => vi.advanceTimersByTime(1000));
    expect(el.querySelector(".lib-cd-ended")?.textContent).toBe("العرض خلص");
    expect(el.querySelector(".lib-cd-cta")).toBeNull();
    expect(el.querySelector('[role="timer"]')).toBeNull();
    await unmount();
  });
});
