/**
 * 引导数据与首页看板
 */
import { Router } from 'express'
import { store } from '../store.js'
import { ok } from '../utils/http.js'
import { serializeTask } from '../chat.js'
import { MODES, MODEL_CHOICES } from '../llm.js'
import { publicUser } from '../auth.js'
import { config } from '../config/index.js'

const router = Router()

router.get('/bootstrap', (req, res) => {
  ok(res, {
    user: publicUser(req.user),
    env: {
      label: config.isProd ? '生产环境' : '开发环境',
      demoNote: '网关/工单/知识库为演示连接器，数据已明确标注',
    },
    modes: Object.values(MODES),
    models: MODEL_CHOICES,
    projectTypes: ['运维运营', '产品研发', '知识工程', '业务流程'],
  })
})

router.get('/stats/dashboard', (req, res) => {
  const tasks = store.list('tasks')
  const connectors = store.list('connectors')
  const today = new Date().toISOString().slice(0, 10)
  ok(res, {
    projectCount: store.list('projects').length,
    activeTaskCount: tasks.filter((t) => ['running', 'waiting_approval', 'waiting_confirm'].includes(t.status)).length,
    pendingApprovalCount: store.list('approvals', (a) => a.status === 'pending').length,
    pendingTodoCount: store.list('todos', (t) => t.status === 'pending').length,
    connectors: {
      total: connectors.length,
      connected: connectors.filter((c) => c.status === 'connected').length,
      issues: connectors.filter((c) => c.status !== 'connected').map((c) => ({ id: c.id, name: c.name, status: c.status })),
    },
    todayRunCount: store.list('automationRuns', (r) => r.startedAt?.slice(0, 10) === today).length,
    unreadNotifications: store.list('notifications', (n) => !n.read).length,
    recentTasks: tasks.slice(-6).reverse().map(serializeTask),
    pendingApprovals: store.list('approvals', (a) => a.status === 'pending'),
    todos: store.list('todos', (t) => t.status === 'pending').slice(0, 5),
    activities: store.list('activities').slice(-8).reverse(),
  })
})

export default router
