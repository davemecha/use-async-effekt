import { useEffect, useRef, DependencyList } from "react";

/**
 * A hook for handling async effects with proper dependency tracking and cleanup management.
 * The name is intentionally spelled with "k" to work correctly with react-hooks/exhaustive-deps ESLint rule.
 *
 * @param effect - An async function to execute. Receives an object with:
 *   - `isMounted`: Function to check if the component is still mounted
 *   - `waitForPrevious`: Function that returns a Promise to wait for the previous effect and its cleanup to complete
 *
 *   The effect function can optionally return a cleanup function that can be either synchronous or asynchronous.
 *
 * @param deps - Dependency array for the effect (same as useEffect)
 *
 * @example
 * // Basic usage without waiting for previous effects
 * useAsyncEffekt(async ({ isMounted }) => {
 *   const data = await fetchData();
 *   if (isMounted()) {
 *     setData(data);
 *   }
 * }, []);
 *
 * @example
 * // Usage with waiting for previous effect to complete
 * useAsyncEffekt(async ({ isMounted, waitForPrevious }) => {
 *   await waitForPrevious(); // Wait for previous effect and cleanup
 *   const data = await fetchData();
 *   if (isMounted()) {
 *     setData(data);
 *   }
 * }, [dependency]);
 *
 * @example
 * // Usage with synchronous cleanup
 * useAsyncEffekt(async ({ isMounted }) => {
 *   const subscription = await createSubscription();
 *
 *   return () => {
 *     subscription.unsubscribe(); // Sync cleanup
 *   };
 * }, []);
 *
 * @example
 * // Usage with asynchronous cleanup
 * useAsyncEffekt(async ({ isMounted }) => {
 *   const connection = await establishConnection();
 *
 *   return async () => {
 *     await connection.close(); // Async cleanup
 *   };
 * }, []);
 *
 * @example
 * // Complex usage with waiting and async cleanup
 * useAsyncEffekt(async ({ isMounted, waitForPrevious }) => {
 *   await waitForPrevious(); // Ensure previous effect is fully cleaned up
 *
 *   const resource = await acquireResource();
 *   if (isMounted()) {
 *     setResource(resource);
 *   }
 *
 *   return async () => {
 *     await resource.cleanup(); // Async cleanup
 *   };
 * }, [resourceId]);
 */
export function useAsyncEffekt(
  effect: ({
    isMounted,
    waitForPrevious,
  }: {
    isMounted: () => boolean;
    waitForPrevious: () => Promise<void>;
  }) => Promise<void | (() => void | Promise<void>)>,
  deps?: DependencyList
): void {
  const isMountedRef = useRef(true);
  // Track the promise chain of all previous effects and their cleanups
  const lastEffectChainRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cleanup: (() => void | Promise<void>) | void;
    let cleanupResolver: (() => void) | null = null;

    // Capture the current chain to wait for
    const previousEffectChain = lastEffectChainRef.current;

    // Create a promise that resolves when this effect's cleanup is complete
    const cleanupPromise = new Promise<void>((resolve) => {
      cleanupResolver = resolve;
    });

    const executeEffect = async () => {
      try {
        cleanup = await effect({
          isMounted: () => isMountedRef.current,
          waitForPrevious: () => previousEffectChain,
        });
      } catch (error) {
        if (isMountedRef.current) {
          console.error("useAsyncEffekt error:", error);
        }
      }
    };

    // Create the current effect promise
    const currentEffectPromise = executeEffect();

    // Update the chain to include both current effect and its future cleanup
    lastEffectChainRef.current = currentEffectPromise.then(
      () => cleanupPromise
    );

    return () => {
      // Trigger cleanup and resolve the cleanup promise
      currentEffectPromise
        .then(async () => {
          if (!cleanup) return;
          try {
            await cleanup();
          } catch (error) {
            console.error("useAsyncEffekt cleanup error:", error);
          }
        })
        .catch(() => {
          // Effect already failed, no cleanup needed
        })
        .then(() => {
          // Resolve the cleanup promise to signal completion
          if (cleanupResolver) {
            cleanupResolver();
          }
        });
    };
  }, deps);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
}
