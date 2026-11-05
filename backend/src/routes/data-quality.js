/**
 * 设备台账数据质量：规则概览、规则启停/改名、立即质检（确定性 Skill 回写趋势与运行记录）
 */
import { Router } from 'express'
import { store, audit } from '../store.js'
import { ok, notFound, actor } from '../utils/http.js'
import { executeSkillTool } from '../skills.js'

const router = Router()

router.get('/', (req, res) => {
  const rules = store.list('dqRules')
  const runs = store.list('dqRuns')
  const stats = {
    rules: rules.length,
    enabled: rules.filter((r) => r.enabled).length,
    failed: rules.filter((r) => r.lastStatus === 'failed').length,
    warning: rules.filter((r) => r.lastStatus === 'warning').length,
    issues: rules.reduce((n, r) => n + (r.lastCount || 0), 0),
  }
  ok(res, { list: rules, runs: runs.slice(-20), stats, demo: true })
})

router.patch('/:id', (req, res) => {
  const r = store.get('dqRules', req.params.id)
  if (!r) return notFound(res, '规则不存在')
  const patch = {}
  if (req.body.enabled !== undefined) patch.enabled = !!req.body.enabled
  if (req.body.name) patch.name = req.body.name
  const updated = store.update('dqRules', r.id, patch)
  audit(actor(req), 'dq.rule.update', 'dqRule', r.id, `质检规则「${r.name}」${patch.enabled ? '启用' : '停用'}`)
  ok(res, { rule: updated })
})

/** 立即执行一轮质检（技能执行，确定性结果） */
router.post('/run', async (req, res) => {
  const result = await executeSkillTool('skill.data_quality_check', req.body || {})
  if (!result.ok) return res.status(400).json({ error: result.error })
  const at = new Date().toISOString()
  for (const r of result.data.results) {
    store.update('dqRules', r.ruleId, {
      lastRunAt: at,
      lastStatus: r.status,
      lastCount: r.issueCount,
      trend: r.issueCount > r.previousCount ? 'up' : r.issueCount < r.previousCount ? 'down' : 'flat',
    })
    store.insert('dqRuns', {
      ruleId: r.ruleId,
      runAt: at,
      status: r.status,
      issueCount: r.issueCount,
      previousCount: r.previousCount,
    })
  }
  audit(actor(req), 'dq.run', 'dqRule', 'all', `手动质检：${result.data.totalRules} 条规则`)
  ok(res, { ...result.data, demo: true })
})

export default router
