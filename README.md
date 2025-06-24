# use-async-effekt

React hooks for async effects and memoization with proper dependency tracking.

## Installation

```bash
npm install use-async-effekt
```

## Hooks

### `useAsyncEffekt`

A hook for handling async effects with proper dependency tracking. The name is intentionally spelled with "k" to work correctly with `react-hooks/exhaustive-deps` ESLint rule.

The hook provides an `isMounted` callback to check if the component is still mounted, helping prevent state updates on unmounted components.

**Features:**

- Proper cleanup handling - waits for async effects to complete before running cleanup
- Race condition protection when dependencies change rapidly
- Memory leak prevention with mount status checking

```typescript
import { useAsyncEffekt } from "use-async-effekt";
import { useState } from "react";

function MyComponent() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useAsyncEffekt(async (isMounted) => {
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

    // Optional cleanup function
    return () => {
      console.log("Cleaning up effect");
    };
  }, []);

  if (loading) return <div>Loading...</div>;
  return <div>{data}</div>;
}
```

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

- `effect: (isMounted: () => boolean) => Promise<void | (() => void)>` - Async function to execute. Receives an `isMounted` callback and can optionally return a cleanup function.
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

MIT © Dave Gööck
