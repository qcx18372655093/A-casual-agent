/**
 * HTTP 响应与审计公共工具
 */

/** 统一成功响应（沿用原直接返回 JSON 数据体的约定） */
export function ok(res, data) {
  return res.json(data)
}

export function notFound(res, msg = '资源不存在') {
  return res.status(404).json({ error: msg })
}

export function badRequest(res, msg) {
  return res.status(400).json({ error: msg })
}

export function forbidden(res, msg = '无权操作') {
  return res.status(403).json({ error: msg })
}

export function conflict(res, msg) {
  return res.status(409).json({ error: msg })
}

/** 当前请求操作人（审计用），未登录场景回退「系统」 */
export function actor(req) {
  return req.user?.name || '系统'
}
