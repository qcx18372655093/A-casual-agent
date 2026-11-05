/**
 * CORS：前后端分离后允许跨域直连
 */
import { config } from '../config/index.js'

export function corsMiddleware(req, res, next) {
  const origin = req.headers.origin
  if (config.allowedOrigins.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*')
  } else if (origin && config.allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(204).end()
  next()
}
