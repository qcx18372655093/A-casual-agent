/**
 * AI 任务：列表、详情、审批/计划后续跑
 */
import { Router } from 'express'
import { store } from '../store.js'
import { ok, notFound } from '../utils/http.js'
import { handleTaskResume, serializeTask } from '../chat.js'

const router = Router()

router.get('/', (req, res) => {
  const { projectId, status, mode, q } = req.query
  let list = store.list('tasks')
  if (projectId) list = list.filter((t) => t.projectId === projectId)
  if (status) list = list.filter((t) => t.status === status)
  if (mode) list = list.filter((t) => t.mode === mode)
  if (q) list = list.filter((t) => t.title.includes(q))
  ok(res, { list: list.map(serializeTask).reverse() })
})

/* SSE 续跑（计划确认/审批后） */
router.post('/:id/resume', handleTaskResume)

router.get('/:id', (req, res) => {
  const task = store.get('tasks', req.params.id)
  if (!task) return notFound(res, '任务不存在')
  const project = task.projectId ? store.get('projects', task.projectId) : null
  const approvals = store.list('approvals', (a) => a.taskId === task.id)
  ok(res, {
    task: serializeTask(task),
    project: project ? { id: project.id, name: project.name, type: project.type } : null,
    approvals,
  })
})

export default router
