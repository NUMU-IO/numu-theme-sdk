/**
 * Currency context propagation (Phase 2 correctness).
 *
 * Proves the multi-currency config is fetched ONCE by NuMuProvider and shared
 * through CurrencyContext, so a currency change (what <CurrencySwitcher> does
 * via setSelected) reflows EVERY <Money>/useMoney() on the page without a
 * reload. The bug this covers: useCurrency() previously fetched + held the
 * selection in per-component state and <Money> ignored it entirely, so
 * switching currency never reached the price tags.
 *
 * Uses React.createElement (no JSX) to match the SDK's no-build test setup
 * (see useNavigation.test.tsx).
 */

import { createElement, type ReactNode } from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NuMuProvider } from "../components/NuMuProvider";
import { Money } from "../components/Money";
import { useCurrency } from "../hooks/useCurrency";
import { useMoney } from "../hooks/useMoney";
import type { Store } from "../types/entities";
import type { ThemeSettingsV3 } from "../types/theme";

const store = {
  id: "s1",
  name: "Test Store",
  slug: "test",
  currency: "EGP",
  default_language: "en",
  use_nextjs_storefront: true,
} as Store;

const themeSettings = {
  schema_version: 3,
  theme_id: "t",
  global_settings: {},
  templates: {},
  section_groups: {},
} as unknown as ThemeSettingsV3;

function currencyBody(autoConvert: boolean) {
  return {
    data: {
      base: "EGP",
      default_presentment: "EGP",
      presentment: ["EGP", "USD"],
      rates: { EGP: "1", USD: "0.02" },
      auto_convert: autoConvert,
    },
  };
}

/**
 * Route the provider's on-mount fetches: the currencies call (the one under
 * test) plus the cart/customer priming calls (benign empties). Returns the spy
 * so a test can assert call counts.
 */
function mockFetch(autoConvert = true) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/storefront/currencies")) {
        return Promise.resolve(
          new Response(JSON.stringify(currencyBody(autoConvert)), {
            status: 200,
          }),
        );
      }
      if (url.includes("/api/cart")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: { id: "c1", items: [], subtotal: 0, total: 0, currency: "EGP" },
            }),
            { status: 200 },
          ),
        );
      }
      // /api/customer/me and anything else.
      return Promise.resolve(
        new Response(JSON.stringify({ data: null }), { status: 200 }),
      );
    });
}

function withProvider(children: ReactNode): ReactNode {
  return createElement(NuMuProvider, { store, themeSettings }, children);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("currency context propagation", () => {
  it("switching currency reflows every <Money> when auto_convert is on", async () => {
    mockFetch(true);
    const Harness = () => {
      const { selected, setSelected } = useCurrency();
      return createElement(
        "div",
        null,
        createElement(Money, { amount: 100 }),
        createElement("span", { "data-testid": "sel" }, selected),
        createElement(
          "button",
          { "data-testid": "usd", onClick: () => setSelected("USD") },
          "USD",
        ),
      );
    };
    const { container, getByTestId } = render(
      withProvider(createElement(Harness)),
    );

    // The single fetch resolves: selection settles to the default (EGP). EGP
    // === base, so even with auto_convert on the price is unconverted.
    await waitFor(() => expect(getByTestId("sel").textContent).toBe("EGP"));
    expect(container.textContent).toContain("100");

    // Switch to USD through the shared context — the <Money> tag reflows.
    fireEvent.click(getByTestId("usd"));
    await waitFor(() => expect(getByTestId("sel").textContent).toBe("USD"));
    // 100 EGP × 0.02 = 2.00 USD.
    expect(container.textContent).toContain("2.00");
    expect(container.textContent).not.toContain("100");
  });

  it("does NOT convert when auto_convert is off, even after a switch", async () => {
    mockFetch(false);
    const Harness = () => {
      const { selected, setSelected, autoConvert } = useCurrency();
      return createElement(
        "div",
        null,
        createElement(Money, { amount: 100 }),
        createElement("span", { "data-testid": "sel" }, selected),
        createElement("span", { "data-testid": "auto" }, String(autoConvert)),
        createElement(
          "button",
          { "data-testid": "usd", onClick: () => setSelected("USD") },
          "USD",
        ),
      );
    };
    const { container, getByTestId } = render(
      withProvider(createElement(Harness)),
    );

    await waitFor(() => expect(getByTestId("auto").textContent).toBe("false"));
    fireEvent.click(getByTestId("usd"));
    await waitFor(() => expect(getByTestId("sel").textContent).toBe("USD"));
    // auto_convert off → amount stays in base units; no converted 2.00.
    expect(container.textContent).toContain("100");
    expect(container.textContent).not.toContain("2.00");
  });

  it("useMoney() converts through the same shared selection", async () => {
    mockFetch(true);
    const Harness = () => {
      const { setSelected } = useCurrency();
      const money = useMoney();
      return createElement(
        "div",
        null,
        createElement("span", { "data-testid": "m" }, money(50)),
        createElement(
          "button",
          { "data-testid": "usd", onClick: () => setSelected("USD") },
          "USD",
        ),
      );
    };
    const { getByTestId } = render(withProvider(createElement(Harness)));

    await waitFor(() => expect(getByTestId("m").textContent).toContain("50"));
    fireEvent.click(getByTestId("usd"));
    // 50 EGP × 0.02 = 1.00 USD.
    await waitFor(() => expect(getByTestId("m").textContent).toContain("1.00"));
  });

  it("fetches /api/storefront/currencies exactly once for many consumers", async () => {
    const spy = mockFetch(true);
    const Many = () =>
      createElement(
        "div",
        null,
        createElement(Money, { amount: 1 }),
        createElement(Money, { amount: 2 }),
        createElement(Money, { amount: 3 }),
      );
    render(withProvider(createElement(Many)));

    await waitFor(() => {
      const calls = spy.mock.calls.filter((c) =>
        String(c[0]).includes("/api/storefront/currencies"),
      );
      expect(calls).toHaveLength(1);
    });
  });
});
