import { DependencyList, useRef } from "react";

type CacheEntry<T> =
  | { status: "pending"; promise: Promise<T>; deps: readonly unknown[] }
  | { status: "success"; result: T; deps: readonly unknown[] }
  | { status: "error"; error: unknown; deps: readonly unknown[] }
  | undefined;

const sameDeps = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

// Global cache for async memoization
let asyncMemoCache: Map<string, CacheEntry<unknown>>;

function getCache<T>() {
  if (!asyncMemoCache) asyncMemoCache = new Map<string, CacheEntry<T>>();
  return asyncMemoCache as Map<string, CacheEntry<T>>;
}

function getCacheKey(
  factory: () => Promise<unknown> | unknown,
  deps: DependencyList,
  scope?: string
): string {
  // Use function toString and JSON.stringify for deps as a simple cache key
  // In production, you might want a more sophisticated key generation
  return JSON.stringify([factory.toString(), deps, scope || ""]);
}

/**
 *
 * @param factory
 * @param deps
 * @param options
 * @returns
 */
export function useAsyncMemoSuspense<T>(
  factory: () => Promise<T> | T,
  deps: DependencyList = [],
  options?: { scope?: string }
): T | undefined {
  // this is just to force the using component to be a client component
  useRef(undefined);

  const isClient = typeof window !== "undefined";
  if (!isClient) return undefined;

  const cacheKey = getCacheKey(factory, deps, options?.scope);
  let cacheEntry = getCache<T>().get(cacheKey);

  // Check if dependencies have changed or no cache entry exists
  if (!cacheEntry || !sameDeps(cacheEntry.deps, deps)) {
    const promise = Promise.resolve(factory());
    const newCacheEntry: CacheEntry<T> = {
      status: "pending",
      promise,
      deps: [...deps],
    };

    newCacheEntry.promise
      .then((result) =>
        Object.assign(newCacheEntry, { status: "success", result })
      )
      .catch((error) =>
        Object.assign(newCacheEntry, { status: "error", error })
      );

    cacheEntry = newCacheEntry;
    getCache().set(cacheKey, newCacheEntry);
  }

  if (cacheEntry?.status === "success") return cacheEntry.result;
  if (cacheEntry?.status === "error") throw cacheEntry.error;
  throw cacheEntry?.promise;
}
