"use client";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Shared client-data layer (Phase 3) — a tiny SWR-style cache with ZERO
 * runtime dependencies.
 *
 * Why this exists (from the audit): several hooks fetched + held per-instance
 * state, so N components rendering the same resource fired N identical requests
 * AND drifted out of sync (e.g. two wishlist hearts for one product; `useApp`
 * applying an out-of-order response over a newer one). `useCachedResource`
 * centralizes fetching behind one module-level store keyed by a string:
 *
 *   (a) DEDUP — the first consumer of a key starts the fetch and stashes the
 *       in-flight promise on the entry; every other consumer that revalidates
 *       the same key while it's pending joins that promise instead of firing a
 *       second request. N consumers → ONE network call.
 *   (b) CACHE — results live on the entry keyed by string, so a later mount
 *       reads the cached value immediately (and skips refetch within
 *       `dedupeIntervalMs`).
 *   (c) SUBSCRIBE / NOTIFY — every hook instance subscribes to its key via
 *       `useSyncExternalStore`. Any update (fetch resolve, `mutate`) rebuilds
 *       the entry's immutable snapshot and notifies ALL subscribers, so every
 *       instance re-renders with the same value — cross-instance state sync.
 *   (d) REVALIDATE + CANCELLATION — each fetch reserves a monotonic sequence
 *       number and an `AbortController`. Starting a new (forced) fetch aborts
 *       the previous one; when any fetch settles, its result is applied ONLY if
 *       its sequence is still the latest (`mySeq === entry.seq`). So a slow,
 *       superseded response can never overwrite a newer result regardless of
 *       the order the network resolves them in.
 *
 * SSR-safe: the fetch is triggered from `useEffect` (never runs under
 * `renderToString`), and `useSyncExternalStore`'s server snapshot returns the
 * `initialData` fallback without ever touching the module cache — so nothing is
 * written to the shared map on the server and there is no cross-request bleed.
 *
 * This is intentionally NOT a full SWR clone (no focus/reconnect revalidation,
 * no suspense, no infinite pagination). It's the smallest primitive that fixes
 * the audited dedup + sync + ordering bugs and that themes can reuse.
 */

/** The reactive slice a consumer reads. */
export interface CachedResourceState<T> {
  /** Latest cached value, or `initialData` before the first fetch settles. */
  data: T | undefined;
  /** Error from the most recent settled fetch (cleared on success / mutate). */
  error: Error | undefined;
  /** True until the first fetch (or `mutate`) settles a value for this key. */
  isLoading: boolean;
  /** True whenever a fetch is currently in flight (initial OR background). */
  isValidating: boolean;
}

/** Fetcher receives an AbortSignal so a superseding fetch can cancel it. */
export type CacheFetcher<T> = (signal: AbortSignal) => Promise<T>;

/** `mutate` accepts a value or an updater `(current) => next`. */
export type CacheMutator<T> =
  | T
  | undefined
  | ((current: T | undefined) => T | undefined);

export interface MutateOptions {
  /** After applying the local value, kick a fresh (forced) revalidation. */
  revalidate?: boolean;
}

export interface CachedResource<T> extends CachedResourceState<T> {
  /**
   * Optimistically write the cached value for this key (all subscribers
   * re-render). Pass `{ revalidate: true }` to also refetch afterwards.
   */
  mutate: (next: CacheMutator<T>, opts?: MutateOptions) => void;
  /** Force a fresh fetch, superseding + aborting any in-flight request. */
  revalidate: () => Promise<void>;
}

export interface UseCachedResourceOptions<T> {
  /**
   * Value shown on the server and on the first client paint before the fetch
   * resolves. Used as the SSR snapshot (SSR-safe: no fetch on the server).
   */
  initialData?: T;
  /** When `false`, the hook holds no subscription and never fetches. */
  enabled?: boolean;
  /** Auto-fetch on mount / key change (default `true`). */
  revalidateOnMount?: boolean;
  /**
   * Skip the mount fetch if a value settled within this window (ms). Prevents
   * a staggered second mount from refetching a still-fresh key. Default 2000.
   */
  dedupeIntervalMs?: number;
  /** Called on a non-abort fetch error, with the key. */
  onError?: (error: Error, key: string) => void;
}

interface Entry<T> {
  data: T | undefined;
  error: Error | undefined;
  /** Has a fetch or mutate produced a value yet? Drives `isLoading`. */
  settled: boolean;
  /** Is a fetch currently running? Drives `isValidating`. */
  inFlight: boolean;
  /** Monotonic request counter; only `mySeq === seq` may apply a result. */
  seq: number;
  lastFetchAt: number;
  /** In-flight fetch promise, for cross-instance dedup. */
  promise: Promise<void> | undefined;
  controller: AbortController | undefined;
  /** Latest fetcher seen for this key, so `mutate({revalidate})` can refetch. */
  fetcher: CacheFetcher<T> | undefined;
  subscribers: Set<() => void>;
  /** Cached immutable snapshot — stable ref until state actually changes. */
  snapshot: CachedResourceState<T>;
}

// Module-level store. Only ever written on the client (see SSR note above).
const cache = new Map<string, Entry<unknown>>();

function buildSnapshot<T>(entry: Entry<T>): CachedResourceState<T> {
  return {
    data: entry.data,
    error: entry.error,
    isLoading: !entry.settled,
    isValidating: entry.inFlight,
  };
}

/** Rebuild the entry's snapshot and notify every subscriber. */
function commit<T>(entry: Entry<T>): void {
  entry.snapshot = buildSnapshot(entry);
  entry.subscribers.forEach((cb) => cb());
}

function getEntry<T>(key: string, initialData?: T): Entry<T> {
  let entry = cache.get(key) as Entry<T> | undefined;
  if (!entry) {
    entry = {
      data: initialData,
      error: undefined,
      settled: false,
      inFlight: false,
      seq: 0,
      lastFetchAt: 0,
      promise: undefined,
      controller: undefined,
      fetcher: undefined,
      subscribers: new Set(),
      snapshot: {
        data: initialData,
        error: undefined,
        isLoading: true,
        isValidating: false,
      },
    };
    cache.set(key, entry as unknown as Entry<unknown>);
  }
  return entry;
}

/**
 * Fetch (or join an in-flight fetch for) `key`.
 *
 * Dedup: a non-forced call with a pending promise returns that promise instead
 * of starting a second request. Ordering: each fetch takes `mySeq = ++seq` and
 * a fresh AbortController; a forced call aborts the previous controller. A
 * result is applied only when `mySeq === entry.seq` at settle time, so a
 * superseded (out-of-order) response is dropped.
 */
export function revalidateResource<T>(
  key: string,
  fetcher: CacheFetcher<T>,
  opts?: { force?: boolean; onError?: (error: Error, key: string) => void },
): Promise<void> {
  const entry = getEntry<T>(key);
  entry.fetcher = fetcher;

  // Dedup: join the request already in flight for this key.
  if (!opts?.force && entry.promise) return entry.promise;

  const mySeq = ++entry.seq;
  if (entry.controller) entry.controller.abort();
  const controller = new AbortController();
  entry.controller = controller;
  entry.inFlight = true;
  commit(entry);

  const run = (async () => {
    try {
      const data = await fetcher(controller.signal);
      if (mySeq !== entry.seq) return; // superseded by a newer request
      entry.data = data;
      entry.error = undefined;
      entry.settled = true;
      entry.lastFetchAt = Date.now();
    } catch (err) {
      if (controller.signal.aborted) return; // cancelled by a newer request
      if (mySeq !== entry.seq) return; // superseded by a newer request
      const error = err instanceof Error ? err : new Error(String(err));
      entry.error = error;
      entry.settled = true;
      entry.lastFetchAt = Date.now();
      opts?.onError?.(error, key);
    } finally {
      // Only the winning (latest) request flips inFlight off + commits, so a
      // superseded fetch resolving late can't clobber the newer one's state.
      if (mySeq === entry.seq) {
        entry.inFlight = false;
        entry.controller = undefined;
        commit(entry);
      }
    }
  })();

  entry.promise = run;
  void run.finally(() => {
    // Clear only if still ours — a forced fetch may have replaced the promise.
    if (entry.promise === run) entry.promise = undefined;
  });
  return run;
}

/** Imperatively write a key's cached value and notify all subscribers. */
export function mutateResource<T>(
  key: string,
  next: CacheMutator<T>,
  opts?: MutateOptions,
): void {
  const entry = getEntry<T>(key);
  const value =
    typeof next === "function"
      ? (next as (current: T | undefined) => T | undefined)(entry.data)
      : next;
  entry.data = value;
  entry.error = undefined;
  entry.settled = true;
  commit(entry);
  if (opts?.revalidate && entry.fetcher) {
    void revalidateResource(key, entry.fetcher, { force: true });
  }
}

/** Peek the current cached value for a key without subscribing. */
export function readResource<T>(key: string): T | undefined {
  return (cache.get(key) as Entry<T> | undefined)?.data;
}

/** Drop one key (or the whole cache when called with no argument). */
export function clearResource(key?: string): void {
  if (key === undefined) {
    cache.clear();
    return;
  }
  cache.delete(key);
}

const NOOP = () => {};

/**
 * Subscribe to a cached resource keyed by `key`, deduping the fetch across all
 * instances and keeping them in sync. See the module docblock for the full
 * contract.
 *
 * @param key       Cache key. `null`/`undefined`/`""` (or `enabled: false`)
 *                  disables the hook — no subscription, no fetch, `initialData`
 *                  is returned.
 * @param fetcher   `(signal) => Promise<T>`. Recreated-per-render is fine; the
 *                  latest is captured in a ref so it doesn't retrigger fetches.
 * @param options   See {@link UseCachedResourceOptions}.
 */
export function useCachedResource<T>(
  key: string | null | undefined,
  fetcher: CacheFetcher<T>,
  options?: UseCachedResourceOptions<T>,
): CachedResource<T> {
  const enabled = options?.enabled !== false && key != null && key !== "";
  const revalidateOnMount = options?.revalidateOnMount !== false;
  const dedupeIntervalMs = options?.dedupeIntervalMs ?? 2000;
  const cacheKey = enabled ? (key as string) : "";

  // Keep latest fetcher / callbacks / initialData in refs so the fetch effect
  // can depend on `key` alone — an inline fetcher recreated every render must
  // not retrigger the request.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const onErrorRef = useRef(options?.onError);
  onErrorRef.current = options?.onError;
  const initialDataRef = useRef(options?.initialData);

  // Stable fallback snapshot for the disabled + SSR paths.
  // `useSyncExternalStore` requires getSnapshot to return a cached reference,
  // so we freeze one object (initialData is first-render-wins, like SWR's
  // fallbackData). isLoading mirrors "will this hook fetch on mount?" so the
  // server markup matches the client's first (pre-effect) snapshot.
  const fallbackRef = useRef<CachedResourceState<T> | null>(null);
  if (fallbackRef.current === null) {
    fallbackRef.current = {
      data: initialDataRef.current,
      error: undefined,
      isLoading: enabled && revalidateOnMount,
      isValidating: false,
    };
  }

  const subscribe = useCallback(
    (cb: () => void) => {
      if (!enabled) return NOOP;
      const entry = getEntry<T>(cacheKey, initialDataRef.current);
      entry.subscribers.add(cb);
      return () => {
        entry.subscribers.delete(cb);
      };
    },
    [cacheKey, enabled],
  );

  const getSnapshot = useCallback((): CachedResourceState<T> => {
    if (!enabled) return fallbackRef.current as CachedResourceState<T>;
    return getEntry<T>(cacheKey, initialDataRef.current).snapshot;
  }, [cacheKey, enabled]);

  const getServerSnapshot = useCallback(
    (): CachedResourceState<T> => fallbackRef.current as CachedResourceState<T>,
    [],
  );

  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Fetch trigger. Runs on mount + key change (client only — effects never run
  // under renderToString, keeping SSR fetch-free). No abort-on-unmount: the
  // in-flight request is shared across instances via dedup, so one unmounting
  // consumer must not cancel a fetch the others still await. Cancellation of a
  // SUPERSEDED request is handled inside revalidateResource (seq + abort).
  useEffect(() => {
    if (!enabled) return;
    const entry = getEntry<T>(cacheKey, initialDataRef.current);
    const fresh =
      entry.settled && Date.now() - entry.lastFetchAt < dedupeIntervalMs;
    if (revalidateOnMount && !fresh) {
      void revalidateResource<T>(
        cacheKey,
        (signal) => fetcherRef.current(signal),
        { onError: (e, k) => onErrorRef.current?.(e, k) },
      );
    }
  }, [cacheKey, enabled, revalidateOnMount, dedupeIntervalMs]);

  const mutate = useCallback(
    (next: CacheMutator<T>, opts?: MutateOptions) => {
      if (!enabled) return;
      mutateResource<T>(cacheKey, next, opts);
    },
    [cacheKey, enabled],
  );

  const revalidate = useCallback((): Promise<void> => {
    if (!enabled) return Promise.resolve();
    return revalidateResource<T>(
      cacheKey,
      (signal) => fetcherRef.current(signal),
      { force: true, onError: (e, k) => onErrorRef.current?.(e, k) },
    );
  }, [cacheKey, enabled]);

  return {
    data: state.data,
    error: state.error,
    isLoading: state.isLoading,
    isValidating: state.isValidating,
    mutate,
    revalidate,
  };
}
