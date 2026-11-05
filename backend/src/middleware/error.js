/**
 * 兜底：未匹配接口 404 + 统一错误处理
 */
export function notFoundHandler(req, res) {
  res.status(404).json({ error: `接口不存在：${req.method} ${req.path}` })
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  console.error('[api] error:', err)
  res.status(500).json({ error: `服务内部错误：${err.message}` })
}
