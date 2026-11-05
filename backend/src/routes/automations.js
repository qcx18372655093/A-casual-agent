/**
 * 自动化：规则 CRUD、手动触发、运行记录
 */
import { Router } from 'express'
import { HeaderUtils } from 'coze-coding-dev-sdk'
import { store, audit } from '../store.js'
import { ok, notFound, actor } from '../utils/http.js'
import { executeAutomation } from '../services/automation.js'

const router = Router()

router.get('/', (req, res) => {
  const list = store.list('automations').map((a) => ({
    ...a,
    projectName: store.get('projects', a.projectId)?.name || null,
    skillName: store.get('skills', a.skillId)?.name || a.skillId,
    lastRun: store.list('automationRuns', (r) => r.automationId === a.id).slice(-1)[0] || null,
    runCount: store.list('automationRuns', (r) => r.automationId === a.id).length,
  }))
  ok(res, { list })
})

router.post('/', (req, res) => {
  const { name, projectId, skillId, schedule, instruction, purpose, notifyTargets } = req.body || {}
  if (!name || !projectId || !skillId || !schedule?.text) {
    return res.status(400).json({ error: '缺少必填字段（name / projectId / skillId / schedule.text）' })
  }
  const a = store.insert('automations', {
    no: store.nextSeq('automation'),
    name,
    projectId,
    skillId,
    instruction: instruction || '',
    purpose: purpose || instruction || '',
    schedule,
    notifyTargets: Array.isArray(notifyTargets) ? notifyTargets : [],
    modelPolicy: 'auto',
    safetyLevel: 'read-only',
    status: 'enabled',
    lastRunAt: null,
    nextRunAt: null,
  })
  audit(actor(req), 'automation.create', 'automation', a.id, `创建自动化「${name}」`)
  ok(res, { automation: a })
})

router.patch('/:id', (req, res) => {
  const a = store.get('automations', req.params.id)
  if (!a) return notFound(res, '自动化不存在')
  const allowed = ['name', 'instruction', 'purpose', 'schedule', 'notifyTargets', 'status', 'skillArgs']
  const patch = {}
  for (const k of allowed) if (k in (req.body || {})) patch[k] = req.body[k]
  store.update('automations', a.id, patch)
  audit(actor(req), 'automation.update', 'automation', a.id, `更新自动化「${a.name}」（${Object.keys(patch).join('、')}）`)
  ok(res, { automation: store.get('automations', a.id) })
})

router.delete('/:id', (req, res) => {
  const a = store.get('automations', req.params.id)
  if (!a) return notFound(res, '自动化不存在')
  store.remove('automations', a.id)
  audit(actor(req), 'automation.delete', 'automation', a.id, `删除自动化「${a.name}」`)
  ok(res, { deleted: true })
})

router.post('/:id/trigger', async (req, res) => {
  const a = store.get('automations', req.params.id)
  if (!a) return notFound(res, '自动化不存在')
  const run = await executeAutomation(a, HeaderUtils.extractForwardHeaders(req.headers), 'manual')
  ok(res, { run })
})

router.get('/:id/runs', (req, res) => {
  ok(res, { list: store.list('automationRuns', (r) => r.automationId === req.params.id).reverse() })
})

export default router
