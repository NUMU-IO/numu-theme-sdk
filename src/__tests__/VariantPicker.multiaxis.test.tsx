/**
 * The full chain, on a payload captured from a RUNNING API.
 *
 * `fixtures/live-multiaxis.json` was not written by hand. It is the response of
 * a live local `NUMU-api` on the Wave 1 + Wave 3 branch — its `options` after
 * the decoration merge, its real `variants`, and the `installed_apps` entry the
 * store payload carried after the app was actually seeded and installed. So
 * this exercises API serialisation, the public-settings projection, the hook
 * and the component against each other rather than against my own assumptions.
 *
 * It is also the ONLY multi-axis coverage that exists: zero multi-axis products
 * exist on either live store, so every multi-axis claim elsewhere is derived
 * from code rather than observed.
 *
 * The captured axis deliberately includes a value whose stored hex was the hub's
 * `#888888` sentinel, so the null the API emits in its place is part of the
 * fixture and the component's handling of it is pinned here.
 */

import { describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { ShopContext } from "../contexts";
import { VariantPicker, type VariantSwatchSettings } from "../components/VariantPicker";
import { useInstalledApp } from "../hooks/useInstalledApp";
import type { Product, ProductOption, ProductVariant, Store } from "../types/entities";
import live from "./fixtures/live-multiaxis.json";

const FIXTURE = live as unknown as {
  options: ProductOption[];
  variants: ProductVariant[];
  installed_apps: { slug: string; settings?: Record<string, unknown> }[];
};

const PRODUCT = {
  options: FIXTURE.options,
  variants: FIXTURE.variants,
} as unknown as Product;

const STORE = { installed_apps: FIXTURE.installed_apps } as unknown as Store;

function chips() {
  return screen.queryAllByTestId("storefront-product-detail-variant-option");
}

/** Mounts the picker the way a theme does: settings read off the store payload. */
function ThemeLike({ locale }: { locale?: string }) {
  const settings = useInstalledApp<VariantSwatchSettings>("variant-swatches");
  return (
    <VariantPicker
      product={PRODUCT}
      selection={{}}
      onSelect={() => {}}
      locale={locale}
      settings={settings}
    />
  );
}

describe("the captured live payload", () => {
  it("carries two axes, which production has none of", () => {
    expect(FIXTURE.options.map((o) => o.name)).toEqual(["Size", "Color"]);
  });

  it("carries the API's null in place of the hub's grey sentinel", () => {
    const color = FIXTURE.options.find((o) => o.name === "Color")!;
    expect(color.hex_values).toEqual(["#d32f2f", null]);
  });

  it("carries only the allowlisted app settings, no secrets", () => {
    const install = FIXTURE.installed_apps.find((a) => a.slug === "variant-swatches")!;
    expect(install.settings).toEqual({ out_of_stock: "hide", swatch_shape: "square" });
    const raw = JSON.stringify(FIXTURE);
    expect(raw).not.toContain("api_token");
    expect(raw).not.toContain("webhook_secret");
  });
});

describe("theme -> hook -> component, end to end", () => {
  it("renders both axes from the real payload", () => {
    render(
      <ShopContext.Provider value={STORE}>
        <ThemeLike />
      </ShopContext.Provider>,
    );
    // Size S/M + Color Red/Blue = 4 chips.
    expect(chips()).toHaveLength(4);
    expect(document.body.innerHTML).toContain("#d32f2f");
  });

  it("app settings captured from the store payload actually drive presentation", () => {
    // The install carries `swatch_shape: "square"`, so a square must reach the
    // DOM. This is the assertion that proves the projection, the hook and the
    // component agree — each half passed its own tests while the chain between
    // them did not exist at all until now.
    render(
      <ShopContext.Provider value={STORE}>
        <ThemeLike />
      </ShopContext.Provider>,
    );
    expect(document.body.innerHTML).toContain("border-radius: 0");
    expect(document.body.innerHTML).not.toContain("border-radius: 50%");
  });

  it("falls back to circles when the app is not installed", () => {
    cleanup();
    render(
      <ShopContext.Provider value={{} as Store}>
        <ThemeLike />
      </ShopContext.Provider>,
    );
    // Same product, no install: defaults apply rather than nothing rendering.
    expect(chips()).toHaveLength(4);
    expect(document.body.innerHTML).toContain("border-radius: 50%");
  });

  it("renders the Arabic labels the API merged onto both axes", () => {
    render(
      <ShopContext.Provider value={STORE}>
        <ThemeLike locale="ar" />
      </ShopContext.Provider>,
    );
    expect(screen.getByText("اللون")).toBeTruthy();
    expect(screen.getByText("المقاس")).toBeTruthy();
    // Canonical values still drive matching under Arabic.
    expect(chips().map((c) => c.getAttribute("data-value"))).toEqual([
      "S",
      "M",
      "Red",
      "Blue",
    ]);
  });

  it("never paints the hub's grey for the sentinel value", () => {
    render(
      <ShopContext.Provider value={STORE}>
        <ThemeLike />
      </ShopContext.Provider>,
    );
    expect(document.body.innerHTML).not.toContain("#888888");
  });
});
