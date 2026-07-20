import { describe, expect, it } from "vitest";
import { collectionHref, productHref } from "../utils/routes";

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
