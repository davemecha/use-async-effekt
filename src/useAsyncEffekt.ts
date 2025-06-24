import { useEffect, useRef, DependencyList } from "react";

/**
 * A hook for handling async effects with proper dependency tracking.
 * The name is intentionally spelled with "k" to work correctly with react-hooks/exhaustive-deps ESLint rule.
 *
 * @param effect - An async function to execute
 * @param deps - Dependency array for the effect
 */
export function useAsyncEffekt(
  effect: (isMounted: () => boolean) => Promise<void | (() => void)>,
  deps?: DependencyList
): void {
  const isMountedRef = useRef(true);

  useEffect(() => {
    let cleanup: (() => void) | void;
    let effectPromise: Promise<void>;

    const executeEffect = async () => {
      try {
        cleanup = await effect(() => isMountedRef.current);
      } catch (error) {
        if (isMountedRef.current) {
          console.error("useAsyncEffekt error:", error);
        }
      }
    };

    effectPromise = executeEffect();

    return () => {
      // Wait for the effect to complete before running cleanup
      effectPromise
        .then(() => {
          if (cleanup) {
            cleanup();
          }
        })
        .catch(() => {
          // Effect already failed, no cleanup needed
        });
    };
  }, deps);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
}
