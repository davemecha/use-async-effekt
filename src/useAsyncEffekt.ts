import { useEffect, useRef, DependencyList } from "react";

/**
 * Runs an asynchronous effect in a React component with dependency tracking, sequential execution, and robust cleanup handling.
 *
 * The effect function receives utilities to check if the component is still mounted and to wait for the completion of previous effects and their cleanups. Supports both synchronous and asynchronous cleanup functions returned from the effect.
 *
 * @param effect - An async function that receives an object with `isMounted` and `waitForPrevious` helpers. May return a cleanup function (sync or async).
 * @param deps - Optional dependency array controlling when the effect runs, similar to React's `useEffect`.
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
