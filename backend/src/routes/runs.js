/**
 * 自动化运行记录（原 /api/runs/:id 独立入口）
 */
import { Router } from 'express'
import { store } from '../store.js'
import { ok, notFound } from '../utils/http.js'

const router = Router()

router.get('/:id', (req, res) => {
  const run = store.get('automationRuns', req.params.id)
  if (!run) return notFound(res, '运行记录不存在')
  ok(res, { run })
})

export default router
