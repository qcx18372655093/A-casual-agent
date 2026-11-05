/**
 * 工具试运行台：/api/tools/test —— 技能/MCP 工具即时调试（高风险拒绝，引导审批）
 */
import { Router } from 'express'
import { store, audit } from '../store.js'
import { ok, actor } from '../utils/http.js'
import { getAvailableSkillTools, executeSkillTool } from '../skills.js'
import { getAvailableMcpTools, executeMcpTool, findCustomConnectorTool } from '../mcp.js'

const router = Router()

router.post('/test', async (req, res) => {
  const { name, args } = req.body || {}
  if (!name) return res.status(400).json({ error: '缺少工具名 name' })
  const skTool = getAvailableSkillTools(null).find((t) => t.name === name)
  const mcpTool = getAvailableMcpTools(null).find((t) => t.name === name)
  const descriptor = skTool || mcpTool
  if (!descriptor) {
    const custom = findCustomConnectorTool(name)
    if (custom) {
      return res.status(409).json({ error: `连接器「${custom.connector.name}」未授权接入，请先在连接器中心完成授权` })
    }
    return res.status(404).json({ error: `工具「${name}」不可用：未登记或未启用` })
  }
  if (descriptor.risk === 'high') {
    return res.status(403).json({ error: `工具「${name}」为高风险操作，请通过 AI 任务对话发起，经审批后执行` })
  }
  const started = Date.now()
  const result = skTool
    ? await Promise.resolve(executeSkillTool(name, args || {}))
    : await Promise.resolve(executeMcpTool(name, args || {}, { test: true }))
  const ms = Date.now() - started
  audit(
    actor(req),
    'tool.test',
    'tool',
    name,
    `试运行工具「${name}」→ ${result.ok ? '成功' : `失败：${result.error || ''}`}`,
    result.ok ? 'success' : 'failed',
  )
  ok(res, { ms, result, tool: { name, sideEffect: descriptor.sideEffect, risk: descriptor.risk } })
})

export default router
