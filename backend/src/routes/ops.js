/**
 * 告警中心：告警列表（含抑制标记/统计）、告警更新、AI 关联分析（确定性 Skill + 真实 LLM）、事件
 */
import { Router } from 'express'
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk'
import { store, audit } from '../store.js'
import { ok, notFound, actor } from '../utils/http.js'
import { executeSkillTool } from '../skills.js'

const router = Router()

router.get('/alerts', (req, res) => {
  const { status, severity, source } = req.query
  let list = store.list('opsAlerts')
  if (status && status !== 'all') list = list.filter((a) => a.status === status)
  if (severity && severity !== 'all') list = list.filter((a) => a.severity === severity)
  if (source) list = list.filter((a) => a.source === source || a.target.includes(source))
  const incidents = store.list('incidents')
  const suppressed = new Set(incidents.flatMap((i) => i.suppressedIds || []))
  list = list.map((a) => ({ ...a, suppressed: suppressed.has(a.id) }))
  const stats = {
    total: store.list('opsAlerts', (a) => a.status === 'active').length,
    critical: store.list('opsAlerts', (a) => a.status === 'active' && a.severity === 'critical').length,
    suppressed: suppressed.size,
    incidents: incidents.length,
  }
  ok(res, { list, stats, incidents, demo: true })
})

router.patch('/alerts/:id', (req, res) => {
  const a = store.get('opsAlerts', req.params.id)
  if (!a) return notFound(res, '告警不存在')
  const patch = {}
  if (req.body.acknowledged !== undefined) patch.acknowledged = !!req.body.acknowledged
  if (req.body.assignee) patch.assignee = req.body.assignee
  if (req.body.status) patch.status = req.body.status
  const updated = store.update('opsAlerts', a.id, patch)
  audit(actor(req), 'alert.update', 'opsAlert', a.id, `更新告警「${a.title}」：${Object.keys(patch).join(',')}`)
  ok(res, { alert: updated })
})

/** AI 关联分析：确定性技能汇聚 + 真实 LLM 输出分析结论（LLM 失败降级文本） */
router.post('/alerts/analyze', async (req, res) => {
  const skillResult = await executeSkillTool('skill.alert_root_cause', req.body || {})
  if (!skillResult.ok) return res.status(400).json({ error: skillResult.error })
  let analysis = ''
  let modelOk = false
  try {
    const client = new LLMClient(new Config(), HeaderUtils.extractForwardHeaders(req))
    const resp = await client.invoke(
      [
        {
          role: 'system',
          content:
            '你是音视频显控运维 AIOps 分析助手，服务指挥中心、会议室、报告厅、智慧教室中的编解码节点、拼接处理器、中控主机、矩阵、录播等设备。基于告警关联证据（JSON，来自演示综合运维集控平台）输出中文根因分析，结构为：## 降噪结论（原始/抑制/事件数）/ ## 事件分析（每个事件：根因判断、证据链、影响面）/ ## 建议处置（按优先级）/ ## 待人工确认。只使用给定数据，证据不足明确写“待核实”，并在开头注明数据来自演示连接器。',
        },
        { role: 'user', content: JSON.stringify(skillResult.data) },
      ],
      { temperature: 0.1 },
    )
    analysis = resp.content
    modelOk = true
  } catch (err) {
    analysis = `AI 分析服务暂时不可用（${err.message}）。以下为确定性关联结果，请人工研判。`
  }
  // 未分析事件标记为已分析
  for (const g of skillResult.data.groups) {
    if (g.incidentId) {
      const inc = store.get('incidents', g.incidentId)
      if (inc && !inc.aiAnalyzed) store.update('incidents', inc.id, { aiAnalyzed: true })
    }
  }
  ok(res, { ...skillResult.data, analysis, modelOk, demo: true })
})

router.get('/incidents', (req, res) => {
  ok(res, { list: store.list('incidents'), demo: true })
})

router.patch('/incidents/:id', (req, res) => {
  const inc = store.get('incidents', req.params.id)
  if (!inc) return notFound(res, '事件不存在')
  const patch = {}
  if (req.body.status) patch.status = req.body.status
  if (req.body.assignee) patch.assignee = req.body.assignee
  const updated = store.update('incidents', inc.id, patch)
  audit(actor(req), 'incident.update', 'incident', inc.id, `事件「${inc.title}」更新：${Object.keys(patch).join(',')}`)
  ok(res, { incident: updated })
})

export default router
