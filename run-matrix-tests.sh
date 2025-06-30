#!/bin/bash
set -euo pipefail  # Exit on error, undefined variables, and pipe failures

REACT_VERSIONS=("16.8.0" "17.0.0" "18.0.0" "19.0.0")
NODE_VERSIONS=("16" "18" "20")

for REACT_VERSION in "${REACT_VERSIONS[@]}"; do
  for NODE_VERSION in "${NODE_VERSIONS[@]}"; do
    # Exclude React 19 with Node 16
    if [[ "${REACT_VERSION}" == "19.0.0" && "${NODE_VERSION}" == "16" ]]; then
      echo "Skipping React ${REACT_VERSION} with Node ${NODE_VERSION} (excluded by matrix)"
      continue
    fi

    echo "Running tests for React ${REACT_VERSION} with Node ${NODE_VERSION}"
    IMAGE_NAME="use-async-effekt-test-react${REACT_VERSION}-node${NODE_VERSION}"

    docker build -t "${IMAGE_NAME}" \
      --build-arg NODE_VERSION="${NODE_VERSION}" \
      --build-arg REACT_VERSION="${REACT_VERSION}" \
      -f Dockerfile.test .

    docker run --rm "${IMAGE_NAME}"

    echo "--------------------------------------------------"
  done
done
