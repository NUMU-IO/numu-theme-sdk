import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { CollectionContext } from "../contexts";
import { useListingHeading } from "../hooks/useListingHeading";
import type { Collection } from "../types/entities";

const wrap = (collection: Collection | null) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <CollectionContext.Provider value={collection}>
        {children}
      </CollectionContext.Provider>
    );
  };

const COLLECTION = {
  id: "c1",
  name: "Clothing",
  slug: "clothing",
  description: "Everything you can wear",
} as unknown as Collection;

describe("useListingHeading", () => {
  it("titles the page with the collection when the shopper is inside one", () => {
    const { result } = renderHook(
      () =>
        useListingHeading({ title: "Shop", defaultTitle: "All products" }),
      { wrapper: wrap(COLLECTION) },
    );
    // The regression this hook exists for: a category page titled
    // "All products" while showing a subset of the catalog.
    expect(result.current.title).toBe("Clothing");
    expect(result.current.description).toBe("Everything you can wear");
    expect(result.current.isCollection).toBe(true);
  });

  it("falls back to the merchant's setting off a collection", () => {
    const { result } = renderHook(
      () =>
        useListingHeading({
          title: "Shop everything",
          defaultTitle: "All products",
        }),
      { wrapper: wrap(null) },
    );
    expect(result.current.title).toBe("Shop everything");
    expect(result.current.isCollection).toBe(false);
  });

  it("falls back to the theme default when the merchant set nothing", () => {
    const { result } = renderHook(
      () => useListingHeading({ defaultTitle: "كل المنتجات" }),
      { wrapper: wrap(null) },
    );
    expect(result.current.title).toBe("كل المنتجات");
  });

  it("treats whitespace-only settings as unset", () => {
    const { result } = renderHook(
      () => useListingHeading({ title: "   ", defaultTitle: "All products" }),
      { wrapper: wrap(null) },
    );
    expect(result.current.title).toBe("All products");
  });

  it("keeps the merchant's subtitle when the collection has no description", () => {
    const bare = { id: "c2", name: "Bags", slug: "bags" } as unknown as Collection;
    const { result } = renderHook(
      () => useListingHeading({ description: "Handpicked" }),
      { wrapper: wrap(bare) },
    );
    expect(result.current.title).toBe("Bags");
    expect(result.current.description).toBe("Handpicked");
  });

  it("is safe with no provider and no options at all", () => {
    const { result } = renderHook(() => useListingHeading());
    expect(result.current.title).toBe("");
    expect(result.current.isCollection).toBe(false);
    expect(result.current.collection).toBeNull();
  });
});
