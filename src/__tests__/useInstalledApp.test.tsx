/**
 * `useInstalledApp` — install state at FIRST RENDER.
 *
 * The whole point is that this does NOT fetch. `useApp()` resolves inside an
 * effect, so anything rendered from it appears only after hydration; a picker
 * driven by it would SSR the theme's markup, swap to the app's on hydration and
 * drop one — a double render and a layout shift on every product page.
 *
 * The degrade path matters as much as the happy one: a theme bundle is a CDN
 * artifact that outlives any single API deploy, so a payload with no
 * `installed_apps` at all must read as "no app settings", never as an error.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { ShopContext } from "../contexts";
import { useHasApp, useInstalledApp } from "../hooks/useInstalledApp";
import type { Store } from "../types/entities";

function Probe({ slug }: { slug: string }) {
  const settings = useInstalledApp<{ swatch_shape?: string }>(slug);
  const has = useHasApp(slug);
  return (
    <div>
      <span data-testid="has">{String(has)}</span>
      <span data-testid="shape">{settings?.swatch_shape ?? "none"}</span>
    </div>
  );
}

function renderWith(store: Partial<Store> | null, slug = "variant-swatches") {
  return render(
    <ShopContext.Provider value={store as Store}>
      <Probe slug={slug} />
    </ShopContext.Provider>,
  );
}

const has = () => screen.getByTestId("has").textContent;
const shape = () => screen.getByTestId("shape").textContent;

describe("useInstalledApp", () => {
  it("returns the public settings for an installed app", () => {
    renderWith({
      installed_apps: [
        { slug: "variant-swatches", settings: { swatch_shape: "square" } },
      ],
    });
    expect(has()).toBe("true");
    expect(shape()).toBe("square");
  });

  it("returns an empty object, not undefined, for an install with no settings", () => {
    // Installed-but-unconfigured must still read as INSTALLED, or the picker
    // would fall back to the theme's markup the moment a merchant installed
    // the app without opening its settings.
    renderWith({ installed_apps: [{ slug: "variant-swatches" }] });
    expect(has()).toBe("true");
    expect(shape()).toBe("none");
  });

  it("returns undefined for an app that is not installed", () => {
    renderWith({ installed_apps: [{ slug: "something-else", settings: {} }] });
    expect(has()).toBe("false");
  });

  it("degrades to undefined on a payload that predates installed_apps", () => {
    // An older host serving a bundle built against a newer SDK. Must read as
    // "no app settings", never throw and never blank the section.
    renderWith({ id: "s1" });
    expect(has()).toBe("false");
    expect(shape()).toBe("none");
  });

  it("tolerates a malformed installed_apps", () => {
    renderWith({ installed_apps: "nope" as unknown as Store["installed_apps"] });
    expect(has()).toBe("false");
  });

  it("does not throw when there is no shop context at all", () => {
    // Unlike `useShop`, which throws outside NuMuProvider. This is read during
    // render by a component the host may mount early, so it must be safe.
    render(<Probe slug="variant-swatches" />);
    expect(has()).toBe("false");
  });
});
