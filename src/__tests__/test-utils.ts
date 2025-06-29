import React from "react";
import semver from "semver";

// types not present, since @testing-library/react-hooks and @testing-library/react are not stable types
// dependencies due to matrix testing and dynamic installation
let renderHook: any;
let act: any;
let waitFor: any;

// React 18+ uses @testing-library/react for renderHook
// React 16/17 use @testing-library/react-hooks
if (semver.gte(React.version, "18.0.0")) {
  try {
    const testingLibReact = require("@testing-library/react");
    renderHook = testingLibReact.renderHook;
    act = testingLibReact.act;
    waitFor = testingLibReact.waitFor;
  } catch (error) {
    console.error("Could not import @testing-library/react:", error);
    throw error;
  }
} else {
  try {
    const testingLibHooks = require("@testing-library/react-hooks");
    const testingLibReact = require("@testing-library/react");
    renderHook = testingLibHooks.renderHook;
    act = testingLibHooks.act;
    waitFor = testingLibReact.waitFor; // waitFor is still in @testing-library/react
  } catch (error) {
    console.error("Could not import @testing-library/react-hooks:", error);
    throw error;
  }
}

export { renderHook, act, waitFor };
