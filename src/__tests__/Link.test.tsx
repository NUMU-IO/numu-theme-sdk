/**
 * Unit tests for <Link> soft navigation (SDK 0.10).
 *
 * The contract under test: an eligible plain left-click dispatches a
 * cancelable `numu:navigate` CustomEvent on window. A host that claims
 * it (preventDefault) suppresses the anchor's default full navigation;
 * with no listener the anchor keeps default behavior (backward compat
 * with hosts that don't ship the bridge). Modified clicks, external
 * URLs, hash anchors, target/download links, and theme onClick
 * preventDefault all bypass soft nav entirely.
 *
 * Uses React.createElement (no JSX) to match the SDK's no-build test
 * setup (see HeroMedia.test.tsx).
 */

import { createElement, type ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import {
  Link,
  NAVIGATE_EVENT,
  requestNavigate,
  type NavigateEventDetail,
} from "../components/Link";
import { LocalizationContext, ShopContext } from "../contexts";
import type { LocalizationState } from "../contexts";
import type { Store } from "../types/entities";

const store = {
  id: "s1",
  name: "Test Store",
  slug: "test",
  subdomain: "test",
  default_language: "en",
} as unknown as Store;

const localization = {
  locale: "en",
  direction: "ltr",
  translations: {},
  formatMoney: (n: number) => String(n),
  formatDate: (d: string | Date) => String(d),
  formatNumber: (n: number) => String(n),
} as unknown as LocalizationState;

function withProviders(el: ReactElement): ReactElement {
  return createElement(
    ShopContext.Provider,
    { value: store },
    createElement(LocalizationContext.Provider, { value: localization }, el),
  );
}

interface Captured {
  hrefs: string[];
  dispose: () => void;
}

/**
 * Attach a NAVIGATE_EVENT listener; claim=true calls preventDefault.
 * Every listener is auto-removed in afterEach — a mid-test assertion
 * failure must not leak a claiming listener into the next test.
 */
const activeListeners: Array<() => void> = [];

function listen(claim: boolean): Captured {
  const hrefs: string[] = [];
  const handler = (e: Event) => {
    hrefs.push((e as CustomEvent<NavigateEventDetail>).detail.href);
    if (claim) e.preventDefault();
  };
  window.addEventListener(NAVIGATE_EVENT, handler);
  const dispose = () => window.removeEventListener(NAVIGATE_EVENT, handler);
  activeListeners.push(dispose);
  return { hrefs, dispose };
}

afterEach(() => {
  cleanup();
  while (activeListeners.length) activeListeners.pop()!();
});

describe("Link soft navigation", () => {
  it("dispatches numu:navigate and suppresses default when the host claims it", () => {
    const cap = listen(true);
    const { getByText } = render(
      withProviders(createElement(Link, { to: "/products/foo" }, "Go")),
    );
    // fireEvent returns false when default was prevented.
    const defaultAllowed = fireEvent.click(getByText("Go"));
    expect(cap.hrefs).toEqual(["/products/foo"]);
    expect(defaultAllowed).toBe(false);
    cap.dispose();
  });

  it("falls back to default anchor behavior when no listener claims", () => {
    const cap = listen(false); // listener observes but does NOT claim
    const { getByText } = render(
      withProviders(createElement(Link, { to: "/cart" }, "Cart")),
    );
    const defaultAllowed = fireEvent.click(getByText("Cart"));
    expect(cap.hrefs).toEqual(["/cart"]);
    expect(defaultAllowed).toBe(true); // full navigation proceeds
    cap.dispose();
  });

  it("skips soft nav on modified clicks (open-in-new-tab)", () => {
    const cap = listen(true);
    const { getByText } = render(
      withProviders(createElement(Link, { to: "/products/foo" }, "Go")),
    );
    fireEvent.click(getByText("Go"), { ctrlKey: true });
    fireEvent.click(getByText("Go"), { metaKey: true });
    fireEvent.click(getByText("Go"), { button: 1 });
    expect(cap.hrefs).toEqual([]);
    cap.dispose();
  });

  it("skips soft nav for external URLs, hash anchors, target and download", () => {
    const cap = listen(true);
    const { getByText } = render(
      withProviders(
        createElement(
          "div",
          null,
          createElement(Link, { to: "https://example.com/x" }, "Ext"),
          createElement(Link, { to: "#reviews" }, "Hash"),
          createElement(Link, { to: "/p", target: "_blank" }, "Blank"),
          createElement(Link, { to: "/f.pdf", download: "" }, "Dl"),
        ),
      ),
    );
    for (const label of ["Ext", "Hash", "Blank", "Dl"]) {
      fireEvent.click(getByText(label));
    }
    expect(cap.hrefs).toEqual([]);
    cap.dispose();
  });

  it("respects a theme onClick that prevents default", () => {
    const cap = listen(true);
    const { getByText } = render(
      withProviders(
        createElement(
          Link,
          { to: "/products/foo", onClick: (e) => e.preventDefault() },
          "Quick view",
        ),
      ),
    );
    fireEvent.click(getByText("Quick view"));
    expect(cap.hrefs).toEqual([]); // theme opted out; no dispatch
    cap.dispose();
  });

  it("requestNavigate reports whether a host claimed the navigation", () => {
    expect(requestNavigate("/search?q=x")).toBe(false); // no listener
    const cap = listen(true);
    expect(requestNavigate("/search?q=x")).toBe(true);
    expect(cap.hrefs).toEqual(["/search?q=x"]);
    cap.dispose();
  });
});
