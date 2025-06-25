# use-async-effekt

React hooks for async effects and memoization with proper dependency tracking.

## Installation

```bash
npm install use-async-effekt
```

## Hooks

### `useAsyncEffekt`

A hook for handling async effects with proper dependency tracking and cleanup management. The name is intentionally spelled with "k" to work correctly with `react-hooks/exhaustive-deps` ESLint rule.

The hook provides:

- An `isMounted` callback to check if the component is still mounted
- A `waitForPrevious` function to wait for previous effects and their cleanup to complete
- Support for both synchronous and asynchronous cleanup functions

**Features:**

- Proper cleanup handling - waits for async effects to complete before running cleanup
- Race condition protection when dependencies change rapidly
- Memory leak prevention with mount status checking
- Sequential effect execution when needed
- Support for both sync and async cleanup functions

#### Basic Usage (Without Waiting)

```typescript
import { useAsyncEffekt } from "use-async-effekt";
import { useState } from "react";

function MyComponent() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useAsyncEffekt(async ({ isMounted }) => {
    setLoading(true);

    try {
      const result = await fetchData();
      if (isMounted()) {
        setData(result);
        setLoading(false);
      }
    } catch (error) {
      if (isMounted()) {
        console.error("Failed to fetch data:", error);
        setLoading(false);
      }
    }
  }, []);

  if (loading) return <div>Loading...</div>;
  return <div>{data}</div>;
}
```

#### Usage with Sequential Effect Execution

When you need to ensure that previous effects complete before starting new ones:

```typescript
function SearchComponent({ query }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useAsyncEffekt(
    async ({ isMounted, waitForPrevious }) => {
      // Wait for any previous search to complete and clean up
      await waitForPrevious();

      if (!query) return;

      setLoading(true);

      try {
        const searchResults = await searchAPI(query);
        if (isMounted()) {
          setResults(searchResults);
          setLoading(false);
        }
      } catch (error) {
        if (isMounted()) {
          console.error("Search failed:", error);
          setLoading(false);
        }
      }
    },
    [query]
  );

  return (
    <div>
      {loading && <div>Searching...</div>}
      {results.map((result) => (
        <div key={result.id}>{result.title}</div>
      ))}
    </div>
  );
}
```

#### Usage with Synchronous Cleanup

```typescript
function SubscriptionComponent({ topic }) {
  const [messages, setMessages] = useState([]);

  useAsyncEffekt(
    async ({ isMounted }) => {
      const subscription = await createSubscription(topic);

      subscription.onMessage((message) => {
        if (isMounted()) {
          setMessages((prev) => [...prev, message]);
        }
      });

      // Return synchronous cleanup function
      return () => {
        subscription.unsubscribe();
        console.log("Subscription cleaned up");
      };
    },
    [topic]
  );

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i}>{msg}</div>
      ))}
    </div>
  );
}
```

#### Usage with Asynchronous Cleanup

```typescript
function ConnectionComponent({ endpoint }) {
  const [status, setStatus] = useState("disconnected");

  useAsyncEffekt(
    async ({ isMounted }) => {
      const connection = await establishConnection(endpoint);

      if (isMounted()) {
        setStatus("connected");
      }

      // Return asynchronous cleanup function
      return async () => {
        if (isMounted()) {
          setStatus("disconnecting");
          await connection.gracefulShutdown();
          setStatus("disconnected");
          console.log("Connection closed gracefully");
        }
      };
    },
    [endpoint]
  );

  return <div>Status: {status}</div>;
}
```

#### Complex Usage: Sequential Effects with Async Cleanup

```typescript
function ResourceManager({ resourceId }) {
  const [resource, setResource] = useState(null);
  const [status, setStatus] = useState("idle");

  useAsyncEffekt(
    async ({ isMounted, waitForPrevious }) => {
      // Ensure previous resource is fully cleaned up before acquiring new one
      await waitForPrevious();

      if (!resourceId) return;

      setStatus("acquiring");

      try {
        const newResource = await acquireResource(resourceId);

        if (isMounted()) {
          setResource(newResource);
          setStatus("ready");
        }

        // Return async cleanup to properly release the resource
        return async () => {
          setStatus("releasing");
          await newResource.release();
          setStatus("idle");
          console.log(`Resource ${resourceId} released`);
        };
      } catch (error) {
        if (isMounted()) {
          setStatus("error");
          console.error("Failed to acquire resource:", error);
        }
      }
    },
    [resourceId]
  );

  return (
    <div>
      <div>Status: {status}</div>
      {resource && <div>Resource ID: {resource.id}</div>}
    </div>
  );
}
```

#### When to Use `waitForPrevious`

Use `waitForPrevious()` when:

- You need to ensure previous effects complete before starting new ones
- You're managing exclusive resources (database connections, file handles, etc.)
- You want to prevent race conditions in sequential operations
- You need to guarantee cleanup order

Don't use `waitForPrevious()` when:

- Effects can run independently and concurrently
- You want maximum performance and don't need sequencing
- Effects are simple and don't have interdependencies

In most cases, you should not use `waitForPrevious()` to keep your application responsive. It is always a trade-off between responsiveness and slower sequential execution.

### `useAsyncMemo`

A hook for memoizing async computations with dependency tracking. Returns `undefined` while the async computation is in progress.

**Features:**

- Automatic memoization based on dependencies
- Preserves last successful value on error
- Mount status checking to prevent memory leaks

```typescript
import { useAsyncMemo } from "use-async-effekt";
import { useState } from "react";

function UserProfile({ userId }) {
  const userData = useAsyncMemo(
    async (isMounted) => {
      const user = await fetchUser(userId);

      // You can check if component is still mounted before expensive operations
      if (!isMounted()) return null;

      const additionalData = await fetchUserDetails(userId);

      return {
        ...user,
        ...additionalData,
      };
    },
    [userId]
  );

  // userData will be undefined while loading, then contain the result
  return (
    <div>
      {userData ? (
        <div>
          <h1>{userData.name}</h1>
          <p>{userData.email}</p>
        </div>
      ) : (
        <div>Loading user...</div>
      )}
    </div>
  );
}
```

## ESLint Configuration

To enable dependency checking for these hooks with the `react-hooks/exhaustive-deps` ESLint rule, add the following configuration to your `.eslintrc.js` or ESLint configuration file:

```javascript
module.exports = {
  // ... other ESLint configuration
  rules: {
    // ... other rules
    "react-hooks/exhaustive-deps": [
      "warn",
      {
        additionalHooks: "(useAsyncEffekt|useAsyncMemo)",
      },
    ],
  },
};
```

Or if you're using `.eslintrc.json`:

```json
{
  "rules": {
    "react-hooks/exhaustive-deps": [
      "warn",
      {
        "additionalHooks": "(useAsyncEffekt|useAsyncMemo)"
      }
    ]
  }
}
```

This configuration tells ESLint to treat `useAsyncEffekt` and `useAsyncMemo` the same way as built-in React hooks like `useEffect` and `useMemo`, ensuring that:

- Missing dependencies are flagged as warnings
- Unnecessary dependencies are detected
- Dependency arrays are properly validated

**Note:** The intentional spelling of `useAsyncEffekt` with "k" ensures it matches the regex pattern that ESLint uses to identify effect-like hooks.

## API Reference

### `useAsyncEffekt(effect, deps?)`

**Parameters:**

- `effect: ({ isMounted, waitForPrevious }: { isMounted: () => boolean, waitForPrevious: () => Promise<void> }) => Promise<void | (() => void | Promise<void>)>` - Async function to execute. Receives an `isMounted` callback and a `waitForPrevious` function, and can optionally return a cleanup function.
- `deps?: DependencyList` - Optional dependency array (same as `useEffect`)

**Returns:** `void`

### `useAsyncMemo(factory, deps?)`

**Parameters:**

- `factory: (isMounted: () => boolean) => Promise<T> | T` - Async function that returns the memoized value. Receives an `isMounted` callback.
- `deps?: DependencyList` - Optional dependency array (same as `useMemo`)

**Returns:** `T | undefined` - The memoized value, or `undefined` while loading

## Features

- ✅ Full TypeScript support
- ✅ Proper dependency tracking
- ✅ Compatible with `react-hooks/exhaustive-deps`
- ✅ Race condition protection
- ✅ Memory leak prevention
- ✅ Cleanup function support
- ✅ Error handling with value preservation
- ✅ Lightweight and performant

## License

MIT Dave Gööck
