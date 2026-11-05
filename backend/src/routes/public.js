/**
 * 公开路由（无需登录）：登录、健康检查。须挂载在 requireAuth 之前。
 */
import { Router } from 'express'
import { handleLogin } from '../auth.js'
import { ok } from '../utils/http.js'
import { config } from '../config/index.js'

const router = Router()

router.post('/auth/login', handleLogin)

router.get('/health', (req, res) => {
  ok(res, { ok: true, service: 'creator-backend', env: config.env, ts: new Date().toISOString() })
})

export default router
