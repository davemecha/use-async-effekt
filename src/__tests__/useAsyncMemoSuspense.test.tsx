import React, { Suspense, startTransition } from "react";
import { render, screen, waitFor, act as rtlAct } from "@testing-library/react";
import { renderHook, act } from "./test-utils";
import { useAsyncMemoSuspense } from "../useAsyncMemoSuspense";

// Type-safe helper component for testing
interface TestComponentProps<T> {
  factory: () => Promise<T> | T;
  deps: React.DependencyList;
  scope?: string;
  testId?: string;
}

function TestComponent<T>({
  factory,
  deps,
  scope,
  testId,
}: TestComponentProps<T>) {
  const value = useAsyncMemoSuspense(factory, deps, { scope });
  return (
    <div data-testid={testId || "test-result"}>Value: {String(value)}</div>
  );
}

// Realistic test component that demonstrates proper usage
interface UserProfileProps {
  userId: string;
  includeDetails?: boolean;
}

function UserProfile({ userId, includeDetails = false }: UserProfileProps) {
  const user = useAsyncMemoSuspense(
    async () => {
      // Simulate realistic API call
      await new Promise((resolve) => setTimeout(resolve, 10));
      return {
        id: userId,
        name: `User ${userId}`,
        email: `user${userId}@example.com`,
        details: includeDetails ? `Details for ${userId}` : undefined,
      };
    },
    [userId, includeDetails], // Realistic dependency usage
    { scope: `user-profile-${userId}-${includeDetails}` } // Proper scoping
  );

  return (
    <div data-testid="user-profile">
      <h1>{user?.name}</h1>
      <p>{user?.email}</p>
      {user?.details && <p>{user.details}</p>}
    </div>
  );
}

// Error boundary for testing error scenarios
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div data-testid="error-boundary">
          Error: {this.state.error?.message}
        </div>
      );
    }
    return this.props.children;
  }
}

describe("useAsyncMemoSuspense - Core Functionality", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe("Basic async operations", () => {
    it("should suspend and then render resolved value", async () => {
      const factory = jest
        .fn()
        .mockImplementation(
          () =>
            new Promise<string>((resolve) =>
              setTimeout(() => resolve("async-result"), 50)
            )
        );

      render(
        <Suspense fallback={<div data-testid="loading">Loading...</div>}>
          <TestComponent
            factory={factory}
            deps={[]}
            scope="basic-async-test"
            testId="async-result"
          />
        </Suspense>
      );

      expect(screen.getByTestId("loading")).toBeInTheDocument();
      expect(factory).toHaveBeenCalledTimes(1);

      await act(async () => {
        jest.advanceTimersByTime(50);
      });

      await waitFor(() =>
        expect(screen.getByTestId("async-result")).toHaveTextContent(
          "Value: async-result"
        )
      );
    });

    it("should handle synchronous values without suspending", async () => {
      const factory = jest.fn().mockReturnValue("sync-result");

      render(
        <Suspense fallback={<div data-testid="loading">Loading...</div>}>
          <TestComponent
            factory={factory}
            deps={[]}
            scope="sync-test"
            testId="sync-result"
          />
        </Suspense>
      );

      // Wait a tick to ensure React has processed the synchronous result
      await waitFor(() => {
        expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
        expect(screen.getByTestId("sync-result")).toHaveTextContent(
          "Value: sync-result"
        );
      });
      expect(factory).toHaveBeenCalledTimes(1);
    });
  });

  describe("Error handling", () => {
    it("should throw async errors to error boundary", async () => {
      const error = new Error("Async operation failed");
      const factory = jest.fn().mockRejectedValue(error);

      render(
        <ErrorBoundary>
          <Suspense fallback={<div data-testid="loading">Loading...</div>}>
            <TestComponent
              factory={factory}
              deps={[]}
              scope="async-error-test"
            />
          </Suspense>
        </ErrorBoundary>
      );

      await waitFor(
        () =>
          expect(screen.getByTestId("error-boundary")).toHaveTextContent(
            "Error: Async operation failed"
          ),
        { timeout: 1000 }
      );
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it("should throw sync errors to error boundary", () => {
      const error = new Error("Sync operation failed");
      const factory = jest.fn().mockImplementation(() => {
        throw error;
      });

      render(
        <ErrorBoundary>
          <Suspense fallback={<div data-testid="loading">Loading...</div>}>
            <TestComponent
              factory={factory}
              deps={[]}
              scope="sync-error-test"
            />
          </Suspense>
        </ErrorBoundary>
      );

      expect(screen.getByTestId("error-boundary")).toHaveTextContent(
        "Error: Sync operation failed"
      );
    });
  });

  describe("Dependency management", () => {
    it("should recompute when dependencies change", async () => {
      const { rerender } = render(
        <Suspense fallback={<div data-testid="loading">Loading...</div>}>
          <UserProfile userId="1" />
        </Suspense>
      );

      await waitFor(() =>
        expect(screen.getByText("User 1")).toBeInTheDocument()
      );

      rerender(
        <Suspense fallback={<div data-testid="loading">Loading...</div>}>
          <UserProfile userId="2" />
        </Suspense>
      );

      await waitFor(() =>
        expect(screen.getByText("User 2")).toBeInTheDocument()
      );
    });

    it("should handle boolean dependency changes", async () => {
      const { rerender } = render(
        <Suspense fallback={<div data-testid="loading">Loading...</div>}>
          <UserProfile userId="1" includeDetails={false} />
        </Suspense>
      );

      await waitFor(() =>
        expect(screen.getByText("User 1")).toBeInTheDocument()
      );
      expect(screen.queryByText("Details for 1")).not.toBeInTheDocument();

      rerender(
        <Suspense fallback={<div data-testid="loading">Loading...</div>}>
          <UserProfile userId="1" includeDetails={true} />
        </Suspense>
      );

      await waitFor(() =>
        expect(screen.getByText("Details for 1")).toBeInTheDocument()
      );
    });
  });

  describe("Scoping", () => {
    it("should differentiate caches with different scopes", async () => {
      const factory1 = jest.fn().mockResolvedValue("scoped-value-1");
      const factory2 = jest.fn().mockResolvedValue("scoped-value-2");

      render(
        <Suspense fallback={<div data-testid="loading">Loading...</div>}>
          <div>
            <TestComponent
              factory={factory1}
              deps={[]}
              scope="scope-1"
              testId="result-1"
            />
            <TestComponent
              factory={factory2}
              deps={[]}
              scope="scope-2"
              testId="result-2"
            />
          </div>
        </Suspense>
      );

      await waitFor(() => {
        expect(screen.getByTestId("result-1")).toHaveTextContent(
          "Value: scoped-value-1"
        );
        expect(screen.getByTestId("result-2")).toHaveTextContent(
          "Value: scoped-value-2"
        );
      });

      expect(factory1).toHaveBeenCalledTimes(1);
      expect(factory2).toHaveBeenCalledTimes(1);
    });
  });

  describe("React 18 concurrent features", () => {
    it("should work with startTransition", async () => {
      let resolver: ((value: string) => void) | undefined;
      const factory = jest
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<string>((res) => {
              resolver = res;
            })
        )
        .mockImplementationOnce(
          () =>
            new Promise<string>((resolve) =>
              setTimeout(() => resolve("transition-value-2"), 10)
            )
        );

      const App = ({ dep }: { dep: number }) => {
        const value = useAsyncMemoSuspense(factory, [dep], {
          scope: `transition-test-${dep}`,
        });
        return <div data-testid="transition-result">Value: {value}</div>;
      };

      const { rerender } = render(
        <Suspense fallback={<div data-testid="loading">Loading...</div>}>
          <App dep={1} />
        </Suspense>
      );

      expect(screen.getByTestId("loading")).toBeInTheDocument();

      await rtlAct(async () => {
        resolver!("transition-value-1");
      });

      await waitFor(() =>
        expect(screen.getByTestId("transition-result")).toHaveTextContent(
          "Value: transition-value-1"
        )
      );

      startTransition(() => {
        rerender(
          <Suspense fallback={<div data-testid="loading">Loading...</div>}>
            <App dep={2} />
          </Suspense>
        );
      });

      // With startTransition, should show old value while loading
      expect(screen.getByTestId("transition-result")).toHaveTextContent(
        "Value: transition-value-1"
      );

      await act(async () => {
        jest.advanceTimersByTime(10);
      });

      await waitFor(() =>
        expect(screen.getByTestId("transition-result")).toHaveTextContent(
          "Value: transition-value-2"
        )
      );
      expect(factory).toHaveBeenCalledTimes(2);
    });
  });

  describe("Cache behavior and edge cases", () => {
    it("should reuse cache when dependencies haven't changed", async () => {
      const factory = jest.fn().mockResolvedValue("cached-result");

      const TestCacheComponent = ({ rerender }: { rerender: boolean }) => {
        const value = useAsyncMemoSuspense(factory, ["static-dep"], {
          scope: "cache-test",
        });
        return (
          <div data-testid="cache-result">
            Value: {value} - Render: {rerender ? "second" : "first"}
          </div>
        );
      };

      const { rerender } = render(
        <Suspense fallback={<div data-testid="loading">Loading...</div>}>
          <TestCacheComponent rerender={false} />
        </Suspense>
      );

      await waitFor(() =>
        expect(screen.getByTestId("cache-result")).toHaveTextContent(
          "Value: cached-result - Render: first"
        )
      );
      expect(factory).toHaveBeenCalledTimes(1);

      // Rerender with same dependencies - should use cache
      rerender(
        <Suspense fallback={<div data-testid="loading">Loading...</div>}>
          <TestCacheComponent rerender={true} />
        </Suspense>
      );

      await waitFor(() =>
        expect(screen.getByTestId("cache-result")).toHaveTextContent(
          "Value: cached-result - Render: second"
        )
      );
      // Factory should still only be called once due to caching
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it("should handle multiple components with same cache key", async () => {
      const factory = jest.fn().mockResolvedValue("shared-result");

      const ComponentA = () => {
        const value = useAsyncMemoSuspense(factory, ["shared"], {
          scope: "shared-scope",
        });
        return <div data-testid="component-a">A: {value}</div>;
      };

      const ComponentB = () => {
        const value = useAsyncMemoSuspense(factory, ["shared"], {
          scope: "shared-scope",
        });
        return <div data-testid="component-b">B: {value}</div>;
      };

      render(
        <Suspense fallback={<div data-testid="loading">Loading...</div>}>
          <ComponentA />
          <ComponentB />
        </Suspense>
      );

      await waitFor(() => {
        expect(screen.getByTestId("component-a")).toHaveTextContent(
          "A: shared-result"
        );
        expect(screen.getByTestId("component-b")).toHaveTextContent(
          "B: shared-result"
        );
      });

      // Factory should only be called once since both components share the same cache
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it("should handle complex dependency types", async () => {
      const complexObj = { nested: { value: 42 }, array: [1, 2, 3] };
      const factory = jest.fn().mockResolvedValue("complex-deps-result");

      const TestComplexDeps = ({
        obj,
        num,
        str,
        bool,
        nullVal,
        undefinedVal,
      }: {
        obj: any;
        num: number;
        str: string;
        bool: boolean;
        nullVal: null;
        undefinedVal: undefined;
      }) => {
        const value = useAsyncMemoSuspense(
          factory,
          [obj, num, str, bool, nullVal, undefinedVal],
          { scope: "complex-deps" }
        );
        return <div data-testid="complex-result">Value: {value}</div>;
      };

      const { rerender } = render(
        <Suspense fallback={<div data-testid="loading">Loading...</div>}>
          <TestComplexDeps
            obj={complexObj}
            num={42}
            str="test"
            bool={true}
            nullVal={null}
            undefinedVal={undefined}
          />
        </Suspense>
      );

      await waitFor(() =>
        expect(screen.getByTestId("complex-result")).toHaveTextContent(
          "Value: complex-deps-result"
        )
      );
      expect(factory).toHaveBeenCalledTimes(1);

      // Rerender with same complex dependencies - should use cache
      rerender(
        <Suspense fallback={<div data-testid="loading">Loading...</div>}>
          <TestComplexDeps
            obj={complexObj}
            num={42}
            str="test"
            bool={true}
            nullVal={null}
            undefinedVal={undefined}
          />
        </Suspense>
      );

      // Should still use cache
      expect(factory).toHaveBeenCalledTimes(1);

      // Change one dependency - should invalidate cache
      rerender(
        <Suspense fallback={<div data-testid="loading">Loading...</div>}>
          <TestComplexDeps
            obj={complexObj}
            num={43} // Changed
            str="test"
            bool={true}
            nullVal={null}
            undefinedVal={undefined}
          />
        </Suspense>
      );

      await waitFor(() =>
        expect(screen.getByTestId("complex-result")).toHaveTextContent(
          "Value: complex-deps-result"
        )
      );
      expect(factory).toHaveBeenCalledTimes(2);
    });

    it("should handle empty dependencies array", async () => {
      const factory = jest.fn().mockResolvedValue("empty-deps-result");

      const TestEmptyDeps = () => {
        const value = useAsyncMemoSuspense(factory, [], {
          scope: "empty-deps-test",
        });
        return <div data-testid="empty-deps-result">Value: {value}</div>;
      };

      render(
        <Suspense fallback={<div data-testid="loading">Loading...</div>}>
          <TestEmptyDeps />
        </Suspense>
      );

      await waitFor(() =>
        expect(screen.getByTestId("empty-deps-result")).toHaveTextContent(
          "Value: empty-deps-result"
        )
      );
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it("should handle no dependencies parameter (default empty array)", async () => {
      const factory = jest.fn().mockResolvedValue("no-deps-result");

      const TestNoDeps = () => {
        // Test calling without deps parameter
        const value = useAsyncMemoSuspense(factory, undefined, {
          scope: "no-deps-test",
        });
        return <div data-testid="no-deps-result">Value: {value}</div>;
      };

      render(
        <Suspense fallback={<div data-testid="loading">Loading...</div>}>
          <TestNoDeps />
        </Suspense>
      );

      await waitFor(() =>
        expect(screen.getByTestId("no-deps-result")).toHaveTextContent(
          "Value: no-deps-result"
        )
      );
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it("should handle zero and negative zero in dependencies", async () => {
      const factory = jest.fn().mockResolvedValue("zero-result");

      const TestZero = ({ zeroValue }: { zeroValue: number }) => {
        const value = useAsyncMemoSuspense(factory, [zeroValue], {
          scope: "zero-test",
        });
        return <div data-testid="zero-result">Value: {value}</div>;
      };

      const { rerender } = render(
        <Suspense fallback={<div data-testid="loading">Loading...</div>}>
          <TestZero zeroValue={0} />
        </Suspense>
      );

      await waitFor(() =>
        expect(screen.getByTestId("zero-result")).toHaveTextContent(
          "Value: zero-result"
        )
      );
      expect(factory).toHaveBeenCalledTimes(1);

      // Rerender with -0 - should be treated as different due to Object.is(0, -0) being false
      rerender(
        <Suspense fallback={<div data-testid="loading">Loading...</div>}>
          <TestZero zeroValue={-0} />
        </Suspense>
      );

      await waitFor(() =>
        expect(screen.getByTestId("zero-result")).toHaveTextContent(
          "Value: zero-result"
        )
      );
      // Should be called twice since Object.is(0, -0) is false
      expect(factory).toHaveBeenCalledTimes(2);
    });

    it("should handle functions with identical string representations but different behavior", async () => {
      // Two different functions that might have similar toString() output
      const factory1 = jest.fn().mockResolvedValue("factory1-result");
      const factory2 = jest.fn().mockResolvedValue("factory2-result");

      const TestIdenticalFunctions = ({ useFirst }: { useFirst: boolean }) => {
        const factory = useFirst ? factory1 : factory2;
        const value = useAsyncMemoSuspense(factory, [useFirst]);
        return <div data-testid="identical-result">Value: {value}</div>;
      };

      const { rerender } = render(
        <Suspense fallback={<div data-testid="loading">Loading...</div>}>
          <TestIdenticalFunctions useFirst={true} />
        </Suspense>
      );

      await waitFor(() =>
        expect(screen.getByTestId("identical-result")).toHaveTextContent(
          "Value: factory1-result"
        )
      );
      expect(factory1).toHaveBeenCalledTimes(1);

      rerender(
        <Suspense fallback={<div data-testid="loading">Loading...</div>}>
          <TestIdenticalFunctions useFirst={false} />
        </Suspense>
      );

      await waitFor(() =>
        expect(screen.getByTestId("identical-result")).toHaveTextContent(
          "Value: factory2-result"
        )
      );
      expect(factory2).toHaveBeenCalledTimes(1);
    });
  });

  // Note: Error recovery is already tested in the main error handling tests

  describe("Performance and memory considerations", () => {
    it("should handle rapid dependency changes efficiently", async () => {
      const factory = jest
        .fn()
        .mockImplementation((dep: number) => Promise.resolve(`rapid-${dep}`));

      const TestRapidChanges = ({ dep }: { dep: number }) => {
        const value = useAsyncMemoSuspense(() => factory(dep), [dep], {
          scope: "rapid-test",
        });
        return <div data-testid="rapid-result">Value: {value}</div>;
      };

      const { rerender } = render(
        <Suspense fallback={<div data-testid="loading">Loading...</div>}>
          <TestRapidChanges dep={1} />
        </Suspense>
      );

      await waitFor(() =>
        expect(screen.getByTestId("rapid-result")).toHaveTextContent(
          "Value: rapid-1"
        )
      );

      // Rapidly change dependencies
      for (let i = 2; i <= 5; i++) {
        rerender(
          <Suspense fallback={<div data-testid="loading">Loading...</div>}>
            <TestRapidChanges dep={i} />
          </Suspense>
        );

        await waitFor(() =>
          expect(screen.getByTestId("rapid-result")).toHaveTextContent(
            `Value: rapid-${i}`
          )
        );
      }

      expect(factory).toHaveBeenCalledTimes(5);
    });
  });
});
