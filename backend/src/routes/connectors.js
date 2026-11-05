/**
 * 系统连接器：目录、MCP Server、新建/导入（含声明工具）、授权/撤销/连通性、删除
 */
import { Router } from 'express'
import { store, audit } from '../store.js'
import { ok, notFound, actor } from '../utils/http.js'
import { normalizeConnectorImport, importConnectorOnce } from '../ingest.js'
import { getAvailableMcpTools } from '../mcp.js'
import { validateToolNames } from './_shared.js'

const router = Router()

router.get('/', (req, res) => {
  ok(res, {
    list: store.list('connectors').map((c) => ({
      ...c,
      usedByProjects: store.list('projects', (p) => p.connectorIds.includes(c.id)).map((p) => p.name),
    })),
    mcpServers: store.list('mcpServers'),
  })
})

router.get('/mcp/servers', (req, res) => {
  ok(res, {
    list: store.list('mcpServers').map((s) => ({
      ...s,
      connector: store.get('connectors', s.connectorId) || null,
      availableTools: getAvailableMcpTools(null).filter((t) => t.server.startsWith(s.name)).length,
    })),
  })
})

router.post('/:id/authorize', (req, res) => {
  const c = store.get('connectors', req.params.id)
  if (!c) return notFound(res, '连接器不存在')
  store.update('connectors', c.id, { status: 'connected', lastSyncAt: new Date().toISOString() })
  audit(actor(req), 'connector.authorize', 'connector', c.id, `授权连接器「${c.name}」（${c.env}）`)
  ok(res, { connector: store.get('connectors', c.id) })
})

router.post('/:id/revoke', (req, res) => {
  const c = store.get('connectors', req.params.id)
  if (!c) return notFound(res, '连接器不存在')
  store.update('connectors', c.id, { status: 'revoked' })
  audit(actor(req), 'connector.revoke', 'connector', c.id, `撤销连接器「${c.name}」授权`)
  ok(res, { connector: store.get('connectors', c.id) })
})

router.post('/:id/test', (req, res) => {
  const c = store.get('connectors', req.params.id)
  if (!c) return notFound(res, '连接器不存在')
  const connected = c.status === 'connected'
  const latencyMs = connected ? 40 + Math.floor(Math.random() * 120) : null
  if (connected) store.update('connectors', c.id, { lastSyncAt: new Date().toISOString() })
  audit(
    actor(req),
    'connector.test',
    'connector',
    c.id,
    `连通性测试：${connected ? `正常（${latencyMs}ms）` : '失败（未授权或已过期）'}`,
    connected ? 'success' : 'failed',
  )
  ok(res, {
    result: connected
      ? { ok: true, latencyMs, env: c.env, demo: true, note: '演示连接器：探测结果仅反映演示环境状态' }
      : { ok: false, reason: '连接器未授权或授权已过期，无法建立连接' },
  })
})

/* 新建自定义连接器（表单，经统一归一化） */
router.post('/', (req, res) => {
  const { data, error } = normalizeConnectorImport(req.body || {})
  if (error) return res.status(400).json({ error })
  const conflict = validateToolNames(data.tools)
  if (conflict) return res.status(409).json({ error: conflict })
  const { connector, duplicated } = importConnectorOnce(data)
  if (duplicated) return res.status(409).json({ error: `已存在同名连接器「${data.name}」` })
  audit(
    actor(req),
    'connector.create',
    'connector',
    connector.id,
    `新建自定义连接器「${connector.name}」${connector.tools?.length ? `（含 ${connector.tools.length} 个声明工具）` : ''}`,
  )
  ok(res, { connector })
})

/* 导入连接器 JSON（payload 可为 JSON 字符串或对象） */
router.post('/import', (req, res) => {
  let payload = req.body?.payload
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload)
    } catch {
      return res.status(400).json({ error: 'JSON 解析失败：请检查格式' })
    }
  }
  const { data, error } = normalizeConnectorImport(payload)
  if (error) return res.status(400).json({ error })
  const conflict = validateToolNames(data.tools)
  if (conflict) return res.status(409).json({ error: conflict })
  const { connector, duplicated } = importConnectorOnce(data)
  if (duplicated) return res.status(409).json({ error: `已存在同名连接器「${data.name}」` })
  audit(actor(req), 'connector.import', 'connector', connector.id, `导入连接器「${connector.name}」`)
  ok(res, { connector })
})

router.delete('/:id', (req, res) => {
  const c = store.get('connectors', req.params.id)
  if (!c) return notFound(res, '连接器不存在')
  if (!c.custom) return res.status(403).json({ error: '预置连接器不可删除，可撤销授权' })
  store.list('projects').forEach((p) => {
    if (p.connectorIds.includes(c.id)) {
      p.connectorIds = p.connectorIds.filter((x) => x !== c.id)
      store.save()
    }
  })
  store.remove('connectors', c.id)
  audit(actor(req), 'connector.delete', 'connector', c.id, `删除自定义连接器「${c.name}」`)
  ok(res, { deleted: true })
})

export default router
