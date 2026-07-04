/**
 * Shared client-data layer (Phase 3) — the three guarantees the audit needs:
 *
 *   (a) DEDUP        — N consumers of one key → the fetcher runs ONCE.
 *   (b) CROSS-SYNC   — a mutate through one instance is seen by another.
 *   (c) ORDERING     — a superseded (out-of-order) response never overwrites
 *                      a newer result.
 *
 * Uses React.createElement (no JSX) to match the SDK's no-build test setup
 * (see currency-context.test.tsx / useNavigation.test.tsx).
 */

import { createElement } from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  useCachedResource,
  clearResource,
  type CachedResource,
} from "../lib/dataCache";

afterEach(() => {
  cleanup();
  // The cache is module-level — reset it so keys don't leak between cases.
  clearResource();
});

describe("useCachedResource — dedup", () => {
  it("N consumers of the same key call the fetcher exactly once", async () => {
    let calls = 0;
    const fetcher = () => {
      calls += 1;
      return Promise.resolve("value");
    };

    function Consumer({ id }: { id: string }) {
      const { data, isLoading } = useCachedResource<string>("dedupe-key", fetcher);
      return createElement(
        "span",
        { "data-testid": id },
        isLoading ? "loading" : data ?? "",
      );
    }

    const { getByTestId } = render(
      createElement(
        "div",
        null,
        createElement(Consumer, { id: "c1" }),
        createElement(Consumer, { id: "c2" }),
        createElement(Consumer, { id: "c3" }),
      ),
    );

    await waitFor(() => expect(getByTestId("c1").textContent).toBe("value"));
    // All three consumers resolve to the same shared value…
    expect(getByTestId("c2").textContent).toBe("value");
    expect(getByTestId("c3").textContent).toBe("value");
    // …from a single network call (in-flight dedup across instances).
    expect(calls).toBe(1);
  });
});

describe("useCachedResource — cross-instance sync", () => {
  it("a mutate through one instance is reflected in another", async () => {
    const fetcher = () => Promise.resolve<string[]>(["a"]);

    let ctrl: CachedResource<string[]> | undefined;
    function A() {
      ctrl = useCachedResource<string[]>("shared-key", fetcher);
      return createElement(
        "span",
        { "data-testid": "A" },
        (ctrl.data ?? []).join(","),
      );
    }
    function B() {
      const { data } = useCachedResource<string[]>("shared-key", fetcher);
      return createElement(
        "span",
        { "data-testid": "B" },
        (data ?? []).join(","),
      );
    }

    const { getByTestId } = render(
      createElement("div", null, createElement(A), createElement(B)),
    );

    // Both instances hydrate from the one shared entry.
    await waitFor(() => expect(getByTestId("A").textContent).toBe("a"));
    expect(getByTestId("B").textContent).toBe("a");

    // Mutating via instance A's handle updates the SHARED store…
    act(() => {
      ctrl!.mutate((cur) => [...(cur ?? []), "b"], { revalidate: false });
    });

    // …so instance B re-renders with the new value too.
    await waitFor(() => expect(getByTestId("B").textContent).toBe("a,b"));
    expect(getByTestId("A").textContent).toBe("a,b");
  });
});

describe("useCachedResource — ordering / cancellation", () => {
  it("a superseded request never overwrites a newer result", async () => {
    const resolvers: Array<(value: string) => void> = [];
    let calls = 0;
    const fetcher = () => {
      calls += 1;
      return new Promise<string>((resolve) => {
        resolvers.push(resolve);
      });
    };

    let ctrl: CachedResource<string> | undefined;
    function Probe() {
      // revalidateOnMount:false so the only fetches are the two we drive below.
      ctrl = useCachedResource<string>("ordering-key", fetcher, {
        revalidateOnMount: false,
      });
      return createElement("span", { "data-testid": "d" }, ctrl.data ?? "none");
    }

    const { getByTestId } = render(createElement(Probe));
    expect(getByTestId("d").textContent).toBe("none");

    // Issue two forced fetches; req #2 supersedes (and aborts) req #1.
    await act(async () => {
      void ctrl!.revalidate();
    });
    await act(async () => {
      void ctrl!.revalidate();
    });
    expect(calls).toBe(2);

    // Resolve OUT OF ORDER: the newer request (#2) resolves first with "fresh".
    await act(async () => {
      resolvers[1]("fresh");
    });
    await waitFor(() => expect(getByTestId("d").textContent).toBe("fresh"));

    // Now the STALE older request (#1) resolves LAST — the classic clobber
    // scenario. The seq guard must drop it so "fresh" survives.
    await act(async () => {
      resolvers[0]("stale");
    });
    expect(getByTestId("d").textContent).toBe("fresh");
  });
});
