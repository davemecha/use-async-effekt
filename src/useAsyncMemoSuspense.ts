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
 * @experimental This hook is experimental and should be used with caution.
 *
 * A hook for memoizing async computations that integrates with React Suspense.
 *
 * This hook allows you to perform an asynchronous operation and suspend the component
 * until the operation is complete. It's useful for data fetching or any other async
 * task that needs to be resolved before rendering.
 *
 * In SSR environments (e.g., Next.js), the hook always returns `undefined` on the
 * server for prerendering. This means the suspense fallback will be displayed on
 * hydration, and nothing will be displayed on the server-side render.
 *
 * This hook requires to be used in a client component.
 *
 * @param factory - The async function to execute.
 * @param deps - The dependency array for the memoization.
 * @param options - An optional options object.
 * @param options.scope - An optional scope to isolate the cache.
 * @returns The memoized value, or it suspends the component.
 *
 * @example
 * ```tsx
 * import { Suspense } from 'react';
 * import { useAsyncMemoSuspense } from 'use-async-effekt-hooks';
 *
 * function UserProfile({ userId }) {
 *   const user = useAsyncMemoSuspense(async () => {
 *     const response = await fetch(`https://api.example.com/users/${userId}`);
 *     return response.json();
 *   }, [userId]);
 *
 *   return (
 *     <div>
 *       <h1>{user.name}</h1>
 *       <p>{user.email}</p>
 *     </div>
 *   );
 * }
 *
 * function App() {
 *   return (
 *     <Suspense fallback={<div>Loading...</div>}>
 *       <UserProfile userId="1" />
 *     </Suspense>
 *   );
 * }
 * ```
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
