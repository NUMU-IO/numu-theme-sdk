import { describe, expect, it } from "vitest";
import {
  centsToMajor,
  formatMoney,
  formatMoneyMajor,
  majorToCents,
} from "../utils/money";

/**
 * Reference: the `fmt` helper shipped byte-identically in 4 themes'
 * `_promotions.ts`. The SDK adopts this behaviour rather than theme-kit's
 * USD/2-digit default, so these assert parity with what production renders.
 */
function themeFmt(cents: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", {
    style: "currency",
    currency: currency || "EGP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

describe("formatMoney — parity with the shipped theme formatter", () => {
  const amounts = [0, 1, 99, 100, 12345, 50000, 999999, 100000000];
  const currencies = ["", "EGP", "SAR", "USD"];
  const locales = ["en", "ar"];

  it("matches the theme implementation across the input matrix", () => {
    for (const cents of amounts) {
      for (const currency of currencies) {
        for (const locale of locales) {
          expect(formatMoney(cents, { currency, locale })).toBe(
            themeFmt(cents, currency, locale),
          );
        }
      }
    }
  });
});

describe("formatMoney — the defaults that were the actual decision", () => {
  it("falls back to EGP, not USD", () => {
    // theme-kit defaults to USD. On an Egypt-first platform that is wrong,
    // and adopting it would have silently redenominated every price.
    expect(formatMoney(50000)).toBe(formatMoney(50000, { currency: "EGP" }));
    expect(formatMoney(50000)).not.toBe(formatMoney(50000, { currency: "USD" }));
  });

  it("shows whole pounds by default", () => {
    // Not "500.00" -- sub-unit precision is noise at Egyptian price points.
    expect(formatMoney(50000)).not.toContain(".00");
  });

  it("still allows fraction digits where they matter", () => {
    expect(formatMoney(50050, { fractionDigits: 2 })).toContain("500.5");
  });

  it("maps the ar locale to ar-EG rather than passing it through raw", () => {
    const ar = formatMoney(50000, { locale: "ar" });
    const en = formatMoney(50000, { locale: "en" });
    expect(ar).not.toBe(en);
    // ar-EG renders Eastern Arabic numerals; a raw "ar" locale would not.
    expect(ar).toMatch(/[٠-٩]/);
  });

  it("treats any non-ar locale as en-EG", () => {
    expect(formatMoney(50000, { locale: "fr" })).toBe(
      formatMoney(50000, { locale: "en" }),
    );
    expect(formatMoney(50000, { locale: null })).toBe(
      formatMoney(50000, { locale: "en" }),
    );
  });
});

describe("formatMoney — bad input never reaches a product card", () => {
  it("renders non-finite amounts as zero, not NaN", () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      const out = formatMoney(bad);
      expect(out).not.toContain("NaN");
      expect(out).toBe(formatMoney(0));
    }
  });

  it("formats negatives rather than throwing", () => {
    expect(() => formatMoney(-50000)).not.toThrow();
  });
});

describe("major/minor unit conversion", () => {
  it("formatMoneyMajor agrees with formatMoney on the same value", () => {
    // The SDK exposes cart money in MAJOR units while the API speaks cents;
    // a helper that only accepted one guaranteed a factor-of-100 bug.
    expect(formatMoneyMajor(500)).toBe(formatMoney(50000));
  });

  it("centsToMajor and majorToCents round-trip", () => {
    for (const cents of [0, 1, 99, 12345, 999999]) {
      expect(majorToCents(centsToMajor(cents))).toBe(cents);
    }
  });

  it("majorToCents rounds rather than truncating", () => {
    expect(majorToCents(10.005)).toBe(1001);
    expect(majorToCents(0.1 + 0.2)).toBe(30); // float noise must not leak
  });

  it("conversion helpers are non-finite safe", () => {
    expect(centsToMajor(NaN)).toBe(0);
    expect(majorToCents(Infinity)).toBe(0);
  });
});
