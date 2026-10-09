/**
 * useVariantSelection — `?variant=<id>` picks that variant after mount.
 *
 * Back in Stock's alert links land on `/products/<slug>?variant=<id>`. The
 * pick happens in an effect, so the server render (which cannot see the query
 * string the same way) and the first client render agree and hydration never
 * mismatches.
 */

import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useVariantSelection } from "../hooks/useVariantSelection";
import type { Product, ProductVariant } from "../types/entities";

const variant = (id: string, size: string): ProductVariant =>
  ({ id, option_values: { Size: size }, is_in_stock: true, price: 100 }) as unknown as ProductVariant;

const PRODUCT = {
  id: "p1",
  options: [{ name: "Size", values: ["S", "M", "L"] }],
  variants: [variant("v-s", "S"), variant("v-m", "M"), variant("v-l", "L")],
} as unknown as Product;

function Probe({ product = PRODUCT }: { product?: Product }) {
  const { variant: chosen } = useVariantSelection(product);
  return <span data-testid="chosen">{chosen?.id ?? "none"}</span>;
}

const chosen = () => screen.getByTestId("chosen").textContent;
const visit = (search: string) => window.history.replaceState(null, "", `/products/tee${search}`);

afterEach(() => visit(""));

describe("useVariantSelection ?variant=", () => {
  it("selects the variant named in the URL", () => {
    visit("?variant=v-l&utm_source=numu_back_in_stock");
    render(<Probe />);
    expect(chosen()).toBe("v-l");
  });

  it("ignores an id that is not this product's", () => {
    visit("?variant=someone-else");
    render(<Probe />);
    expect(chosen()).toBe("v-s");
  });

  it("keeps the default without the parameter", () => {
    render(<Probe />);
    expect(chosen()).toBe("v-s");
  });

  it("hydrates the server markup with no warning, then applies the URL", async () => {
    const el = document.createElement("div");
    el.innerHTML = renderToString(<Probe />);
    document.body.appendChild(el);
    visit("?variant=v-m");
    const errors: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...a) => errors.push(a.join(" ")));
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(el, <Probe />, {
        onRecoverableError: (e) => errors.push(String((e as Error)?.message ?? e)),
      });
    });
    spy.mockRestore();
    expect(errors).toEqual([]);
    expect(el.textContent).toBe("v-m");
    await act(async () => root?.unmount());
    el.remove();
  });
});
