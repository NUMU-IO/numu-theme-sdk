import { describe, it, expect } from "vitest";
import { createElement } from "react";
import {
  makeFixtureContext,
  verifyThemeRender,
  REQUIRED_TEMPLATES,
  type ThemeServerModule,
} from "../verify";

describe("makeFixtureContext", () => {
  it("builds a complete context for a template", () => {
    const ctx = makeFixtureContext("product");
    expect(ctx.currentTemplate).toBe("product");
    expect(ctx.page?.type).toBe("product");
    // Page data is populated generously so any hook has data.
    const data = ctx.page?.data as Record<string, unknown>;
    expect(data.product).toBeTruthy();
    expect(Array.isArray(data.products)).toBe(true);
    expect(data.collection).toBeTruthy();
    expect(ctx.storeData?.currency).toBe("EGP");
    expect(ctx.initialCart?.items.length).toBeGreaterThan(0);
  });
});

describe("verifyThemeRender", () => {
  it("passes when every template renders non-empty HTML", async () => {
    const mod: ThemeServerModule = {
      createApp: (ctx) =>
        createElement("main", null, `theme:${ctx.currentTemplate}`),
    };
    const res = await verifyThemeRender(mod);
    expect(res.ok).toBe(true);
    expect(res.results.map((r) => r.template)).toEqual([...REQUIRED_TEMPLATES]);
    expect(res.results.every((r) => r.ok && r.htmlLength > 0)).toBe(true);
  });

  it("fails the template that throws, isolating the crash", async () => {
    const mod: ThemeServerModule = {
      createApp: (ctx) => {
        if (ctx.currentTemplate === "cart") throw new Error("boom in cart");
        return createElement("div", null, "ok");
      },
    };
    const res = await verifyThemeRender(mod);
    expect(res.ok).toBe(false);
    const cart = res.results.find((r) => r.template === "cart");
    expect(cart?.ok).toBe(false);
    expect(cart?.error).toContain("boom in cart");
    // Other templates still rendered fine.
    expect(res.results.filter((r) => r.template !== "cart").every((r) => r.ok)).toBe(
      true,
    );
  });

  it("fails on empty output (component renders nothing)", async () => {
    const Empty = () => null;
    const mod: ThemeServerModule = { createApp: () => createElement(Empty) };
    const res = await verifyThemeRender(mod, { templates: ["home"] });
    expect(res.ok).toBe(false);
    expect(res.results[0].error).toContain("empty");
  });

  it("fails when the bundle has no createApp", async () => {
    const res = await verifyThemeRender({} as ThemeServerModule);
    expect(res.ok).toBe(false);
    expect(res.results[0].error).toContain("createApp");
  });

  it("only renders the requested templates", async () => {
    const mod: ThemeServerModule = {
      createApp: () => createElement("div", null, "x"),
    };
    const res = await verifyThemeRender(mod, { templates: ["home", "product"] });
    expect(res.results.map((r) => r.template)).toEqual(["home", "product"]);
  });
});
