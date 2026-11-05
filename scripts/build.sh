#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
cd "${COZE_WORKSPACE_PATH}"

# pnpm workspace：根目录 install 会同时安装前端与 backend/ 依赖
pnpm install
# 后端语法自检（部署前兜底）
pnpm -C backend run check
# 前端构建
pnpm run build
