import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
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
      ({ dep }) => useAsyncMemo(computeFn, [dep]),
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
      ({ dep }) => useAsyncMemo(computeFn, [dep]),
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
      ({ dep }) => useAsyncMemo(computeFn, [dep]),
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
      ({ dep }) => useAsyncMemo(computeFn, [dep]),
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
      ({ dep }) => useAsyncMemo(computeFn, [dep]),
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
      ({ dep }) => useAsyncMemo(computeFn, [dep]),
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
      ({ obj, num }) => useAsyncMemo(computeFn, [obj.id, obj.name, num]),
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
});
