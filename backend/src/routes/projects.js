/**
 * 项目：列表/详情/设置/成员（项目 = 授权边界）
 */
import { Router } from 'express'
import { store, audit } from '../store.js'
import { ok, notFound, actor } from '../utils/http.js'
import { serializeTask } from '../chat.js'

const router = Router()

router.get('/', (req, res) => {
  const { type, status, q } = req.query
  let list = store.list('projects')
  if (type) list = list.filter((p) => p.type === type)
  if (status) list = list.filter((p) => p.status === status)
  if (q) list = list.filter((p) => p.name.includes(q) || p.goal?.includes(q))
  ok(res, {
    list: list.map((p) => ({
      ...p,
      taskCount: store.list('tasks', (t) => t.projectId === p.id).length,
      docCount: store.list('documents', (d) => store.get('spaces', d.spaceId)?.projectId === p.id).length,
    })),
  })
})

router.post('/', (req, res) => {
  const { name, type, goal, owner } = req.body || {}
  if (!name || !type) return res.status(400).json({ error: '缺少项目名称或类型' })
  const p = store.insert('projects', {
    name,
    type,
    status: 'active',
    owner: owner || actor(req),
    goal: goal || '',
    instructions: '',
    boundaries: '',
    skillIds: [],
    connectorIds: [],
    members: [{ name: owner || actor(req), role: '负责人', email: '' }],
  })
  audit(actor(req), 'project.create', 'project', p.id, `创建项目「${name}」`)
  ok(res, { project: p })
})

router.get('/:id', (req, res) => {
  const p = store.get('projects', req.params.id)
  if (!p) return notFound(res, '项目不存在')
  const tasks = store.list('tasks', (t) => t.projectId === p.id).map(serializeTask).reverse()
  const docs = store.list('documents', (d) => store.get('spaces', d.spaceId)?.projectId === p.id)
  const automations = store.list('automations', (a) => a.projectId === p.id).map((a) => ({
    ...a,
    lastRun: store.list('automationRuns', (r) => r.automationId === a.id).slice(-1)[0] || null,
  }))
  const connectors = p.connectorIds.map((cid) => store.get('connectors', cid)).filter(Boolean)
  const skills = p.skillIds.map((sid) => store.get('skills', sid)).filter(Boolean)
  const activities = store.list('activities', (a) => a.projectId === p.id).reverse()
  ok(res, { project: p, tasks, docs, automations, connectors, skills, activities })
})

router.patch('/:id', (req, res) => {
  const p = store.get('projects', req.params.id)
  if (!p) return notFound(res, '项目不存在')
  const allowed = ['name', 'type', 'status', 'owner', 'goal', 'instructions', 'boundaries', 'skillIds', 'connectorIds']
  const patch = {}
  for (const k of allowed) if (k in (req.body || {})) patch[k] = req.body[k]
  store.update('projects', p.id, patch)
  audit(actor(req), 'project.update', 'project', p.id, `更新项目设置（${Object.keys(patch).join('、')}）`)
  ok(res, { project: store.get('projects', p.id) })
})

router.post('/:id/members', (req, res) => {
  const p = store.get('projects', req.params.id)
  if (!p) return notFound(res, '项目不存在')
  const { name, role, email } = req.body || {}
  if (!name || !role) return res.status(400).json({ error: '缺少成员姓名或角色' })
  p.members.push({ name, role, email: email || '' })
  store.save()
  audit(actor(req), 'project.member.add', 'project', p.id, `添加成员 ${name}（${role}）`)
  ok(res, { project: p })
})

router.delete('/:id/members/:name', (req, res) => {
  const p = store.get('projects', req.params.id)
  if (!p) return notFound(res, '项目不存在')
  p.members = p.members.filter((m) => m.name !== req.params.name)
  store.save()
  audit(actor(req), 'project.member.remove', 'project', p.id, `移除成员 ${req.params.name}`)
  ok(res, { project: p })
})

export default router
