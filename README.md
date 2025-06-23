# use-async-effekt

React hooks for async effects and memoization with proper dependency tracking.

## Installation

```bash
npm install use-async-effekt
```

## Hooks

### `useAsyncEffekt`

A hook for handling async effects with proper dependency tracking. The name is intentionally spelled with "k" to work correctly with `react-hooks/exhaustive-deps` ESLint rule.

```typescript
import { useAsyncEffekt } from "use-async-effekt";

function MyComponent() {
  const [data, setData] = useState(null);

  useAsyncEffekt(async (isMounted: () => boolean) => {
    const result = await fetchData();
    if (isMounted()) setData(result);
  }, []);

  return <div>{data}</div>;
}
```

### `useAsyncMemo`

A hook for memoizing async computations with dependency tracking.

```typescript
import { useAsyncMemo } from "use-async-effekt";

function MyComponent({ userId }) {
  const userData = useAsyncMemo(
    async (isMounted: () => boolean) => {
      return await fetchUser(userId);
    },
    [userId]
  );

  return <div>{userData?.name}</div>;
}
```

## Features

- ✅ Full TypeScript support
- ✅ Proper dependency tracking
- ✅ Compatible with `react-hooks/exhaustive-deps`
- ✅ Lightweight and performant

## License

MIT © Dave Gööck
