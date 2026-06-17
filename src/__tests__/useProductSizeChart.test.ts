import { describe, expect, it } from "vitest";
import { resolveSizeChart } from "../hooks/useProductSizeChart";
import type { SizeChart } from "../types/entities";

const productChart: SizeChart = {
  mode: "custom",
  column_headers: ["Chest"],
  rows: [{ size: "M", values: ["92"] }],
};

const storeChart: SizeChart = {
  column_headers: ["Chest"],
  rows: [{ size: "S", values: ["86"] }],
};

const attrs = (sc?: unknown) => (sc ? { size_chart: sc } : {});
const settings = (sc?: unknown) => (sc ? { size_chart: sc } : {});

describe("resolveSizeChart", () => {
  it("returns null when neither product nor store has a chart", () => {
    expect(resolveSizeChart(undefined, undefined)).toBeNull();
    expect(resolveSizeChart({}, {})).toBeNull();
  });

  it("mode 'off' hides the chart even when a store default exists", () => {
    const off: SizeChart = { ...productChart, mode: "off" };
    expect(resolveSizeChart(attrs(off), settings(storeChart))).toBeNull();
  });

  it("mode 'custom' uses the product's own chart", () => {
    expect(resolveSizeChart(attrs(productChart), settings(storeChart))).toBe(
      productChart,
    );
  });

  it("mode 'custom' with no rows resolves to null (not the store default)", () => {
    const empty: SizeChart = { mode: "custom", column_headers: [], rows: [] };
    expect(resolveSizeChart(attrs(empty), settings(storeChart))).toBeNull();
  });

  it("mode 'default' falls back to the store-wide chart", () => {
    const def: SizeChart = { ...productChart, mode: "default" };
    expect(resolveSizeChart(attrs(def), settings(storeChart))).toBe(storeChart);
  });

  it("legacy (no mode): a populated product chart wins over the default", () => {
    const legacy: SizeChart = { column_headers: ["Chest"], rows: [{ size: "L", values: ["98"] }] };
    expect(resolveSizeChart(attrs(legacy), settings(storeChart))).toBe(legacy);
  });

  it("legacy with empty product chart falls through to the store default", () => {
    expect(resolveSizeChart(attrs(undefined), settings(storeChart))).toBe(
      storeChart,
    );
  });
});
