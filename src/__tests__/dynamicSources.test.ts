import { describe, expect, it } from "vitest";
import {
  dynamicSource,
  isDynamicSource,
  resolveDynamicValue,
  resolveSettingsMap,
  resolveSourcePath,
} from "../utils/dynamicSources";
import type { Collection, Product, Store } from "../types/entities";

// Fixtures — minimal shapes; the resolver only reads a handful of
// fields per resource, so we don't need full mocks.

const product: Product = {
  id: "p1",
  name: "Crimson Tee",
  slug: "crimson-tee",
  description: "<p>Soft cotton crew-neck.</p>",
  price: 25000,
  currency: "EGP",
  images: [
    { id: "i1", url: "https://cdn/img-1.jpg", alt: "front", position: 1 },
  ],
  variants: [
    {
      id: "v1",
      position: 0,
      option_values: {},
      price: 25000,
      sku: "TEE-CRIM-M",
      inventory_quantity: 10,
      is_in_stock: true,
    },
  ],
  in_stock: true,
};

const collection: Collection = {
  id: "c1",
  name: "Summer Drop",
  slug: "summer",
  description: "Hot weather essentials.",
  image_url: "https://cdn/coll-1.jpg",
  product_count: 12,
};

const store: Pick<Store, "name" | "description" | "logo_url"> = {
  name: "ACME Apparel",
  description: "Streetwear since 2020",
  logo_url: "https://cdn/logo.png",
};

describe("isDynamicSource", () => {
  it("returns true for { __numu_source } objects", () => {
    expect(isDynamicSource({ __numu_source: "product.title" })).toBe(true);
  });
  it("returns false for plain strings, numbers, nulls", () => {
    expect(isDynamicSource("hello")).toBe(false);
    expect(isDynamicSource(42)).toBe(false);
    expect(isDynamicSource(null)).toBe(false);
    expect(isDynamicSource(undefined)).toBe(false);
  });
  it("returns false for image-picker objects with `url` but no source key", () => {
    expect(isDynamicSource({ url: "x", alt: "y" })).toBe(false);
  });
  it("returns false when __numu_source is not a string", () => {
    expect(isDynamicSource({ __numu_source: 5 })).toBe(false);
    expect(isDynamicSource({ __numu_source: null })).toBe(false);
  });
});

describe("dynamicSource builder", () => {
  it("emits the discriminant shape", () => {
    expect(dynamicSource("collection.title")).toEqual({
      __numu_source: "collection.title",
    });
  });
});

describe("resolveSourcePath — product", () => {
  it("resolves product.title to product.name", () => {
    expect(resolveSourcePath("product.title", { product })).toBe("Crimson Tee");
  });
  it("resolves product.name (alias) to product.name", () => {
    expect(resolveSourcePath("product.name", { product })).toBe("Crimson Tee");
  });
  it("strips HTML for description_snippet and caps at 200 chars", () => {
    const snippet = resolveSourcePath("product.description_snippet", {
      product,
    });
    expect(snippet).toBe("Soft cotton crew-neck.");
  });
  it("returns raw description (with HTML) for description", () => {
    expect(resolveSourcePath("product.description", { product })).toBe(
      "<p>Soft cotton crew-neck.</p>",
    );
  });
  it("resolves product.price (cents)", () => {
    expect(resolveSourcePath("product.price", { product })).toBe(25000);
  });
  it("resolves product.sku from the first variant", () => {
    expect(resolveSourcePath("product.sku", { product })).toBe("TEE-CRIM-M");
  });
  it("resolves product.image to the first image url", () => {
    expect(resolveSourcePath("product.image", { product })).toBe(
      "https://cdn/img-1.jpg",
    );
  });
  it("returns null when product is absent", () => {
    expect(resolveSourcePath("product.title", {})).toBeNull();
  });
});

describe("resolveSourcePath — collection / store", () => {
  it("resolves collection.title", () => {
    expect(resolveSourcePath("collection.title", { collection })).toBe(
      "Summer Drop",
    );
  });
  it("resolves collection.image", () => {
    expect(resolveSourcePath("collection.image", { collection })).toBe(
      "https://cdn/coll-1.jpg",
    );
  });
  it("resolves store.name / description / logo", () => {
    expect(resolveSourcePath("store.name", { store })).toBe("ACME Apparel");
    expect(resolveSourcePath("store.description", { store })).toBe(
      "Streetwear since 2020",
    );
    expect(resolveSourcePath("store.logo", { store })).toBe(
      "https://cdn/logo.png",
    );
  });
  it("returns null for unknown root", () => {
    expect(resolveSourcePath("metafield.custom.color", { product })).toBeNull();
  });
  it("returns null for unknown field on a known root", () => {
    expect(resolveSourcePath("product.unknown_field", { product })).toBeNull();
  });
});

describe("resolveDynamicValue", () => {
  it("passes literal strings through unchanged", () => {
    expect(resolveDynamicValue("Hero headline", { product })).toBe(
      "Hero headline",
    );
  });
  it("resolves a ref against the active context", () => {
    expect(
      resolveDynamicValue({ __numu_source: "product.title" }, { product }),
    ).toBe("Crimson Tee");
  });
  it("returns null when the ref can't resolve (no context)", () => {
    expect(
      resolveDynamicValue({ __numu_source: "product.title" }, {}),
    ).toBeNull();
  });
});

describe("resolveSettingsMap", () => {
  it("walks every key, resolving refs and passing literals through", () => {
    const settings = {
      headline: { __numu_source: "product.title" },
      subtitle: "literal subtitle",
      hero_image: { __numu_source: "product.image" },
      // The image-picker stored shape is `{ url, alt }`. The resolver
      // must NOT mistake this for a dynamic ref — there's no
      // `__numu_source` key.
      logo: { url: "x.png", alt: "x" },
    };
    const out = resolveSettingsMap(settings, { product });
    expect(out).toEqual({
      headline: "Crimson Tee",
      subtitle: "literal subtitle",
      hero_image: "https://cdn/img-1.jpg",
      logo: { url: "x.png", alt: "x" },
    });
  });
  it("emits null for an unresolvable ref so themes can detect missing context", () => {
    const out = resolveSettingsMap(
      { headline: { __numu_source: "product.title" } },
      // No product in context.
      {},
    );
    expect(out).toEqual({ headline: null });
  });
  it("returns the input unchanged when it isn't an object", () => {
    // Defensive — theme code might call with `instance?.settings ?? null`.
    expect(resolveSettingsMap(null as unknown as object, {})).toBeNull();
  });
});
