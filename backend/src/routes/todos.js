/**
 * 待办：列表、完成
 */
import { Router } from 'express'
import { store, audit } from '../store.js'
import { ok, notFound, actor } from '../utils/http.js'

const router = Router()

router.get('/', (req, res) => {
  const { status, projectId } = req.query
  let list = store.list('todos')
  if (status) list = list.filter((t) => t.status === status)
  if (projectId) list = list.filter((t) => t.projectId === projectId)
  ok(res, {
    list: list.reverse().map((t) => ({
      ...t,
      projectName: store.get('projects', t.projectId)?.name || null,
      taskTitle: t.taskId ? store.get('tasks', t.taskId)?.title || null : null,
    })),
  })
})

router.post('/:id/complete', (req, res) => {
  const t = store.get('todos', req.params.id)
  if (!t) return notFound(res, '待办不存在')
  store.update('todos', t.id, { status: 'done' })
  audit(actor(req), 'todo.complete', 'todo', t.id, `完成待办「${t.title}」`)
  ok(res, { todo: store.get('todos', t.id) })
})

router.post('/:id/reopen', (req, res) => {
  const t = store.get('todos', req.params.id)
  if (!t) return notFound(res, '待办不存在')
  store.update('todos', t.id, { status: 'pending' })
  audit(actor(req), 'todo.reopen', 'todo', t.id, `重开待办「${t.title}」`)
  ok(res, { todo: store.get('todos', t.id) })
})

export default router
