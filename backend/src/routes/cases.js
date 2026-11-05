/**
 * 探索案例：案例库列表、复制为任务
 */
import { Router } from 'express'
import { store, audit } from '../store.js'
import { ok, notFound, actor } from '../utils/http.js'

const router = Router()

router.get('/', (req, res) => {
  ok(res, { list: store.list('cases') })
})

router.post('/:id/copy', (req, res) => {
  const c = store.get('cases', req.params.id)
  if (!c) return notFound(res, '案例不存在')
  store.update('cases', c.id, { usedCount: (c.usedCount || 0) + 1 })
  audit(actor(req), 'case.copy', 'case', c.id, `复制案例「${c.title}」为任务`)
  ok(res, { prompt: c.prompt, mode: req.body?.mode || c.mode || 'craft', projectId: c.projectId || null })
})

export default router
