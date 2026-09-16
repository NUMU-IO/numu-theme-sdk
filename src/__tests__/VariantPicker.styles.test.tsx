/**
 * The options style library.
 *
 * One component renders every style, because the alternative is each theme
 * hand-rolling its own and drifting — which is precisely the state this work
 * replaced (eleven copy-pasted pickers, two of them shipping unlabelled
 * circles). A merchant picks the style; no theme code changes.
 *
 * Every style must keep the contracts the default already had: the QA hook
 * triple, a text label on every value, a canonical `data-value`, and the
 * sold-out treatment. A style that quietly drops the label would reintroduce
 * the WCAG 1.4.1 failure the shared component exists to end.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { VariantPicker, type VariantSwatchSettings } from "../components/VariantPicker";
import type { Product, ProductVariant } from "../types/entities";

function variant(
  option_values: Record<string, string>,
  overrides: Partial<ProductVariant> = {},
): ProductVariant {
  return {
    id: Object.values(option_values).join("-") || "v",
    position: 0,
    option_values,
    price: 99,
    price_currency: "EGP",
    inventory_quantity: 5,
    is_in_stock: true,
    ...overrides,
  } as ProductVariant;
}

/** A colour axis with hexes, images and per-value prices. */
const PRODUCT = {
  options: [
    {
      name: "Color",
      position: 0,
      values: ["Frost White", "Cobalt Blue", "Hot Pink"],
      hex_values: ["#f4f1ea", "#1f4fd8", "#e6338c"],
      image_values: [
        "https://cdn.numueg.app/a.webp",
        "https://cdn.numueg.app/b.webp",
        null,
      ],
      name_ar: "اللون",
      values_ar: ["أوف وايت", "كحلي", "فوشيا"],
    },
  ],
  variants: [
    variant({ Color: "Frost White" }, { price: 99 }),
    variant({ Color: "Cobalt Blue" }, { price: 129 }),
    variant({ Color: "Hot Pink" }, { price: 99, is_in_stock: false, inventory_quantity: 0 }),
  ],
} as unknown as Product;

const STYLES: NonNullable<VariantSwatchSettings["swatch_style"]>[] = [
  "chip",
  "pills",
  "box",
  "polaroid",
  "button",
  "radio",
];

function chips() {
  return screen.queryAllByTestId("storefront-product-detail-variant-option");
}

beforeEach(cleanup);

describe("every style keeps the contracts the default has", () => {
  it.each(STYLES)("%s renders one control per value", (swatch_style) => {
    render(<VariantPicker product={PRODUCT} selection={{}} settings={{ swatch_style }} />);
    expect(chips()).toHaveLength(3);
  });

  it.each(STYLES)("%s keeps data-value canonical under Arabic", (swatch_style) => {
    render(
      <VariantPicker
        product={PRODUCT}
        selection={{}}
        locale="ar"
        settings={{ swatch_style }}
      />,
    );
    expect(chips().map((c) => c.getAttribute("data-value"))).toEqual([
      "Frost White",
      "Cobalt Blue",
      "Hot Pink",
    ]);
  });

  it.each(STYLES)("%s gives every value an accessible name", (swatch_style) => {
    render(<VariantPicker product={PRODUCT} selection={{}} settings={{ swatch_style }} />);
    for (const c of chips()) expect(c.getAttribute("aria-label")).toBeTruthy();
  });

  it.each(STYLES)("%s marks the sold-out value", (swatch_style) => {
    render(<VariantPicker product={PRODUCT} selection={{}} settings={{ swatch_style }} />);
    const pink = chips().find((c) => c.getAttribute("data-value") === "Hot Pink");
    expect(pink?.getAttribute("data-state")).toBe("out_of_stock");
  });

  it.each(["pills", "box", "polaroid", "button", "radio"] as const)(
    "%s renders a VISIBLE text label, not colour alone",
    (swatch_style) => {
      // The default `chip` style is the only one that may show a tile with no
      // adjacent text (it still carries aria-label + the axis heading).
      render(<VariantPicker product={PRODUCT} selection={{}} settings={{ swatch_style }} />);
      expect(screen.getByText("Cobalt Blue")).toBeTruthy();
    },
  );
});

describe("price display", () => {
  it("is off by default, so nothing changes for themes that never ask", () => {
    render(<VariantPicker product={PRODUCT} selection={{}} settings={{ swatch_style: "box" }} />);
    expect(screen.queryByText(/99/)).toBeNull();
  });

  it("shows each value's own price when enabled", () => {
    render(
      <VariantPicker
        product={PRODUCT}
        selection={{}}
        settings={{ swatch_style: "box", show_price: true }}
      />,
    );
    // Cobalt Blue is the 129 variant; Frost White is 99.
    expect(screen.getByText(/129/)).toBeTruthy();
    expect(screen.getAllByText(/99/).length).toBeGreaterThan(0);
  });

  it("wraps the price in a bdi so digits stay LTR in an Arabic row", () => {
    render(
      <VariantPicker
        product={PRODUCT}
        selection={{}}
        locale="ar"
        settings={{ swatch_style: "box", show_price: true }}
      />,
    );
    const bdis = [...document.querySelectorAll("bdi")];
    expect(bdis.length).toBeGreaterThan(0);
    expect(bdis.every((b) => b.getAttribute("dir") === "ltr")).toBe(true);
  });

  it("renders no price at all when no variant carries the value", () => {
    // A zero would read as "free", which is worse than showing nothing.
    const orphan = {
      options: [{ name: "Color", position: 0, values: ["Ghost"], hex_values: ["#123456"] }],
      variants: [],
    } as unknown as Product;
    render(
      <VariantPicker
        product={orphan}
        selection={{}}
        settings={{ swatch_style: "box", show_price: true }}
      />,
    );
    expect(document.body.textContent).not.toMatch(/0\.00|EGP\s*0/);
  });
});

describe("style-specific structure", () => {
  it("box and polaroid put the label under the tile inside one frame", () => {
    render(<VariantPicker product={PRODUCT} selection={{}} settings={{ swatch_style: "box" }} />);
    const first = chips()[0];
    // tile + label live in the same bordered wrapper
    expect(first.querySelectorAll("span").length).toBeGreaterThanOrEqual(3);
    expect(first.textContent).toContain("Frost White");
  });

  it("radio draws a radio glyph rather than relying on colour", () => {
    render(
      <VariantPicker
        product={PRODUCT}
        selection={{ Color: "Cobalt Blue" }}
        settings={{ swatch_style: "radio" }}
      />,
    );
    const chosen = chips().find((c) => c.getAttribute("data-value") === "Cobalt Blue")!;
    const glyph = [...chosen.querySelectorAll("span")].find((s) =>
      (s.getAttribute("style") || "").includes("border-radius: 50%"),
    );
    expect(glyph).toBeTruthy();
    expect(glyph!.getAttribute("style")).toContain("inset 0 0 0 4px");
  });

  it("an axis that resolved nothing visual is text in EVERY style", () => {
    // A row of identical checkerboards says nothing, whatever the merchant set.
    const bare = {
      options: [{ name: "Size", position: 0, values: ["S", "M"], values_ar: ["صغير", "وسط"] }],
      variants: [variant({ Size: "S" }), variant({ Size: "M" })],
    } as unknown as Product;
    render(<VariantPicker product={bare} selection={{}} settings={{ swatch_style: "box" }} />);
    expect(screen.getByText("S")).toBeTruthy();
    expect(document.body.innerHTML).not.toContain("repeating-conic-gradient");
  });

  it("still falls back to the theme's markup when there is no decoration", () => {
    const bare = {
      options: [{ name: "Size", position: 0, values: ["S"] }],
      variants: [variant({ Size: "S" })],
    } as unknown as Product;
    render(
      <VariantPicker product={bare} selection={{}} settings={{ swatch_style: "polaroid" }}>
        <div data-testid="theme-own-markup">theme</div>
      </VariantPicker>,
    );
    expect(screen.getByTestId("theme-own-markup")).toBeTruthy();
    expect(chips()).toHaveLength(0);
  });
});

describe("merchant-chosen shape and ratio", () => {
  const styleOf = (i = 0) => {
    const spans = [...chips()[i].querySelectorAll("span")] as HTMLElement[];
    // The tile is the span carrying an explicit inline-size.
    return (
      spans.map((s) => s.getAttribute("style") || "").find((st) => st.includes("inline-size")) || ""
    );
  };

  it.each([
    ["circle", "border-radius: 50%"],
    ["square", "border-radius: 0"],
    ["rounded", "border-radius: 8px"],
    ["pill", "border-radius: 999px"],
  ] as const)("%s applies its radius", (swatch_shape, expected) => {
    render(<VariantPicker product={PRODUCT} selection={{}} settings={{ swatch_shape }} />);
    expect(styleOf()).toContain(expected);
  });

  it("custom takes the merchant's own radius", () => {
    render(
      <VariantPicker
        product={PRODUCT}
        selection={{}}
        settings={{ swatch_shape: "custom", swatch_radius: "14px" }}
      />,
    );
    expect(styleOf()).toContain("border-radius: 14px");
  });

  it("custom with an empty radius falls back to rounded, not to a bare square", () => {
    render(
      <VariantPicker
        product={PRODUCT}
        selection={{}}
        settings={{ swatch_shape: "custom", swatch_radius: "   " }}
      />,
    );
    expect(styleOf()).toContain("border-radius: 8px");
  });

  it("a taller ratio makes the tile taller, not wider", () => {
    // What a catalogue of shoes or bags actually needs.
    render(
      <VariantPicker
        product={PRODUCT}
        selection={{}}
        settings={{ swatch_shape: "square", swatch_ratio: "3:4" }}
      />,
    );
    const st = styleOf();
    expect(st).toContain("inline-size: 40px");
    expect(st).toContain("block-size: 53px");
  });

  it("a wider ratio shortens the tile", () => {
    render(
      <VariantPicker
        product={PRODUCT}
        selection={{}}
        settings={{ swatch_shape: "square", swatch_ratio: "4:3" }}
      />,
    );
    expect(styleOf()).toContain("block-size: 30px");
  });

  it("forces a circle back to square, because a circle at 3:4 is an ellipse", () => {
    render(
      <VariantPicker
        product={PRODUCT}
        selection={{}}
        settings={{ swatch_shape: "circle", swatch_ratio: "3:4" }}
      />,
    );
    const st = styleOf();
    expect(st).toContain("inline-size: 40px");
    expect(st).toContain("block-size: 40px");
  });

  it.each(["", "nonsense", "0:0", "-1:2", "1:", ":2"])(
    "tolerates the unusable ratio %p rather than collapsing the tile",
    (swatch_ratio) => {
      // A merchant typo must never blank a product page.
      render(
        <VariantPicker
          product={PRODUCT}
          selection={{}}
          settings={{ swatch_shape: "square", swatch_ratio }}
        />,
      );
      expect(styleOf()).toContain("block-size: 40px");
    },
  );

  it("clamps an extreme ratio to something that still reads as a swatch", () => {
    render(
      <VariantPicker
        product={PRODUCT}
        selection={{}}
        settings={{ swatch_shape: "square", swatch_ratio: "1:50" }}
      />,
    );
    expect(styleOf()).toContain("block-size: 120px"); // 40 * clamp(3)
  });
});

describe("sold-out treatment reaches EVERY kind of option", () => {
  /** An axis with no visual at all — the text-only path. */
  const TEXT_AXIS = {
    options: [{ name: "Size", position: 0, values: ["S", "M"], values_ar: ["صغير", "وسط"] }],
    variants: [
      variant({ Size: "S" }),
      variant({ Size: "M" }, { is_in_stock: false, inventory_quantity: 0 }),
    ],
  } as unknown as Product;

  const soldOutStyle = (product: Product, settings: VariantSwatchSettings, value: string) => {
    render(<VariantPicker product={product} selection={{}} settings={settings} />);
    const chip = chips().find((c) => c.getAttribute("data-value") === value)!;
    return [...chip.querySelectorAll("span")]
      .map((s) => s.getAttribute("style") || "")
      .join(" | ");
  };

  it.each(["strike", "cross"] as const)(
    "%s draws its diagonal across a sold-out TEXT pill, which IS the swatch there",
    (out_of_stock) => {
      // `cross` used to leave a sold-out size with no strike, no dim and no
      // signal at all — identical to an available one. It now gets the same
      // diagonal a tile gets, drawn across the pill box rather than a
      // line-through drawn through the letterforms.
      render(<VariantPicker product={TEXT_AXIS} selection={{}} settings={{ out_of_stock }} />);
      const m = chips().find((c) => c.getAttribute("data-value") === "M")!;
      const s = chips().find((c) => c.getAttribute("data-value") === "S")!;
      expect(m.querySelectorAll("[data-numu-strike]").length).toBe(
        out_of_stock === "cross" ? 2 : 1,
      );
      expect(s.querySelectorAll("[data-numu-strike]").length).toBe(0);
    },
  );

  it("dim marks a sold-out text option by fading it", () => {
    expect(soldOutStyle(TEXT_AXIS, { out_of_stock: "dim" }, "M")).toContain("opacity: 0.35");
  });

  it("never stacks one fade on top of another", () => {
    // `box` puts the label under the tile. Fading the container AND the tile
    // inside it multiplied out to 0.20 — a swatch nobody can read.
    const styles = soldOutStyle(
      TEXT_AXIS,
      { out_of_stock: "dim", swatch_style: "box" },
      "M",
    );
    expect(styles).toContain("opacity: 0.35");
    expect(styles).not.toContain("opacity: 0.1");
  });

  it("hide removes it entirely rather than leaving it unmarked", () => {
    render(<VariantPicker product={TEXT_AXIS} selection={{}} settings={{ out_of_stock: "hide" }} />);
    expect(chips().map((c) => c.getAttribute("data-value"))).toEqual(["S"]);
  });

  it.each(["strike", "cross", "dim"] as const)(
    "%s never leaves a sold-out option looking identical to an available one",
    (out_of_stock) => {
      // The invariant behind all of the above, stated once.
      render(
        <VariantPicker product={TEXT_AXIS} selection={{}} settings={{ out_of_stock }} />,
      );
      const styleOf = (v: string) =>
        [...chips().find((c) => c.getAttribute("data-value") === v)!.querySelectorAll("span")]
          .map((s) => s.getAttribute("style") || "")
          .join(" | ");
      expect(styleOf("M")).not.toBe(styleOf("S"));
    },
  );

  it("cross draws BOTH diagonals on a tile, a strike draws one", () => {
    const withTile = {
      options: [
        { name: "Color", position: 0, values: ["Red", "Blue"], hex_values: ["#f00", "#00f"] },
      ],
      variants: [
        variant({ Color: "Red" }),
        variant({ Color: "Blue" }, { is_in_stock: false, inventory_quantity: 0 }),
      ],
    } as unknown as Product;

    const count = (settings: VariantSwatchSettings) => {
      cleanup();
      render(<VariantPicker product={withTile} selection={{}} settings={settings} />);
      const blue = chips().find((c) => c.getAttribute("data-value") === "Blue")!;
      // Count the QA hook, not the CSS: the diagonal is an SVG stroke this
      // test DOM does not lay out, so asserting on the style would pass or
      // fail for the wrong reason. The browser proves the pixels.
      return blue.querySelectorAll("[data-numu-strike]").length;
    };

    expect(count({ out_of_stock: "strike" })).toBe(1);
    expect(count({ out_of_stock: "cross" })).toBe(2);
  });
});

describe("the card surface is a swatch row, not a full picker", () => {
  const MIXED = {
    options: [
      { name: "Size", position: 0, values: ["S", "M"], values_ar: ["صغير", "وسط"] },
      {
        name: "Color",
        position: 1,
        values: ["Red", "Blue"],
        hex_values: ["#f00", "#00f"],
        name_ar: "اللون",
      },
    ],
    variants: [variant({ Size: "S", Color: "Red" }), variant({ Size: "M", Color: "Blue" })],
  } as unknown as Product;

  it("shows every axis on a PDP", () => {
    render(<VariantPicker product={MIXED} selection={{}} />);
    expect([...document.querySelectorAll("[data-numu-axis]")].map((a) =>
      a.getAttribute("data-numu-axis"),
    )).toEqual(["Size", "Color"]);
  });

  it("skips a text-only axis on a CARD", () => {
    // A size row with its own heading on every card made the card taller than
    // its neighbours and broke the grid — and a shopper cannot pick a size from
    // a card anyway, because a card carries no resolved variant.
    render(<VariantPicker product={MIXED} selection={{}} surface="card" />);
    expect([...document.querySelectorAll("[data-numu-axis]")].map((a) =>
      a.getAttribute("data-numu-axis"),
    )).toEqual(["Color"]);
  });

  it("drops the axis heading on a card but keeps every accessible name", () => {
    render(<VariantPicker product={MIXED} selection={{}} surface="card" locale="ar" />);
    expect(screen.queryByText("اللون")).toBeNull();
    for (const c of chips()) expect(c.getAttribute("aria-label")).toBeTruthy();
  });

  it("keeps the heading on a PDP", () => {
    render(<VariantPicker product={MIXED} selection={{}} locale="ar" />);
    expect(screen.getByText("اللون")).toBeTruthy();
  });

  it("stays display-only on a card even when onSelect is passed", () => {
    // A card has no resolved variant_id; adding to cart without one opens a
    // second cart line from the PDP's.
    render(<VariantPicker product={MIXED} selection={{}} surface="card" onSelect={() => {}} />);
    expect(document.querySelectorAll("button")).toHaveLength(0);
  });
});

describe("a card never borrows a product-page layout", () => {
  const CARD = {
    options: [
      {
        name: "Color",
        position: 0,
        values: ["Red", "Blue"],
        hex_values: ["#f00", "#00f"],
      },
    ],
    variants: [variant({ Color: "Red" }), variant({ Color: "Blue" })],
  } as unknown as Product;

  it("renders the compact tile even when the merchant picked `box`", () => {
    // `box` puts a label and a price under every value. In a grid cell that
    // made one card ~180px taller than its neighbours and broke the row.
    render(
      <VariantPicker
        product={CARD}
        selection={{}}
        surface="card"
        settings={{ swatch_style: "box", show_price: true, swatch_size: "l" }}
      />,
    );
    const chip = chips()[0];
    expect(chip.textContent).toBe("");
  });
});
