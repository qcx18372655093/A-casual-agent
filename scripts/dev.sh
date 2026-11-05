#!/bin/bash
set -Eeuo pipefail

PORT="${DEPLOY_RUN_PORT:-5000}"
BACKEND_PORT="${BACKEND_PORT:-5001}"
COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
cd "${COZE_WORKSPACE_PATH}"

free_port() {
  local pids
  pids=$(ss -H -lntp 2>/dev/null | awk -v port="${PORT}" '$4 ~ ":"port"$"' | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u || true)
  if [ -n "${pids}" ]; then
    echo "[dev] port ${PORT} in use by PIDs: ${pids}, clearing..."
    echo "${pids}" | xargs -r kill -9 || true
    sleep 1
  fi
}

# 后端独立服务（backend/）：已在运行则复用，否则后台拉起。
# node --watch 仅监听 backend/src 模块图，backend/data/db.json 落盘不会触发重启。
if curl -fsS --max-time 2 "http://localhost:${BACKEND_PORT}/api/health" >/dev/null 2>&1; then
  echo "[dev] backend already running on ${BACKEND_PORT}"
else
  echo "[dev] starting backend on ${BACKEND_PORT} (log: /app/work/logs/bypass//backend.log)"
  mkdir -p /app/work/logs/bypass
  (cd backend && nohup env BACKEND_PORT="${BACKEND_PORT}" node --watch-path=src --watch src/index.js >> /app/work/logs/bypass//backend.log 2>&1 &)
  for i in $(seq 1 40); do
    if curl -fsS --max-time 2 "http://localhost:${BACKEND_PORT}/api/health" >/dev/null 2>&1; then
      echo "[dev] backend ready on ${BACKEND_PORT}"
      break
    fi
    sleep 0.5
  done
fi

free_port
echo "[dev] starting vite on port ${PORT} (proxy /api → 127.0.0.1:${BACKEND_PORT})"
exec pnpm run dev
