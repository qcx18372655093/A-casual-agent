/**
 * 审批：列表 + 决策（仅 approver/admin；通过后由前端调任务 resume 续跑）
 */
import { Router } from 'express'
import { store, audit } from '../store.js'
import { ok, notFound, actor } from '../utils/http.js'

const router = Router()

router.get('/', (req, res) => {
  const { status, projectId } = req.query
  let list = store.list('approvals')
  if (status) list = list.filter((a) => a.status === status)
  if (projectId) list = list.filter((a) => a.projectId === projectId)
  ok(res, {
    list: list.reverse().map((a) => ({
      ...a,
      taskTitle: a.taskId ? store.get('tasks', a.taskId)?.title : null,
      projectName: a.projectId ? store.get('projects', a.projectId)?.name : null,
    })),
  })
})

router.post('/:id/decide', (req, res) => {
  const a = store.get('approvals', req.params.id)
  if (!a) return notFound(res, '审批不存在')
  if (!['approver', 'admin'].includes(req.user?.role)) {
    return res.status(403).json({ error: '仅审批人或管理员可处理审批' })
  }
  if (a.status !== 'pending') return res.status(409).json({ error: '该审批已处理' })
  const { decision, comment } = req.body || {}
  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'decision 必须为 approved / rejected' })
  }
  store.update('approvals', a.id, {
    status: decision,
    decidedAt: new Date().toISOString(),
    decidedBy: req.user.name,
    comment: comment || null,
  })
  audit(
    req.user.name,
    'approval.decide',
    'approval',
    a.id,
    `${decision === 'approved' ? '审批通过' : '审批拒绝'}：${a.title}${comment ? `（${comment}）` : ''}`,
  )
  // 若审批来自 AI 任务，任务侧需通过 /api/tasks/:id/resume 继续执行
  const needResume = !!(a.taskId && store.get('tasks', a.taskId)?.pendingToolCall)
  ok(res, { approval: store.get('approvals', a.id), needResume, taskId: a.taskId || null })
})

export default router
