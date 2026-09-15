import { describe, expect, it } from "vitest";
import { collectionHref, productHref, seriesHref, whatsappHref } from "../utils/routes";

describe("productHref", () => {
  // Verbatim behaviour of the copy that shipped in 4 themes + 4 scaffolds --
  // the migration onto this export must not change a single link.
  it("builds a product detail path", () => {
    expect(productHref("blue-scarf")).toBe("/products/blue-scarf");
  });

  it("accepts an id as well as a slug", () => {
    expect(productHref("2b1f8c4e")).toBe("/products/2b1f8c4e");
  });

  it("falls back to the index rather than emitting /products/undefined", () => {
    expect(productHref(undefined)).toBe("/products");
    expect(productHref(null)).toBe("/products");
    expect(productHref("")).toBe("/products");
  });
});

describe("collectionHref", () => {
  // Not an extraction -- the themes had no helper here, just 27 inline
  // templates that disagreed about the missing-slug case. These are the
  // semantics chosen to replace them.
  it("prefers the slug", () => {
    expect(collectionHref({ slug: "scarves", id: "abc" })).toBe(
      "/collections/scarves",
    );
  });

  it("falls back to the id when a category has no slug", () => {
    // The bare inline template produced "/collections/undefined" here -- a 404
    // the merchant sees as a broken menu item.
    expect(collectionHref({ slug: null, id: "abc" })).toBe("/collections/abc");
    expect(collectionHref({ id: "abc" })).toBe("/collections/abc");
    expect(collectionHref({ slug: "", id: "abc" })).toBe("/collections/abc");
  });

  it("accepts a bare slug string", () => {
    expect(collectionHref("scarves")).toBe("/collections/scarves");
  });

  it("falls back to the index when there is nothing to link to", () => {
    expect(collectionHref(null)).toBe("/collections");
    expect(collectionHref(undefined)).toBe("/collections");
    expect(collectionHref("")).toBe("/collections");
    expect(collectionHref({})).toBe("/collections");
    expect(collectionHref({ slug: null, id: null })).toBe("/collections");
  });

  it("never emits an undefined segment", () => {
    for (const input of [null, undefined, "", {}, { slug: null, id: null }]) {
      expect(collectionHref(input as never)).not.toContain("undefined");
    }
  });
});

describe("seriesHref", () => {
  it("builds a series route and safely handles missing data", () => {
    expect(seriesHref("harry-potter")).toBe("/series/harry-potter");
    expect(seriesHref(undefined)).toBe("/products");
  });
});

describe("whatsappHref", () => {
  // The inline theme builders strip non-digits only, so "010…" became
  // wa.me/010…, a link WhatsApp cannot open.
  it("turns the ways merchants type a number into an international wa.me link", () => {
    for (const typed of ["010 1234 5678", "01012345678", "+20 10 1234 5678", "00201012345678", "+20-101-234-5678"]) {
      expect(whatsappHref(typed)).toBe("https://wa.me/201012345678");
    }
  });

  it("keeps a pasted link and rejects anything without a number", () => {
    expect(whatsappHref(" https://wa.me/201012345678?text=hi ")).toBe("https://wa.me/201012345678?text=hi");
    expect(whatsappHref("")).toBeUndefined();
    expect(whatsappHref(undefined)).toBeUndefined();
    expect(whatsappHref("call us")).toBeUndefined();
    expect(whatsappHref("javascript:alert(1)")).toBeUndefined();
  });
});
