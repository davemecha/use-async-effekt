// Test utilities with React version compatibility
import React from 'react';

// Check if renderHook exists in @testing-library/react (React 18+)
// Otherwise use @testing-library/react-hooks (React 16/17)
let renderHook: any;
let act: any;
let waitFor: any;

try {
  const testingLibReact = require('@testing-library/react');
  
  // Check if renderHook exists in @testing-library/react
  if (testingLibReact.renderHook) {
    // React 18+ - renderHook is in @testing-library/react
    renderHook = testingLibReact.renderHook;
    act = testingLibReact.act;
    waitFor = testingLibReact.waitFor;
  } else {
    // React 16/17 - renderHook is in @testing-library/react-hooks
    const testingLibHooks = require('@testing-library/react-hooks');
    renderHook = testingLibHooks.renderHook;
    act = testingLibHooks.act;
    waitFor = testingLibReact.waitFor;
  }
} catch (error) {
  throw new Error('Could not import testing utilities: ' + (error instanceof Error ? error.message : String(error)));
}

export { renderHook, act, waitFor };
