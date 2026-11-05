/**
 * SMART6000（NET-6000）智慧教室 AI 中控集控台
 * - 主机集群状态查询（只读）
 * - 场景执行计划生成（确定性技能，只出计划）
 * - 场景/设备执行：高风险写操作，经 MCP 工具落地并全程审计
 */
import { Router } from 'express'
import { store, audit } from '../store.js'
import { ok, notFound, badRequest, actor } from '../utils/http.js'
import { executeMcpTool } from '../mcp.js'
import { executeSkillTool } from '../skills.js'
import { SMART_SCENES } from '../seed-smart.js'

const router = Router()

/** 主机集群总览 */
router.get('/hosts', (req, res) => {
  const hosts = store.list('demoSmartHosts')
  const stats = {
    total: hosts.length,
    online: hosts.filter((h) => h.status === 'online').length,
    degraded: hosts.filter((h) => h.status === 'degraded').length,
    offline: hosts.filter((h) => h.status === 'offline').length,
    aiRunning: hosts.filter((h) => h.aiStatus === 'running').length,
    todaySceneExecs: hosts.reduce((s, h) => s + (h.metrics?.todaySceneExecs || 0), 0),
  }
  ok(res, { list: hosts, stats, scenes: Object.values(SMART_SCENES).map((s) => ({ key: s.key, name: s.name, risk: s.risk })), demo: true })
})

/** 单台主机详情 */
router.get('/hosts/:id', (req, res) => {
  const h = store.get('demoSmartHosts', req.params.id)
  if (!h) return notFound(res, '主机不存在')
  ok(res, { host: h, demo: true })
})

/** 场景执行计划（只出计划，不执行）：复用技能执行器汇聚主机与设备状态 */
router.post('/scene/plan', async (req, res) => {
  const { hostId, scene } = req.body || {}
  if (!hostId || !scene) return badRequest(res, '缺少参数 hostId / scene')
  const result = await executeSkillTool('skill.smart_scene_plan', { hostId, scene })
  if (!result.ok) return badRequest(res, result.error)
  audit(actor(req), 'smart.scene.plan', 'demoSmartHost', hostId, `生成场景计划「${result.data.scene?.name}」`)
  ok(res, { ...result.data, demo: true })
})

/** 场景执行（高风险写操作）：经 MCP 工具落地，幂等可审计 */
router.post('/scene/exec', async (req, res) => {
  const { hostId, scene, clientRequestId } = req.body || {}
  if (!hostId || !scene) return badRequest(res, '缺少参数 hostId / scene')
  const result = await executeMcpTool('smart.scene_exec', { hostId, scene }, {})
  if (!result.ok) return badRequest(res, result.error)
  audit(actor(req), 'smart.scene.exec', 'demoSmartHost', hostId, `执行场景「${result.data.scene}」（演示环境）`)
  ok(res, { ...result.data, demo: true })
})

/** 单设备控制（高风险写操作） */
router.post('/device/control', async (req, res) => {
  const { hostId, device, command } = req.body || {}
  if (!hostId || !device || !command) return badRequest(res, '缺少参数 hostId / device / command')
  const result = await executeMcpTool('smart.device_control', { hostId, device, command }, {})
  if (!result.ok) return badRequest(res, result.error)
  audit(actor(req), 'smart.device.control', 'demoSmartHost', hostId, `控制设备 ${result.data.device}：${result.data.before} → ${result.data.after}（演示环境）`)
  ok(res, { ...result.data, demo: true })
})

export default router
