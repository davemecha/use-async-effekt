import { useState, useEffect, useRef, DependencyList } from "react";

/**
 * Memoizes the result of an asynchronous computation, updating when dependencies change and preserving the last successful value on error.
 *
 * The factory function receives an `isMounted` callback to check if the component is still mounted before updating state.
 *
 * @param factory - Function that performs the asynchronous computation and receives an `isMounted` callback
 * @param deps - Optional array of dependencies that trigger recomputation when changed
 * @returns The current memoized value, which is `undefined` while loading or the last successful value if an error occurs
 */
export function useAsyncMemo<T>(
  factory: (isMounted: () => boolean) => Promise<T> | T,
  deps?: DependencyList
): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  const isMountedRef = useRef(true);
  const lastSuccessfulValueRef = useRef<T | undefined>(undefined);

  useEffect(() => {
    const executeFactory = async () => {
      try {
        const result = await factory(() => isMountedRef.current);
        if (isMountedRef.current) {
          setValue(result);
          lastSuccessfulValueRef.current = result;
        }
      } catch (error) {
        if (isMountedRef.current) {
          console.error("useAsyncMemo error:", error);
          // Keep the last successful value on error
          setValue(lastSuccessfulValueRef.current);
        }
      }
    };

    executeFactory();
  }, deps);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return value;
}
