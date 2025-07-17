import React, { Suspense, startTransition } from "react";
import { render, screen, waitFor, act as rtlAct } from "@testing-library/react";
import { renderHook, act } from "./test-utils";
import { useAsyncMemoSuspense } from "../useAsyncMemoSuspense";

// Helper component to test the hook with suspense
const TestComponent = ({ factory, deps, scope }) => {
  const value = useAsyncMemoSuspense(factory, deps, { scope });
  return <div>Value: {value}</div>;
};

// Error boundary for testing error throwing
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return <div>Error: {this.state.error.message}</div>;
    }
    return this.props.children;
  }
}

describe("useAsyncMemoSuspense", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    // Mock console.error to avoid polluting the test output
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    // Reset caches before each test
    // This is a simplified way to clear the cache for testing purposes.
    // In a real app, you might not have direct access to the cache.
    const cacheModule = require("../useAsyncMemoSuspense");
    if (cacheModule.asyncMemoCache) {
        cacheModule.asyncMemoCache.clear();
    }
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("should suspend while the promise is pending and then render the resolved value", async () => {
    const factory = () => new Promise((resolve) => setTimeout(() => resolve("resolved"), 100));
    render(
      <Suspense fallback={<div>Loading...</div>}>
        <TestComponent factory={factory} deps={[]} />
      </Suspense>
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Value: resolved")).toBeInTheDocument(), { timeout: 200 });
  });

  it("should throw an error to the error boundary if the promise rejects", async () => {
    const error = new Error("failed");
    const factory = () => Promise.reject(error);

    render(
      <ErrorBoundary>
        <Suspense fallback={<div>Loading...</div>}>
          <TestComponent factory={factory} deps={[]} />
        </Suspense>
      </ErrorBoundary>
    );

    await waitFor(() => expect(screen.getByText("Error: failed")).toBeInTheDocument());
  });


  it("should use scope to differentiate caches for hooks with same deps", async () => {
    const factory1 = () => Promise.resolve("value1");
    const factory2 = () => Promise.resolve("value2");

    render(
      <Suspense fallback={<div>Loading...</div>}>
        <div>
          Component 1: <TestComponent factory={factory1} deps={[]} scope="scope1" />
        </div>
        <div>
          Component 2: <TestComponent factory={factory2} deps={[]} scope="scope2" />
        </div>
      </Suspense>
    );

    await waitFor(() => {
      expect(screen.getByText("Value: value1")).toBeInTheDocument();
      expect(screen.getByText("Value: value2")).toBeInTheDocument();
    });
  });

  it("should re-evaluate, suspend and handle transitions", async () => {
    let resolver;
    const factory = jest.fn()
      .mockImplementationOnce(() => new Promise(res => { resolver = () => res("value1"); }))
      .mockResolvedValueOnce("value2");

    const App = ({ dep }) => {
      const value = useAsyncMemoSuspense(factory, [dep]);
      return <div>Value: {value}</div>;
    };

    const { rerender } = render(
      <Suspense fallback={<div>Loading...</div>}>
        <App dep={1} />
      </Suspense>
    );

    // Initial render
    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await rtlAct(async () => {
        resolver();
    });

    await waitFor(() => expect(screen.getByText("Value: value1")).toBeInTheDocument());

    // Rerender with new deps using startTransition
    startTransition(() => {
      rerender(
        <Suspense fallback={<div>Loading...</div>}>
          <App dep={2} />
        </Suspense>
      );
    });

    // With startTransition, React should show the old value while the new one is loading
    expect(screen.getByText("Value: value1")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("Value: value2")).toBeInTheDocument());
    expect(factory).toHaveBeenCalledTimes(2);
  });
});
