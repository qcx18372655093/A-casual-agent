/**
 * 审计日志：全链路操作留痕（仅读），含筛选 facet
 */
import { Router } from 'express'
import { store } from '../store.js'
import { ok } from '../utils/http.js'

const router = Router()

router.get('/', (req, res) => {
  const { actor, action, targetType, q } = req.query
  let list = store.list('auditLogs')
  if (actor) list = list.filter((l) => l.actor === actor)
  if (action) list = list.filter((l) => l.action === action)
  if (targetType) list = list.filter((l) => l.targetType === targetType)
  if (q) list = list.filter((l) => l.detail.includes(q))
  ok(res, {
    list: list.reverse().slice(0, 200),
    facets: {
      actors: [...new Set(store.list('auditLogs').map((l) => l.actor))],
      actions: [...new Set(store.list('auditLogs').map((l) => l.action))],
    },
  })
})

export default router
