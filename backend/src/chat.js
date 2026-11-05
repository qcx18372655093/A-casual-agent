import { HeaderUtils } from 'coze-coding-dev-sdk'
import { store, audit } from './store.js'
import { runTaskLoop, resumeWithApprovedTool, MODES } from './llm.js'

/** 去除内部字段的任务序列化（llmMessages 仅服务端使用） */
export function serializeTask(task) {
  if (!task) return null
  const { llmMessages, ...rest } = task
  return {
    ...rest,
    displayId: `TASK-${task.no}`,
    pendingToolCall: task.pendingToolCall ? { name: task.pendingToolCall.name, approvalId: task.pendingToolCall.approvalId } : null,
  }
}

function sseInit(res) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  if (typeof res.flushHeaders === 'function') res.flushHeaders()
}

function sseSend(res, type, data) {
  res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)
}

/** POST /api/chat/stream — 发起/继续 AI 任务，SSE 流式返回 */
export async function handleChatStream(req, res) {
  const { taskId, projectId, mode, input, model, title } = req.body || {}
  if (!input || !String(input).trim()) {
    return res.status(400).json({ error: '缺少任务输入 input' })
  }

  let task
  if (taskId) {
    task = store.get('tasks', taskId)
    if (!task) return res.status(404).json({ error: '任务不存在' })
    if (['waiting_approval', 'waiting_confirm'].includes(task.status)) {
      return res.status(409).json({ error: '任务正等待计划确认或审批，请先处理' })
    }
  } else {
    const project = projectId ? store.get('projects', projectId) : null
    if (projectId && !project) return res.status(404).json({ error: '项目不存在' })
    const no = store.nextSeq('task')
    task = store.insert('tasks', {
      no,
      title: title || String(input).trim().slice(0, 30),
      projectId: project ? project.id : null,
      mode: MODES[mode] ? mode : 'craft',
      model: model || 'doubao-seed-2-0-pro-260215',
      status: 'running',
      actor: req.user?.name || '系统',
      skillIds: [],
      connectorIds: [],
      messages: [],
      llmMessages: [],
      steps: [],
      demo: false,
    })
    audit(task.actor, 'task.create', 'task', task.id, `发起 AI 任务：${task.title}（${MODES[task.mode].name}）`)
    if (project) {
      store.insert('activities', { projectId: project.id, kind: 'task', text: `发起任务「${task.title}」`, actor: task.actor })
    }
  }

  const content = String(input).trim()
  task.messages.push({ role: 'user', content, ts: new Date().toISOString() })
  task.llmMessages.push({ role: 'user', content })
  task.status = 'running'
  store.save()

  sseInit(res)
  let closed = false
  res.on('close', () => {
    closed = true
  })
  const emit = (type, data) => {
    if (closed) return
    try {
      sseSend(res, type, data)
    } catch {
      closed = true
    }
  }
  emit('meta', { taskId: task.id, no: task.no, status: 'running', mode: task.mode, model: task.model })

  try {
    await runTaskLoop(task, HeaderUtils.extractForwardHeaders(req.headers), emit)
  } catch (err) {
    console.error('[chat] runTaskLoop error:', err)
    task.status = 'failed'
    task.error = err.message
    store.save()
    emit('error', { message: `执行失败：${err.message}` })
  }
  emit('done', { task: serializeTask(task) })
  res.end()
}

/** POST /api/tasks/:id/resume — 计划确认 / 审批决定后继续任务（SSE） */
export async function handleTaskResume(req, res) {
  const task = store.get('tasks', req.params.id)
  if (!task) return res.status(404).json({ error: '任务不存在' })
  const { action, comment } = req.body || {}

  if (action === 'cancel_plan') {
    task.status = 'cancelled'
    task.messages.push({ role: 'user', content: '已取消该计划，任务终止。', ts: new Date().toISOString(), kind: 'action' })
    store.save()
    audit(task.actor || '陈志远', 'task.cancel', 'task', task.id, '用户取消计划，任务终止')
    return res.json({ task: serializeTask(task) })
  }

  if (!['confirm_plan', 'approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: '不支持的 action（confirm_plan / approve / reject / cancel_plan）' })
  }

  const now = new Date().toISOString()

  if (action === 'confirm_plan') {
    if (task.status !== 'waiting_confirm') return res.status(409).json({ error: '任务当前不在等待计划确认状态' })
    task.planConfirmed = true
    task.status = 'running'
    task.messages.push({ role: 'user', content: '已确认计划，开始执行。', ts: now, kind: 'action' })
    task.llmMessages.push({ role: 'user', content: '【系统】用户已确认上述计划，请按计划逐步执行；高风险工具仍会转人工审批。' })
    audit(task.actor || '陈志远', 'plan.confirm', 'task', task.id, '用户确认计划，开始执行')
  }

  if (action === 'approve' || action === 'reject') {
    if (!['approver', 'admin'].includes(req.user?.role)) return res.status(403).json({ error: '仅审批人或管理员可处理高风险审批' })
    const pending = task.pendingToolCall
    if (!pending) return res.status(409).json({ error: '任务没有待审批的工具调用' })
    const approval = store.get('approvals', pending.approvalId)
    if (approval && approval.status === 'pending') {
      store.update('approvals', approval.id, {
        status: action === 'approve' ? 'approved' : 'rejected',
        decidedAt: now,
        decidedBy: req.user.name,
        comment: comment || null,
      })
    }
    audit(req.user.name, 'approval.decide', 'approval', pending.approvalId, `${action === 'approve' ? '审批通过' : '审批拒绝'}：${pending.name}${comment ? `（${comment}）` : ''}`)

    if (action === 'approve') {
      task.status = 'running'
      task.messages.push({ role: 'user', content: `已批准高风险操作「${pending.name}」。`, ts: now, kind: 'action' })
      task.llmMessages.push({ role: 'user', content: `【系统】高风险操作 ${pending.name} 已获审批通过，系统将直接执行该工具并把结果返回给你。` })
    } else {
      task.status = 'running'
      const rejectedName = pending.name
      task.pendingToolCall = undefined
      task.messages.push({ role: 'user', content: `已拒绝高风险操作「${rejectedName}」。`, ts: now, kind: 'action' })
      task.llmMessages.push({
        role: 'user',
        content: `<tool_result name="${rejectedName}" approved="false">审批被拒绝${comment ? `：${comment}` : ''}。该操作未执行，请向用户说明并给出替代建议。</tool_result>`,
      })
    }
  }

  store.save()

  sseInit(res)
  let closed = false
  res.on('close', () => {
    closed = true
  })
  const emit = (type, data) => {
    if (closed) return
    try {
      sseSend(res, type, data)
    } catch {
      closed = true
    }
  }
  emit('meta', { taskId: task.id, no: task.no, status: task.status, mode: task.mode, model: task.model })

  try {
    if (action === 'approve') {
      await resumeWithApprovedTool(task, HeaderUtils.extractForwardHeaders(req.headers), emit)
    } else {
      await runTaskLoop(task, HeaderUtils.extractForwardHeaders(req.headers), emit)
    }
  } catch (err) {
    console.error('[chat] resume error:', err)
    task.status = 'failed'
    task.error = err.message
    store.save()
    emit('error', { message: `执行失败：${err.message}` })
  }
  emit('done', { task: serializeTask(task) })
  res.end()
}
