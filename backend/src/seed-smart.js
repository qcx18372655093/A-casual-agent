/**
 * SMART6000（NET-6000）智慧教室 AI 中控 + 会议助手 + SSLX 视频识别种子数据
 * 幂等：只在对应集合/记录缺失时播种，可反复调用
 */
import { store } from './store.js'

const now = Date.now()
const iso = (msAgo) => new Date(now - msAgo).toISOString()

/* ---------------- SMART6000 演示主机集群 ---------------- */
// 接口规格对齐 NET-6000：Ethernet / NET总线 / COM / IR / I/O / RELAY
const SMART_HOSTS = [
  {
    id: 'sh_a101', name: 'A101 阶梯教室中控主机', model: 'NET-6000', alias: 'SMART6000',
    room: 'A101 阶梯教室', building: 'A栋教学楼', status: 'online', firmware: 'V6.2.1',
    ip: '10.10.1.101', aiEngine: true, aiStatus: 'running', recognitionRate: 99.2,
    interfaces: { ethernet: 2, netBus: 1, com: 4, ir: 4, io: 8, relay: 8 },
    scene: '上课', lastSceneAt: iso(3 * 3600e3),
    devices: [
      { id: 'proj', name: '投影仪', type: 'projector', control: 'COM1', status: 'on' },
      { id: 'screen', name: '智慧大屏', type: 'display', control: 'COM2', status: 'on' },
      { id: 'amp', name: '功放', type: 'audio', control: 'COM3', status: 'on' },
      { id: 'cam', name: '云台摄像机', type: 'camera', control: 'Ethernet', status: 'on' },
      { id: 'light', name: '教室灯光', type: 'light', control: 'RELAY1-2', status: 'on' },
      { id: 'curtain', name: '电动窗帘', type: 'curtain', control: 'RELAY3-4', status: 'closed' },
      { id: 'ac', name: '空调', type: 'hvac', control: 'IR1', status: 'on' },
      { id: 'rec', name: '录播主机', type: 'recorder', control: 'Ethernet', status: 'recording' },
    ],
    metrics: { uptimeHours: 2160, tempC: 41, todaySceneExecs: 6, aiEvents: 23 },
    updatedAt: iso(5 * 60e3), demo: true,
  },
  {
    id: 'sh_a102', name: 'A102 智慧教室中控主机', model: 'NET-6000', alias: 'SMART6000',
    room: 'A102 智慧教室', building: 'A栋教学楼', status: 'online', firmware: 'V6.2.1',
    ip: '10.10.1.102', aiEngine: true, aiStatus: 'running', recognitionRate: 98.7,
    interfaces: { ethernet: 2, netBus: 1, com: 4, ir: 4, io: 8, relay: 8 },
    scene: '空闲', lastSceneAt: iso(26 * 3600e3),
    devices: [
      { id: 'proj', name: '投影仪', type: 'projector', control: 'COM1', status: 'off' },
      { id: 'screen', name: '智慧大屏', type: 'display', control: 'COM2', status: 'standby' },
      { id: 'amp', name: '功放', type: 'audio', control: 'COM3', status: 'off' },
      { id: 'cam', name: '云台摄像机', type: 'camera', control: 'Ethernet', status: 'on' },
      { id: 'light', name: '教室灯光', type: 'light', control: 'RELAY1-2', status: 'off' },
      { id: 'curtain', name: '电动窗帘', type: 'curtain', control: 'RELAY3-4', status: 'open' },
      { id: 'ac', name: '空调', type: 'hvac', control: 'IR1', status: 'off' },
      { id: 'rec', name: '录播主机', type: 'recorder', control: 'Ethernet', status: 'standby' },
    ],
    metrics: { uptimeHours: 2160, tempC: 38, todaySceneExecs: 2, aiEvents: 9 },
    updatedAt: iso(12 * 60e3), demo: true,
  },
  {
    id: 'sh_b201', name: 'B201 实训教室中控主机', model: 'NET-6000', alias: 'SMART6000',
    room: 'B201 实训教室', building: 'B栋实训楼', status: 'degraded', firmware: 'V6.1.4',
    ip: '10.10.2.201', aiEngine: true, aiStatus: 'running', recognitionRate: 97.5,
    interfaces: { ethernet: 2, netBus: 1, com: 4, ir: 4, io: 8, relay: 8 },
    scene: '上课', lastSceneAt: iso(90 * 60e3),
    devices: [
      { id: 'proj', name: '投影仪', type: 'projector', control: 'COM1', status: 'on' },
      { id: 'screen', name: '实训大屏', type: 'display', control: 'COM2', status: 'on' },
      { id: 'amp', name: '功放', type: 'audio', control: 'COM3', status: 'fault' },
      { id: 'cam', name: '云台摄像机', type: 'camera', control: 'Ethernet', status: 'on' },
      { id: 'light', name: '教室灯光', type: 'light', control: 'RELAY1-2', status: 'on' },
      { id: 'curtain', name: '电动窗帘', type: 'curtain', control: 'RELAY3-4', status: 'closed' },
      { id: 'ac', name: '空调', type: 'hvac', control: 'IR1', status: 'on' },
      { id: 'rec', name: '录播主机', type: 'recorder', control: 'Ethernet', status: 'recording' },
    ],
    metrics: { uptimeHours: 980, tempC: 47, todaySceneExecs: 4, aiEvents: 17 },
    issue: '功放（COM3）无响应，建议现场检查音频链路',
    updatedAt: iso(2 * 60e3), demo: true,
  },
  {
    id: 'sh_report', name: '报告厅中控主机', model: 'NET-6000', alias: 'SMART6000',
    room: '学术交流报告厅', building: '综合楼', status: 'offline', firmware: 'V6.2.1',
    ip: '10.10.3.10', aiEngine: true, aiStatus: 'stopped', recognitionRate: null,
    interfaces: { ethernet: 2, netBus: 1, com: 4, ir: 4, io: 8, relay: 8 },
    scene: null, lastSceneAt: iso(3 * 86400e3),
    devices: [
      { id: 'proj', name: '激光投影', type: 'projector', control: 'COM1', status: 'unknown' },
      { id: 'screen', name: 'LED 大屏', type: 'display', control: 'COM2', status: 'unknown' },
      { id: 'amp', name: '线阵功放', type: 'audio', control: 'COM3', status: 'unknown' },
      { id: 'cam', name: '跟踪摄像机', type: 'camera', control: 'Ethernet', status: 'unknown' },
      { id: 'light', name: '舞台灯光', type: 'light', control: 'RELAY1-4', status: 'unknown' },
      { id: 'curtain', name: '电动幕布', type: 'curtain', control: 'RELAY5-6', status: 'unknown' },
      { id: 'ac', name: '空调', type: 'hvac', control: 'IR1', status: 'unknown' },
      { id: 'rec', name: '录播主机', type: 'recorder', control: 'Ethernet', status: 'unknown' },
    ],
    metrics: { uptimeHours: 0, tempC: null, todaySceneExecs: 0, aiEvents: 0 },
    issue: '主机离线 3 天，疑似电源时序器未上电',
    updatedAt: iso(3 * 86400e3), demo: true,
  },
]

/* 场景定义：一键上课/下课/午休/考试（联动设备时序） */
export const SMART_SCENES = {
  class_start: {
    key: 'class_start', name: '一键上课', risk: 'high',
    steps: [
      { order: 1, device: 'light', action: 'on', label: '开启教室灯光' },
      { order: 2, device: 'curtain', action: 'close', label: '关闭电动窗帘' },
      { order: 3, device: 'screen', action: 'on', label: '唤醒智慧大屏' },
      { order: 4, device: 'proj', action: 'on', label: '开启投影仪（预热 15s）' },
      { order: 5, device: 'amp', action: 'on', label: '开启功放' },
      { order: 6, device: 'ac', action: 'on', label: '空调调至 24℃' },
      { order: 7, device: 'cam', action: 'track', label: '摄像机开启教师跟踪' },
      { order: 8, device: 'rec', action: 'record', label: '录播主机开始录制' },
    ],
  },
  class_end: {
    key: 'class_end', name: '一键下课', risk: 'high',
    steps: [
      { order: 1, device: 'rec', action: 'stop', label: '录播主机停止录制并归档' },
      { order: 2, device: 'cam', action: 'standby', label: '摄像机回到待机位' },
      { order: 3, device: 'proj', action: 'off', label: '关闭投影仪（散热 90s）' },
      { order: 4, device: 'screen', action: 'standby', label: '大屏进入待机' },
      { order: 5, device: 'amp', action: 'off', label: '关闭功放' },
      { order: 6, device: 'ac', action: 'off', label: '关闭空调' },
      { order: 7, device: 'curtain', action: 'open', label: '打开电动窗帘' },
      { order: 8, device: 'light', action: 'off', label: '延时 5 分钟关闭灯光' },
    ],
  },
  break: {
    key: 'break', name: '午休模式', risk: 'medium',
    steps: [
      { order: 1, device: 'screen', action: 'standby', label: '大屏待机' },
      { order: 2, device: 'light', action: 'dim', label: '灯光调至 30%' },
      { order: 3, device: 'curtain', action: 'open', label: '窗帘半开' },
    ],
  },
  exam: {
    key: 'exam', name: '考试模式', risk: 'high',
    steps: [
      { order: 1, device: 'cam', action: 'exam', label: '摄像机切换考场巡查预置位' },
      { order: 2, device: 'rec', action: 'record', label: '录播主机全程录制（不可手动停止）' },
      { order: 3, device: 'screen', action: 'on', label: '大屏显示考试时钟' },
      { order: 4, device: 'light', action: 'on', label: '灯光全开' },
      { order: 5, device: 'curtain', action: 'close', label: '关闭窗帘' },
    ],
  },
}

/* ---------------- 会议助手演示会议 ---------------- */
const DEMO_TRANSCRIPT_UTTERANCES = [
  { start: 0.0, end: 8.4, speaker: 'spk_1', text: '好，我们开始今天的智慧教室二期建设周会。先过一下上周的三个遗留事项。' },
  { start: 8.4, end: 21.7, speaker: 'spk_2', text: 'A 栋的八台 NET-6000 中控主机已经全部上架，固件统一升到 6.2.1，A101 和 A102 两间教室的场景联动脚本已经联调通过了。' },
  { start: 21.7, end: 33.2, speaker: 'spk_1', text: 'B201 的功放告警昨天又复现了一次，运维那边定位到是音频线接触不良，这周必须闭环。' },
  { start: 33.2, end: 47.9, speaker: 'spk_3', text: '报告厅那台主机离线的问题我查过了，是电源时序器没上电，已经和物业确认明天上午恢复。另外一键上课场景的投影仪预热时间，教务希望控制在十秒以内。' },
  { start: 47.9, end: 61.3, speaker: 'spk_2', text: '预热时间这个要看投影型号，激光的可以压到八秒，灯泡机物理极限就是十五秒左右，这个我出一个对比表给教务定夺。' },
  { start: 61.3, end: 74.8, speaker: 'spk_1', text: '好。会议纪要里记三个待办：第一，B201 功放本周五前闭环，负责人李晓峰；第二，报告厅主机明天恢复上线并补跑一次巡检；第三，投影预热对比表周三前出。散会。' },
]

const DEMO_MINUTES = `## 会议纪要 · 智慧教室二期建设周会

**参会方**：项目部 / 运维组 / 教务对接人（3 方，说话人 3 人）
**时长**：约 1 分 15 秒（节选）

### 一、议题与进展
1. **A 栋中控部署完成**：8 台 NET-6000（SMART6000）全部上架，固件统一 V6.2.1；A101 / A102 场景联动脚本联调通过。
2. **B201 功放告警**：定位为音频线接触不良，运维侧本周闭环。
3. **报告厅主机离线**：电源时序器未上电，物业明日上午恢复，恢复后补巡检。
4. **一键上课体验优化**：教务要求投影预热 ≤10s；激光投影可达 8s，灯泡机物理极限约 15s。

### 二、决议
- 灯泡机教室维持现状，新采购教室优先激光投影方案。
- 报告厅恢复后 24 小时内完成一轮集控巡检并回传报告。

### 三、待办事项
| # | 事项 | 负责人 | 截止 |
| - | ---- | ------ | ---- |
| 1 | B201 功放音频链路修复并回归验证 | 李晓峰 | 本周五 |
| 2 | 报告厅主机恢复上线 + 补巡检 | 运维组 | 明日 |
| 3 | 投影预热时间对比表（激光 vs 灯泡） | 设备组 | 本周三 |

> 本纪要由 AI 基于语音转写生成，请人工复核后归档。`

const MEETINGS = [
  {
    id: 'mt_demo_weekly',
    title: '智慧教室二期建设周会（节选）',
    location: '综合楼 3F · 会议室 2', meetingAt: iso(86400e3),
    duration: 74.8, status: 'done',
    audioName: 'weekly-meeting-clip.mp3',
    transcript: {
      text: DEMO_TRANSCRIPT_UTTERANCES.map((u) => u.text).join(''),
      utterances: DEMO_TRANSCRIPT_UTTERANCES,
      duration: 74.8, engine: 'doubao-asr', demo: true,
    },
    minutes: DEMO_MINUTES,
    projectId: 'p_classroom', actor: 'admin', demo: true,
  },
  {
    id: 'mt_demo_acceptance',
    title: 'A101 阶梯教室验收预备会',
    location: 'A101 阶梯教室', meetingAt: iso(2 * 86400e3),
    duration: null, status: 'pending',
    audioName: null, transcript: null, minutes: null,
    projectId: 'p_classroom', actor: 'admin', demo: true,
  },
]

export function seedSmart() {
  // 演示主机
  if (!store.get('demoSmartHosts', 'sh_a101')) {
    SMART_HOSTS.forEach((h) => store.insert('demoSmartHosts', h))
  }

  // 连接器：SMART6000 集控
  if (!store.get('connectors', 'conn_smart6000')) {
    store.insert('connectors', {
      id: 'conn_smart6000', name: 'SMART6000 集控平台',
      category: 'control', type: 'mcp',
      desc: '对接 NET-6000（俗称 SMART6000）AI 型可编程媒体终端集群：一键上课/下课场景、投影/灯光/窗帘/录播集控、AI 课堂识别联动、校园多教室统一巡检。',
      scopes: ['场景联动', '设备集控', 'AI 识别', '集群巡检'],
      status: 'connected', dataSource: 'demo', lastSyncAt: new Date().toISOString(),
      owner: '林晚晴', health: 'healthy',
      demo: true, builtin: true,
      meta: { alias: 'SMART6000', model: 'NET-6000', line: '智慧教育 · AI 中控主机' },
    })
  }

  // MCP Server 登记
  if (!store.get('mcpServers', 'mcp_smart6000')) {
    store.insert('mcpServers', {
      id: 'mcp_smart6000', name: 'smart6000', label: 'SMART6000 集控平台（NET-6000）', connectorId: 'conn_smart6000',
      endpoint: 'mcp://smart-cluster.local/rpc', status: 'connected', demo: true, builtin: true,
      tools: [
        { name: 'smart.list_hosts', label: '查询中控主机集群', description: '查询 SMART6000（NET-6000）主机集群的在线状态、固件、AI 识别状态', risk: 'low', action: 'read', inputSchema: { type: 'object', properties: { status: { type: 'string', description: 'online/degraded/offline，缺省全部' } } } },
        { name: 'smart.get_host', label: '查询主机详情', description: '查询单台 NET-6000 主机的接口占用、受控设备状态、场景与运行指标', risk: 'low', action: 'read', inputSchema: { type: 'object', properties: { hostId: { type: 'string', description: '主机 ID' } }, required: ['hostId'] } },
        { name: 'smart.scene_exec', label: '执行教室场景', description: '在指定教室主机执行一键上课/一键下课/午休/考试场景（联动投影、大屏、灯光、窗帘、录播等）', risk: 'high', action: 'write', inputSchema: { type: 'object', properties: { hostId: { type: 'string', description: '主机 ID' }, scene: { type: 'string', description: 'class_start / class_end / break / exam' } }, required: ['hostId', 'scene'] } },
        { name: 'smart.device_control', label: '控制受控设备', description: '控制主机下辖单台设备（投影/大屏/灯光/窗帘/空调/摄像机/录播）', risk: 'high', action: 'write', inputSchema: { type: 'object', properties: { hostId: { type: 'string' }, device: { type: 'string', description: 'proj/screen/amp/cam/light/curtain/ac/rec' }, command: { type: 'string', description: 'on/off/open/close/standby' } }, required: ['hostId', 'device', 'command'] } },
      ],
    })
  }

  // 技能：SMART6000 场景联动（字段结构与 seed-platform 对齐）
  const existingSkill = store.get('skills', 'sk_smart_scene')
  if (existingSkill && existingSkill.status !== 'enabled') {
    // 存量库修复：旧版种子以 enabled 布尔值写入，统一升级为 status 字段
    store.update('skills', 'sk_smart_scene', { status: 'enabled' })
  }
  if (!store.get('skills', 'sk_smart_scene')) {
    store.insert('skills', {
      id: 'sk_smart_scene', name: '教室场景联动（SMART6000）', version: '1.0.0',
      domain: '智慧教育', risk: 'high', status: 'enabled',
      desc: '面向 NET-6000（SMART6000）中控主机编排一键上课/下课/午休/考试场景：自动核对主机在线状态与受控设备，生成联动执行计划，高风险场景走人工审批后下发。',
      scenario: '用户提问“A101 一键上课”“把这层教室切到考试模式”“下课了帮我关设备”。',
      inputs: [
        { name: 'scene', type: 'string', required: true, desc: '场景：class_start / class_end / break / exam' },
        { name: 'hostId', type: 'string', required: false, desc: '目标主机 ID，缺省为全部在线主机' },
        { name: 'building', type: 'string', required: false, desc: '限定楼栋，如 A栋教学楼' },
      ],
      outputs: [{ name: 'plan', type: 'object', desc: '场景执行计划：时序步骤、目标主机、阻断项' }],
      steps: ['查询主机集群在线状态', '核对受控设备故障', '生成设备联动时序计划', '提交审批闸门', '审批通过后下发执行'],
      deps: { connectors: ['conn_smart6000'], mcp: ['smart.list_hosts', 'smart.get_host', 'smart.scene_exec'] },
      failurePolicy: '主机离线或设备故障时自动排除并明确标注，不得强行下发',
      installs: 0, createdAt: new Date().toISOString(),
      builtin: true, demo: true,
    })
  }

  // 方案：智慧教室 AI 集控（字段结构与 seed-platform 对齐）
  if (!store.get('solutions', 'sol_smart6000')) {
    store.insert('solutions', {
      id: 'sol_smart6000', name: '智慧教室 AI 集控（SMART6000）', domain: 'education', icon: 'Cpu',
      tagline: '以 NET-6000（SMART6000）AI 中控为落地载体的一键上课与教室集控运维',
      pain: '教室设备分散（投影/大屏/功放/灯光/窗帘/录播），上课前逐台开关繁琐；多教室巡检靠人工跑腿，故障发现滞后。',
      desc: '围绕 SMART6000 主机集群提供：一键上课/下课/考试场景编排与审批执行、教室设备集控、AI 课堂识别状态回传、多教室统一巡检，适配高校与中小学智慧教室、报告厅、录播教室。',
      skillIds: ['sk_smart_scene', 'sk_class_inspect'], connectorIds: ['conn_smart6000', 'conn_control'],
      prompt: '把 A101 阶梯教室切到一键上课场景，先核对主机与设备状态，出执行计划待审批。',
      usedCount: 0, featured: true,
      demo: true, builtin: true, createdAt: new Date().toISOString(),
    })
  }

  // 会议演示数据
  if (!store.get('meetings', 'mt_demo_weekly')) {
    MEETINGS.forEach((m) => store.insert('meetings', m))
  }

  // 授权：把 SMART6000 能力挂到智慧教室运维项目
  const edu = store.get('projects', 'p_classroom')
  if (edu && !(edu.connectorIds || []).includes('conn_smart6000')) {
    store.update('projects', 'p_classroom', {
      connectorIds: [...(edu.connectorIds || []), 'conn_smart6000'],
      skillIds: [...new Set([...(edu.skillIds || []), 'sk_smart_scene'])],
    })
  }
}
