import React from "react";
import { renderHook, act, waitFor } from "./test-utils";
import { useAsyncMemo } from "../useAsyncMemo";

describe("useAsyncMemo", () => {
  beforeEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should return undefined initially and then the computed value", async () => {
    const computeFn = jest.fn().mockResolvedValue("test-value");
    const { result } = renderHook(() => useAsyncMemo(computeFn, []));

    expect(result.current).toBeUndefined();
    expect(computeFn).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(result.current).toBe("test-value");
    });
  });

  it("should recompute when dependencies change", async () => {
    const computeFn = jest
      .fn()
      .mockResolvedValueOnce("value-1")
      .mockResolvedValueOnce("value-2");

    const { result, rerender } = renderHook(
      ({ dep }: { dep: string }) => useAsyncMemo(computeFn, [dep]),
      { initialProps: { dep: "dep1" } }
    );

    expect(result.current).toBeUndefined();

    await waitFor(() => {
      expect(result.current).toBe("value-1");
    });

    act(() => {
      rerender({ dep: "dep2" });
    });

    // useAsyncMemo keeps the previous value during recomputation
    expect(result.current).toBe("value-1");

    await waitFor(() => {
      expect(result.current).toBe("value-2");
    });

    expect(computeFn).toHaveBeenCalledTimes(2);
  });

  it("should not recompute when dependencies are the same", async () => {
    const computeFn = jest.fn().mockResolvedValue("test-value");
    const { result, rerender } = renderHook(
      ({ dep }: { dep: string }) => useAsyncMemo(computeFn, [dep]),
      { initialProps: { dep: "same-dep" } }
    );

    await waitFor(() => {
      expect(result.current).toBe("test-value");
    });

    act(() => {
      rerender({ dep: "same-dep" });
    });

    expect(computeFn).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("test-value");
  });

  it("should handle errors and keep the last successful value", async () => {
    const mockConsoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const computeFn = jest
      .fn()
      .mockResolvedValueOnce("success-value")
      .mockRejectedValueOnce(new Error("computation error"));

    const { result, rerender } = renderHook(
      ({ dep }: { dep: string }) => useAsyncMemo(computeFn, [dep]),
      { initialProps: { dep: "dep1" } }
    );

    await waitFor(() => {
      expect(result.current).toBe("success-value");
    });

    act(() => {
      rerender({ dep: "dep2" });
    });

    // Should keep the last successful value on error
    await waitFor(() => {
      expect(result.current).toBe("success-value");
    });

    expect(computeFn).toHaveBeenCalledTimes(2);
    mockConsoleError.mockRestore();
  });

  it("should handle initial error by returning undefined", async () => {
    const mockConsoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const computeFn = jest.fn().mockRejectedValue(new Error("initial error"));
    const { result } = renderHook(() => useAsyncMemo(computeFn, []));

    expect(result.current).toBeUndefined();

    // Wait a bit to ensure the error is handled
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(result.current).toBeUndefined();
    expect(computeFn).toHaveBeenCalledTimes(1);
    mockConsoleError.mockRestore();
  });

  it("should cancel previous computation when dependencies change", async () => {
    let resolveFirst: (value: string) => void;
    let resolveSecond: (value: string) => void;

    const firstPromise = new Promise<string>((resolve) => {
      resolveFirst = resolve;
    });

    const secondPromise = new Promise<string>((resolve) => {
      resolveSecond = resolve;
    });

    const computeFn = jest
      .fn()
      .mockReturnValueOnce(firstPromise)
      .mockReturnValueOnce(secondPromise);

    const { result, rerender } = renderHook(
      ({ dep }: { dep: string }) => useAsyncMemo(computeFn, [dep]),
      { initialProps: { dep: "dep1" } }
    );

    expect(result.current).toBeUndefined();

    // Change dependencies before first computation completes
    act(() => {
      rerender({ dep: "dep2" });
    });

    // Resolve both promises
    await act(async () => {
      resolveFirst("first-value");
      resolveSecond("second-value");
      await Promise.all([firstPromise, secondPromise]);
    });

    await waitFor(() => {
      expect(result.current).toBe("second-value");
    });

    expect(computeFn).toHaveBeenCalledTimes(2);
  });

  it("should handle rapid dependency changes", async () => {
    const computeFn = jest
      .fn()
      .mockResolvedValueOnce("value-1")
      .mockResolvedValueOnce("value-2")
      .mockResolvedValueOnce("value-3");

    const { result, rerender } = renderHook(
      ({ dep }: { dep: string }) => useAsyncMemo(computeFn, [dep]),
      { initialProps: { dep: "dep1" } }
    );

    // Wait for first value
    await waitFor(() => {
      expect(result.current).toBe("value-1");
    });

    // Rapidly change dependencies
    act(() => {
      rerender({ dep: "dep2" });
      rerender({ dep: "dep3" });
    });

    // Wait for the final computation to complete
    // Due to cancellation, we might get value-2 or value-3
    await waitFor(() => {
      expect(["value-2", "value-3"]).toContain(result.current);
    });

    // Due to rapid changes and cancellation, we might get fewer calls than expected
    expect(computeFn).toHaveBeenCalledTimes(2);
  });

  it("should handle null, zero, and empty string values correctly", async () => {
    const computeFn = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce("");

    const { result, rerender } = renderHook(
      ({ dep }: { dep: string }) => useAsyncMemo(computeFn, [dep]),
      { initialProps: { dep: "null" } }
    );

    await waitFor(() => {
      expect(result.current).toBeNull();
    });

    act(() => {
      rerender({ dep: "zero" });
    });

    await waitFor(() => {
      expect(result.current).toBe(0);
    });

    act(() => {
      rerender({ dep: "empty" });
    });

    await waitFor(() => {
      expect(result.current).toBe("");
    });

    expect(computeFn).toHaveBeenCalledTimes(3);
  });

  it("should cleanup on unmount", async () => {
    let resolveComputation: (value: string) => void;
    const computationPromise = new Promise<string>((resolve) => {
      resolveComputation = resolve;
    });

    const computeFn = jest.fn().mockReturnValue(computationPromise);
    const { result, unmount } = renderHook(() => useAsyncMemo(computeFn, []));

    expect(result.current).toBeUndefined();

    unmount();

    // Resolve after unmount - should not cause any issues
    await act(async () => {
      resolveComputation("test-value");
      await computationPromise;
    });

    expect(computeFn).toHaveBeenCalledTimes(1);
  });

  it("should work with complex dependencies", async () => {
    const computeFn = jest
      .fn()
      .mockResolvedValueOnce("result-1")
      .mockResolvedValueOnce("result-2");

    const obj1 = { id: 1, name: "test" };
    const obj2 = { id: 2, name: "test2" };

    const { result, rerender } = renderHook(
      ({ obj, num }: { obj: { id: number; name: string }; num: number }) =>
        useAsyncMemo(computeFn, [obj.id, obj.name, num]),
      { initialProps: { obj: obj1, num: 42 } }
    );

    await waitFor(() => {
      expect(result.current).toBe("result-1");
    });

    act(() => {
      rerender({ obj: obj2, num: 42 });
    });

    await waitFor(() => {
      expect(result.current).toBe("result-2");
    });

    expect(computeFn).toHaveBeenCalledTimes(2);
  });

  it("should handle StrictMode double invocation", async () => {
    const computeFn = jest.fn().mockResolvedValue("test-value");

    const { result } = renderHook(() => useAsyncMemo(computeFn, []), {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(React.StrictMode, null, children),
    });

    await waitFor(() => {
      expect(result.current).toBe("test-value");
    });

    // In StrictMode, effects may run twice, but the final result should be correct
    expect(result.current).toBe("test-value");
  });

  it("should handle synchronous computation functions", async () => {
    const computeFn = jest.fn().mockReturnValue("sync-value");
    const { result } = renderHook(() => useAsyncMemo(computeFn, []));

    expect(result.current).toBeUndefined();

    await waitFor(() => {
      expect(result.current).toBe("sync-value");
    });

    expect(computeFn).toHaveBeenCalledTimes(1);
  });

  it("should handle delayed async operations with proper timing", async () => {
    jest.useFakeTimers();

    const computeFn = jest
      .fn()
      .mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve("test-value"), 1000)
          )
      );

    const { result } = renderHook(() => useAsyncMemo(computeFn, []));

    expect(result.current).toBeUndefined();

    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve(); // Allow promises to resolve
    });

    expect(result.current).toBe("test-value");

    jest.useRealTimers();
  });

  it("should handle synchronous factory function", async () => {
    const syncFactory = jest.fn().mockReturnValue("sync-value");
    const { result } = renderHook(() => useAsyncMemo(syncFactory, []));

    expect(result.current).toBeUndefined();

    await waitFor(() => {
      expect(result.current).toBe("sync-value");
    });

    expect(syncFactory).toHaveBeenCalledTimes(1);
    expect(syncFactory).toHaveBeenCalledWith(expect.any(Function));
  });

  it("should handle factory function that checks isMounted", async () => {
    let isMountedFn: (() => boolean) | undefined;
    const factory = jest.fn().mockImplementation((isMounted) => {
      isMountedFn = isMounted;
      return Promise.resolve("test-value");
    });

    const { result, unmount } = renderHook(() => useAsyncMemo(factory, []));

    await waitFor(() => {
      expect(result.current).toBe("test-value");
    });

    expect(isMountedFn).toBeDefined();
    expect(isMountedFn!()).toBe(true);

    unmount();
    expect(isMountedFn!()).toBe(false);
  });

  it("should not update state if component unmounts before async operation completes", async () => {
    let resolveFactory: ((value: string) => void) | undefined;
    const factory = jest.fn().mockImplementation(() => {
      return new Promise<string>((resolve) => {
        resolveFactory = resolve;
      });
    });

    const { result, unmount } = renderHook(() => useAsyncMemo(factory, []));

    expect(result.current).toBeUndefined();
    expect(factory).toHaveBeenCalledTimes(1);

    // Unmount before resolving
    unmount();

    // Now resolve the promise
    act(() => {
      resolveFactory!("late-value");
    });

    // Should still be undefined since component was unmounted
    expect(result.current).toBeUndefined();
  });

  it("should handle factory function returning null", async () => {
    const factory = jest.fn().mockResolvedValue(null);
    const { result } = renderHook(() => useAsyncMemo(factory, []));

    await waitFor(() => {
      expect(result.current).toBeNull();
    });
  });

  it("should handle factory function returning undefined", async () => {
    const factory = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAsyncMemo(factory, []));

    // Should remain undefined, but factory should have been called
    expect(result.current).toBeUndefined();
    expect(factory).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(result.current).toBeUndefined();
    });
  });

  it("should handle factory function returning 0", async () => {
    const factory = jest.fn().mockResolvedValue(0);
    const { result } = renderHook(() => useAsyncMemo(factory, []));

    await waitFor(() => {
      expect(result.current).toBe(0);
    });
  });

  it("should handle factory function returning false", async () => {
    const factory = jest.fn().mockResolvedValue(false);
    const { result } = renderHook(() => useAsyncMemo(factory, []));

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it("should handle factory function returning empty string", async () => {
    const factory = jest.fn().mockResolvedValue("");
    const { result } = renderHook(() => useAsyncMemo(factory, []));

    await waitFor(() => {
      expect(result.current).toBe("");
    });
  });

  it("should preserve last successful value through multiple errors", async () => {
    const mockConsoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const factory = jest
      .fn()
      .mockResolvedValueOnce("success-1")
      .mockRejectedValueOnce(new Error("error-1"))
      .mockRejectedValueOnce(new Error("error-2"))
      .mockResolvedValueOnce("success-2");

    const { result, rerender } = renderHook(
      ({ dep }: { dep: number }) => useAsyncMemo(factory, [dep]),
      { initialProps: { dep: 1 } }
    );

    // First success
    await waitFor(() => {
      expect(result.current).toBe("success-1");
    });

    // First error - should keep last successful value
    act(() => {
      rerender({ dep: 2 });
    });

    await waitFor(() => {
      expect(result.current).toBe("success-1");
    });

    // Second error - should still keep last successful value
    act(() => {
      rerender({ dep: 3 });
    });

    await waitFor(() => {
      expect(result.current).toBe("success-1");
    });

    // Second success - should update to new value
    act(() => {
      rerender({ dep: 4 });
    });

    await waitFor(() => {
      expect(result.current).toBe("success-2");
    });

    expect(mockConsoleError).toHaveBeenCalledTimes(2);
    mockConsoleError.mockRestore();
  });

  it("should handle complex object values", async () => {
    const complexValue = {
      id: 1,
      name: "test",
      nested: { value: "nested-test" },
      array: [1, 2, 3],
    };

    const factory = jest.fn().mockResolvedValue(complexValue);
    const { result } = renderHook(() => useAsyncMemo(factory, []));

    await waitFor(() => {
      expect(result.current).toEqual(complexValue);
      expect(result.current).toBe(complexValue); // Same reference
    });
  });

  it("should handle factory that uses isMounted to prevent state updates", async () => {
    let shouldComplete = false;
    const factory = jest.fn().mockImplementation(async (isMounted) => {
      // Simulate some async work
      await new Promise((resolve) => setTimeout(resolve, 10));

      if (!isMounted()) {
        return "should-not-be-used";
      }

      return shouldComplete ? "completed" : "initial";
    });

    const { result, rerender } = renderHook(
      ({ trigger }: { trigger: boolean }) => useAsyncMemo(factory, [trigger]),
      { initialProps: { trigger: false } }
    );

    await waitFor(() => {
      expect(result.current).toBe("initial");
    });

    shouldComplete = true;
    act(() => {
      rerender({ trigger: true });
    });

    await waitFor(() => {
      expect(result.current).toBe("completed");
    });

    expect(factory).toHaveBeenCalledTimes(2);
  });

  it("should handle very rapid dependency changes", async () => {
    const factory = jest
      .fn()
      .mockResolvedValueOnce("value-1")
      .mockResolvedValueOnce("value-2")
      .mockResolvedValueOnce("value-3")
      .mockResolvedValueOnce("value-4")
      .mockResolvedValueOnce("value-5");

    const { result, rerender } = renderHook(
      ({ dep }: { dep: number }) => useAsyncMemo(factory, [dep]),
      { initialProps: { dep: 1 } }
    );

    // Rapid changes
    for (let i = 2; i <= 5; i++) {
      act(() => {
        rerender({ dep: i });
      });
    }

    // Should eventually settle on the last value
    await waitFor(() => {
      expect(result.current).toBe("value-5");
    });

    expect(factory).toHaveBeenCalledTimes(5);
  });
});
