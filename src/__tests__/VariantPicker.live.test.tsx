/**
 * Cross-wave integration: does the component actually consume what the API
 * actually sends?
 *
 * Wave 1 (NUMU-api) restores the decoration onto `options[]`. Wave 2 (this SDK)
 * renders it. Each was tested against its own hand-written fixtures, which is
 * exactly the gap that produced the bug this whole effort exists to fix: on
 * 2026-09-09 the API stopped sending `hex_values` 29 seconds before the theme
 * started reading it, and both sides were "tested".
 *
 * So `fixtures/live-options.json` is not hand-written. It is the real
 * `attributes` blob of four real products on the two live stores, snapshotted
 * on 2026-09-16, pushed through the ACTUAL `_resolve_options_for_product` from
 * the Wave 1 branch. Regenerate it by re-running that resolver over the
 * snapshot in `docs/Plans/app-color-variant/snapshots/`.
 *
 * The four products cover both serving paths and both live stores:
 *   • sponge-taupe / elegance-baby-blue — vionne, CANONICAL options + merged
 *     decoration (the path that was broken)
 *   • nike-3-signs / classic-nike       — rabbit, LEGACY derivation (the path
 *     that still worked, so a regression here is the expensive one)
 */

import { describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { VariantPicker } from "../components/VariantPicker";
import type { Product, ProductOption, ProductVariant } from "../types/entities";
import live from "./fixtures/live-options.json";

interface LiveEntry {
  store: string;
  canonical_options_present: boolean;
  options: ProductOption[];
}
const FIXTURES = live as unknown as Record<string, LiveEntry>;

/** Build variant rows matching the axis, so availability is exercised too. */
function productFrom(entry: LiveEntry, soldOut: string[] = []): Product {
  const axis = entry.options[0];
  const variants: ProductVariant[] = (axis?.values || []).map((value, i) => ({
    id: `v${i}`,
    position: i,
    option_values: { [axis.name]: value },
    price: 100,
    inventory_quantity: soldOut.includes(value) ? 0 : 5,
    is_in_stock: !soldOut.includes(value),
  })) as ProductVariant[];
  return { options: entry.options, variants } as unknown as Product;
}

function chips() {
  return screen.queryAllByTestId("storefront-product-detail-variant-option");
}

describe("live API payloads render", () => {
  it.each(Object.keys(FIXTURES))("%s paints real swatches, not the label", (slug) => {
    cleanup();
    const entry = FIXTURES[slug];
    render(<VariantPicker product={productFrom(entry)} selection={{}} />);

    const axis = entry.options[0];
    expect(chips()).toHaveLength(axis.values.length);

    const html = document.body.innerHTML;
    // Every value paints SOMETHING real — its own image where the merchant set
    // one, otherwise its hex. Both live rabbit products carry both, and the
    // image wins there by design.
    (axis.values || []).forEach((_value, i) => {
      const image = axis.image_values?.[i];
      const hex = axis.hex_values?.[i];
      if (image) expect(html).toContain("/api/image-transform");
      else if (hex) expect(html).toContain(hex);
    });
    // And the merchant's label must never be a CSS colour. This is the
    // assertion that would have failed on the live site on 2026-09-09.
    for (const value of axis.values) {
      expect(html).not.toContain(`background: ${value}`);
    }
  });

  it("paints the hex instead of the image under image_source=color_only", () => {
    // rabbit's products carry both, so the merchant needs a lever when the
    // per-value photos read badly at chip size.
    const entry = FIXTURES["nike-3-signs"];
    render(
      <VariantPicker
        product={productFrom(entry)}
        selection={{}}
        settings={{ image_source: "color_only" }}
      />,
    );
    const html = document.body.innerHTML;
    expect(html).toContain("#fafafa");
    expect(html).not.toContain("/api/image-transform");
  });

  it("covers both serving paths, so neither can silently regress", () => {
    const canonical = Object.values(FIXTURES).filter((f) => f.canonical_options_present);
    const legacy = Object.values(FIXTURES).filter((f) => !f.canonical_options_present);
    expect(canonical.length).toBeGreaterThan(0); // vionne
    expect(legacy.length).toBeGreaterThan(0); // rabbit
  });

  it("renders the real Arabic labels the API merged back on", () => {
    const entry = FIXTURES["sponge-taupe"];
    render(<VariantPicker product={productFrom(entry)} selection={{ Color: "Taupe" }} locale="ar" />);
    expect(screen.getByText("اللون")).toBeTruthy();
    expect(screen.getByText(/بيج رمادي/)).toBeTruthy();
    // The canonical value still drives matching.
    expect(chips()[0].getAttribute("data-value")).toBe("Taupe");
  });

  it("marks a real sold-out value on a real payload", () => {
    const entry = FIXTURES["nike-3-signs"];
    render(<VariantPicker product={productFrom(entry, ["Black"])} selection={{}} />);
    const black = chips().find((c) => c.getAttribute("data-value") === "Black");
    expect(black?.getAttribute("data-state")).toBe("out_of_stock");
  });

  it("never emits the hub's #888888 grey for any live product", () => {
    // That grey is the fingerprint of decoration already overwritten. The API
    // drops an all-grey axis; this asserts none survives to the DOM.
    for (const slug of Object.keys(FIXTURES)) {
      cleanup();
      render(<VariantPicker product={productFrom(FIXTURES[slug])} selection={{}} />);
      expect(document.body.innerHTML).not.toContain("#888888");
    }
  });

  it("keeps hex_values positionally aligned with values on every fixture", () => {
    // A dict-shaped hexValues realigned wrongly would paint the right colours
    // against the wrong labels — worse than painting none.
    for (const entry of Object.values(FIXTURES)) {
      for (const axis of entry.options) {
        if (axis.hex_values) {
          expect(axis.hex_values.length).toBe(axis.values.length);
        }
      }
    }
  });
});
