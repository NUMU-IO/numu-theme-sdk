/**
 * I3 — useSectionGroup unit tests.
 *
 * The hook is the SDK side of "global sections shared across pages": it reads
 * the ordered section instances for a named group out of
 * `themeSettings.section_groups[group]`, re-attaching each instance's `id`.
 *
 * Uses React.createElement (no JSX) so the test transpiles without any
 * JSX-runtime config, matching the SDK's other hook tests.
 */

import { createElement, type ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSectionGroup } from "../hooks/useSectionGroup";
import { ThemeSettingsContext } from "../contexts";
import type { ThemeSettingsV3 } from "../types/theme";

function makeSettings(
  section_groups: ThemeSettingsV3["section_groups"],
): ThemeSettingsV3 {
  return {
    schema_version: 3,
    theme_id: "fixture",
    global_settings: {},
    templates: {},
    section_groups,
  };
}

/** Wrap the hook in a ThemeSettingsContext provider (or none, for null). */
function wrapper(
  settings: ThemeSettingsV3 | null,
): (props: { children: ReactNode }) => ReactNode {
  return ({ children }) =>
    createElement(ThemeSettingsContext.Provider, { value: settings }, children);
}

const HEADER_GROUP = makeSettings({
  header: {
    name: "Header",
    sections: {
      announcement_1: { type: "announcement-bar", settings: { text: "Sale" } },
      main_header: { type: "header", settings: { sticky: true } },
      // Present in `sections` but intentionally omitted from `order` below.
      orphan: { type: "spacer", settings: {} },
    },
    // Deliberately NOT alphabetical, and references a missing id ("ghost").
    order: ["main_header", "announcement_1", "ghost"],
  },
  footer: {
    name: "Footer",
    sections: {
      footer_1: { type: "footer", settings: {}, disabled: true },
    },
    order: ["footer_1"],
  },
});

describe("useSectionGroup", () => {
  it("returns the group's section instances in `order`, each carrying its id", () => {
    const { result } = renderHook(() => useSectionGroup("header"), {
      wrapper: wrapper(HEADER_GROUP),
    });
    // main_header first (order[0]), then announcement_1; "ghost" is skipped
    // (in order but absent from sections), and "orphan" never appears (not in
    // order).
    expect(result.current.map((s) => s.id)).toEqual([
      "main_header",
      "announcement_1",
    ]);
    expect(result.current[0]).toMatchObject({
      id: "main_header",
      type: "header",
      settings: { sticky: true },
    });
    expect(result.current[1]).toMatchObject({
      id: "announcement_1",
      type: "announcement-bar",
      settings: { text: "Sale" },
    });
  });

  it("preserves the `disabled` flag on instances (theme filters, not the hook)", () => {
    const { result } = renderHook(() => useSectionGroup("footer"), {
      wrapper: wrapper(HEADER_GROUP),
    });
    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toMatchObject({ id: "footer_1", disabled: true });
  });

  it("returns [] when the named group is absent", () => {
    const { result } = renderHook(() => useSectionGroup("sidebar"), {
      wrapper: wrapper(HEADER_GROUP),
    });
    expect(result.current).toEqual([]);
  });

  it("returns [] when section_groups is empty", () => {
    const { result } = renderHook(() => useSectionGroup("header"), {
      wrapper: wrapper(makeSettings({})),
    });
    expect(result.current).toEqual([]);
  });

  it("returns [] (no throw) when used outside a ThemeSettings provider", () => {
    const { result } = renderHook(() => useSectionGroup("header"), {
      wrapper: wrapper(null),
    });
    expect(result.current).toEqual([]);
  });

  it("returns [] when the group exists but its order is empty", () => {
    const settings = makeSettings({
      header: { name: "Header", sections: {}, order: [] },
    });
    const { result } = renderHook(() => useSectionGroup("header"), {
      wrapper: wrapper(settings),
    });
    expect(result.current).toEqual([]);
  });

  it("keeps a stable array reference across re-renders with unchanged settings", () => {
    const { result, rerender } = renderHook(() => useSectionGroup("header"), {
      wrapper: wrapper(HEADER_GROUP),
    });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
