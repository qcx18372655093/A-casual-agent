/**
 * 账户路由（需登录）：登出、当前用户
 */
import { Router } from 'express'
import { handleLogout, handleMe } from '../auth.js'

const router = Router()

router.post('/auth/logout', handleLogout)
router.get('/auth/me', handleMe)

export default router
