/**
 * Tests for VariantPicker.
 *
 * The contract worth pinning is not "it renders chips" — it is the set of
 * failures this component exists to make impossible:
 *
 *   • a doubled swatch row (the children must render EITHER/OR, never both)
 *   • a swatch with no text label (WCAG 1.4.1, shipped today by two themes)
 *   • the merchant's label passed to `background-color` (the original bug)
 *   • a confident grey chip standing in for a colour nobody set
 *   • a sold-out value that looks ordinary and fails at Add to cart
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { VariantPicker } from "../components/VariantPicker";
import type { Product, ProductVariant } from "../types/entities";

const AR_COLOR = "اللون";

function variant(
  option_values: Record<string, string>,
  overrides: Partial<ProductVariant> = {},
): ProductVariant {
  return {
    id: Object.values(option_values).join("-") || "v",
    position: 0,
    option_values,
    price: 100,
    inventory_quantity: 1,
    is_in_stock: true,
    ...overrides,
  } as ProductVariant;
}

/** Vionne's `sponge-taupe`, as the API serves it after the Wave 1 merge. */
const SPONGE = {
  options: [
    {
      name: "Color",
      position: 0,
      values: ["Taupe", "Cafe", "Chocolate"],
      hex_values: ["#c9b19b", "#9d7f72", "#582a24"],
      name_ar: AR_COLOR,
      values_ar: ["بيج رمادي", "كافيه", "شوكولاتة"],
    },
  ],
  variants: [
    variant({ Color: "Taupe" }),
    variant({ Color: "Cafe" }),
    variant({ Color: "Chocolate" }, { is_in_stock: false, inventory_quantity: 0 }),
  ],
} as unknown as Product;

/** A product with axes but no decoration at all — the theme keeps its markup. */
const BARE = {
  options: [{ name: "Size", position: 0, values: ["S", "M"] }],
  variants: [variant({ Size: "S" }), variant({ Size: "M" })],
} as unknown as Product;

const FALLBACK = <div data-testid="theme-own-markup">theme pills</div>;

function chips() {
  return screen.queryAllByTestId("storefront-product-detail-variant-option");
}

describe("deferral — the children are an EITHER/OR, never a second row", () => {
  it("renders the theme's markup when the product carries no decoration", () => {
    render(
      <VariantPicker product={BARE} selection={{}}>
        {FALLBACK}
      </VariantPicker>,
    );
    expect(screen.getByTestId("theme-own-markup")).toBeTruthy();
    expect(chips()).toHaveLength(0);
  });

  it("renders the theme's markup when the product has no axes at all", () => {
    const single = { options: [], variants: [variant({})] } as unknown as Product;
    render(
      <VariantPicker product={single} selection={{}}>
        {FALLBACK}
      </VariantPicker>,
    );
    expect(screen.getByTestId("theme-own-markup")).toBeTruthy();
  });

  it("does NOT render the children once it draws swatches", () => {
    // A doubled row is the single most-reported failure of this app category.
    // It is prevented structurally here, not by a runtime check that could
    // flash and collapse.
    render(
      <VariantPicker product={SPONGE} selection={{}}>
        {FALLBACK}
      </VariantPicker>,
    );
    expect(screen.queryByTestId("theme-own-markup")).toBeNull();
    expect(chips()).toHaveLength(3);
  });
});

describe("the colour ladder", () => {
  it("paints the explicit hex, never the merchant's label", () => {
    // The original bug: `style={{ backgroundColor: value }}` where value is
    // "Taupe" or "كحلي". Neither is a CSS colour, so the dot painted nothing.
    render(<VariantPicker product={SPONGE} selection={{}} />);
    const html = document.body.innerHTML;
    expect(html).toContain("#c9b19b");
    expect(html).not.toContain("background: Taupe");
    expect(html).not.toContain("background-color: Taupe");
  });

  it("falls back to the bilingual lexicon when no hex was set", () => {
    const p = {
      options: [
        {
          name: "Color",
          position: 0,
          values: ["كحلي", "Red"],
          // No hex_values; values_ar is what makes the axis "decorated".
          values_ar: ["كحلي", "أحمر"],
        },
      ],
      variants: [variant({ Color: "كحلي" }), variant({ Color: "Red" })],
    } as unknown as Product;
    render(<VariantPicker product={p} selection={{}} />);
    const html = document.body.innerHTML;
    expect(html).toContain("#1b2a4a"); // navy, matched through the Arabic spelling
    expect(html).toContain("#d32f2f"); // red, matched through English
  });

  it("gives an unresolvable value the unknown chip inside a painted row", () => {
    // A row that is mostly real colours stays a row of chips; the one value
    // nobody set gets an explicit unknown chip so the row reads uniformly.
    const p = {
      options: [
        {
          name: "Color",
          position: 0,
          values: ["Taupe", "Navy Heather"],
          hex_values: ["#c9b19b", null],
        },
      ],
      variants: [variant({ Color: "Taupe" }), variant({ Color: "Navy Heather" })],
    } as unknown as Product;
    render(<VariantPicker product={p} selection={{}} />);
    const html = document.body.innerHTML;
    expect(html).toContain("#c9b19b");
    // "falls back to a default gray" is a documented category failure that
    // shoppers report as "wrong colours" — worse than no colour at all.
    expect(html).toContain("repeating-conic-gradient");
    expect(html).not.toContain("#888888");
  });

  it("renders the whole axis as text when nothing on it resolves", () => {
    // A row of identical checkerboards says nothing. The last rung of the
    // ladder is a text pill, which at least names the colour.
    const p = {
      options: [
        {
          name: "Color",
          position: 0,
          values: ["Navy Heather", "Ecru Melange"],
          hex_values: [null, null],
          values_ar: ["ميلانج", "إكرو"],
        },
      ],
      variants: [
        variant({ Color: "Navy Heather" }),
        variant({ Color: "Ecru Melange" }),
      ],
    } as unknown as Product;
    render(<VariantPicker product={p} selection={{}} />);
    expect(screen.getByText("Navy Heather")).toBeTruthy();
    expect(document.body.innerHTML).not.toContain("repeating-conic-gradient");
  });

  it("lets an explicit app override beat the stored hex", () => {
    render(
      <VariantPicker
        product={SPONGE}
        selection={{}}
        settings={{ color_overrides: { taupe: "#000000" } }}
      />,
    );
    expect(document.body.innerHTML).toContain("#000000");
  });
});

describe("accessibility and RTL", () => {
  it("always renders a text label beside every swatch", () => {
    // Two themes ship colour swatches with no text child at all, so an Arabic
    // colour name becomes a row of blank unlabelled circles.
    render(<VariantPicker product={SPONGE} selection={{ Color: "Taupe" }} />);
    for (const chip of chips()) {
      expect(chip.getAttribute("aria-label")).toBeTruthy();
    }
    expect(screen.getByText(/Taupe/)).toBeTruthy();
  });

  it("renders Arabic axis and value labels under an Arabic locale", () => {
    render(<VariantPicker product={SPONGE} selection={{ Color: "Taupe" }} locale="ar" />);
    expect(screen.getByText(AR_COLOR)).toBeTruthy();
    expect(screen.getByText(/بيج رمادي/)).toBeTruthy();
  });

  it("keeps data-value canonical and untranslated under Arabic", () => {
    // Translation must never be able to break variant matching.
    render(<VariantPicker product={SPONGE} selection={{}} locale="ar" />);
    expect(chips().map((c) => c.getAttribute("data-value"))).toEqual([
      "Taupe",
      "Cafe",
      "Chocolate",
    ]);
  });

  it("wraps the overflow counter in a bdi so the digit stays LTR", () => {
    render(<VariantPicker product={SPONGE} selection={{}} maxVisible={1} />);
    const bdi = document.querySelector("bdi");
    expect(bdi?.getAttribute("dir")).toBe("ltr");
    expect(bdi?.textContent).toBe("+2");
  });

  it("uses only logical inset properties on the selected check mark", () => {
    render(<VariantPicker product={SPONGE} selection={{}} />);
    const html = document.body.innerHTML;
    expect(html).not.toMatch(/(^|[^-])\bleft:/);
    expect(html).not.toMatch(/(^|[^-])\bright:/);
  });
});

describe("availability", () => {
  it("marks a sold-out value rather than letting it look ordinary", () => {
    render(<VariantPicker product={SPONGE} selection={{}} />);
    const [, , chocolate] = chips();
    expect(chocolate.getAttribute("data-sold-out")).toBe("true");
    expect(chocolate.getAttribute("data-state")).toBe("out_of_stock");
  });

  it("keeps the QA hook triple every theme's E2E keys on", () => {
    render(<VariantPicker product={SPONGE} selection={{}} />);
    const [first] = chips();
    expect(first.getAttribute("data-testid")).toBe(
      "storefront-product-detail-variant-option",
    );
    expect(first.getAttribute("data-value")).toBe("Taupe");
    expect(first.hasAttribute("data-sold-out")).toBe(false);
  });

  it("removes sold-out values entirely under out_of_stock=hide", () => {
    render(
      <VariantPicker product={SPONGE} selection={{}} settings={{ out_of_stock: "hide" }} />,
    );
    expect(chips()).toHaveLength(2);
  });
});

describe("interaction", () => {
  it("reports the canonical value, not the translated label", () => {
    const onSelect = vi.fn();
    render(
      <VariantPicker product={SPONGE} selection={{}} onSelect={onSelect} locale="ar" />,
    );
    (chips()[1] as HTMLButtonElement).click();
    expect(onSelect).toHaveBeenCalledWith("Color", "Cafe");
  });

  it("renders display-only, non-interactive chips on a collection card", () => {
    // A card cannot resolve a variant_id, and adding to cart without one opens
    // a second cart line — so a card swatch links to the PDP, never quick-adds.
    render(<VariantPicker product={SPONGE} selection={{}} surface="card" />);
    expect(document.querySelectorAll("button")).toHaveLength(0);
    expect(chips()).toHaveLength(3);
  });
});

describe("settings that must not be dead controls", () => {
  it("honours show_on_cards=false by falling back on a card", () => {
    // Declared but unread, this rendered in the hub, saved, and changed
    // nothing — which reads to a merchant as a broken feature.
    render(
      <VariantPicker
        product={SPONGE}
        selection={{}}
        surface="card"
        settings={{ show_on_cards: false }}
      >
        {FALLBACK}
      </VariantPicker>,
    );
    expect(screen.getByTestId("theme-own-markup")).toBeTruthy();
    expect(chips()).toHaveLength(0);
  });

  it("still renders card swatches when show_on_cards is unset", () => {
    render(<VariantPicker product={SPONGE} selection={{}} surface="card" />);
    expect(chips()).toHaveLength(3);
  });
});

describe("layout contracts a no-layout test DOM cannot catch", () => {
  it("gives the swatch chip an explicit display, or it renders 0x0", () => {
    // A <span> is display:inline, and an inline box ignores inline-size /
    // block-size. This shipped past every other test in this file because the
    // test DOM computes no layout — a real browser showed a 0x0 chip.
    render(<VariantPicker product={SPONGE} selection={{}} />);
    const spans = [...chips()[0].querySelectorAll("span")] as HTMLElement[];
    const chip = spans[spans.length - 1];
    const style = chip.getAttribute("style") || "";
    expect(style).toContain("display: inline-block");
    expect(style).toContain("inline-size: 40px");
  });
});
