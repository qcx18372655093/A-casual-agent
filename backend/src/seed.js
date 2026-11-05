import { store } from './store.js'

const now = () => new Date().toISOString()
const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString()
const daysAgo = (d) => new Date(Date.now() - d * 86400 * 1000).toISOString()
const minutesAgo = (m) => new Date(Date.now() - m * 60 * 1000).toISOString()

/**
 * 种子数据集。
 * 注意：设备/告警/工单均来自「演示连接器」的模拟业务系统数据，
 * 通过 dataSource: 'demo' 与 demo: true 全程标识，严禁冒充真实设备状态。
 */
export function seedAll() {
  /* ---------------- 项目 ---------------- */
  const pClassroom = store.insert('projects', {
    id: 'p_classroom',
    no: store.nextSeq('project'),
    name: '智慧教室运维项目',
    type: '运维运营',
    owner: '陈志远',
    status: 'active',
    goal: '保障 A/B 两栋教学楼 86 间智慧教室的设备稳定运行，故障平均响应时间控制在 30 分钟以内，巡检覆盖率达到 100%。',
    instructions:
      '1. 巡检与诊断默认只读，不得因“分析原因”顺带执行修复。\n2. 设备重启、参数修改、配置下发等操作必须生成执行计划并经授权人审批。\n3. 诊断结论需区分观测事实、可能原因与建议措施，证据不足时标注“待核实”。\n4. 引用数据时必须说明来源连接器与时间范围。',
    boundaries:
      '不得在上课时段（08:00-21:00 工作日）重启教室设备；不得修改课表系统数据；文件升级仅限 /opt/classroom/agent/ 白名单路径。',
    connectorIds: ['conn_gateway', 'conn_workorder', 'conn_kb'],
    skillIds: ['sk_health', 'sk_fault', 'sk_inspection', 'sk_upgrade'],
    members: [
      { name: '陈志远', role: '项目负责人' },
      { name: '李晓梅', role: '运维人员' },
      { name: '王工', role: '运维人员' },
      { name: '赵倩', role: '普通成员' },
    ],
    createdAt: daysAgo(42),
  })

  const pWeb = store.insert('projects', {
    id: 'p_web',
    no: store.nextSeq('project'),
    name: '官网 2.0 改版项目',
    type: '产品研发',
    owner: '林晓',
    status: 'active',
    goal: '完成公司官网信息架构改版与视觉升级，覆盖首页、产品页、案例页与文档中心，Q3 上线。',
    instructions: '1. 产出文档遵循公司品牌规范。\n2. 涉及发布素材生成的任务使用「想一想」模式先审后做。',
    boundaries: '不直接操作线上发布系统；生成的材料仅保存在任务工作空间。',
    connectorIds: ['conn_kb'],
    skillIds: ['sk_weekly', 'sk_knowledge'],
    members: [
      { name: '林晓', role: '项目负责人' },
      { name: '苏杭', role: '普通成员' },
      { name: '陈默', role: '普通成员' },
    ],
    createdAt: daysAgo(28),
  })

  store.insert('projects', {
    id: 'p_kb',
    no: store.nextSeq('project'),
    name: '客户服务知识库建设',
    type: '知识工程',
    owner: '周敏',
    status: 'active',
    goal: '沉淀客户服务 SOP 与常见问题库，接入知识问答能力，首次响应解决率提升至 60%。',
    instructions: '资料导入后需完成索引才可被检索问答引用；引用必须给出来源文档与章节。',
    boundaries: '客户隐私数据脱敏后才可入库；跨项目共享需显式授权。',
    connectorIds: ['conn_kb'],
    skillIds: ['sk_knowledge'],
    members: [
      { name: '周敏', role: '项目负责人' },
      { name: '钱进', role: '普通成员' },
    ],
    createdAt: daysAgo(15),
  })

  store.insert('projects', {
    id: 'p_procure',
    no: store.nextSeq('project'),
    name: '采购流程数字化',
    type: '业务流程',
    owner: '吴国强',
    status: 'paused',
    goal: '将采购申请、比价、审批、归档流程线上化，打通采购系统 API。',
    instructions: '采购系统连接器尚未授权，当前仅做流程梳理与方案设计。',
    boundaries: '未经授权不得读写采购系统。',
    connectorIds: [],
    skillIds: [],
    members: [{ name: '吴国强', role: '项目负责人' }],
    createdAt: daysAgo(60),
  })

  /* ---------------- 连接器 ---------------- */
  store.insert('connectors', {
    id: 'conn_gateway',
    name: '教室设备网关',
    category: '设备平台',
    protocol: 'MCP',
    status: 'connected',
    dataSource: 'demo',
    env: '测试环境',
    owner: '李晓梅',
    scopes: ['read', 'control-with-approval'],
    desc: '接入教室设备网关测试环境，提供设备台账、实时状态、告警查询与受控设备操作。',
    lastSyncAt: minutesAgo(6),
    calls30d: 1284,
    createdAt: daysAgo(40),
  })
  store.insert('connectors', {
    id: 'conn_workorder',
    name: '运维工单系统',
    category: '企业服务',
    protocol: 'MCP',
    status: 'connected',
    dataSource: 'demo',
    env: '测试环境',
    owner: '李晓梅',
    scopes: ['read', 'create'],
    desc: '查询与创建运维工单，写操作幂等，创建前按确认策略执行。',
    lastSyncAt: minutesAgo(31),
    calls30d: 236,
    createdAt: daysAgo(38),
  })
  store.insert('connectors', {
    id: 'conn_notify',
    name: '企业消息通知',
    category: '消息渠道',
    protocol: 'MCP',
    status: 'unauthorized',
    dataSource: 'demo',
    env: '生产环境',
    owner: '陈志远',
    scopes: ['send'],
    desc: '向获准的企业微信群组发送通知。授权后可由自动化与审批通过的任务调用。',
    lastSyncAt: null,
    calls30d: 0,
    createdAt: daysAgo(20),
  })
  store.insert('connectors', {
    id: 'conn_kb',
    name: '企业知识库服务',
    category: '知识库',
    protocol: 'MCP',
    status: 'connected',
    dataSource: 'demo',
    env: '测试环境',
    owner: '周敏',
    scopes: ['read'],
    desc: '检索企业知识空间文档，返回带来源的片段，用于问答与报告引用。',
    lastSyncAt: hoursAgo(2),
    calls30d: 512,
    createdAt: daysAgo(30),
  })
  store.insert('connectors', {
    id: 'conn_pms',
    name: '项目管理平台 API',
    category: '企业服务',
    protocol: 'REST',
    status: 'expired',
    dataSource: 'demo',
    env: '生产环境',
    owner: '林晓',
    scopes: ['read'],
    desc: '读取项目管理平台的迭代与事项数据。授权已过期，需重新授权后使用。',
    lastSyncAt: daysAgo(12),
    calls30d: 98,
    createdAt: daysAgo(50),
  })
  store.insert('connectors', {
    id: 'conn_erp',
    name: '采购系统',
    category: '企业服务',
    protocol: 'REST',
    status: 'unauthorized',
    dataSource: 'demo',
    env: '生产环境',
    owner: '吴国强',
    scopes: ['read', 'write'],
    desc: '采购申请与订单数据。按最小权限接入，写操作需审批策略放行。',
    lastSyncAt: null,
    calls30d: 0,
    createdAt: daysAgo(45),
  })

  /* ---------------- MCP Server 登记 ---------------- */
  store.insert('mcpServers', {
    id: 'mcp_gateway',
    name: 'edu-device-gateway',
    version: '1.4.2',
    connectorId: 'conn_gateway',
    dataClassification: '内部',
    risk: 'medium',
    networkTarget: 'gateway.test.internal:8443',
    status: 'audited',
    desc: '教室设备网关 MCP 适配服务，登记设备查询与受控操作工具。',
    tools: [
      {
        name: 'gateway.list_devices',
        desc: '查询设备台账清单，可按楼栋、类型、状态过滤',
        sideEffect: 'read',
        risk: 'low',
        schema: {
          type: 'object',
          properties: {
            building: { type: 'string', description: '楼栋，如 A楼 / B楼' },
            type: { type: 'string', description: '设备类型，如 网关/灯光控制器/中控主机/环境传感器/投影' },
            status: { type: 'string', description: 'online / offline / degraded' },
          },
        },
      },
      {
        name: 'gateway.get_device_status',
        desc: '查询单台设备实时状态与关键指标',
        sideEffect: 'read',
        risk: 'low',
        schema: {
          type: 'object',
          properties: { deviceId: { type: 'string', description: '设备编号，如 GW-A-03' } },
          required: ['deviceId'],
        },
      },
      {
        name: 'gateway.list_alerts',
        desc: '查询设备告警历史，可按设备、级别、时间范围过滤',
        sideEffect: 'read',
        risk: 'low',
        schema: {
          type: 'object',
          properties: {
            deviceId: { type: 'string' },
            severity: { type: 'string', description: 'critical / warning / info' },
            days: { type: 'number', description: '最近 N 天，默认 7' },
          },
        },
      },
      {
        name: 'gateway.reboot_device',
        desc: '重启指定设备（高风险：造成分钟级服务中断，需审批）',
        sideEffect: 'write',
        risk: 'high',
        schema: {
          type: 'object',
          properties: {
            deviceId: { type: 'string' },
            reason: { type: 'string', description: '重启原因，用于审计' },
          },
          required: ['deviceId', 'reason'],
        },
      },
      {
        name: 'gateway.update_config',
        desc: '修改设备配置参数（高风险：影响设备行为，需审批）',
        sideEffect: 'write',
        risk: 'high',
        schema: {
          type: 'object',
          properties: {
            deviceId: { type: 'string' },
            configKey: { type: 'string' },
            value: { type: 'string' },
          },
          required: ['deviceId', 'configKey', 'value'],
        },
      },
    ],
    createdAt: daysAgo(40),
  })
  store.insert('mcpServers', {
    id: 'mcp_workorder',
    name: 'ops-workorder',
    version: '0.9.1',
    connectorId: 'conn_workorder',
    dataClassification: '内部',
    risk: 'medium',
    networkTarget: 'workorder.test.internal:443',
    status: 'audited',
    desc: '运维工单 MCP 适配服务，支持工单查询与幂等创建。',
    tools: [
      {
        name: 'workorder.list_tickets',
        desc: '查询工单列表，可按状态、设备过滤',
        sideEffect: 'read',
        risk: 'low',
        schema: {
          type: 'object',
          properties: {
            status: { type: 'string', description: 'open / processing / closed' },
            deviceId: { type: 'string' },
          },
        },
      },
      {
        name: 'workorder.create_ticket',
        desc: '创建运维工单（写操作，按确认策略执行，幂等）',
        sideEffect: 'write',
        risk: 'medium',
        schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            deviceId: { type: 'string' },
            priority: { type: 'string', description: 'P1 / P2 / P3' },
            description: { type: 'string' },
            clientRequestId: { type: 'string', description: '幂等键，防止重复创建' },
          },
          required: ['title', 'priority'],
        },
      },
    ],
    createdAt: daysAgo(38),
  })
  store.insert('mcpServers', {
    id: 'mcp_kb',
    name: 'knowledge-base',
    version: '2.1.0',
    connectorId: 'conn_kb',
    dataClassification: '内部',
    risk: 'low',
    networkTarget: 'kb.test.internal:443',
    status: 'audited',
    desc: '企业知识库检索 MCP 服务，返回带来源的文档片段。',
    tools: [
      {
        name: 'kb.search',
        desc: '检索知识空间文档，返回相关片段与来源',
        sideEffect: 'read',
        risk: 'low',
        schema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            topK: { type: 'number', description: '返回片段数，默认 5' },
          },
          required: ['query'],
        },
      },
    ],
    createdAt: daysAgo(30),
  })

  /* ---------------- Skill ---------------- */
  const skillMeta = [
    {
      id: 'sk_health',
      name: '设备健康摘要',
      version: '1.2.0',
      domain: '运维分析',
      risk: 'low',
      status: 'enabled',
      desc: '汇总设备在线率、异常设备清单与活跃告警，输出问题设备台账。',
      scenario: '用户提问“总结当前哪些设备有问题”“最近哪些故障重复发生”时调用。',
      inputs: [
        { name: 'building', type: 'string', required: false, desc: '限定楼栋，如 A楼' },
        { name: 'type', type: 'string', required: false, desc: '限定设备类型' },
      ],
      outputs: [{ name: 'summary', type: 'object', desc: '设备统计与问题清单' }],
      steps: ['读取设备台账', '读取实时状态', '关联活跃告警', '按楼栋/类型归并', '输出问题清单与证据'],
      deps: { connectors: ['conn_gateway'], mcp: ['gateway.list_devices', 'gateway.list_alerts'] },
      failurePolicy: '连接器不可用时明确标注“无法确认”，不得误报正常',
      installs: 86,
      createdAt: daysAgo(35),
    },
    {
      id: 'sk_fault',
      name: '故障归因分析',
      version: '0.9.3',
      domain: '运维分析',
      risk: 'medium',
      status: 'enabled',
      desc: '围绕单台设备汇聚告警、工单、配置变更与知识库证据，辅助归因。',
      scenario: '用户提问“A楼网关今天为什么反复离线”等单设备归因问题。',
      inputs: [
        { name: 'deviceId', type: 'string', required: true, desc: '设备编号' },
        { name: 'days', type: 'number', required: false, desc: '分析时间范围（天）' },
      ],
      outputs: [{ name: 'evidence', type: 'object', desc: '证据包：告警/工单/知识片段' }],
      steps: ['确认设备与时间范围', '汇聚告警历史', '汇聚关联工单', '检索知识库处置预案', '输出证据包'],
      deps: { connectors: ['conn_gateway', 'conn_workorder', 'conn_kb'], mcp: ['gateway.get_device_status', 'gateway.list_alerts', 'workorder.list_tickets', 'kb.search'] },
      failurePolicy: '证据不足时列出缺失数据并标注“待核实”',
      installs: 64,
      createdAt: daysAgo(30),
    },
    {
      id: 'sk_inspection',
      name: '教室巡查报告',
      version: '1.0.2',
      domain: '运维巡检',
      risk: 'low',
      status: 'enabled',
      desc: '按授权范围只读检查教室设备状态，生成带时间与对象的巡查报告。',
      scenario: '每日 08:00 自动巡查，或用户手动发起“巡查一遍今天教室设备”。',
      inputs: [{ name: 'date', type: 'string', required: false, desc: '巡查日期，默认今天' }],
      outputs: [{ name: 'report', type: 'object', desc: '巡查结果与异常清单' }],
      steps: ['获取设备清单', '逐项只读检查', '对照阈值识别异常', '生成巡查报告', '异常转待办/通知'],
      deps: { connectors: ['conn_gateway'], mcp: ['gateway.list_devices', 'gateway.list_alerts'] },
      failurePolicy: '连接失败标记“无法确认”，不得误报正常',
      installs: 112,
      createdAt: daysAgo(33),
    },
    {
      id: 'sk_upgrade',
      name: '文件升级助手',
      version: '0.8.0',
      domain: '变更管理',
      risk: 'high',
      status: 'enabled',
      desc: '生成指定文件升级计划：核对版本、校验值、备份、影响范围与回滚方案。',
      scenario: '用户下达“将指定文件升级到某版本”任务，默认 Plan 模式先审后做。',
      inputs: [
        { name: 'file', type: 'string', required: true, desc: '目标文件路径或唯一标识' },
        { name: 'targetVersion', type: 'string', required: true, desc: '目标版本' },
        { name: 'deviceId', type: 'string', required: false, desc: '目标设备' },
      ],
      outputs: [{ name: 'upgradePlan', type: 'object', desc: '升级计划（未执行）' }],
      steps: ['确认文件/版本/环境/窗口', '读取当前版本', '核对来源与校验值', '评估影响与依赖', '生成备份与回滚方案', '输出计划待审批'],
      deps: { connectors: ['conn_gateway'], mcp: ['gateway.get_device_status'] },
      failurePolicy: '未接入真实执行器，仅能生成计划，必须明确标注未实际升级',
      installs: 41,
      createdAt: daysAgo(22),
    },
    {
      id: 'sk_weekly',
      name: '项目周报生成',
      version: '1.1.0',
      domain: '日常办公',
      risk: 'low',
      status: 'enabled',
      desc: '汇聚项目近 7 天任务、运行与动态素材，供 AI 生成结构化周报。',
      scenario: '用户要求“生成本周项目周报”。',
      inputs: [{ name: 'projectId', type: 'string', required: false, desc: '项目，默认当前项目' }],
      outputs: [{ name: 'materials', type: 'object', desc: '周报素材包' }],
      steps: ['汇聚任务进展', '汇聚自动化运行', '汇聚异常与待办', '输出素材包'],
      deps: { connectors: [] },
      failurePolicy: '无数据时明示，不编造进展',
      installs: 73,
      createdAt: daysAgo(26),
    },
    {
      id: 'sk_knowledge',
      name: '知识库问答',
      version: '1.0.0',
      domain: '资料与知识',
      risk: 'low',
      status: 'enabled',
      desc: '在授权知识空间内检索文档片段，支撑带来源引用的问答。',
      scenario: '用户提问与资料相关的问题，如“网关反复离线的处置预案”。',
      inputs: [{ name: 'query', type: 'string', required: true, desc: '检索问题' }],
      outputs: [{ name: 'excerpts', type: 'array', desc: '带文档名与章节的片段' }],
      steps: ['解析问题', '检索授权空间', '返回片段与来源'],
      deps: { connectors: ['conn_kb'], mcp: ['kb.search'] },
      failurePolicy: '未命中或资料过期时明确说明',
      installs: 95,
      createdAt: daysAgo(29),
    },
    {
      id: 'sk_config_diff',
      name: '配置差异检查',
      version: '0.5.1',
      domain: '运维分析',
      risk: 'medium',
      status: 'disabled',
      desc: '对比设备当前配置与基线配置，输出差异项与影响评估。',
      scenario: '用户怀疑配置被变更导致异常时使用。',
      inputs: [{ name: 'deviceId', type: 'string', required: true, desc: '设备编号' }],
      outputs: [{ name: 'diff', type: 'object', desc: '配置差异清单' }],
      steps: ['读取当前配置', '读取基线配置', '输出差异与影响'],
      deps: { connectors: ['conn_gateway'], mcp: ['gateway.get_device_status'] },
      failurePolicy: '审核中，默认停用',
      installs: 18,
      createdAt: daysAgo(10),
    },
  ]
  for (const s of skillMeta) store.insert('skills', s)

  store.insert('marketSkills', {
    id: 'mt_release',
    name: '发布材料生成',
    version: '0.3.0',
    domain: '产品发布',
    risk: 'medium',
    status: 'reviewing',
    desc: '根据项目资料生成发布公告、更新说明与培训材料初稿。',
    vendor: '社区贡献',
    installs: 12,
    createdAt: daysAgo(6),
  })
  store.insert('marketSkills', {
    id: 'mt_meeting',
    name: '会议纪要与待办提取',
    version: '1.4.0',
    domain: '日常办公',
    risk: 'low',
    status: 'published',
    desc: '整理会议记录，提取决议与待办并关联项目任务。',
    vendor: '官方',
    installs: 238,
    createdAt: daysAgo(50),
  })

  /* ---------------- 演示设备平台数据（演示连接器） ---------------- */
  const devices = [
    ['GW-A-01', 'A楼-网关-01', '网关', 'A楼', 'A栋弱电间', 'online', 'v2.3.1', 18],
    ['GW-A-02', 'A楼-网关-02', '网关', 'A楼', 'A栋弱电间', 'online', 'v2.3.1', 22],
    ['GW-A-03', 'A楼-网关-03', '网关', 'A楼', 'A栋3层弱电间', 'degraded', 'v2.1.0', 3],
    ['CC-A-101', 'A楼-中控-101', '中控主机', 'A楼', 'A101 教室', 'online', 'v5.0.2', 41],
    ['LC-A-102', 'A楼-灯光-102', '灯光控制器', 'A楼', 'A102 教室', 'online', 'v1.8.4', 36],
    ['ES-A-103', 'A楼-环传-103', '环境传感器', 'A楼', 'A103 教室', 'online', 'v1.2.0', 29],
    ['GW-B-01', 'B楼-网关-01', '网关', 'B楼', 'B栋弱电间', 'online', 'v2.3.1', 25],
    ['LC-B-201', 'B楼-灯光-201', '灯光控制器', 'B楼', 'B201 教室', 'offline', 'v1.8.4', 0],
    ['CC-B-202', 'B楼-中控-202', '中控主机', 'B楼', 'B202 教室', 'online', 'v5.0.2', 33],
    ['PJ-B-203', 'B楼-投影-203', '投影', 'B楼', 'B203 教室', 'degraded', 'v3.4.1', 55],
    ['ES-B-204', 'B楼-环传-204', '环境传感器', 'B楼', 'B204 教室', 'online', 'v1.2.0', 31],
    ['LC-B-205', 'B楼-灯光-205', '灯光控制器', 'B楼', 'B205 教室', 'online', 'v1.8.4', 27],
  ]
  for (const [id, name, type, building, room, status, firmware, uptime] of devices) {
    store.insert('demoDevices', {
      id,
      name,
      type,
      building,
      room,
      status,
      firmware,
      ip: `10.20.${building === 'A楼' ? '11' : '12'}.${10 + devices.indexOf(devices.find((d) => d[0] === id))}`,
      lastHeartbeat: status === 'offline' ? daysAgo(2) : minutesAgo(2 + Math.floor(Math.random() * 6)),
      metrics: {
        uptimeHours: uptime,
        temperature: status === 'offline' ? null : 34 + Math.floor(Math.random() * 12),
        rssi: type === '环境传感器' ? -62 - Math.floor(Math.random() * 15) : null,
        offlineCount7d: id === 'GW-A-03' ? 9 : status === 'offline' ? 14 : Math.floor(Math.random() * 2),
      },
      config: {
        // CC-B-202 经审批（ap_history_1）将心跳间隔调整为 60s，用于配置差异检查演示
        heartbeatInterval: id === 'CC-B-202' ? '60s' : '30s',
        reportTopic: `campus/${building}/${id}`,
        powerPolicy: 'auto',
      },
      demo: true,
    })
  }

  const alerts = [
    ['GW-A-03', 'critical', '设备心跳丢失，反复离线（24h 内 4 次）', 26, 'active'],
    ['GW-A-03', 'warning', '固件版本 v2.1.0 低于推荐版本 v2.3.1', 160, 'active'],
    ['LC-B-201', 'critical', '设备持续离线超过 48 小时', 50, 'active'],
    ['PJ-B-203', 'warning', '灯泡寿命剩余 8%，建议更换', 120, 'active'],
    ['GW-A-01', 'info', '固件升级完成 v2.3.1', 200, 'resolved'],
    ['CC-B-202', 'warning', '中控主机 CPU 温度短时超过 45℃', 30, 'resolved'],
    ['ES-A-103', 'info', '传感器校准完成', 320, 'resolved'],
    ['GW-B-01', 'info', '例行巡检通过', 400, 'resolved'],
  ]
  for (const [deviceId, severity, message, hours, status] of alerts) {
    store.insert('demoAlerts', {
      id: `AL-${1000 + store.list('demoAlerts').length}`,
      deviceId,
      severity,
      message,
      firstSeen: hoursAgo(hours),
      lastSeen: status === 'active' ? hoursAgo(Math.min(hours, 3)) : hoursAgo(hours),
      count: Math.max(1, Math.floor(hours / 6)),
      status,
      demo: true,
    })
  }

  store.insert('demoWorkorders', {
    id: 'WO-2071',
    title: 'A楼3层网关反复离线排查',
    deviceId: 'GW-A-03',
    status: 'processing',
    priority: 'P2',
    assignee: '王工',
    description: '近一周多次心跳丢失，怀疑 PoE 供电或固件问题，待现场核查。',
    createdAt: daysAgo(2),
    demo: true,
  })
  store.insert('demoWorkorders', {
    id: 'WO-2078',
    title: 'B201 灯光控制器离线更换电源',
    deviceId: 'LC-B-201',
    status: 'open',
    priority: 'P1',
    assignee: '李晓梅',
    description: '设备持续离线，初步判断电源模块故障，备件已申领。',
    createdAt: daysAgo(1),
    demo: true,
  })
  store.insert('demoWorkorders', {
    id: 'WO-2055',
    title: 'B203 投影灯泡寿命预警处理',
    deviceId: 'PJ-B-203',
    status: 'closed',
    priority: 'P3',
    assignee: '王工',
    description: '已登记备件更换计划，随本周维护窗口处理。',
    createdAt: daysAgo(5),
    demo: true,
  })

  /* ---------------- 知识空间与文档 ---------------- */
  store.insert('spaces', {
    id: 'sp_classroom',
    name: '智慧教室项目知识库',
    scope: 'project',
    projectId: 'p_classroom',
    owner: '陈志远',
    builtin: true,
    desc: '设备手册、巡检 SOP 与故障处置预案，供项目内 AI 任务检索引用。',
    createdAt: daysAgo(38),
  })
  store.insert('spaces', {
    id: 'sp_team',
    name: '运营团队共享空间',
    scope: 'team',
    projectId: null,
    owner: '周敏',
    builtin: true,
    desc: '团队管理制度、模板与通用方法论。',
    createdAt: daysAgo(25),
  })

  const docs = [
    {
      id: 'doc_gateway_manual',
      spaceId: 'sp_classroom',
      title: '智慧教室网关设备手册（节选）',
      category: '设备手册',
      version: 'v2.3',
      tags: ['网关', '固件', '心跳'],
      updatedAt: daysAgo(8),
      content:
        '## 3.2 心跳机制\n网关每 30s 上报心跳至平台。连续 3 次未收到心跳判定为离线。\n\n## 3.3 反复离线排查\n1. 检查 PoE 供电电压是否低于 44V；\n2. 检查上行交换机端口协商速率；\n3. 固件低于 v2.3.0 的版本存在已知的看门狗缺陷（编号 FW-108），会导致设备在内存水位过高时重启，表现为反复离线；\n4. 若上述均正常，收集 /var/log/agent.log 联系厂商。\n\n## 4.1 固件升级\n支持平台下发升级。升级前请确认设备处于维护窗口，升级耗时约 3-5 分钟，期间设备离线。升级失败自动回滚至前一版本。',
    },
    {
      id: 'doc_inspection_sop',
      spaceId: 'sp_classroom',
      title: '教室巡检标准作业程序 SOP',
      category: 'SOP',
      version: 'v3.1',
      tags: ['巡检', 'SOP'],
      updatedAt: daysAgo(14),
      content:
        '## 每日巡查\n08:00 前完成全部开放教室设备只读检查：网关在线率、灯光控制器状态、中控主机心跳、环境传感器数据新鲜度。\n\n## 异常分级\n- P1：影响当日教学（设备离线、无法上课），30 分钟内响应；\n- P2：性能降级但不影响教学，当日处理；\n- P3：预警类，随维护窗口处理。\n\n## 处置原则\n巡检默认只读。重启、配置修改等操作必须经项目负责人审批，并避开 08:00-21:00 上课时段。',
    },
    {
      id: 'doc_incident_playbook',
      spaceId: 'sp_classroom',
      title: '常见故障处置预案',
      category: '处置预案',
      version: 'v1.7',
      tags: ['故障', '预案', '网关', '灯光'],
      updatedAt: daysAgo(5),
      content:
        '## 网关反复离线\n优先核查固件版本：v2.1.x 及更早版本存在看门狗缺陷 FW-108，建议升级至 v2.3.1。若固件已最新，检查 PoE 供电与上联端口。\n\n## 灯光控制器离线\n常见原因为电源模块故障或总线接触不良。持续离线超过 24h 建议现场更换电源模块。\n\n## 投影灯泡告警\n寿命低于 10% 时登记备件，随维护窗口更换，避免教学中突发熄灯。',
    },
    {
      id: 'doc_weekly_tpl',
      spaceId: 'sp_team',
      title: '项目周报模板',
      category: '模板',
      version: 'v2.0',
      tags: ['周报', '模板'],
      updatedAt: daysAgo(20),
      content:
        '## 周报结构\n1. 本周进展（按任务列出状态与产出）；\n2. 数据与指标；\n3. 风险与阻塞；\n4. 下周计划。\n\n要求：进展描述关联具体任务或运行记录，不夸大、不编造。',
    },
    {
      id: 'doc_governance',
      spaceId: 'sp_team',
      title: 'AI 使用与数据分级规范（摘要）',
      category: '制度',
      version: 'v1.2',
      tags: ['合规', '数据分级'],
      updatedAt: daysAgo(30),
      content:
        '## 数据分级\n公开 / 内部 / 秘密 / 机密。AI 任务默认仅可访问「内部」及以下级别资料。\n\n## 演示数据标注\n凡来自演示环境或模拟连接器的数据，界面与报告必须显著标注「演示数据」，禁止冒充真实生产状态。',
    },
  ]
  for (const d of docs) {
    store.insert('documents', {
      ...d,
      size: d.content.length,
      indexed: true,
      createdAt: d.updatedAt,
    })
  }

  /* ---------------- 自动化 ---------------- */
  store.insert('automations', {
    id: 'au_inspection',
    no: store.nextSeq('automation'),
    name: '每日教室巡查',
    projectId: 'p_classroom',
    purpose: '每日 08:00 只读检查全部教室设备状态，异常生成报告并通知值班人员。',
    instruction: '按授权读取网关、灯光、中控、环传设备状态，对照阈值识别离线/告警/异常，生成巡查报告。默认只读，修复操作仅生成建议。',
    skillId: 'sk_inspection',
    skillArgs: {},
    schedule: { kind: 'daily', time: '08:00', timezone: 'Asia/Shanghai', text: '每天 08:00（Asia/Shanghai）' },
    modelPolicy: 'auto',
    safetyLevel: 'read-only',
    notifyTargets: ['值班运维群', '李晓梅'],
    status: 'enabled',
    lastRunAt: hoursAgo(3),
    nextRunAt: new Date(new Date().setHours(8, 0, 0, 0) + 86400000).toISOString(),
    createdAt: daysAgo(21),
  })
  store.insert('automations', {
    id: 'au_health',
    no: store.nextSeq('automation'),
    name: '设备在线率巡检',
    projectId: 'p_classroom',
    purpose: '每 30 分钟检查设备在线率与关键指标，连接失败标记“无法确认”。',
    instruction: '检查设备在线率、心跳、告警与关键指标；异常生成告警摘要。',
    skillId: 'sk_health',
    skillArgs: {},
    schedule: { kind: 'interval', every: '30m', text: '每 30 分钟' },
    modelPolicy: 'auto',
    safetyLevel: 'read-only',
    notifyTargets: ['值班运维群'],
    status: 'paused',
    lastRunAt: daysAgo(2),
    nextRunAt: null,
    createdAt: daysAgo(18),
  })

  /* ---------------- 自动化运行记录 ---------------- */
  const runs = [
    ['au_inspection', 'success', 26, 0, '全部 12 台设备完成只读检查，在线率 100%，未发现新增异常。', 4],
    ['au_inspection', 'partial', 31, 2, '发现 2 项异常：A楼-网关-03 反复离线（24h 内 4 次）；B楼-投影-203 灯泡寿命剩余 8%。已生成待办。', 27],
    ['au_inspection', 'partial', 29, 1, '发现 1 项异常：B楼-灯光-201 持续离线超过 24 小时，已创建运维待办并通知值班人员。', 51],
    ['au_inspection', 'failed', 0, 0, '设备网关连接器超时（>15s 无响应），本次巡查标记为「无法确认」，未将任何设备误判为正常。', 76],
    ['au_inspection', 'success', 24, 0, '全部设备检查通过，历史告警无新增。', 99],
  ]
  for (const [auId, status, duration, anomalies, summary, hours] of runs) {
    store.insert('automationRuns', {
      id: `run_${1000 + store.list('automationRuns').length}`,
      automationId: auId,
      automationName: auId === 'au_inspection' ? '每日教室巡查' : '设备在线率巡检',
      projectId: 'p_classroom',
      status,
      durationSec: duration,
      anomalyCount: anomalies,
      summary,
      report: `## 巡查报告（演示数据）\n\n${summary}\n\n- 数据来源：教室设备网关（演示连接器）\n- 检查方式：只读\n- 结论可信度：数据新鲜度正常`,
      steps: [
        { title: '获取设备清单', status: 'ok' },
        { title: '逐项只读检查', status: status === 'failed' ? 'error' : 'ok' },
        { title: '识别异常', status: status === 'failed' ? 'error' : 'ok' },
        { title: '生成报告与通知', status: status === 'failed' ? 'skip' : 'ok' },
      ],
      triggeredBy: 'schedule',
      startedAt: hoursAgo(hours),
      finishedAt: hoursAgo(hours - 0.01),
      demo: true,
      createdAt: hoursAgo(hours),
    })
  }

  /* ---------------- 任务（含一段真实可追溯的对话样例结构与一个待审批任务） ---------------- */
  store.insert('tasks', {
    id: 't_demo_summary',
    no: store.nextSeq('task'),
    title: '总结当前哪些设备有问题',
    projectId: 'p_classroom',
    mode: 'ask',
    model: 'doubao-seed-2-0-pro-260215',
    status: 'completed',
    skillIds: ['sk_health'],
    connectorIds: ['conn_gateway'],
    messages: [
      { role: 'user', content: '总结一下当前哪些设备有问题？', ts: hoursAgo(5) },
      {
        role: 'assistant',
        content:
          '已通过「设备健康摘要」技能查询教室设备网关（演示连接器）。\n\n## 观测事实（演示数据）\n当前共有 **3 台设备**存在异常：\n\n| 设备 | 现象 | 最近发生 | 活跃告警 |\n| --- | --- | --- | --- |\n| A楼-网关-03 | 反复离线（7 天内 9 次） | 约 3 小时前 | 心跳丢失（critical） |\n| B楼-灯光-201 | 持续离线超过 48 小时 | 2 天前 | 离线（critical） |\n| B楼-投影-203 | 灯泡寿命剩余 8% | 5 天前 | 寿命预警（warning） |\n\n## 可能原因\n- A楼-网关-03 固件 v2.1.0 存在已知看门狗缺陷（FW-108），与反复离线现象吻合（待现场核实）。\n- B楼-灯光-201 工单判断为电源模块故障。\n\n## 建议措施\n1. 优先处理 B楼-灯光-201（影响 B201 上课，P1）。\n2. 安排 A楼-网关-03 固件升级至 v2.3.1（需走文件升级审批）。\n3. B楼-投影-203 随维护窗口更换灯泡（P3）。',
        ts: hoursAgo(5),
        sources: ['教室设备网关（演示连接器）', '设备健康摘要 v1.2.0'],
      },
    ],
    steps: [
      { kind: 'skill', name: '设备健康摘要', tool: 'skill.device_health_summary', status: 'ok', durationMs: 860, summary: '汇总 12 台设备，3 台异常', ts: hoursAgo(5) },
      { kind: 'mcp', name: 'gateway.list_alerts', tool: 'gateway.list_alerts', status: 'ok', durationMs: 412, summary: '返回 4 条活跃告警', ts: hoursAgo(5) },
    ],
    demo: true,
    createdAt: hoursAgo(5),
    updatedAt: hoursAgo(5),
  })

  store.insert('tasks', {
    id: 't_demo_upgrade',
    no: store.nextSeq('task'),
    title: '将 A楼-网关-03 固件升级到 v2.3.1',
    projectId: 'p_classroom',
    mode: 'craft',
    model: 'doubao-seed-2-0-pro-260215',
    status: 'waiting_approval',
    skillIds: ['sk_upgrade'],
    connectorIds: ['conn_gateway'],
    messages: [
      { role: 'user', content: '把 A楼-网关-03 的固件升级到 v2.3.1，解决反复离线问题。', ts: hoursAgo(2) },
      {
        role: 'assistant',
        content:
          '已核对目标设备当前版本为 v2.1.0，目标版本 v2.3.1 可修复看门狗缺陷 FW-108。升级属于高风险操作，我已生成执行计划并提交审批，审批通过后方可在维护窗口执行。',
        ts: hoursAgo(2),
        sources: ['教室设备网关（演示连接器）', '文件升级助手 v0.8.0'],
      },
    ],
    steps: [
      { kind: 'skill', name: '文件升级助手', tool: 'skill.file_upgrade_plan', status: 'ok', durationMs: 1240, summary: '生成升级计划：备份 → 升级 → 健康检查 → 必要时回滚', ts: hoursAgo(2) },
      { kind: 'approval', name: '高风险操作审批', tool: 'approval', status: 'waiting', summary: 'gateway.update_config / GW-A-03', ts: hoursAgo(2) },
    ],
    plan: {
      title: 'A楼-网关-03 固件升级计划',
      goal: '将 GW-A-03 固件由 v2.1.0 升级至 v2.3.1，修复看门狗缺陷 FW-108 导致的反复离线。',
      steps: [
        { title: '前置检查', detail: '确认设备在线、备份当前配置与固件镜像', risk: 'low' },
        { title: '下发升级', detail: '通过受控连接器下发 v2.3.1 固件，设备升级期间离线约 3-5 分钟', risk: 'high' },
        { title: '健康检查', detail: '校验版本号、心跳恢复、告警清除', risk: 'low' },
        { title: '回滚预案', detail: '升级失败或验证不通过时自动回滚至 v2.1.0 并转人工', risk: 'medium' },
      ],
      scope: '仅 GW-A-03（A楼3层弱电间），维护窗口 21:30-22:30',
      risks: ['升级期间 A 楼 3 层教室设备短暂离线', '固件不兼容导致升级失败（概率低）'],
      sideEffects: ['设备重启', '分钟级服务中断'],
    },
    demo: true,
    createdAt: hoursAgo(2),
    updatedAt: hoursAgo(2),
  })

  /* ---------------- 审批 ---------------- */
  store.insert('approvals', {
    id: 'ap_upgrade_1',
    no: store.nextSeq('approval'),
    kind: 'high-risk-operation',
    title: '高风险操作审批：A楼-网关-03 固件升级 v2.3.1',
    taskId: 't_demo_upgrade',
    projectId: 'p_classroom',
    applicant: '陈志远（AI 任务发起）',
    object: 'GW-A-03 / A楼3层弱电间',
    change: '固件 v2.1.0 → v2.3.1（gateway.update_config / 下发升级）',
    impact: '升级期间 A 楼 3 层教室设备离线 3-5 分钟；建议在 21:30 后维护窗口执行',
    rollback: '升级失败自动回滚至 v2.1.0，并恢复升级前配置备份',
    status: 'pending',
    approver: '李晓梅',
    expireAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    createdAt: hoursAgo(2),
  })
  store.insert('approvals', {
    id: 'ap_history_1',
    no: store.nextSeq('approval'),
    kind: 'high-risk-operation',
    title: '高风险操作审批：B楼-中控-202 心跳间隔调整',
    taskId: null,
    projectId: 'p_classroom',
    applicant: '王工',
    object: 'CC-B-202 / B202 教室',
    change: 'heartbeatInterval: 30s → 60s',
    impact: '降低平台接入负载，状态感知延迟上升至分钟级',
    rollback: '恢复 heartbeatInterval 为 30s',
    status: 'approved',
    approver: '李晓梅',
    decidedAt: daysAgo(3),
    comment: '同意，观察一周。',
    createdAt: daysAgo(4),
  })
  store.insert('approvals', {
    id: 'ap_history_2',
    no: store.nextSeq('approval'),
    kind: 'high-risk-operation',
    title: '高风险操作审批：上课时段重启 A楼-网关-02',
    taskId: null,
    projectId: 'p_classroom',
    applicant: '赵倩',
    object: 'GW-A-02',
    change: '重启设备（gateway.reboot_device）',
    impact: '违反操作边界：上课时段禁止重启教室设备',
    rollback: '不涉及',
    status: 'rejected',
    approver: '李晓梅',
    decidedAt: daysAgo(6),
    comment: '违反操作边界，请改到维护窗口再申请。',
    createdAt: daysAgo(6),
  })

  /* ---------------- 待办 ---------------- */
  store.insert('todos', {
    id: 'td_light',
    no: store.nextSeq('todo'),
    title: '处理 B楼-灯光-201 持续离线（P1）',
    source: '自动化运行 run_1002 · 每日教室巡查',
    projectId: 'p_classroom',
    runId: 'run_1002',
    detail: '设备持续离线超过 48 小时，工单 WO-2078 已开立，需现场更换电源模块。',
    suggestion: '今日内完成备件更换并复核在线状态。',
    priority: 'P1',
    status: 'pending',
    assignee: '李晓梅',
    createdAt: daysAgo(2),
  })
  store.insert('todos', {
    id: 'td_gateway',
    no: store.nextSeq('todo'),
    title: '确认 A楼-网关-03 固件升级窗口',
    source: 'AI 任务 · 将 A楼-网关-03 固件升级到 v2.3.1',
    projectId: 'p_classroom',
    taskId: 't_demo_upgrade',
    detail: '升级计划已生成，待确认维护窗口并审批后执行。',
    suggestion: '建议安排在 21:30-22:30 维护窗口。',
    priority: 'P2',
    status: 'pending',
    assignee: '陈志远',
    createdAt: hoursAgo(2),
  })
  store.insert('todos', {
    id: 'td_done_1',
    no: store.nextSeq('todo'),
    title: '上周投影灯泡预警跟进',
    source: '自动化运行 run_1004',
    projectId: 'p_classroom',
    detail: 'B203 投影灯泡寿命预警，已登记备件。',
    priority: 'P3',
    status: 'done',
    assignee: '王工',
    createdAt: daysAgo(5),
  })

  /* ---------------- 通知 ---------------- */
  store.insert('notifications', {
    id: 'nt_1',
    kind: 'approval',
    title: '待审批：A楼-网关-03 固件升级 v2.3.1',
    body: 'AI 任务提交了高风险操作计划，等待审批。',
    link: '/approvals',
    read: false,
    createdAt: hoursAgo(2),
  })
  store.insert('notifications', {
    id: 'nt_2',
    kind: 'automation',
    title: '每日教室巡查：发现 1 项异常',
    body: 'B楼-灯光-201 持续离线超过 24 小时，已创建运维待办。',
    link: '/automations',
    read: false,
    createdAt: daysAgo(2),
  })

  /* ---------------- 活动记录 ---------------- */
  const acts = [
    ['p_classroom', 'approval', '提交固件升级审批：GW-A-03 → v2.3.1', '陈志远', 2],
    ['p_classroom', 'automation', '每日教室巡查完成：发现 2 项异常', '系统', 27],
    ['p_classroom', 'task', '完成任务「总结当前哪些设备有问题」', '陈志远', 5],
    ['p_classroom', 'connector', '教室设备网关连接器连通性测试通过', '李晓梅', 8],
    ['p_web', 'task', '生成官网改版第 6 周周报', '林晓', 30],
    ['p_classroom', 'knowledge', '更新文档《常见故障处置预案》至 v1.7', '王工', 120],
  ]
  for (const [pid, kind, text, actor, hours] of acts) {
    store.insert('activities', { projectId: pid, kind, text, actor, createdAt: hoursAgo(hours) })
  }

  /* ---------------- 审计 ---------------- */
  const auditSeed = [
    ['陈志远', 'login', 'session', '-', '登录工作台', 7],
    ['李晓梅', 'connector.authorize', 'connector', 'conn_gateway', '授权教室设备网关连接器（测试环境，最小权限）', 100],
    ['陈志远', 'task.create', 'task', 't_demo_summary', '发起 AI 任务：总结当前哪些设备有问题（问一问）', 5],
    ['系统', 'tool.invoke', 'mcp', 'gateway.list_devices', 'AI 调用 MCP 工具 gateway.list_devices（只读）', 5],
    ['系统', 'tool.invoke', 'skill', 'sk_health', 'AI 调用技能 设备健康摘要 v1.2.0', 5],
    ['陈志远', 'task.create', 'task', 't_demo_upgrade', '发起 AI 任务：固件升级（做一做）', 2],
    ['系统', 'approval.submit', 'approval', 'ap_upgrade_1', '高风险操作转人工审批：gateway.update_config / GW-A-03', 2],
    ['系统', 'automation.run', 'automation', 'au_inspection', '每日教室巡查执行完成：partial', 27],
    ['李晓梅', 'approval.decide', 'approval', 'ap_history_1', '审批通过：B楼-中控-202 心跳间隔调整', 72],
    ['李晓梅', 'approval.decide', 'approval', 'ap_history_2', '审批拒绝：上课时段重启设备（违反操作边界）', 144],
  ]
  for (const [actor, action, targetType, targetId, detail, hours] of auditSeed) {
    store.insert('auditLogs', {
      seq: store.nextSeq('audit'),
      actor,
      action,
      targetType,
      targetId,
      detail,
      result: 'success',
      createdAt: hoursAgo(hours),
    })
  }

  /* ---------------- 探索案例 ---------------- */
  store.insert('cases', {
    id: 'case_inspection',
    title: '每日教室巡查自动化',
    scenario: '服务协作 / 运维巡检',
    goal: '每日定时只读巡查教室设备，异常自动报告并通知值班人员。',
    applies: '拥有设备网关类连接器的运维项目',
    preview: '08:00 自动运行 → 生成巡查报告 → 异常创建待办并通知',
    skillIds: ['sk_inspection'],
    connectorIds: ['conn_gateway'],
    prompt: '帮我配置每日 08:00 的教室设备巡查：只读检查全部设备状态，异常生成报告并通知值班人员。',
    usedCount: 45,
    createdAt: daysAgo(20),
  })
  store.insert('cases', {
    id: 'case_fault_weekly',
    title: '设备故障周报',
    scenario: '专业任务 / 运维分析',
    goal: '汇总一周设备告警、离线事件与处理进展，生成故障周报。',
    applies: '需要周期性复盘设备健康状况的团队',
    preview: '汇聚告警与工单 → 归因分析 → 结构化周报',
    skillIds: ['sk_fault', 'sk_weekly'],
    connectorIds: ['conn_gateway', 'conn_workorder'],
    prompt: '汇总最近一周的设备故障与告警，分析重复发生的问题，生成故障周报。',
    usedCount: 32,
    createdAt: daysAgo(16),
  })
  store.insert('cases', {
    id: 'case_upgrade',
    title: '指定文件升级流程',
    scenario: '专业任务 / 变更管理',
    goal: '对指定文件/固件生成升级计划，审批通过后在维护窗口执行。',
    applies: '有固件或文件升级需求的设备运维场景',
    preview: '确认目标与版本 → 升级计划 → 审批 → 受控执行 → 验证/回滚',
    skillIds: ['sk_upgrade'],
    connectorIds: ['conn_gateway'],
    prompt: '将指定设备的固件升级到目标版本，先生成升级计划给我看。',
    usedCount: 18,
    createdAt: daysAgo(12),
  })
  store.insert('cases', {
    id: 'case_knowledge',
    title: '基于设备手册的故障问答',
    scenario: '资料与知识',
    goal: '检索授权知识空间中的设备手册与处置预案，带来源回答运维问题。',
    applies: '已沉淀手册与 SOP 的项目团队',
    preview: '问题 → 检索知识库 → 带来源引用的回答',
    skillIds: ['sk_knowledge'],
    connectorIds: ['conn_kb'],
    prompt: '网关反复离线应该怎么排查？请结合知识库中的手册与预案回答。',
    usedCount: 57,
    createdAt: daysAgo(25),
  })

  return { pClassroom, pWeb }
}
