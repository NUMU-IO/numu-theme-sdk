import { describe, expect, it } from "vitest";
import {
  LOGO_SHAPE_OPTIONS,
  LOGO_SIZE_OPTIONS,
  logoImgStyle,
  logoStyleTokens,
} from "../utils/logoStyle";

describe("logoImgStyle", () => {
  it("returns undefined for 'none' / empty so the theme keeps its native sizing", () => {
    expect(logoImgStyle("none", "medium")).toBeUndefined();
    expect(logoImgStyle("", "small")).toBeUndefined();
    expect(logoImgStyle(undefined, undefined)).toBeUndefined();
  });

  it("crops a square box with object-cover for 'square'", () => {
    const s = logoImgStyle("square", "small");
    expect(s).toMatchObject({ width: 32, height: 32, objectFit: "cover" });
    expect(s?.borderRadius).toBeUndefined();
    expect(s?.clipPath).toBeUndefined();
  });

  it("applies a full border-radius for 'circle'", () => {
    expect(logoImgStyle("circle", "small")).toMatchObject({
      borderRadius: "9999px",
      objectFit: "cover",
    });
  });

  it("applies a clip-path triangle for 'triangle'", () => {
    expect(logoImgStyle("triangle", "small")?.clipPath).toBe(
      "polygon(50% 0%, 100% 100%, 0% 100%)",
    );
  });

  it("gives circle/rounded a larger frame than square/triangle at the same size", () => {
    // circle (inscribed disc) reads smaller, so it gets a bigger box
    expect(logoImgStyle("circle", "medium")?.height).toBe(64);
    expect(logoImgStyle("square", "medium")?.height).toBe(40);
    expect(logoImgStyle("circle", "large")?.height).toBe(80);
    expect(logoImgStyle("square", "large")?.height).toBe(56);
  });

  it("defaults an unknown size to small", () => {
    expect(logoImgStyle("circle", "huge")?.height).toBe(48);
  });
});

describe("logoStyleTokens", () => {
  it("is empty for 'none'", () => {
    expect(logoStyleTokens("none", "medium")).toEqual({});
  });

  it("emits box/radius/clip CSS vars for a shape", () => {
    expect(logoStyleTokens("circle", "medium")).toEqual({
      "--theme-logo-box": "64px",
      "--theme-logo-radius": "9999px",
      "--theme-logo-clip": "none",
    });
    expect(logoStyleTokens("triangle", "small")["--theme-logo-clip"]).toBe(
      "polygon(50% 0%, 100% 100%, 0% 100%)",
    );
  });
});

describe("logo option constants", () => {
  it("expose bilingual shape + size options", () => {
    expect(LOGO_SHAPE_OPTIONS.map((o) => o.value)).toEqual([
      "none",
      "square",
      "rounded",
      "circle",
      "triangle",
    ]);
    expect(LOGO_SIZE_OPTIONS.map((o) => o.value)).toEqual([
      "small",
      "medium",
      "large",
    ]);
    expect(LOGO_SHAPE_OPTIONS.every((o) => o.label && o.label_ar)).toBe(true);
  });
});
