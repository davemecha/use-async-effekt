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
  const cleanupRef = useRef<(() => void) | void>();

  useEffect(() => {
    isMountedRef.current = true;

    const executeEffect = async () => {
      try {
        const cleanup = await effect(() => isMountedRef.current);
        if (isMountedRef.current) {
          cleanupRef.current = cleanup;
        } else if (cleanup) {
          // If component unmounted while effect was running, call cleanup immediately
          cleanup();
        }
      } catch (error) {
        if (isMountedRef.current) {
          console.error("useAsyncEffekt error:", error);
        }
      }
    };

    executeEffect();

    return () => {
      isMountedRef.current = false;
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = undefined;
      }
    };
  }, deps);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
}
