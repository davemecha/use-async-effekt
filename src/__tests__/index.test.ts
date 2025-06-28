import { useAsyncEffekt, useAsyncMemo } from '../index';

describe('index', () => {
  it('should export useAsyncEffekt', () => {
    expect(useAsyncEffekt).toBeDefined();
  });

  it('should export useAsyncMemo', () => {
    expect(useAsyncMemo).toBeDefined();
  });
});
