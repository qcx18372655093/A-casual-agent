import { store } from './store.js'

/**
 * MCP 工具注册中心。
 * 工具来自已登记的 MCP Server（server/mcp.js 的 mcpServers 集合），
 * 实际可用性受连接器状态与项目授权约束：
 * - 连接器非 connected → 工具不可用
 * - 写操作工具支持审批上下文与幂等
 *
 * 注意：当前网关/工单/知识库均为「演示连接器」数据（demo: true），
 * 返回结果必须携带 demo 标识，不得冒充真实系统。
 */

function devices() {
  return store.list('demoDevices')
}
function alerts() {
  return store.list('demoAlerts')
}

/** 知识库检索：关键词评分 + 片段截取 */
export function kbSearch(query, topK = 5) {
  const docs = store.list('documents', (d) => d.indexed)
  const terms = String(query || '')
    .split(/[\s,，。？?、/]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
  // 单字词噪声大，过滤；同时保留原始查询做整体匹配
  const keywords = [...new Set(terms.filter((t) => t.length >= 2))]
  // 中文长词补充二元分词，提升检索召回（如“网关重启”→ 网关/关重/重启）
  const expanded = new Set(keywords)
  for (const k of keywords) {
    if (/[一-鿿]/.test(k) && k.length > 2) {
      for (let i = 0; i < k.length - 1; i++) expanded.add(k.slice(i, i + 2))
    }
  }
  const scored = docs
    .map((doc) => {
      const hay = `${doc.title}\n${(doc.tags || []).join(' ')}\n${doc.content}`
      let score = 0
      for (const k of expanded) {
        const hits = hay.split(k).length - 1
        if (hits > 0) score += hits * (doc.title.includes(k) ? 3 : 1) * (k.length >= 3 ? 2 : 1)
      }
      return { doc, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)

  return scored.map(({ doc, score }) => {
    // 截取首个命中位置附近片段
    let idx = -1
    for (const k of keywords) {
      idx = doc.content.indexOf(k)
      if (idx >= 0) break
    }
    const start = Math.max(0, (idx < 0 ? 0 : idx) - 80)
    const excerpt = doc.content.slice(start, start + 320)
    const space = store.get('spaces', doc.spaceId)
    return {
      docId: doc.id,
      title: doc.title,
      category: doc.category,
      version: doc.version,
      spaceId: doc.spaceId,
      space: space ? space.name : null,
      updatedAt: doc.updatedAt,
      score,
      excerpt,
    }
  })
}

/** MCP 工具执行器：name → { serverId, connectorId, desc, sideEffect, risk, execute } */
export const MCP_TOOLS = {
  'gateway.list_devices': {
    serverId: 'mcp_gateway',
    connectorId: 'conn_gateway',
    desc: '查询设备台账清单，可按楼栋、类型、状态过滤',
    sideEffect: 'read',
    risk: 'low',
    execute(args) {
      let list = devices()
      if (args.building) list = list.filter((d) => d.building === args.building)
      if (args.type) list = list.filter((d) => d.type === args.type)
      if (args.status) list = list.filter((d) => d.status === args.status)
      return {
        ok: true,
        demo: true,
        data: {
          total: list.length,
          devices: list.map((d) => ({
            id: d.id,
            name: d.name,
            type: d.type,
            building: d.building,
            room: d.room,
            status: d.status,
            firmware: d.firmware,
            lastHeartbeat: d.lastHeartbeat,
          })),
        },
      }
    },
  },

  'gateway.get_device_status': {
    serverId: 'mcp_gateway',
    connectorId: 'conn_gateway',
    desc: '查询单台设备实时状态与关键指标',
    sideEffect: 'read',
    risk: 'low',
    execute(args) {
      const d = store.get('demoDevices', args.deviceId)
      if (!d) return { ok: false, error: `设备 ${args.deviceId} 不存在于台账` }
      const active = alerts().filter((a) => a.deviceId === d.id && a.status === 'active')
      return {
        ok: true,
        demo: true,
        data: {
          id: d.id,
          name: d.name,
          type: d.type,
          building: d.building,
          room: d.room,
          status: d.status,
          firmware: d.firmware,
          ip: d.ip,
          lastHeartbeat: d.lastHeartbeat,
          metrics: d.metrics,
          activeAlerts: active.map((a) => ({ id: a.id, severity: a.severity, message: a.message, lastSeen: a.lastSeen })),
        },
      }
    },
  },

  'gateway.list_alerts': {
    serverId: 'mcp_gateway',
    connectorId: 'conn_gateway',
    desc: '查询设备告警历史，可按设备、级别、时间范围过滤',
    sideEffect: 'read',
    risk: 'low',
    execute(args) {
      const days = Number(args.days || 7)
      const since = Date.now() - days * 86400000
      let list = alerts().filter((a) => new Date(a.lastSeen).getTime() >= since || a.status === 'active')
      if (args.deviceId) list = list.filter((a) => a.deviceId === args.deviceId)
      if (args.severity) list = list.filter((a) => a.severity === args.severity)
      return {
        ok: true,
        demo: true,
        data: {
          rangeDays: days,
          total: list.length,
          alerts: list.map((a) => ({
            id: a.id,
            deviceId: a.deviceId,
            severity: a.severity,
            message: a.message,
            firstSeen: a.firstSeen,
            lastSeen: a.lastSeen,
            count: a.count,
            status: a.status,
          })),
        },
      }
    },
  },

  'gateway.reboot_device': {
    serverId: 'mcp_gateway',
    connectorId: 'conn_gateway',
    desc: '重启指定设备（高风险：分钟级服务中断，需审批）',
    sideEffect: 'write',
    risk: 'high',
    execute(args, ctx) {
      const d = store.get('demoDevices', args.deviceId)
      if (!d) return { ok: false, error: `设备 ${args.deviceId} 不存在于台账` }
      // 审批通过后执行（演示连接器：仅更新演示状态）
      store.update('demoDevices', d.id, {
        status: 'online',
        lastHeartbeat: new Date().toISOString(),
        metrics: { ...d.metrics, uptimeHours: 0, offlineCount7d: 0 },
      })
      for (const a of alerts().filter((x) => x.deviceId === d.id && x.status === 'active' && x.severity === 'critical')) {
        store.update('demoAlerts', a.id, { status: 'resolved' })
      }
      return {
        ok: true,
        demo: true,
        data: {
          rebooted: true,
          deviceId: d.id,
          name: d.name,
          reason: args.reason,
          approvalId: ctx?.approvalId || null,
          note: '演示连接器：状态变更仅作用于演示环境，未操作真实设备',
          downtimeEstimate: '3-5 分钟',
        },
      }
    },
  },

  'gateway.update_config': {
    serverId: 'mcp_gateway',
    connectorId: 'conn_gateway',
    desc: '修改设备配置参数（高风险，需审批）',
    sideEffect: 'write',
    risk: 'high',
    execute(args, ctx) {
      const d = store.get('demoDevices', args.deviceId)
      if (!d) return { ok: false, error: `设备 ${args.deviceId} 不存在于台账` }
      const before = d.config?.[args.configKey]
      if (args.configKey === 'firmware') {
        store.update('demoDevices', d.id, { firmware: args.value })
        for (const a of alerts().filter((x) => x.deviceId === d.id && x.status === 'active' && x.message.includes('固件'))) {
          store.update('demoAlerts', a.id, { status: 'resolved' })
        }
      } else {
        store.update('demoDevices', d.id, { config: { ...(d.config || {}), [args.configKey]: args.value } })
      }
      return {
        ok: true,
        demo: true,
        data: {
          updated: true,
          deviceId: d.id,
          configKey: args.configKey,
          before: args.configKey === 'firmware' ? d.firmware : before,
          after: args.value,
          approvalId: ctx?.approvalId || null,
          note: '演示连接器：配置变更仅作用于演示环境，未操作真实设备',
        },
      }
    },
  },

  'workorder.list_tickets': {
    serverId: 'mcp_workorder',
    connectorId: 'conn_workorder',
    desc: '查询工单列表，可按状态、设备过滤',
    sideEffect: 'read',
    risk: 'low',
    execute(args) {
      let list = store.list('demoWorkorders')
      if (args.status) list = list.filter((t) => t.status === args.status)
      if (args.deviceId) list = list.filter((t) => t.deviceId === args.deviceId)
      return { ok: true, demo: true, data: { total: list.length, tickets: list } }
    },
  },

  'workorder.create_ticket': {
    serverId: 'mcp_workorder',
    connectorId: 'conn_workorder',
    desc: '创建运维工单（写操作，幂等）',
    sideEffect: 'write',
    risk: 'medium',
    execute(args) {
      if (!args.title || !args.priority) return { ok: false, error: '缺少必填参数 title / priority' }
      // 幂等：clientRequestId 去重，防止重试造成重复工单
      if (args.clientRequestId) {
        const dup = store.find('demoWorkorders', (t) => t.clientRequestId === args.clientRequestId)
        if (dup) return { ok: true, demo: true, data: { created: false, deduped: true, ticket: dup } }
      }
      const no = 2080 + store.list('demoWorkorders').length
      const ticket = store.insert('demoWorkorders', {
        id: `WO-${no}`,
        title: args.title,
        deviceId: args.deviceId || null,
        status: 'open',
        priority: args.priority,
        assignee: '值班运维',
        description: args.description || '',
        clientRequestId: args.clientRequestId || null,
        demo: true,
      })
      return { ok: true, demo: true, data: { created: true, ticket } }
    },
  },

  'kb.search': {
    serverId: 'mcp_kb',
    connectorId: 'conn_kb',
    desc: '检索知识空间文档，返回相关片段与来源',
    sideEffect: 'read',
    risk: 'low',
    execute(args) {
      const results = kbSearch(args.query, args.topK || 5)
      return {
        ok: true,
        demo: true,
        data: {
          query: args.query,
          total: results.length,
          excerpts: results,
          note: results.length === 0 ? '未命中已索引资料，可能资料不存在、未索引或无权访问' : undefined,
        },
      }
    },
  },

  /* ---------------- SMART6000（NET-6000）AI 中控主机集控 ---------------- */

  'smart.list_hosts': {
    serverId: 'mcp_smart6000',
    connectorId: 'conn_smart6000',
    desc: '查询 SMART6000（NET-6000）中控主机集群的在线状态、固件与 AI 识别状态',
    sideEffect: 'read',
    risk: 'low',
    execute(args) {
      let list = store.list('demoSmartHosts')
      if (args.status) list = list.filter((h) => h.status === args.status)
      if (args.building) list = list.filter((h) => h.building === args.building)
      return {
        ok: true,
        demo: true,
        data: {
          total: list.length,
          online: store.list('demoSmartHosts').filter((h) => h.status === 'online').length,
          hosts: list.map((h) => ({
            id: h.id, name: h.name, model: h.model, alias: h.alias,
            room: h.room, building: h.building, status: h.status,
            firmware: h.firmware, ip: h.ip,
            aiEngine: h.aiEngine, aiStatus: h.aiStatus, recognitionRate: h.recognitionRate,
            scene: h.scene, issue: h.issue || null, updatedAt: h.updatedAt,
          })),
        },
      }
    },
  },

  'smart.get_host': {
    serverId: 'mcp_smart6000',
    connectorId: 'conn_smart6000',
    desc: '查询单台 NET-6000 主机的接口占用、受控设备状态、当前场景与运行指标',
    sideEffect: 'read',
    risk: 'low',
    execute(args) {
      const h = store.get('demoSmartHosts', args.hostId)
      if (!h) return { ok: false, error: `主机 ${args.hostId} 不存在于集控集群` }
      return {
        ok: true,
        demo: true,
        data: {
          id: h.id, name: h.name, model: h.model, alias: h.alias,
          room: h.room, building: h.building, status: h.status,
          firmware: h.firmware, ip: h.ip,
          interfaces: h.interfaces,
          aiEngine: h.aiEngine, aiStatus: h.aiStatus, recognitionRate: h.recognitionRate,
          scene: h.scene, lastSceneAt: h.lastSceneAt,
          devices: h.devices, metrics: h.metrics, issue: h.issue || null,
        },
      }
    },
  },

  'smart.scene_exec': {
    serverId: 'mcp_smart6000',
    connectorId: 'conn_smart6000',
    desc: '在指定教室主机执行一键上课/下课/午休/考试场景（高风险，需审批）',
    sideEffect: 'write',
    risk: 'high',
    async execute(args, ctx) {
      const h = store.get('demoSmartHosts', args.hostId)
      if (!h) return { ok: false, error: `主机 ${args.hostId} 不存在于集控集群` }
      if (h.status !== 'online') return { ok: false, error: `主机 ${h.name} 当前离线/降级，无法下发场景` }
      const { SMART_SCENES } = await import('./seed-smart.js')
      const scene = SMART_SCENES[args.scene]
      if (!scene) return { ok: false, error: `未知场景 ${args.scene}，可选：${Object.keys(SMART_SCENES).join(' / ')}` }
      // 联动设备状态落库（演示）
      const devicePatch = { on: 'on', off: 'off', open: 'open', close: 'closed', standby: 'standby', record: 'recording', stop: 'standby', track: 'on', exam: 'on', dim: 'dim' }
      const devices = (h.devices || []).map((d) => {
        const step = scene.steps.find((s) => s.device === d.id)
        return step ? { ...d, status: devicePatch[step.action] || d.status } : d
      })
      store.update('demoSmartHosts', h.id, {
        scene: scene.name, lastSceneAt: new Date().toISOString(), devices,
        metrics: { ...(h.metrics || {}), todaySceneExecs: (h.metrics?.todaySceneExecs || 0) + 1 },
      })
      return {
        ok: true,
        demo: true,
        data: {
          executed: true, hostId: h.id, host: h.name, scene: scene.name,
          steps: scene.steps,
          approvalId: ctx?.approvalId || null,
          note: '演示连接器：场景仅作用于演示环境，未下发真实教室设备',
        },
      }
    },
  },

  'smart.device_control': {
    serverId: 'mcp_smart6000',
    connectorId: 'conn_smart6000',
    desc: '控制主机下辖单台受控设备（投影/大屏/灯光/窗帘/空调/摄像机/录播）（高风险，需审批）',
    sideEffect: 'write',
    risk: 'high',
    execute(args, ctx) {
      const h = store.get('demoSmartHosts', args.hostId)
      if (!h) return { ok: false, error: `主机 ${args.hostId} 不存在于集控集群` }
      if (h.status !== 'online') return { ok: false, error: `主机 ${h.name} 当前离线/降级，无法下发控制` }
      const dev = (h.devices || []).find((d) => d.id === args.device || d.type === args.device || d.name === args.device)
      if (!dev) return { ok: false, error: `主机 ${h.name} 下不存在设备 ${args.device}` }
      const cmdMap = { on: 'on', off: 'off', open: 'open', close: 'closed', standby: 'standby' }
      const next = cmdMap[args.command]
      if (!next) return { ok: false, error: `不支持的控制指令 ${args.command}` }
      const before = dev.status
      const devices = h.devices.map((d) => (d.id === dev.id ? { ...d, status: next } : d))
      store.update('demoSmartHosts', h.id, { devices })
      return {
        ok: true,
        demo: true,
        data: {
          controlled: true, hostId: h.id, device: dev.name, control: dev.control,
          before, after: next,
          approvalId: ctx?.approvalId || null,
          note: '演示连接器：控制仅作用于演示环境，未操作真实设备',
        },
      }
    },
  },
}

/* ------------------------------------------------------------------ */
/* 自定义连接器：声明式 HTTP 工具引擎                                     */
/* 用户登记的连接器可自带 tools 定义（无需写代码），由通用 HTTP 执行器运行 */
/* ------------------------------------------------------------------ */

/** 模板替换：把 {{参数名}} 替换为 args 中的值 */
function renderTemplate(str, args) {
  if (typeof str !== 'string') return str
  return str.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key) => {
    const v = args?.[key]
    return v === undefined || v === null ? '' : String(v)
  })
}

/** 参数定义 → JSON Schema（供 LLM 决策阶段使用） */
export function schemaFromParams(params) {
  const list = Array.isArray(params) ? params : []
  return {
    type: 'object',
    properties: Object.fromEntries(list.map((p) => [p.name, { type: p.type === 'number' ? 'number' : 'string', description: p.desc || '' }])),
    required: list.filter((p) => p.required).map((p) => p.name),
  }
}

/** 通用 HTTP 执行器：执行声明式工具定义，返回统一契约 */
export async function executeHttpTool(tool, args = {}) {
  const method = (tool.method || 'GET').toUpperCase()
  const url = renderTemplate(tool.url, args)
  if (!/^https?:\/\//.test(url)) return { ok: false, error: `工具「${tool.name}」的 URL 无效：${tool.url || '(未配置)'}` }
  const headers = {}
  for (const [k, v] of Object.entries(tool.headers || {})) headers[k] = renderTemplate(String(v), args)
  const init = { method, headers, signal: AbortSignal.timeout(15000) }
  if (!['GET', 'HEAD'].includes(method)) {
    if (tool.bodyTemplate) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json'
      init.body = renderTemplate(tool.bodyTemplate, args)
    } else if (Object.keys(args).length) {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(args)
    }
  }
  let resp
  try {
    resp = await fetch(url, init)
  } catch (err) {
    return { ok: false, error: `HTTP 请求失败：${err.message}` }
  }
  const text = await resp.text()
  let body = text
  try { body = JSON.parse(text) } catch { /* 纯文本响应 */ }
  if (!resp.ok) return { ok: false, error: `HTTP ${resp.status}：${text.slice(0, 200)}` }
  return { ok: true, demo: false, data: { status: resp.status, body } }
}

/** 按工具名查找自定义连接器工具 */
export function findCustomConnectorTool(name) {
  for (const conn of store.list('connectors')) {
    for (const t of conn.tools || []) {
      if (t.name === name) return { connector: conn, tool: t }
    }
  }
  return null
}

/** 已占用的工具名集合（预置 MCP_TOOLS + 所有连接器声明的工具） */
export function allToolNames(excludeConnectorId = null) {
  const names = new Set(Object.keys(MCP_TOOLS))
  for (const conn of store.list('connectors')) {
    if (excludeConnectorId && conn.id === excludeConnectorId) continue
    for (const t of conn.tools || []) names.add(t.name)
  }
  return names
}

/** 取出某连接器集合下可用的 MCP 工具（仅 connected 连接器） */
export function getAvailableMcpTools(connectorIds) {
  const usable = []
  for (const [name, tool] of Object.entries(MCP_TOOLS)) {
    const conn = store.get('connectors', tool.connectorId)
    if (!conn || conn.status !== 'connected') continue
    if (connectorIds && connectorIds.length && !connectorIds.includes(tool.connectorId)) continue
    const server = store.get('mcpServers', tool.serverId)
    usable.push({
      name,
      desc: tool.desc,
      sideEffect: tool.sideEffect,
      risk: tool.risk,
      connector: conn.name,
      server: server ? `${server.name}@${server.version}` : tool.serverId,
      schema: server?.tools?.find((t) => t.name === name)?.schema || { type: 'object' },
    })
  }
  // 自定义连接器声明的 HTTP 工具
  for (const conn of store.list('connectors')) {
    if (!conn.tools?.length) continue
    if (conn.status !== 'connected') continue
    if (connectorIds && connectorIds.length && !connectorIds.includes(conn.id)) continue
    for (const t of conn.tools) {
      usable.push({
        name: t.name,
        desc: t.desc,
        sideEffect: t.sideEffect || 'read',
        risk: t.risk || 'low',
        connector: conn.name,
        server: '自定义 HTTP 工具',
        schema: schemaFromParams(t.params),
      })
    }
  }
  return usable
}

export async function executeMcpTool(name, args, ctx) {
  const tool = MCP_TOOLS[name]
  if (tool) {
    const conn = store.get('connectors', tool.connectorId)
    if (!conn || conn.status !== 'connected') {
      return { ok: false, error: `连接器「${conn?.name || tool.connectorId}」未授权或不可用（状态：${conn?.status || 'unknown'}），请先完成授权` }
    }
    try {
      return await tool.execute(args || {}, ctx)
    } catch (err) {
      return { ok: false, error: `工具执行异常：${err.message}` }
    }
  }
  // 自定义连接器的声明式 HTTP 工具
  const found = findCustomConnectorTool(name)
  if (!found) return { ok: false, error: `未登记的 MCP 工具：${name}` }
  if (found.connector.status !== 'connected') {
    return { ok: false, error: `连接器「${found.connector.name}」未授权接入（状态：${found.connector.status}），请先在连接器中心完成授权` }
  }
  return executeHttpTool(found.tool, args || {})
}
