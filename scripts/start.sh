#!/bin/bash
set -Eeuo pipefail

PORT="${DEPLOY_RUN_PORT:-5000}"
COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
cd "${COZE_WORKSPACE_PATH}"

echo "[start] starting production gateway on port ${PORT} (backend: ${BACKEND_PORT:-5001})"
exec node scripts/prod.js
