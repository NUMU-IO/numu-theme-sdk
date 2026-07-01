/**
 * Unit tests for <HeroMedia> — the V3 above-the-fold hero primitive
 * (Hero Image plan §3.5).
 *
 * Uses React.createElement (no JSX) to match the SDK's no-build test setup
 * (see useNavigation.test.tsx). Art direction is matchMedia-driven (not a native
 * <picture>) so an embedded preview that resizes its iframe — the editor's
 * Desktop/Mobile toggle — swaps the bitmap deterministically. These tests assert:
 * neutral placeholder, single perf <img>, the desktop/mobile bitmap selection by
 * viewport, the priority downgrade, server-crop gating, the raw-url error fallback,
 * and the alternate-image pre-warm.
 */

import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { HeroMedia } from "../components/HeroMedia";

const DESKTOP = "https://cdn.numueg.app/hero-desktop.jpg";
const MOBILE = "https://cdn.numueg.app/hero-mobile.jpg";

/** Stub window.matchMedia so `(max-width: 767px)` reports the given match state. */
function setMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

afterEach(() => {
  // @ts-expect-error – test cleanup
  delete window.matchMedia;
});

describe("HeroMedia", () => {
  it("renders a neutral placeholder (no <img>) when src is missing", () => {
    const { container } = render(
      createElement(HeroMedia, { src: null, alt: "Spring sale" }),
    );
    expect(container.querySelector("img")).toBeNull();
    const placeholder = container.querySelector('[role="img"]');
    expect(placeholder).not.toBeNull();
    expect(placeholder?.tagName).toBe("DIV");
    expect(placeholder?.getAttribute("aria-label")).toBe("Spring sale");
  });

  it("renders one eager, high-priority <img> with a transformer srcSet and no <picture>", () => {
    const { container } = render(
      createElement(HeroMedia, { src: DESKTOP, alt: "Hero" }),
    );
    expect(container.querySelector("picture")).toBeNull();

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("loading")).toBe("eager");
    expect(img?.getAttribute("fetchpriority")).toBe("high");
    expect(img?.getAttribute("decoding")).toBe("async");

    // srcSet routes through the storefront transformer, not the raw R2 URL,
    // and uses the deviceSizes-safe width ladder (never a width that 400s
    // on /_next/image).
    const srcset = img?.getAttribute("srcset") ?? "";
    expect(srcset).toContain("/api/image-transform");
    expect(srcset).toContain("640w");
    expect(srcset).toContain("1920w");
    expect(srcset).not.toContain("3200w");
    // Width-only desktop request (no server-crop params) when no desktopAspect →
    // byte-matches the host's width-only <link rel=preload>.
    expect(srcset).not.toMatch(/fp-x|ar=|fit=/);
    // Base src is also transformer-routed (at the 1920 ceiling), width-only.
    expect(img?.getAttribute("src")).toContain("/api/image-transform");
    expect(img?.getAttribute("src")).not.toMatch(/fp-x|ar=|fit=/);
  });

  it("uses the desktop bitmap (never a <picture>) when the viewport is above the breakpoint", () => {
    setMatchMedia(false);
    const { container } = render(
      createElement(HeroMedia, {
        src: DESKTOP,
        alt: "Hero",
        mobileSrc: MOBILE,
        mobileAspect: "4/5",
      }),
    );
    expect(container.querySelector("picture")).toBeNull();
    const srcset = container.querySelector("img")?.getAttribute("srcset") ?? "";
    expect(srcset).toContain("hero-desktop");
    expect(srcset).not.toContain("hero-mobile");
  });

  it("swaps to the mobile bitmap when the viewport matches the mobile breakpoint", () => {
    setMatchMedia(true);
    const { container } = render(
      createElement(HeroMedia, {
        src: DESKTOP,
        alt: "Hero",
        mobileSrc: MOBILE,
        mobileAspect: "4/5",
      }),
    );
    // The mobile bitmap is served (native art direction without a flaky <picture>).
    const img = container.querySelector("img");
    const srcset = img?.getAttribute("srcset") ?? "";
    expect(srcset).toContain("hero-mobile");
    expect(srcset).not.toContain("hero-desktop");
    // The mobile crop box is forwarded to the transformer.
    expect(srcset).toContain("ar=4");
  });

  it("downgrades to lazy with no fetchpriority when priority is false", () => {
    const { container } = render(
      createElement(HeroMedia, { src: DESKTOP, alt: "Hero", priority: false }),
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("loading")).toBe("lazy");
    expect(img?.getAttribute("fetchpriority")).toBeNull();
  });

  it("sends desktop server-crop params only when desktopAspect is set", () => {
    const { container } = render(
      createElement(HeroMedia, {
        src: DESKTOP,
        alt: "Hero",
        desktopAspect: "16/9",
        transform: { v: 1, focal: { x: 0.3, y: 0.7 } },
      }),
    );
    const srcset = container.querySelector("img")?.getAttribute("srcset") ?? "";
    expect(srcset).toContain("ar=16"); // aspect ratio forwarded
    expect(srcset).toContain("fp-x=0.3"); // focal forwarded
  });

  it("falls back to the raw url when the optimized image errors (host not allow-listed)", () => {
    const { container } = render(
      createElement(HeroMedia, { src: DESKTOP, alt: "Hero" }),
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toContain("/api/image-transform");
    // Simulate /api/image-transform refusing the host (403) → the <img> errors.
    fireEvent.error(img as HTMLImageElement);
    const after = container.querySelector("img");
    expect(after?.getAttribute("src")).toBe(DESKTOP); // raw url, never a regression
    expect(after?.getAttribute("srcset")).toBeNull(); // no transform srcSet
  });

  it("pre-warms the alternate image so the breakpoint swap is instant", () => {
    setMatchMedia(false); // desktop active → the alternate to warm is the MOBILE image
    const warmed: string[] = [];
    const RealImage = window.Image;
    class SpyImage {
      onerror: unknown = null;
      decoding = "";
      fetchPriority = "";
      set src(v: string) {
        warmed.push(v);
      }
      get src() {
        return "";
      }
    }
    // @ts-expect-error – override for the duration of this render
    window.Image = SpyImage;
    try {
      render(
        createElement(HeroMedia, {
          src: DESKTOP,
          alt: "Hero",
          mobileSrc: MOBILE,
          mobileAspect: "4/5",
        }),
      );
    } finally {
      window.Image = RealImage;
    }
    // The off-breakpoint (mobile) bitmap was fetched ahead of the swap.
    expect(warmed.some((u) => u.includes("hero-mobile"))).toBe(true);
  });
});
