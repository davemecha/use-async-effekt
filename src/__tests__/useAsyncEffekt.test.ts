import { renderHook, act } from "@testing-library/react";
import { useAsyncEffekt } from "../useAsyncEffekt";

// Helper to create a delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("useAsyncEffekt", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("should execute async effect on mount", async () => {
    const mockEffect = jest.fn().mockResolvedValue(undefined);

    renderHook(() => useAsyncEffekt(mockEffect, []));

    await act(async () => {
      jest.runAllTimers();
    });

    expect(mockEffect).toHaveBeenCalledTimes(1);
    expect(mockEffect).toHaveBeenCalledWith({
      isMounted: expect.any(Function),
      waitForPrevious: expect.any(Function),
    });
  });

  it("should provide isMounted function that returns true when mounted", async () => {
    let isMountedFn: (() => boolean) | undefined;

    const mockEffect = jest.fn().mockImplementation(({ isMounted }) => {
      isMountedFn = isMounted;
      return Promise.resolve();
    });

    renderHook(() => useAsyncEffekt(mockEffect, []));

    await act(async () => {
      jest.runAllTimers();
    });

    expect(isMountedFn).toBeDefined();
    expect(isMountedFn!()).toBe(true);
  });

  it("should provide isMounted function that returns false when unmounted", async () => {
    let isMountedFn: (() => boolean) | undefined;

    const mockEffect = jest.fn().mockImplementation(({ isMounted }) => {
      isMountedFn = isMounted;
      return Promise.resolve();
    });

    const { unmount } = renderHook(() => useAsyncEffekt(mockEffect, []));

    await act(async () => {
      jest.runAllTimers();
    });

    unmount();

    expect(isMountedFn).toBeDefined();
    expect(isMountedFn!()).toBe(false);
  });

  it("should re-run effect when dependencies change", async () => {
    const mockEffect = jest.fn().mockResolvedValue(undefined);
    let dep = 1;

    const { rerender } = renderHook(() => useAsyncEffekt(mockEffect, [dep]));

    await act(async () => {
      jest.runAllTimers();
    });

    expect(mockEffect).toHaveBeenCalledTimes(1);

    dep = 2;
    rerender();

    await act(async () => {
      jest.runAllTimers();
    });

    expect(mockEffect).toHaveBeenCalledTimes(2);
  });

  it("should not re-run effect when dependencies stay the same", async () => {
    const mockEffect = jest.fn().mockResolvedValue(undefined);
    const dep = 1;

    const { rerender } = renderHook(() => useAsyncEffekt(mockEffect, [dep]));

    await act(async () => {
      jest.runAllTimers();
    });

    expect(mockEffect).toHaveBeenCalledTimes(1);

    rerender();

    await act(async () => {
      jest.runAllTimers();
    });

    expect(mockEffect).toHaveBeenCalledTimes(1);
  });

  it("should handle synchronous cleanup function", async () => {
    const mockCleanup = jest.fn();
    const mockEffect = jest.fn().mockResolvedValue(mockCleanup);

    const { unmount } = renderHook(() => useAsyncEffekt(mockEffect, []));

    await act(async () => {
      jest.runAllTimers();
    });

    expect(mockEffect).toHaveBeenCalledTimes(1);
    expect(mockCleanup).not.toHaveBeenCalled();

    unmount();

    await act(async () => {
      jest.runAllTimers();
    });

    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });

  it("should handle asynchronous cleanup function", async () => {
    const mockCleanup = jest.fn().mockResolvedValue(undefined);
    const mockEffect = jest.fn().mockResolvedValue(mockCleanup);

    const { unmount } = renderHook(() => useAsyncEffekt(mockEffect, []));

    await act(async () => {
      jest.runAllTimers();
    });

    expect(mockEffect).toHaveBeenCalledTimes(1);
    expect(mockCleanup).not.toHaveBeenCalled();

    unmount();

    await act(async () => {
      jest.runAllTimers();
    });

    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });

  it("should wait for previous effect when waitForPrevious is called", async () => {
    let resolveFirstEffect: (() => void) | undefined;
    let fistEffectFinishedAndCleaned = false;

    const firstEffect = jest.fn().mockImplementation(() => {
      return new Promise<void>((resolve) => {
        resolveFirstEffect = resolve;
      });
    });

    const secondEffect = jest
      .fn()
      .mockImplementation(async ({ waitForPrevious }) => {
        await waitForPrevious();
        fistEffectFinishedAndCleaned = true;
      });

    let dep = 1;
    const { rerender } = renderHook(() =>
      useAsyncEffekt(dep === 1 ? firstEffect : secondEffect, [dep])
    );

    await act(async () => {
      jest.runAllTimers();
    });

    expect(firstEffect).toHaveBeenCalledTimes(1);
    expect(fistEffectFinishedAndCleaned).toBe(false);

    // Change dependency to trigger second effect
    dep = 2;
    rerender();

    await act(async () => {
      jest.runAllTimers();
    });

    // Second effect should be waiting
    expect(secondEffect).toHaveBeenCalledTimes(1);
    expect(fistEffectFinishedAndCleaned).toBe(false);

    // Resolve first effect
    resolveFirstEffect!();

    await act(async () => {
      jest.runAllTimers();
    });

    expect(fistEffectFinishedAndCleaned).toBe(true);
  });

  it("should handle errors in async effects gracefully", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    const error = new Error("Test error");
    const mockEffect = jest.fn().mockRejectedValue(error);

    renderHook(() => useAsyncEffekt(mockEffect, []));

    await act(async () => {
      jest.runAllTimers();
    });

    expect(mockEffect).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "useAsyncEffekt error:",
      error
    );

    consoleErrorSpy.mockRestore();
  });

  it("should handle errors in cleanup functions gracefully", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    const error = new Error("Cleanup error");
    const mockCleanup = jest.fn().mockRejectedValue(error);
    const mockEffect = jest.fn().mockResolvedValue(mockCleanup);

    const { unmount } = renderHook(() => useAsyncEffekt(mockEffect, []));

    await act(async () => {
      jest.runAllTimers();
    });

    unmount();

    await act(async () => {
      jest.runAllTimers();
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "useAsyncEffekt cleanup error:",
      error
    );

    consoleErrorSpy.mockRestore();
  });

  it("should cancel effect if component unmounts before effect completes", async () => {
    let effectCompleted = false;

    const mockEffect = jest.fn().mockImplementation(async ({ isMounted }) => {
      await delay(100);
      if (isMounted()) {
        effectCompleted = true;
      }
    });

    const { unmount } = renderHook(() => useAsyncEffekt(mockEffect, []));

    // Start the effect
    await act(async () => {
      jest.advanceTimersByTime(50);
    });

    // Unmount before effect completes
    unmount();

    // Complete the timer
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    expect(effectCompleted).toBe(false);
  });

  it("should work without dependencies array", async () => {
    const mockEffect = jest.fn().mockResolvedValue(undefined);

    renderHook(() => useAsyncEffekt(mockEffect));

    await act(async () => {
      jest.runAllTimers();
    });

    expect(mockEffect).toHaveBeenCalledTimes(1);
  });

  it("should handle rapid dependency changes correctly", async () => {
    const mockEffect = jest.fn().mockResolvedValue(undefined);
    let dep = 1;

    const { rerender } = renderHook(() => useAsyncEffekt(mockEffect, [dep]));

    await act(async () => {
      jest.runAllTimers();
    });

    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Rapidly change dependencies
    for (let i = 2; i <= 5; i++) {
      dep = i;
      rerender();
    }

    await act(async () => {
      jest.runAllTimers();
    });

    // Should have been called for each dependency change
    expect(mockEffect).toHaveBeenCalledTimes(5);
  });
});
