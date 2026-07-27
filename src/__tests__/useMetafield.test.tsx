/**
 * Unit tests for useMetafield / useMetafields — first-class read access
 * to merchant-defined typed fields.
 *
 * Covers: product + collection owners (context-typed arrays), the page
 * owner's two accepted data shapes (`data.page.metafields` from the CMS
 * page route projection, flat `data.metafields`), missing-owner and
 * missing-field behaviour (null / [] — never throws), and malformed
 * entries being filtered out.
 *
 * Uses React.createElement (no JSX) so the test transpiles without any
 * JSX-runtime config, matching the SDK's no-build test setup.
 */

import { createElement, type ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useMetafield, useMetafields } from "../hooks/useMetafield";
import { CollectionContext, PageContext, ProductContext } from "../contexts";
import type { Collection, Metafield, Page, Product } from "../types/entities";

const specs: Metafield[] = [
  { namespace: "specs", key: "material", type: "string", value: "Egyptian cotton" },
  { namespace: "specs", key: "weight_g", type: "number", value: 180 },
];

function makeProduct(metafields?: Metafield[]): Product {
  return {
    id: "p1",
    name: "Tee",
    slug: "tee",
    price: 50000,
    currency: "EGP",
    images: [],
    variants: [],
    in_stock: true,
    metafields,
  };
}

function makeCollection(metafields?: Metafield[]): Collection {
  return {
    id: "c1",
    name: "Clothing",
    slug: "clothing",
    product_count: 3,
    metafields,
  };
}

function wrapper(opts: {
  product?: Product | null;
  collection?: Collection | null;
  page?: Page | null;
}): (props: { children: ReactNode }) => ReactNode {
  return ({ children }) =>
    createElement(
      ProductContext.Provider,
      { value: opts.product ?? null },
      createElement(
        CollectionContext.Provider,
        { value: opts.collection ?? null },
        createElement(
          PageContext.Provider,
          { value: opts.page ?? null },
          children,
        ),
      ),
    );
}

describe("useMetafields", () => {
  it("returns the product's fields for owner=product", () => {
    const { result } = renderHook(() => useMetafields("product"), {
      wrapper: wrapper({ product: makeProduct(specs) }),
    });
    expect(result.current).toHaveLength(2);
    expect(result.current[0]?.key).toBe("material");
  });

  it("returns [] when the owner is not in context", () => {
    const { result } = renderHook(() => useMetafields("product"), {
      wrapper: wrapper({}),
    });
    expect(result.current).toEqual([]);
  });

  it("returns [] when the entity has no metafields array", () => {
    const { result } = renderHook(() => useMetafields("collection"), {
      wrapper: wrapper({ collection: makeCollection(undefined) }),
    });
    expect(result.current).toEqual([]);
  });

  it("reads the collection's fields for owner=collection", () => {
    const { result } = renderHook(() => useMetafields("collection"), {
      wrapper: wrapper({ collection: makeCollection(specs) }),
    });
    expect(result.current.map((m) => m.key)).toEqual(["material", "weight_g"]);
  });

  it("reads page fields from the CMS route projection (data.page.metafields)", () => {
    const page: Page = {
      type: "page",
      title: "About",
      data: { page: { handle: "about", metafields: specs } },
    };
    const { result } = renderHook(() => useMetafields("page"), {
      wrapper: wrapper({ page }),
    });
    expect(result.current).toHaveLength(2);
  });

  it("reads page fields from a flat data.metafields shape", () => {
    const page: Page = {
      type: "page",
      title: "About",
      data: { metafields: [specs[0]] },
    };
    const { result } = renderHook(() => useMetafields("page"), {
      wrapper: wrapper({ page }),
    });
    expect(result.current).toHaveLength(1);
    expect(result.current[0]?.value).toBe("Egyptian cotton");
  });

  it("filters malformed entries instead of surfacing them", () => {
    const page: Page = {
      type: "page",
      title: "About",
      data: { metafields: [specs[0], "junk", { key: 1 }, null] },
    };
    const { result } = renderHook(() => useMetafields("page"), {
      wrapper: wrapper({ page }),
    });
    expect(result.current).toHaveLength(1);
  });
});

describe("useMetafield", () => {
  it("finds a field by namespace + key", () => {
    const { result } = renderHook(
      () => useMetafield("product", "specs", "weight_g"),
      { wrapper: wrapper({ product: makeProduct(specs) }) },
    );
    expect(result.current?.type).toBe("number");
    expect(result.current?.value).toBe(180);
  });

  it("returns null for a missing field (theme fallback renders)", () => {
    const { result } = renderHook(
      () => useMetafield("product", "specs", "nope"),
      { wrapper: wrapper({ product: makeProduct(specs) }) },
    );
    expect(result.current).toBeNull();
  });

  it("returns null when the owner is absent — never throws", () => {
    const { result } = renderHook(
      () => useMetafield("collection", "specs", "material"),
      { wrapper: wrapper({}) },
    );
    expect(result.current).toBeNull();
  });

  it("does not cross owners (product field invisible via page)", () => {
    const { result } = renderHook(
      () => useMetafield("page", "specs", "material"),
      { wrapper: wrapper({ product: makeProduct(specs), page: null }) },
    );
    expect(result.current).toBeNull();
  });
});
