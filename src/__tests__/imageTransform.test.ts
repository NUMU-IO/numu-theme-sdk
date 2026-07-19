import { describe, expect, it } from "vitest";
import {
  applyImageTransform,
  asImageTransform,
  type ImageTransform,
} from "../utils/imageTransform";

/**
 * Reference implementation — a verbatim copy of the `applyImageTransform`
 * that all 14 V3 themes ship in their own `src/sections/_shared.ts`.
 *
 * The SDK export is replacing those local copies fleet-wide. Every theme's
 * currently-published render must stay pixel-identical through that swap, so
 * the SDK is pinned against this reference rather than against hand-written
 * expectations: if the two ever diverge, a theme migrating onto the SDK would
 * silently change how merchant images are framed on live storefronts.
 *
 * Do not "fix" this reference to match the SDK. It is the shipped behaviour.
 */
const themeClamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));

function themeApplyImageTransform(
  t: ImageTransform | undefined | null,
  fit: "cover" | "contain" = "cover",
): Record<string, unknown> {
  if (!t) return {};
  const fx = Math.round(themeClamp(t.focal?.x ?? 0.5, 0, 1) * 1e4) / 100;
  const fy = Math.round(themeClamp(t.focal?.y ?? 0.5, 0, 1) * 1e4) / 100;
  const zoom = themeClamp(t.zoom ?? 1, 1, 4);
  const rot = ((((t.rotation ?? 0) % 360) + 360) % 360);
  const effFit = t.fit ?? fit;
  const style: Record<string, unknown> = {
    transform: `scale(${zoom}) rotate(${rot}deg)`,
    transformOrigin: `${fx}% ${fy}%`,
    objectFit: effFit,
  };
  if (effFit === "cover") style.objectPosition = `${fx}% ${fy}%`;
  return style;
}

const t = (over: Partial<ImageTransform> = {}): ImageTransform => ({
  v: 1,
  ...over,
});

describe("applyImageTransform — parity with the shipped theme copies", () => {
  // Deliberately includes out-of-range, non-finite and missing values: the
  // clamps are what keep a corrupt stored transform from producing broken CSS.
  const focals = [
    undefined,
    { x: 0, y: 0 },
    { x: 0.5, y: 0.5 },
    { x: 1, y: 1 },
    { x: 0.333, y: 0.667 },
    { x: -1, y: 2 },
    { x: NaN, y: Infinity },
  ];
  const zooms = [undefined, 1, 1.5, 4, 0.2, 99, NaN];
  const rotations = [undefined, 0, 90, 359, 360, 450, -90, -450];
  const fits: (ImageTransform["fit"] | undefined)[] = [
    undefined,
    "cover",
    "contain",
  ];
  const callerFits: ("cover" | "contain")[] = ["cover", "contain"];

  it("matches the theme implementation across the full input matrix", () => {
    let cases = 0;
    for (const focal of focals) {
      for (const zoom of zooms) {
        for (const rotation of rotations) {
          for (const fit of fits) {
            for (const callerFit of callerFits) {
              const input = t({
                focal: focal as ImageTransform["focal"],
                zoom,
                rotation,
                fit,
              });
              expect(applyImageTransform(input, callerFit)).toEqual(
                themeApplyImageTransform(input, callerFit),
              );
              cases++;
            }
          }
        }
      }
    }
    // Guard against the loops silently collapsing to nothing.
    expect(cases).toBe(
      focals.length *
        zooms.length *
        rotations.length *
        fits.length *
        callerFits.length,
    );
  });

  it("matches the theme implementation for null/undefined transforms", () => {
    for (const callerFit of callerFits) {
      expect(applyImageTransform(undefined, callerFit)).toEqual(
        themeApplyImageTransform(undefined, callerFit),
      );
      expect(applyImageTransform(null, callerFit)).toEqual(
        themeApplyImageTransform(null, callerFit),
      );
    }
  });
});

describe("applyImageTransform — the className-override contract", () => {
  // This is the whole reason the helper returns {} instead of a default fit.
  // An inline style beats a class, so emitting objectFit for an untransformed
  // image would override a placement's own object-contain/object-none class on
  // most merchant images — e.g. a logo in a header would start cropping.
  it("returns no style at all when there is no transform", () => {
    expect(applyImageTransform(undefined)).toEqual({});
    expect(applyImageTransform(null)).toEqual({});
    expect(applyImageTransform(undefined, "contain")).toEqual({});
    expect(applyImageTransform(null, "cover")).toEqual({});
  });

  it("does emit objectFit once a transform exists", () => {
    expect(applyImageTransform(t(), "contain")).toMatchObject({
      objectFit: "contain",
    });
  });

  it("lets a caller force a fit by spreading over an explicit default", () => {
    // The HeroMedia pattern: a hero must always fill its frame.
    expect({ objectFit: "cover", ...applyImageTransform(undefined, "cover") })
      .toEqual({ objectFit: "cover" });
    expect({ objectFit: "cover", ...applyImageTransform(t({ fit: "contain" }), "cover") })
      .toMatchObject({ objectFit: "contain" });
  });
});

describe("applyImageTransform — framing maths", () => {
  it("centres by default", () => {
    expect(applyImageTransform(t())).toEqual({
      transform: "scale(1) rotate(0deg)",
      transformOrigin: "50% 50%",
      objectFit: "cover",
      objectPosition: "50% 50%",
    });
  });

  it("converts a normalised focal point to percentages", () => {
    expect(applyImageTransform(t({ focal: { x: 0.25, y: 0.75 } }))).toMatchObject(
      { transformOrigin: "25% 75%", objectPosition: "25% 75%" },
    );
  });

  it("clamps focal to 0..1 and zoom to 1..4", () => {
    expect(
      applyImageTransform(t({ focal: { x: -3, y: 9 }, zoom: 100 })),
    ).toMatchObject({
      transform: "scale(4) rotate(0deg)",
      transformOrigin: "0% 100%",
    });
    expect(applyImageTransform(t({ zoom: 0.1 }))).toMatchObject({
      transform: "scale(1) rotate(0deg)",
    });
  });

  it("falls back to the lower bound for non-finite numbers", () => {
    expect(
      applyImageTransform(t({ focal: { x: NaN, y: NaN }, zoom: NaN })),
    ).toMatchObject({
      transform: "scale(1) rotate(0deg)",
      transformOrigin: "0% 0%",
    });
  });

  it("normalises rotation into 0..359, including negatives", () => {
    expect(applyImageTransform(t({ rotation: 360 }))).toMatchObject({
      transform: "scale(1) rotate(0deg)",
    });
    expect(applyImageTransform(t({ rotation: 450 }))).toMatchObject({
      transform: "scale(1) rotate(90deg)",
    });
    expect(applyImageTransform(t({ rotation: -90 }))).toMatchObject({
      transform: "scale(1) rotate(270deg)",
    });
  });

  it("omits objectPosition when contained — it only means anything for cover", () => {
    const style = applyImageTransform(t({ focal: { x: 0.2, y: 0.2 } }), "contain");
    expect(style.objectFit).toBe("contain");
    expect(style.objectPosition).toBeUndefined();
    // transformOrigin still carries the focal point so zoom pivots correctly.
    expect(style.transformOrigin).toBe("20% 20%");
  });

  it("lets the stored transform's own fit beat the caller's", () => {
    expect(applyImageTransform(t({ fit: "contain" }), "cover")).toMatchObject({
      objectFit: "contain",
    });
    expect(applyImageTransform(t({ fit: "cover" }), "contain")).toMatchObject({
      objectFit: "cover",
    });
  });
});

describe("asImageTransform", () => {
  it("reads the transform off an image setting value", () => {
    const transform = { v: 1, zoom: 2 };
    expect(asImageTransform({ url: "/a.jpg", alt: "", transform })).toBe(
      transform,
    );
  });

  it("returns undefined for values that carry no usable transform", () => {
    expect(asImageTransform("/a.jpg")).toBeUndefined();
    expect(asImageTransform({ url: "/a.jpg" })).toBeUndefined();
    expect(asImageTransform({ url: "/a.jpg", transform: null })).toBeUndefined();
    expect(asImageTransform({ transform: "nope" })).toBeUndefined();
    expect(asImageTransform(undefined)).toBeUndefined();
    expect(asImageTransform(null)).toBeUndefined();
  });

  it("round-trips into applyImageTransform", () => {
    const value = { url: "/a.jpg", transform: { v: 1, focal: { x: 0.1, y: 0.9 } } };
    expect(applyImageTransform(asImageTransform(value))).toMatchObject({
      objectPosition: "10% 90%",
    });
  });
});
