import { useState, useEffect, useRef, DependencyList } from "react";

/**
 * A hook for memoizing async computations with dependency tracking.
 *
 * @param factory - An async function that returns the memoized value
 * @param deps - Dependency array for the memoization
 * @returns The memoized value, undefined while loading, or the last successful value on error
 */
export function useAsyncMemo<T>(
  factory: (isMounted: () => boolean) => Promise<T> | T,
  deps?: DependencyList
): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  const isMountedRef = useRef(true);
  const lastSuccessfulValueRef = useRef<T | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const executeFactory = async () => {
      try {
        const result = await factory(() => isMountedRef.current);
        if (isMountedRef.current && !cancelled) {
          setValue(result);
          lastSuccessfulValueRef.current = result;
        }
      } catch (error) {
        if (isMountedRef.current && !cancelled) {
          console.error("useAsyncMemo error:", error);
          // Keep the last successful value on error
          setValue(lastSuccessfulValueRef.current);
        }
      }
    };

    executeFactory();

    return () => {
      cancelled = true;
    };
  }, deps);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return value;
}
