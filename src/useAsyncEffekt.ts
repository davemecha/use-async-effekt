import { useEffect, useRef, DependencyList } from "react";

/**
 * A hook for handling async effects with proper dependency tracking.
 * The name is intentionally spelled with "k" to work correctly with react-hooks/exhaustive-deps ESLint rule.
 *
 * @param effect - An async function to execute
 * @param deps - Dependency array for the effect
 */
export function useAsyncEffekt(
  effect: ({
    isMounted,
    waitForLastEffect,
  }: {
    isMounted: () => boolean;
    waitForLastEffect: () => Promise<void>;
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
          waitForLastEffect: () => previousEffectChain,
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
