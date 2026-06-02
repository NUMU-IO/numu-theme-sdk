/**
 * Unit tests for applyGlobalStyleTokens + resolveFontStack (Phase 3.5).
 *
 * This is the helper that bridges a store's global theme settings
 * (colors/fonts/layout) to CSS custom properties on the bundle's mount
 * root — the fix that made the Theme-Settings pickers stop being a
 * silent no-op. It had zero coverage before Phase 5.4.
 *
 * Environment: happy-dom (vitest.config) gives us a real `document` +
 * an element whose `.style` supports custom properties.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyGlobalStyleTokens, resolveFontStack } from "../utils/styleTokens";

function el(): HTMLElement {
  return document.createElement("div");
}

function fontLinks(): NodeListOf<Element> {
  return document.querySelectorAll("link[data-numu-font]");
}

beforeEach(() => {
  // Clear any webfont <link>s injected by a previous test so the
  // idempotency assertions start from a known state.
  fontLinks().forEach((l) => l.remove());
});

afterEach(() => {
  fontLinks().forEach((l) => l.remove());
});

describe("applyGlobalStyleTokens — colors", () => {
  it("maps a color setting to --theme-<id> verbatim", () => {
    const root = el();
    applyGlobalStyleTokens({ background_color: "#f7f1e8" }, root);
    expect(root.style.getPropertyValue("--theme-background_color")).toBe(
      "#f7f1e8",
    );
  });

  it("also emits the canonical role alias for a known color id", () => {
    const root = el();
    applyGlobalStyleTokens({ primary_color: "#3a2418" }, root);
    expect(root.style.getPropertyValue("--theme-primary_color")).toBe("#3a2418");
    expect(root.style.getPropertyValue("--theme-color-primary")).toBe("#3a2418");
  });

  it("recognises the color_<role> spelling too", () => {
    const root = el();
    applyGlobalStyleTokens({ color_background: "#fff" }, root);
    expect(root.style.getPropertyValue("--theme-color-background")).toBe("#fff");
  });

  it("trims whitespace around the color value", () => {
    const root = el();
    applyGlobalStyleTokens({ accent_color: "  #caramel  ".replace("caramel", "c47f42") }, root);
    expect(root.style.getPropertyValue("--theme-accent_color")).toBe("#c47f42");
    expect(root.style.getPropertyValue("--theme-color-accent")).toBe("#c47f42");
  });

  it("accepts rgb()/hsl()/var() color forms", () => {
    const root = el();
    applyGlobalStyleTokens(
      {
        text_color: "rgb(10, 20, 30)",
        border_color: "hsl(200 50% 40%)",
        button_color: "var(--x)",
      },
      root,
    );
    expect(root.style.getPropertyValue("--theme-color-text")).toBe(
      "rgb(10, 20, 30)",
    );
    expect(root.style.getPropertyValue("--theme-color-border")).toBe(
      "hsl(200 50% 40%)",
    );
    expect(root.style.getPropertyValue("--theme-color-button")).toBe("var(--x)");
  });

  it("does not set a role alias for an unknown color id", () => {
    const root = el();
    applyGlobalStyleTokens({ sidebar_tint: "#abcdef" }, root);
    expect(root.style.getPropertyValue("--theme-sidebar_tint")).toBe("#abcdef");
    // No role alias exists for an arbitrary id.
    expect(root.style.getPropertyValue("--theme-color-sidebar_tint")).toBe("");
  });
});

describe("applyGlobalStyleTokens — color schemes (object values)", () => {
  it("expands an object of role:color into --scheme-<id>-<role>", () => {
    const root = el();
    applyGlobalStyleTokens(
      { scheme_light: { background: "#ffffff", text: "#111111" } },
      root,
    );
    expect(root.style.getPropertyValue("--scheme-scheme_light-background")).toBe(
      "#ffffff",
    );
    expect(root.style.getPropertyValue("--scheme-scheme_light-text")).toBe(
      "#111111",
    );
  });

  it("skips non-color entries inside a scheme object", () => {
    const root = el();
    applyGlobalStyleTokens(
      { scheme_a: { background: "#000", label: "Dark" } },
      root,
    );
    expect(root.style.getPropertyValue("--scheme-scheme_a-background")).toBe(
      "#000",
    );
    expect(root.style.getPropertyValue("--scheme-scheme_a-label")).toBe("");
  });
});

describe("applyGlobalStyleTokens — fonts", () => {
  it("resolves a known font token to a stack + role alias + injects the webfont", () => {
    const root = el();
    applyGlobalStyleTokens({ heading_font: "cormorant" }, root);
    const stack = root.style.getPropertyValue("--theme-heading_font");
    expect(stack).toContain("Cormorant Garamond");
    expect(root.style.getPropertyValue("--theme-font-heading")).toBe(stack);
    // Exactly one webfont <link> injected.
    expect(fontLinks().length).toBe(1);
    expect(fontLinks()[0].getAttribute("href")).toContain("Cormorant+Garamond");
  });

  it("maps the body_font role too", () => {
    const root = el();
    applyGlobalStyleTokens({ body_font: "inter" }, root);
    expect(root.style.getPropertyValue("--theme-font-body")).toContain("Inter");
  });

  it("treats an unknown font value as a literal scalar (no role alias, no link)", () => {
    const root = el();
    applyGlobalStyleTokens({ heading_font: "Arial, sans-serif" }, root);
    expect(root.style.getPropertyValue("--theme-heading_font")).toBe(
      "Arial, sans-serif",
    );
    // Unknown families don't get a role alias (only registry tokens do).
    expect(root.style.getPropertyValue("--theme-font-heading")).toBe("");
    expect(fontLinks().length).toBe(0);
  });
});

describe("applyGlobalStyleTokens — scalars + guards", () => {
  it("passes through string/number layout scalars", () => {
    const root = el();
    applyGlobalStyleTokens({ page_width: "1240px", columns: 4 }, root);
    expect(root.style.getPropertyValue("--theme-page_width")).toBe("1240px");
    expect(root.style.getPropertyValue("--theme-columns")).toBe("4");
  });

  it("skips reserved __-prefixed keys (e.g. __translations)", () => {
    const root = el();
    applyGlobalStyleTokens(
      { __translations: { en: { x: "y" } }, primary_color: "#000" },
      root,
    );
    expect(root.style.getPropertyValue("--theme-__translations")).toBe("");
    expect(root.style.getPropertyValue("--theme-primary_color")).toBe("#000");
  });

  it("skips empty-string scalar values", () => {
    const root = el();
    applyGlobalStyleTokens({ page_width: "" }, root);
    expect(root.style.getPropertyValue("--theme-page_width")).toBe("");
  });

  it("is a no-op when el is null/undefined", () => {
    expect(() => applyGlobalStyleTokens({ primary_color: "#000" }, null)).not.toThrow();
    expect(() =>
      applyGlobalStyleTokens({ primary_color: "#000" }, undefined),
    ).not.toThrow();
  });

  it("is a no-op when globalSettings is null/undefined/non-object", () => {
    const root = el();
    expect(() => applyGlobalStyleTokens(null, root)).not.toThrow();
    expect(() => applyGlobalStyleTokens(undefined, root)).not.toThrow();
    // Nothing got written.
    expect(root.getAttribute("style")).toBeFalsy();
  });

  it("is idempotent — re-applying does not duplicate the webfont link", () => {
    const root = el();
    applyGlobalStyleTokens({ heading_font: "cormorant" }, root);
    applyGlobalStyleTokens({ heading_font: "cormorant" }, root);
    applyGlobalStyleTokens({ heading_font: "cormorant" }, root);
    expect(fontLinks().length).toBe(1);
  });
});

describe("resolveFontStack", () => {
  it("returns the registry stack for a known token + injects the link", () => {
    const stack = resolveFontStack("playfair");
    expect(stack).toContain("Playfair Display");
    expect(fontLinks().length).toBe(1);
  });

  it("returns the value verbatim for an unknown token (no link)", () => {
    const stack = resolveFontStack('"My Brand Font", sans-serif');
    expect(stack).toBe('"My Brand Font", sans-serif');
    expect(fontLinks().length).toBe(0);
  });

  it("resolves the Arabic-friendly tokens (Cairo / Tajawal)", () => {
    expect(resolveFontStack("cairo")).toContain("Cairo");
    expect(resolveFontStack("tajawal")).toContain("Tajawal");
  });
});
