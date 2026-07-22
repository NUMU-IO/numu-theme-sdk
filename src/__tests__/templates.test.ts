/**
 * Template resolution — the "no blank page" engine.
 *
 * These pin the exact behaviours that caused real blank-store incidents and
 * that the 14 hand-copied `_template-utils.ts` files encoded. If any of these
 * breaks, some theme renders an empty page for a shopper.
 */

import { describe, it, expect } from "vitest";
import {
  resolveSections,
  selectTemplateSections,
  type MaybeOrderedTemplate,
} from "../utils/templates";

const inst = (type: string) => ({ type, settings: {} });

describe("resolveSections", () => {
  it("returns [] for an absent template — not a throw", () => {
    expect(resolveSections(undefined)).toEqual([]);
    expect(resolveSections({})).toEqual([]);
  });

  it("gives array-form sections synthetic type-index ids", () => {
    const r = resolveSections({ sections: [inst("hero"), inst("hero")] });
    expect(r.map((s) => s.id)).toEqual(["hero-0", "hero-1"]);
  });

  it("walks map form in `order`", () => {
    const t: MaybeOrderedTemplate = {
      sections: { a: inst("hero"), b: inst("footer") },
      order: ["b", "a"],
    };
    expect(resolveSections(t).map((s) => s.instance.type)).toEqual([
      "footer",
      "hero",
    ]);
  });

  it("defaults to map key order when `order` is absent", () => {
    const t: MaybeOrderedTemplate = { sections: { x: inst("a"), y: inst("b") } };
    expect(resolveSections(t).map((s) => s.id)).toEqual(["x", "y"]);
  });

  it("skips ids in `order` that the map doesn't contain (deleted section)", () => {
    const t: MaybeOrderedTemplate = {
      sections: { a: inst("hero") },
      order: ["a", "ghost", "b"],
    };
    expect(resolveSections(t).map((s) => s.id)).toEqual(["a"]);
  });
});

describe("selectTemplateSections", () => {
  const known = (set: string[]) => (t: string) => set.includes(t);

  it("uses the host template when it has known sections", () => {
    const host: MaybeOrderedTemplate = { sections: [inst("hero"), inst("grid")] };
    const preset: MaybeOrderedTemplate = { sections: [inst("demo")] };
    const r = selectTemplateSections(host, preset, known(["hero", "grid"]));
    expect(r.map((s) => s.instance.type)).toEqual(["hero", "grid"]);
  });

  it("falls back to the preset when the host template is empty", () => {
    const preset: MaybeOrderedTemplate = { sections: [inst("demo")] };
    const r = selectTemplateSections(undefined, preset, known(["demo"]));
    expect(r.map((s) => s.instance.type)).toEqual(["demo"]);
  });

  it("falls back to the preset when NONE of the host sections are known", () => {
    // A customisation authored for a DIFFERENT theme must not blank the page.
    const host: MaybeOrderedTemplate = {
      sections: [inst("other-theme-hero"), inst("other-theme-cta")],
    };
    const preset: MaybeOrderedTemplate = { sections: [inst("demo")] };
    const r = selectTemplateSections(host, preset, known(["demo"]));
    expect(r.map((s) => s.instance.type)).toEqual(["demo"]);
  });

  it("filters unknown types OUT of an otherwise-known host template", () => {
    // Empire's inline version skipped this and rendered "Unknown section".
    const host: MaybeOrderedTemplate = {
      sections: [inst("hero"), inst("stale-removed"), inst("footer")],
    };
    const r = selectTemplateSections(host, undefined, known(["hero", "footer"]));
    expect(r.map((s) => s.instance.type)).toEqual(["hero", "footer"]);
  });

  it("returns [] when host has sections, some known, but preset is also empty on the no-known path", () => {
    const host: MaybeOrderedTemplate = { sections: [inst("unknown")] };
    expect(selectTemplateSections(host, undefined, known(["hero"]))).toEqual([]);
  });
});
