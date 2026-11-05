import { store } from './store.js'
import { kbSearch, executeMcpTool, executeHttpTool, schemaFromParams } from './mcp.js'

/**
 * Skill 能力体系。
 * Skill 是平台可组合、可测试、可复用的任务能力单元：
 * - 声明适用场景、输入/输出、执行步骤、依赖连接器/MCP 工具、权限与风险
 * - 不拥有独立权限，实际调用受当前用户、项目和连接器授权约束
 * - 此处 executor 提供确定性数据汇聚（证据包/计划草案），
 *   推理与成文由大模型完成（Skill 嵌入大模型调用链）
 */

/** Skill 工具名 → skillId */
export const SKILL_TOOL_MAP = {
  'skill.device_health_summary': 'sk_health',
  'skill.fault_analysis': 'sk_fault',
  'skill.classroom_inspection': 'sk_inspection',
  'skill.file_upgrade_plan': 'sk_upgrade',
  'skill.weekly_report': 'sk_weekly',
  'skill.knowledge_answer': 'sk_knowledge',
  'skill.config_diff_check': 'sk_config_diff',
  'skill.alert_root_cause': 'sk_alert_rca',
  'skill.log_diagnose': 'sk_log_diagnose',
  'skill.data_quality_check': 'sk_dq_check',
  'skill.device_patrol': 'sk_device_patrol',
  'skill.matrix_batch_plan': 'sk_matrix_batch',
  'skill.ecis_kvm_dispatch': 'sk_ecis_kvm',
  'skill.fsp_dispatch': 'sk_fsp_dispatch',
  'skill.signal_preset_plan': 'sk_signal_preset',
  'skill.scene_exec_plan': 'sk_scene_exec',
  'skill.meeting_assist': 'sk_meeting_assist',
  'skill.class_inspect': 'sk_class_inspect',
  'skill.smart_scene_plan': 'sk_smart_scene',
}

/** 告警关联分组（确定性部分）：同源去重 + 时间窗拓扑归组 */
function correlateAlerts(args = {}) {
  const all = store.list('opsAlerts')
  const windowMin = parseInt(String(args.timeWindow || '30').replace(/[^0-9]/g, ''), 10) || 30
  const since = Date.now() - windowMin * 60 * 1000
  let list = all.filter((a) => new Date(a.firedAt).getTime() >= since)
  if (args.source) list = list.filter((a) => a.source.includes(args.source) || a.target.includes(args.source))
  // 同源重复告警先抑制
  const suppressed = list.filter((a) => a.dedupKey)
  const primary = list.filter((a) => !a.dedupKey && a.status !== 'recovered')
  const recovered = list.filter((a) => a.status === 'recovered' && !a.dedupKey)
  // 按已有事件的 alertIds 归组
  const incidents = store.list('incidents')
  const groups = incidents
    .map((inc) => ({
      incidentId: inc.id,
      title: inc.title,
      severity: inc.severity,
      rootCause: inc.rootCause,
      confidence: inc.confidence,
      suggested: inc.suggested,
      sopDocId: inc.sopDocId,
      impact: inc.impact,
      alerts: primary.filter((a) => inc.alertIds.includes(a.id)),
      suppressed: suppressed.filter((a) => inc.suppressedIds?.includes(a.id)),
    }))
    .filter((g) => g.alerts.length > 0)
  return { windowMin, groups, noiseRecovered: recovered, suppressedCount: suppressed.length }
}

const EXECUTORS = {
  /** 设备健康摘要：统计 + 问题清单 + 活跃告警 */
  sk_health(args) {
    let list = store.list('demoDevices')
    if (args.building) list = list.filter((d) => d.building === args.building)
    if (args.type) list = list.filter((d) => d.type === args.type)
    const byStatus = { online: 0, offline: 0, degraded: 0 }
    for (const d of list) byStatus[d.status] = (byStatus[d.status] || 0) + 1
    const activeAlerts = store.list('demoAlerts', (a) => a.status === 'active')
    const problems = list
      .filter((d) => d.status !== 'online')
      .map((d) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        room: d.room,
        status: d.status,
        firmware: d.firmware,
        lastHeartbeat: d.lastHeartbeat,
        offlineCount7d: d.metrics?.offlineCount7d ?? 0,
        alerts: activeAlerts
          .filter((a) => a.deviceId === d.id)
          .map((a) => ({ severity: a.severity, message: a.message, firstSeen: a.firstSeen, lastSeen: a.lastSeen })),
      }))
    return {
      ok: true,
      demo: true,
      data: {
        scope: { building: args.building || '全部', type: args.type || '全部' },
        total: list.length,
        byStatus,
        onlineRate: list.length ? `${Math.round((byStatus.online / list.length) * 100)}%` : 'N/A',
        problemCount: problems.length,
        problems,
        activeAlertCount: activeAlerts.length,
        dataTime: new Date().toISOString(),
      },
      sources: ['教室设备网关（演示连接器）'],
    }
  },

  /** 故障归因分析：围绕单设备汇聚证据包 */
  sk_fault(args) {
    if (!args.deviceId) return { ok: false, error: '缺少参数 deviceId（设备编号）' }
    const statusRes = executeMcpTool('gateway.get_device_status', { deviceId: args.deviceId })
    if (!statusRes.ok) return statusRes
    const days = Number(args.days || 7)
    const alertsRes = executeMcpTool('gateway.list_alerts', { deviceId: args.deviceId, days })
    const ticketsRes = executeMcpTool('workorder.list_tickets', { deviceId: args.deviceId })
    const device = statusRes.data
    const kbHits = kbSearch(`${device.type} 离线 故障 处置`, 3)
    return {
      ok: true,
      demo: true,
      data: {
        device: statusRes.data,
        alertsInRange: alertsRes.data,
        relatedTickets: ticketsRes.data,
        knowledgeRefs: kbHits,
        missing: [
          '设备端 /var/log/agent.log 日志（平台未接入）',
          'PoE 供电电压现场测量值',
        ],
        note: '证据包已汇聚；请将「观测事实 / 可能原因 / 建议措施」分开表述，证据不足项标注待核实',
      },
      sources: ['教室设备网关（演示连接器）', '运维工单系统（演示连接器）', '企业知识库（演示连接器）'],
    }
  },

  /** 教室巡查：全量只读检查 + 异常清单 */
  sk_inspection(args) {
    const list = store.list('demoDevices')
    const activeAlerts = store.list('demoAlerts', (a) => a.status === 'active')
    const items = list.map((d) => {
      const deviceAlerts = activeAlerts.filter((a) => a.deviceId === d.id)
      const abnormal = d.status !== 'online' || deviceAlerts.some((a) => a.severity === 'critical')
      return {
        id: d.id,
        name: d.name,
        type: d.type,
        room: d.room,
        status: d.status,
        heartbeatFresh: d.status !== 'offline',
        lastHeartbeat: d.lastHeartbeat,
        issue: abnormal
          ? deviceAlerts.find((a) => a.severity === 'critical')?.message || deviceAlerts[0]?.message || '状态异常'
          : null,
      }
    })
    const anomalies = items.filter((i) => i.issue)
    return {
      ok: true,
      demo: true,
      data: {
        date: args.date || new Date().toISOString().slice(0, 10),
        total: items.length,
        checked: items.length,
        unchecked: [],
        onlineRate: `${Math.round((items.filter((i) => i.status === 'online').length / items.length) * 100)}%`,
        anomalyCount: anomalies.length,
        anomalies,
        items,
        policy: '默认只读检查；修复操作仅生成建议或待审批任务',
      },
      sources: ['教室设备网关（演示连接器）'],
    }
  },

  /** 文件升级计划：只生成计划，绝不实际执行 */
  sk_upgrade(args) {
    if (!args.file && !args.deviceId) return { ok: false, error: '信息不完整：需要目标文件路径/标识（file）或目标设备（deviceId）' }
    if (!args.targetVersion) return { ok: false, error: '信息不完整：需要目标版本（targetVersion）' }
    let currentVersion = '未知（待现场确认）'
    let deviceInfo = null
    if (args.deviceId) {
      const d = store.get('demoDevices', args.deviceId)
      if (!d) return { ok: false, error: `设备 ${args.deviceId} 不存在于台账` }
      currentVersion = d.firmware
      deviceInfo = { id: d.id, name: d.name, room: d.room, status: d.status, firmware: d.firmware }
    }
    return {
      ok: true,
      demo: true,
      data: {
        executed: false,
        mustNote: '未接入真实升级执行器，本结果仅为升级计划，未对任何系统执行实际升级',
        upgradePlan: {
          file: args.file || `固件（设备 ${args.deviceId}）`,
          device: deviceInfo,
          currentVersion,
          targetVersion: args.targetVersion,
          prechecks: ['确认设备处于维护窗口', '核对固件来源与 SHA-256 校验值', '确认路径在白名单 /opt/classroom/agent/ 内'],
          backup: '升级前自动备份当前固件镜像与配置至平台备份库，保留 30 天',
          stages: ['获取文件并校验', '备份当前版本', '下发升级', '健康检查/版本确认', '完成或回滚'],
          rollback: '验证失败或超时自动回滚至当前版本，并转人工处理',
          risks: ['升级期间设备离线 3-5 分钟', '版本不兼容导致升级失败'],
          approval: '高风险操作，须经授权人员审批后执行',
        },
      },
      sources: ['文件升级助手 v0.8.0', '教室设备网关（演示连接器）'],
    }
  },

  /** 周报素材包 */
  sk_weekly(args) {
    const projectId = args.projectId || null
    const since = Date.now() - 7 * 86400000
    const tasks = store
      .list('tasks', (t) => (!projectId || t.projectId === projectId) && new Date(t.createdAt).getTime() >= since)
      .map((t) => ({ no: t.no, title: t.title, status: t.status, mode: t.mode, createdAt: t.createdAt }))
    const runs = store
      .list('automationRuns', (r) => (!projectId || r.projectId === projectId) && new Date(r.startedAt).getTime() >= since)
      .map((r) => ({ id: r.id, name: r.automationName, status: r.status, summary: r.summary, startedAt: r.startedAt }))
    const todos = store.list('todos', (t) => (!projectId || t.projectId === projectId))
    const project = projectId ? store.get('projects', projectId) : null
    return {
      ok: true,
      demo: false,
      data: {
        project: project ? { id: project.id, name: project.name } : null,
        period: '近 7 天',
        tasks,
        automationRuns: runs,
        todos: todos.map((t) => ({ title: t.title, status: t.status, priority: t.priority })),
        alertsSummary: store.list('demoAlerts', (a) => a.status === 'active').map((a) => ({ deviceId: a.deviceId, severity: a.severity, message: a.message })),
      },
      sources: ['平台任务/运行记录', '教室设备网关（演示连接器）'],
    }
  },

  /** 知识库问答素材 */
  sk_knowledge(args) {
    if (!args.query) return { ok: false, error: '缺少参数 query' }
    const hits = kbSearch(args.query, 5)
    return {
      ok: true,
      demo: true,
      data: {
        query: args.query,
        total: hits.length,
        excerpts: hits,
        note: hits.length === 0 ? '未命中：资料可能不存在、未索引、已过期或当前用户无权访问，请如实说明' : '引用时必须注明文档名与版本',
      },
      sources: ['企业知识库（演示连接器）'],
    }
  },

  /** 配置差异检查 */
  sk_config_diff(args) {
    if (!args.deviceId) return { ok: false, error: '缺少参数 deviceId' }
    const d = store.get('demoDevices', args.deviceId)
    if (!d) return { ok: false, error: `设备 ${args.deviceId} 不存在于台账` }
    const baseline = { heartbeatInterval: '30s', powerPolicy: 'auto', reportTopic: `campus/${d.building}/${d.id}` }
    const current = d.config || {}
    const diff = Object.keys(baseline)
      .filter((k) => String(current[k] ?? '') !== String(baseline[k]))
      .map((k) => ({ key: k, baseline: baseline[k], current: current[k] ?? '(缺失)' }))
    return {
      ok: true,
      demo: true,
      data: { deviceId: d.id, name: d.name, diffCount: diff.length, diff, note: diff.length ? '发现配置偏离基线，请结合变更记录评估影响' : '配置与基线一致' },
      sources: ['教室设备网关（演示连接器）'],
    }
  },

  /** 告警降噪与根因分析：关联证据包 */
  sk_alert_rca(args) {
    const ctx = correlateAlerts(args)
    return {
      ok: true,
      demo: true,
      data: {
        scope: { timeWindow: `${ctx.windowMin}m`, source: args.source || '全部来源' },
        groupCount: ctx.groups.length,
        suppressedCount: ctx.suppressedCount,
        noiseCount: ctx.noiseRecovered.length,
        groups: ctx.groups.map((g) => ({
          title: g.title, severity: g.severity, rootCause: g.rootCause,
          confidence: g.confidence, impact: g.impact, suggested: g.suggested,
          alertCount: g.alerts.length,
          alerts: g.alerts.map((a) => ({ id: a.id, source: a.source, target: a.target, metric: a.metric, title: a.title, value: `${a.value}${a.unit || ''}` })),
          sopDocId: g.sopDocId,
        })),
        noiseRecovered: ctx.noiseRecovered.map((a) => ({ id: a.id, title: a.title, reason: '短时抖动后自行恢复，按降噪规范不打扰' })),
        note: '证据来自演示综合运维集控平台；根因为 AI 假设，需人工确认后方可沉淀为案例',
      },
      sources: ['综合运维集控平台（演示连接器）', '企业知识库（演示连接器）'],
    }
  },

  /** 显控设备日志错误模式诊断（演示模式库） */
  sk_log_diagnose(args) {
    const device = args.device || args.service
    if (!device) return { ok: false, error: '缺少参数 device（设备/平台，如 PGM3-3F 中控）' }
    const minutes = Number(args.minutes || 30)
    const patternLib = {
      'PGM3-3F': [
        { pattern: 'SceneTimeout: matrix HDMI ch2 switch no ack', count: 6, firstSeen: minutesAgo(12), sample: 'scene=开会模式 step=matrix.ch2 wait_ack timeout 30000ms' },
        { pattern: 'IRLearnMismatch: codebook not matched for projector', count: 2, firstSeen: minutesAgo(30), sample: 'ir device=投影 codebook=default mismatch' },
      ],
      'ECIS-OUT-LED-01': [
        { pattern: 'VideoLoss: jitter buffer overflow, packet loss 38%', count: 412, firstSeen: minutesAgo(26), sample: 'loss=38% jitter=overflow src=IN-PC-02' },
        { pattern: 'LinkFlap: uplink eth1 flap detected', count: 9, firstSeen: minutesAgo(28), sample: 'uplink POE-SW-A2 util 96%' },
      ],
      default: [
        { pattern: 'DeviceHeartbeatLost: heartbeat missed', count: 3, firstSeen: minutesAgo(20), sample: `device=${device} heartbeat missed x2 then recovered` },
      ],
    }
    const patterns = patternLib[device] || patternLib.default
    return {
      ok: true,
      demo: true,
      data: {
        device, window: `${minutes}m`,
        topPatterns: patterns,
        relatedChange: device === 'PGM3-3F' ? '昨日 ThinkControl 场景脚本 v1.4 更新（新增矩阵回执等待）' : '近 1 小时无变更',
        note: '日志来自演示综合运维集控平台，计数为模拟数据',
      },
      sources: ['综合运维集控平台（演示连接器）'],
    }
  },

  /** 数据质量质检：执行启用规则 */
  sk_dq_check(args) {
    let rules = store.list('dqRules', (r) => r.enabled)
    if (args.dataset) rules = rules.filter((r) => r.dataset === args.dataset)
    if (Array.isArray(args.ruleTypes) && args.ruleTypes.length) {
      rules = rules.filter((r) => args.ruleTypes.includes(r.type))
    }
    const results = rules.map((r) => ({
      ruleId: r.id, name: r.name, dataset: r.dataset, type: r.type,
      severity: r.severity, status: r.lastStatus, issueCount: r.lastCount,
      previousCount: r.previousCount, trend: r.trend, detail: r.detail, sample: r.sample,
    }))
    const failed = results.filter((r) => r.status === 'failed').length
    const warning = results.filter((r) => r.status === 'warning').length
    return {
      ok: true,
      demo: true,
      data: {
        totalRules: results.length, failed, warning,
        totalIssues: results.reduce((n, r) => n + r.issueCount, 0),
        results,
        runAt: new Date().toISOString(),
      },
      sources: ['综合运维集控平台（演示连接器）'],
    }
  },

  /** 整网显控设备巡检（演示清单） */
  sk_device_patrol(args) {
    const scope = args.scope || '全部'
    const devices = [
      { id: 'ECIS-IN-PC-02', name: '指挥中心-编码节点', type: 'ECIS 编码节点', room: '指挥中心', status: 'online', backup: '主备正常', firmware: 'v3.5', temp: 46, risk: 'low' },
      { id: 'ECIS-OUT-LED-01', name: '指挥中心-大屏输出节点', type: 'ECIS 解码节点', room: '指挥中心', status: 'degraded', backup: '主备正常', firmware: 'v3.5', temp: 61, risk: 'high', issue: '视频流丢包 38%，上行链路拥塞' },
      { id: 'ESP-MAX-01', name: '指挥中心-拼接处理器', type: '拼接处理器', room: '指挥中心', status: 'online', backup: '热备份正常', firmware: 'v4.1', temp: 52, risk: 'low' },
      { id: 'PGM3-3F', name: '3F-中控主机', type: '中控主机', room: '3号会议室', status: 'degraded', backup: '无', firmware: 'v2.8', temp: 49, risk: 'medium', issue: '场景脚本执行超时，矩阵回执缺失' },
      { id: 'MATRIX-3F', name: '3F-混合矩阵', type: '混合矩阵', room: '3号会议室', status: 'online', backup: '无', firmware: 'v3.2', temp: 44, risk: 'medium', issue: 'HDMI 通道 2 切换无回执' },
      { id: 'REC-02', name: '教学楼-录播主机', type: '录播主机', room: '教学楼 201', status: 'online', backup: '无', firmware: 'v1.9', temp: 41, risk: 'low' },
      { id: 'TP-5F', name: '5F-触摸屏', type: '触摸屏', room: '5号报告厅', status: 'online', backup: '无', firmware: 'v2.2', temp: 38, risk: 'low' },
    ]
    const risks = devices.filter((d) => d.risk !== 'low')
    return {
      ok: true,
      demo: true,
      data: {
        scope, total: devices.length,
        onlineRate: `${Math.round((devices.filter((d) => d.status === 'online').length / devices.length) * 100)}%`,
        riskCount: risks.length, risks, devices,
        suggestion: risks.length ? '优先处理 ECIS-OUT-LED-01（丢包 38%，链路拥塞）；核查 PGM3-3F 与 MATRIX-3F 的回执链路' : '整网设备稳定',
        policy: '默认只读巡检；修复/重启等写操作需审批后执行',
      },
      sources: ['综合运维集控平台（演示连接器）'],
    }
  },

  /** 坐席 KVM 调度与推屏（只出计划） */
  sk_ecis_kvm(args) {
    if (!args.seat || !args.action) return { ok: false, error: '缺少参数 seat（坐席）或 action（动作）' }
    return {
      ok: true,
      demo: true,
      data: {
        executed: false,
        mustNote: '未接入真实 ECIS 执行器，本结果仅为调度计划，未对任何设备执行实际操作',
        dispatchPlan: {
          seat: args.seat, action: args.action,
          prechecks: ['校验坐席对目标主机/大屏的调度权限', '确认编码/解码节点在线、码流正常', '确认 USB 透传链路无中断'],
          steps: ['锁定源信号与目标', '建立 KVM 接管/推屏通道', '切换并校验回显', '释放或保持会话'],
          verify: '大屏回显画面与坐席预览一致，键鼠接管响应 < 200ms',
          risks: ['权限不足导致调度被拒绝', '跨楼宇链路丢包导致画面卡顿'],
          approval: '高风险写操作，须经授权人员审批后执行',
        },
      },
      sources: ['ECIS 分布式管理平台（演示连接器）'],
    }
  },

  /** 光纤坐席涉密调度（只出计划） */
  sk_fsp_dispatch(args) {
    if (!args.preset) return { ok: false, error: '缺少参数 preset（预案名）' }
    return {
      ok: true,
      demo: true,
      data: {
        executed: false,
        mustNote: '未接入真实 FSP 执行器，本结果仅为切换计划；涉密写操作必须人工审批',
        switchPlan: {
          preset: args.preset,
          isolation: 'FPGA 纯光纤硬件交换，物理隔离，不走 IP 网',
          prechecks: ['校验涉密调度权限与双人复核', '确认光纤链路收光正常', '确认目标预案链路可用'],
          steps: ['锁定涉密信号源', '硬件级切换光纤通路', '校验大屏预案回显'],
          compliance: '全程留痕可审计；涉密链路严禁跨网调度',
          approval: '涉密高风险操作，强制人工审批（建议双人复核）',
        },
      },
      sources: ['FSP 光纤坐席管控平台（演示连接器）'],
    }
  },

  /** 大屏开窗漫游预案（只出计划） */
  sk_signal_preset(args) {
    if (!args.wall || !args.preset) return { ok: false, error: '缺少参数 wall（大屏）或 preset（预案/布局）' }
    return {
      ok: true,
      demo: true,
      data: {
        executed: false,
        mustNote: '未接入真实拼接处理器，本结果仅为开窗/预案计划，未执行',
        wallPlan: {
          wall: args.wall, preset: args.preset,
          prechecks: ['读取大屏与输入源在线状态', '确认热备份链路可用'],
          layout: '按目标布局开窗/漫游/叠加，配置底图与字幕',
          steps: ['解析目标布局', '规划信号路由', '逐窗口开窗并校验', '应用预案并回显确认'],
          risks: ['输入源无信号导致窗口黑屏', '预案误切换影响在显内容'],
          approval: '高风险写操作，须经授权人员审批后执行',
        },
      },
      sources: ['矩阵拼接处理器网关（演示连接器）'],
    }
  },

  /** 中控一键场景联动（只出计划） */
  sk_scene_exec(args) {
    if (!args.room || !args.scene) return { ok: false, error: '缺少参数 room（房间）或 scene（场景）' }
    return {
      ok: true,
      demo: true,
      data: {
        executed: false,
        mustNote: '未接入真实中控主机，本结果仅为场景联动计划，未执行',
        scenePlan: {
          room: args.room, scene: args.scene,
          devices: ['大屏/拼接', '矩阵', '灯光', '窗帘', '功放/音频', '摄像机', '空调/电源'],
          sequence: ['时序上电（先电源后设备）', '矩阵/大屏切换', '灯光窗帘就位', '音频开麦', '状态反馈校验'],
          safety: '涉电设备必须按序上电；未确认回执不得连续重发指令',
          risks: ['矩阵无回执导致联动中断', '时序错误冲击设备'],
          approval: '高风险写操作，须经授权人员审批后执行',
        },
      },
      sources: ['中控主机（图蒙/PGM，演示连接器）'],
    }
  },

  /** 会务全流程助手（演示数据） */
  sk_meeting_assist(args) {
    const meeting = args.meeting || '月度常务会'
    return {
      ok: true,
      demo: true,
      data: {
        meeting,
        signin: { expected: 15, actual: 14, rate: '93%', absent: ['王工（请假）'] },
        vote: { topic: '二季度采购计划', agree: 12, against: 1, abstain: 1, result: '通过' },
        minutes: {
          summary: '会议围绕二季度采购计划与指挥中心改造两项议程，表决通过采购计划。',
          decisions: ['通过二季度采购计划（12 票同意）', '指挥中心改造方案待补充预算后复议'],
          actionItems: ['林晚晴：本周五前补充改造预算', '陈志远：跟进 ECIS 节点扩容评估'],
        },
        note: 'AI 转写与纪要为演示数据；真实环境由 Almeet 平台提供转写文本',
      },
      sources: ['Almeet 智会云枢会务平台（演示连接器）'],
    }
  },

  /** 智慧教室巡课录播巡检（演示清单） */
  sk_class_inspect(args) {
    const building = args.building || '全部教学楼'
    const rooms = [
      { room: '201', record: '录制中', audio: '正常', control: '在线', aiFocus: '专注度 86%', issue: null },
      { room: '202', record: '未录制', audio: '正常', control: '在线', aiFocus: '-', issue: '录播未随课表启动' },
      { room: '203', record: '录制中', audio: '无声', control: '在线', aiFocus: '专注度 79%', issue: '吊麦阵列无声，扩声通道无电平' },
      { room: '305', record: '录制中', audio: '正常', control: '离线', aiFocus: '专注度 82%', issue: '中控主机离线，无法远程管控' },
    ]
    const anomalies = rooms.filter((r) => r.issue)
    return {
      ok: true,
      demo: true,
      data: {
        building, total: rooms.length,
        recordingCount: rooms.filter((r) => r.record === '录制中').length,
        anomalyCount: anomalies.length, anomalies, rooms,
        suggestion: '优先处理 203（扩声无声）与 305（中控离线）；202 核对课程表联动',
      },
      sources: ['灵析 AI 教学督导平台（演示连接器）', '录播流媒体网关（演示连接器）'],
    }
  },

  /** 矩阵批量执行规划（只出计划，不执行） */
  sk_matrix_batch(args) {
    if (!args.group || !args.action) return { ok: false, error: '缺少参数 group（设备分组）或 action（批量动作）' }
    const groupDevices = [
      { id: 'MT-301', name: '3号厅-主显', online: true },
      { id: 'MT-302', name: '3号厅-音响', online: true },
      { id: 'MT-303', name: '3号厅-灯光台', online: true },
      { id: 'MT-304', name: '3号厅-备用屏', online: false },
    ]
    const online = groupDevices.filter((d) => d.online)
    return {
      ok: true,
      demo: true,
      data: {
        group: args.group, action: args.action,
        batches: [
          { seq: 1, target: online.slice(0, 1), check: '回执成功且业务画面正常，观察 60s', abortOnFailure: true },
          { seq: 2, target: online.slice(1, 3), check: '逐台校验执行回执，任一台失败熔断', abortOnFailure: true },
        ],
        excludedOffline: groupDevices.filter((d) => !d.online),
        rollback: '一键切回主链路；每批失败自动停止后续批次',
        note: '仅生成灰度计划，写操作必须经人工审批后执行',
      },
      sources: ['矩阵拼接处理器网关（演示连接器）'],
    }
  },

  /** SMART6000 教室场景联动：核对主机与设备，生成场景执行计划（执行走审批） */
  async sk_smart_scene(args) {
    const { SMART_SCENES } = await import('./seed-smart.js')
    const sceneKey = args.scene || 'class_start'
    const scene = SMART_SCENES[sceneKey]
    if (!scene) {
      return { ok: false, error: `未知场景 ${sceneKey}，可选：${Object.entries(SMART_SCENES).map(([k, s]) => `${k}（${s.name}）`).join(' / ')}` }
    }
    let hosts = store.list('demoSmartHosts')
    if (args.hostId) hosts = hosts.filter((h) => h.id === args.hostId)
    if (args.building) hosts = hosts.filter((h) => h.building === args.building)
    if (hosts.length === 0) return { ok: false, error: '未找到匹配的 SMART6000 主机' }
    const targets = hosts.map((h) => {
      const faults = (h.devices || []).filter((d) => d.status === 'fault')
      const offline = h.status !== 'online'
      return {
        hostId: h.id, host: h.name, room: h.room, status: h.status,
        currentScene: h.scene, aiStatus: h.aiStatus,
        deviceCount: (h.devices || []).length,
        faultDevices: faults.map((d) => `${d.name}（${d.control}）`),
        blockers: [
          ...(offline ? ['主机离线/降级，无法下发场景'] : []),
          ...(faults.length > 0 ? [`存在故障设备：${faults.map((d) => d.name).join('、')}，建议先派单修复`] : []),
        ],
      }
    })
    const executable = targets.filter((t) => t.blockers.length === 0)
    return {
      ok: true,
      demo: true,
      data: {
        executed: false,
        mustNote: '本结果仅为场景执行计划，尚未下发；确认后须经审批闸门执行 smart.scene_exec',
        scene: { key: sceneKey, name: scene.name, risk: scene.risk },
        steps: scene.steps,
        targetCount: targets.length,
        executableCount: executable.length,
        targets,
        policy: '高风险写操作：执行前必须由审批人确认；离线/故障主机自动排除',
      },
      sources: ['SMART6000 集控平台（演示连接器）'],
    }
  },
}

function minutesAgo(min) {
  return new Date(Date.now() - min * 60 * 1000).toISOString()
}
/* ------------------------------------------------------------------ */
/* 自定义技能：通用执行器（无需写代码即可让自建技能真正可调用）               */
/* ------------------------------------------------------------------ */

export const EXECUTOR_KINDS = {
  plan_only: { key: 'plan_only', name: '计划生成', desc: '按声明步骤输出执行计划，高风险自动走审批' },
  kb_answer: { key: 'kb_answer', name: '知识问答', desc: '检索知识空间命中片段，由模型组织回答' },
  http_call: { key: 'http_call', name: 'HTTP 调用', desc: '调用一个外部 HTTP 接口并返回结果' },
}

export function executorLabel(skill) {
  return EXECUTOR_KINDS[skill?.executor?.kind]?.name || '计划生成'
}

/** 自定义技能的输入 Schema：按执行体类型生成确定性参数 */
function schemaForCustomSkill(s) {
  const kind = s.executor?.kind || 'plan_only'
  if (kind === 'kb_answer') {
    return { type: 'object', properties: { query: { type: 'string', description: '检索问题' } }, required: ['query'] }
  }
  if (kind === 'http_call') {
    return schemaFromParams(s.executor?.params)
  }
  return { type: 'object', properties: { objective: { type: 'string', description: '要达成的目标或背景说明' } }, required: ['objective'] }
}

/** 执行自定义技能 */
async function executeCustomSkill(skill, args) {
  const ex = skill.executor || { kind: 'plan_only' }
  if (ex.kind === 'kb_answer') {
    const query = args.query || skill.name
    let results = kbSearch(query, ex.topK || 5)
    if (ex.spaceId) results = results.filter((r) => r.doc?.spaceId === ex.spaceId || r.spaceId === ex.spaceId)
    return {
      ok: true,
      demo: false,
      data: {
        query,
        total: results.length,
        excerpts: results,
        note: results.length === 0 ? '未命中知识空间内容，可先在知识空间上传/录入相关资料' : undefined,
      },
    }
  }
  if (ex.kind === 'http_call') {
    if (!ex.url) return { ok: false, error: `技能「${skill.name}」未配置 HTTP 接口地址` }
    return executeHttpTool({ name: skill.toolName, method: ex.method, url: ex.url, headers: ex.headers, bodyTemplate: ex.body }, args)
  }
  // plan_only：确定性计划生成（写类意图由 risk=high 在编排层转审批）
  return {
    ok: true,
    demo: false,
    data: {
      mode: 'plan_only',
      objective: args.objective || args.query || '',
      skill: { id: skill.id, name: skill.name, version: skill.version || 'v1.0' },
      steps: (skill.steps || []).map((s, i) => ({ seq: i + 1, action: s, status: 'pending' })),
      note: '该技能为计划生成型：以上为执行计划，实际落地动作需经审批后由人工或预置连接器完成',
    },
  }
}

export function getAvailableSkillTools(skillIds) {
  const out = []
  for (const [toolName, skillId] of Object.entries(SKILL_TOOL_MAP)) {
    if (skillIds && skillIds.length && !skillIds.includes(skillId)) continue
    const s = store.get('skills', skillId)
    if (!s || s.status !== 'enabled') continue
    out.push({
      name: toolName,
      skillId: s.id,
      skillName: s.name,
      version: s.version,
      desc: `${s.desc}（适用：${s.scenario}）`,
      risk: s.risk,
      sideEffect: s.risk === 'high' ? 'write' : 'read',
      schema: {
        type: 'object',
        properties: Object.fromEntries((s.inputs || []).map((i) => [i.name, { type: i.type === 'number' ? 'number' : 'string', description: i.desc }])),
        required: (s.inputs || []).filter((i) => i.required).map((i) => i.name),
      },
    })
  }
  // 自定义技能（声明执行体后真正可调用）
  for (const s of store.list('skills')) {
    if (!s.custom || !s.toolName || s.status !== 'enabled') continue
    if (skillIds && skillIds.length && !skillIds.includes(s.id)) continue
    out.push({
      name: s.toolName,
      skillId: s.id,
      skillName: s.name,
      version: s.version || 'v1.0',
      desc: `${s.desc || s.name}（自定义技能·${executorLabel(s)}）`,
      risk: s.risk || 'low',
      sideEffect: s.risk === 'high' ? 'write' : 'read',
      schema: schemaForCustomSkill(s),
    })
  }
  return out
}

export async function executeSkillTool(toolName, args) {
  const builtinId = SKILL_TOOL_MAP[toolName]
  if (builtinId) {
    const s = store.get('skills', builtinId)
    if (!s || s.status !== 'enabled') return { ok: false, error: `技能「${s?.name || builtinId}」未启用或不存在` }
    try {
      return EXECUTORS[builtinId](args || {})
    } catch (err) {
      return { ok: false, error: `技能执行异常：${err.message}` }
    }
  }
  const s = store.find('skills', (x) => x.toolName === toolName)
  if (!s) return { ok: false, error: `未登记的技能工具：${toolName}` }
  if (s.status !== 'enabled') return { ok: false, error: `技能「${s.name}」未启用` }
  try {
    return await executeCustomSkill(s, args || {})
  } catch (err) {
    return { ok: false, error: `技能执行异常：${err.message}` }
  }
}

export function getSkillByToolName(toolName) {
  const skillId = SKILL_TOOL_MAP[toolName]
  if (skillId) return store.get('skills', skillId)
  return store.find('skills', (x) => x.toolName === toolName) || null
}
