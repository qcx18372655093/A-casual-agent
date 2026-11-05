import { store } from './store.js'

/**
 * Creator Agent 平台扩展种子（天誉创高 CREATOR 音视频显控一体化业务）。
 * 平台域对齐公司五大主线 + 综合运维底座：
 *   ops 综合运维集控 / ecis 分布式坐席 / fsp 光纤坐席 / matrix 矩阵拼接 /
 *   control 中央控制 / conference 数字会议 / education 智慧教育
 * 所有业务系统数据均来自「演示连接器」，全程 demo: true 标识，禁止冒充真实执行结果。
 */
const now = () => new Date().toISOString()
const minutesAgo = (m) => new Date(Date.now() - m * 60 * 1000).toISOString()
const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString()
const daysAgo = (d) => new Date(Date.now() - d * 86400 * 1000).toISOString()

function skill(s) {
  return {
    version: '1.0.0',
    risk: 'low',
    status: 'enabled',
    inputs: [],
    outputs: [],
    steps: [],
    deps: { connectors: [], mcp: [] },
    failurePolicy: '连接器不可用时明确标注“无法确认”，不得编造',
    installs: 0,
    createdAt: daysAgo(14),
    ...s,
  }
}

export function seedPlatform() {
  /* ================= 连接器：对接 CREATOR 各软件平台（演示） ================= */
  const connectors = [
    {
      id: 'conn_ioms', name: '综合运维集控平台', category: 'ops', type: 'mcp',
      desc: '整网显控设备状态监控、告警、日志、资产台账与双备份管理。', scopes: ['设备状态', '告警日志', '资产台账'],
      status: 'connected', dataSource: 'demo', lastSyncAt: minutesAgo(3), owner: '陈志远', health: 'healthy',
    },
    {
      id: 'conn_ecis', name: 'ECIS 分布式管理平台', category: 'ecis', type: 'mcp',
      desc: 'IP 分布式坐席：信号预览、开窗推屏、坐席权限、KVM 切换、录像回放、分组调度。', scopes: ['坐席调度', '信号预览', '录像回放'],
      status: 'connected', dataSource: 'demo', lastSyncAt: minutesAgo(4), owner: '周启明', health: 'healthy',
    },
    {
      id: 'conn_fsp', name: 'FSP 光纤坐席管控平台', category: 'fsp', type: 'mcp',
      desc: '纯光纤非 IP 坐席：FPGA 硬件交换、物理隔离、信号调度、大屏预案、权限管理。', scopes: ['光纤调度', '大屏预案'],
      status: 'connected', dataSource: 'demo', lastSyncAt: minutesAgo(6), owner: '周启明', health: 'healthy',
    },
    {
      id: 'conn_matrix', name: '矩阵拼接处理器网关', category: 'matrix', type: 'mcp',
      desc: 'ESP-MAX 拼接与混合矩阵：信号路由、开窗漫游、预案轮巡、热备份、卡式扩容。', scopes: ['信号切换', '开窗预案'],
      status: 'connected', dataSource: 'demo', lastSyncAt: minutesAgo(5), owner: '赵以安', health: 'degraded',
    },
    {
      id: 'conn_control', name: '中控主机（图蒙/PGM）', category: 'control', type: 'mcp',
      desc: 'ThinkControl 可编程中控：一键场景、设备联动、时序上电、红外/串口/网口控制。', scopes: ['场景联动', '外设控制'],
      status: 'connected', dataSource: 'demo', lastSyncAt: minutesAgo(7), owner: '赵以安', health: 'healthy',
    },
    {
      id: 'conn_almeet', name: 'Almeet 智会云枢会务平台', category: 'conference', type: 'mcp',
      desc: '无纸化会务：会议预约、签到、议程、文件分发、投票表决、AI 转写、跨会场会商。', scopes: ['会务流程', 'AI 转写'],
      status: 'connected', dataSource: 'demo', lastSyncAt: minutesAgo(9), owner: '林晚晴', health: 'healthy',
    },
    {
      id: 'conn_lingxi', name: '灵析 AI 教学督导平台', category: 'education', type: 'mcp',
      desc: '智慧教育：课堂行为分析、录播管理、巡课督导、直播点播、教学资源管理。', scopes: ['巡课督导', '录播管理'],
      status: 'connected', dataSource: 'demo', lastSyncAt: minutesAgo(11), owner: '林晚晴', health: 'healthy',
    },
    {
      id: 'conn_rec', name: '录播流媒体网关', category: 'education', type: 'mcp',
      desc: '录播主机与流媒体：常态化录课、直播推流、点播资源、信号录制回放。', scopes: ['录播推流', '录制回放'],
      status: 'connected', dataSource: 'demo', lastSyncAt: minutesAgo(13), owner: '王工', health: 'healthy',
    },
  ]
  for (const c of connectors) store.insert('connectors', c)

  /* ================= Skill：可复用的 Agent 能力单元 ================= */
  const skills = [
    /* ---- 综合运维底座 ---- */
    skill({
      id: 'sk_alert_rca', name: '显控告警降噪与根因分析', version: '1.3.0', domain: '综合运维', risk: 'low',
      desc: '将整网编解码节点、拼接处理器、中控、矩阵、录播等多源设备告警按时间窗与链路拓扑关联，去重降噪并给出根因假设与证据链。',
      scenario: '用户提问“这批设备告警根因是什么”“哪些真正需要处理”；告警中心 AI 关联分析。',
      inputs: [
        { name: 'timeWindow', type: 'string', required: false, desc: '时间窗，如 30m / 2h，默认 30m' },
        { name: 'source', type: 'string', required: false, desc: '限定来源，如 ecis / 拼接处理器 / 中控' },
      ],
      outputs: [{ name: 'clusters', type: 'array', desc: '关联告警组：根因候选、影响面、证据' }],
      steps: ['拉取时间窗内活跃告警', '按设备/链路/时间关联去重', '识别根因告警与派生告警', '检索显控 SOP 知识库', '输出根因假设与处置建议'],
      deps: { connectors: ['conn_ioms', 'conn_kb'], mcp: ['ioms.list_alerts', 'kb.search'] },
      installs: 168,
    }),
    skill({
      id: 'sk_log_diagnose', name: '显控设备日志诊断', version: '1.0.4', domain: '综合运维', risk: 'low',
      desc: '检索中控主机、编解码节点、矩阵、录播等设备与平台日志，聚类高频错误模式，关联固件/配置变更，给出排查方向。',
      scenario: '用户提问“中控主机最近报什么错”“这批离线日志的共同原因”。',
      inputs: [
        { name: 'device', type: 'string', required: true, desc: '设备/平台，如 PGM3-3F 中控' },
        { name: 'keyword', type: 'string', required: false, desc: '关键字，如 ERROR / timeout' },
        { name: 'minutes', type: 'number', required: false, desc: '回溯分钟数，默认 30' },
      ],
      outputs: [{ name: 'patterns', type: 'array', desc: '错误模式、计数、样例与首次出现时间' }],
      steps: ['确定设备与时间窗', '检索错误日志', '聚类错误模式', '关联固件/配置变更', '输出排查方向'],
      deps: { connectors: ['conn_ioms'], mcp: ['ioms.search_logs'] },
      installs: 96,
    }),
    skill({
      id: 'sk_dq_check', name: '设备资产数据质检', version: '1.2.1', domain: '综合运维', risk: 'low',
      desc: '执行设备台账重复编号、关键字段缺失、固件版本过旧、位置标签不规范等质检，输出问题清单、影响面与趋势。',
      scenario: '用户提问“设备台账有没有问题”“多少设备标签不规范”。',
      inputs: [
        { name: 'dataset', type: 'string', required: false, desc: '台账/数据集，默认全部启用规则' },
        { name: 'ruleTypes', type: 'array', required: false, desc: '规则类型：duplicate/missing/threshold/tag' },
      ],
      outputs: [{ name: 'results', type: 'array', desc: '规则执行结果、问题数、样例与环比' }],
      steps: ['读取启用的质检规则', '拉取最新台账统计', '逐项判定并抽样', '计算环比趋势', '输出问题清单与建议'],
      deps: { connectors: ['conn_ioms'], mcp: ['ioms.list_rules', 'ioms.run_check'] },
      installs: 71,
    }),
    skill({
      id: 'sk_device_patrol', name: '整网显控设备巡检', version: '1.1.0', domain: '综合运维', risk: 'low',
      desc: '巡检整网编解码节点、拼接处理器、中控主机、矩阵、录播、触摸屏在线状态与双备份，输出异常设备与处理建议。',
      scenario: '用户提问“整网设备稳不稳”“哪个设备离线/有风险”。',
      inputs: [{ name: 'scope', type: 'string', required: false, desc: '范围，如 A 楼 / 指挥中心，默认全部' }],
      outputs: [{ name: 'devices', type: 'array', desc: '设备状态、风险等级与建议' }],
      steps: ['拉取设备清单与在线状态', '检查心跳与双备份', '检查固件与温度', '输出异常设备与建议'],
      deps: { connectors: ['conn_ioms'], mcp: ['ioms.list_devices'] },
      installs: 88,
    }),

    /* ---- 分布式坐席（ECIS / FSP） ---- */
    skill({
      id: 'sk_ecis_kvm', name: '坐席 KVM 调度与推屏', version: '1.0.0', domain: '分布式坐席', risk: 'high',
      desc: '生成坐席 KVM 调度计划：一套键鼠跨主机、跨席位推送信号上大屏、抓取大屏信号回席位；写操作先出计划待审批。',
      scenario: '用户下达“把 3 号坐席的指挥席信号推上 LED 大屏”“接管 5 号主机”等调度指令。',
      inputs: [
        { name: 'seat', type: 'string', required: true, desc: '坐席/席位，如 3 号坐席' },
        { name: 'action', type: 'string', required: true, desc: '动作，如 推屏上大屏 / 抓取回席位 / 接管主机' },
      ],
      outputs: [{ name: 'dispatchPlan', type: 'object', desc: '坐席调度计划（未执行）' }],
      steps: ['校验坐席权限与在线状态', '解析源信号与目标', '生成 KVM/推屏步骤', '定义回显校验', '输出计划待审批'],
      deps: { connectors: ['conn_ecis'], mcp: ['ecis.list_seats', 'ecis.preview'] },
      failurePolicy: '写操作未经审批不得执行；坐席离线时从计划剔除并明示',
      installs: 54,
    }),
    skill({
      id: 'sk_fsp_dispatch', name: '光纤坐席涉密调度', version: '1.0.0', domain: '光纤坐席', risk: 'high',
      desc: 'FSP 纯光纤坐席的信号调度与大屏预案：FPGA 硬件交换、物理隔离、毫秒级切换；涉密场景写操作必须人工审批。',
      scenario: '涉密/公安/电网指挥场景下达“切换应急预案”“调度光纤坐席信号”。',
      inputs: [
        { name: 'preset', type: 'string', required: true, desc: '预案名，如 应急指挥预案' },
      ],
      outputs: [{ name: 'switchPlan', type: 'object', desc: '光纤切换计划（未执行）' }],
      steps: ['校验涉密权限', '读取光纤链路状态', '生成切换与隔离步骤', '输出计划待审批'],
      deps: { connectors: ['conn_fsp'], mcp: ['fsp.list_links', 'fsp.list_presets'] },
      failurePolicy: '涉密写操作必须人工审批；物理隔离链路不得跨网调度',
      installs: 27,
    }),

    /* ---- 矩阵拼接 ---- */
    skill({
      id: 'sk_signal_preset', name: '大屏开窗漫游预案', version: '1.0.2', domain: '矩阵拼接', risk: 'high',
      desc: '生成拼接处理器开窗/漫游/叠加/预案切换计划：多画面布局、信号路由、底图字幕；写操作先出计划待审批。',
      scenario: '用户下达“把指挥中心大屏切成 2×2 监控布局”“切换到应急指挥预案”。',
      inputs: [
        { name: 'wall', type: 'string', required: true, desc: '大屏，如 指挥中心 LED 主屏' },
        { name: 'preset', type: 'string', required: true, desc: '预案/布局，如 2×2 监控 / 应急指挥' },
      ],
      outputs: [{ name: 'wallPlan', type: 'object', desc: '大屏预案计划（未执行）' }],
      steps: ['读取大屏与输入源状态', '解析目标布局/预案', '生成开窗与路由步骤', '输出计划待审批'],
      deps: { connectors: ['conn_matrix'], mcp: ['matrix.list_inputs', 'matrix.list_presets'] },
      failurePolicy: '写操作未经审批不得执行；热备份链路优先',
      installs: 49,
    }),
    skill({
      id: 'sk_matrix_batch', name: '矩阵设备灰度批量控制', version: '0.9.0', domain: '矩阵拼接', risk: 'high',
      desc: '将矩阵/拼接设备批量操作（固件升级、链路切换、参数下发）拆解为分批灰度计划：分组、批次、回执校验与失败熔断。',
      scenario: '用户下达“把 3 号厅全部矩阵切到备用链路”“批量升级拼接卡固件”。',
      inputs: [
        { name: 'group', type: 'string', required: true, desc: '设备分组，如 3 号厅' },
        { name: 'action', type: 'string', required: true, desc: '批量动作，如 切换链路/固件升级/参数下发' },
      ],
      outputs: [{ name: 'batchPlan', type: 'object', desc: '分批灰度计划（未执行）' }],
      steps: ['解析分组与动作', '读取设备在线状态', '生成分批与灰度顺序', '定义回执校验与熔断条件', '输出计划待审批'],
      deps: { connectors: ['conn_matrix'], mcp: ['matrix.list_devices'] },
      failurePolicy: '写操作未经审批不得执行；设备离线时从批次剔除并明示',
      installs: 33,
    }),

    /* ---- 中央控制 ---- */
    skill({
      id: 'sk_scene_exec', name: '中控一键场景联动', version: '1.1.0', domain: '中央控制', risk: 'high',
      desc: '生成中控一键场景执行计划：开会/散会/观影/应急模式下大屏、矩阵、灯光、窗帘、功放、摄像机、空调的联动与时序上电。',
      scenario: '用户下达“3 号会议室进入开会模式”“报告厅切换应急模式”。',
      inputs: [
        { name: 'room', type: 'string', required: true, desc: '房间，如 3 号会议室' },
        { name: 'scene', type: 'string', required: true, desc: '场景，如 开会 / 散会 / 应急 / 观影' },
      ],
      outputs: [{ name: 'scenePlan', type: 'object', desc: '场景联动计划（未执行）' }],
      steps: ['读取房间设备在线状态', '解析场景联动序列', '编排时序上电顺序', '定义反馈校验', '输出计划待审批'],
      deps: { connectors: ['conn_control'], mcp: ['control.list_devices', 'control.list_scenes'] },
      failurePolicy: '写操作未经审批不得执行；涉电设备时序错误可能损坏设备，必须按序',
      installs: 92,
    }),

    /* ---- 数字会议 ---- */
    skill({
      id: 'sk_meeting_assist', name: '会务全流程助手', version: '1.0.0', domain: '数字会议', risk: 'low',
      desc: '覆盖会前-会中-会后：会议预约、签到统计、议程与文件分发、投票表决汇总、AI 转写与会议纪要生成。',
      scenario: '用户提问“帮我整理今天常务会纪要”“统计签到与表决结果”。',
      inputs: [
        { name: 'meeting', type: 'string', required: false, desc: '会议名，默认最近一场' },
        { name: 'action', type: 'string', required: false, desc: '动作，如 纪要 / 签到 / 表决' },
      ],
      outputs: [{ name: 'minutes', type: 'object', desc: '纪要/签到/表决结果' }],
      steps: ['读取会议议程与签到', '汇总投票表决', '调取 AI 转写文本', '生成结构化纪要'],
      deps: { connectors: ['conn_almeet'], mcp: ['almeet.list_meetings', 'almeet.transcript'] },
      installs: 63,
    }),

    /* ---- 智慧教育 ---- */
    skill({
      id: 'sk_class_inspect', name: '智慧教室巡课录播巡检', version: '1.0.0', domain: '智慧教育', risk: 'low',
      desc: '巡检多间教室的录播状态、扩声、中控在线情况，汇总巡课与 AI 课堂行为分析结果，远程发现异常教室。',
      scenario: '用户提问“巡一遍教学楼教室”“哪些教室录播/扩声异常”。',
      inputs: [{ name: 'building', type: 'string', required: false, desc: '楼栋，默认全部' }],
      outputs: [{ name: 'rooms', type: 'array', desc: '教室录播/扩声/中控状态与异常项' }],
      steps: ['拉取教室设备清单', '检查录播与扩声状态', '汇总 AI 课堂分析', '输出异常教室与建议'],
      deps: { connectors: ['conn_lingxi', 'conn_rec'], mcp: ['lingxi.list_rooms', 'rec.status'] },
      installs: 41,
    }),
  ]
  for (const s of skills) store.insert('skills', s)

  /* ================= 显控运维 SOP 知识空间（经验沉淀） ================= */
  const sopSpace = store.insert('spaces', {
    id: 'sp_av_sop', name: '显控运维 SOP 与故障案例库', scope: 'team',
    desc: '沉淀指挥中心/会议室/报告厅/智慧教室的显控设备排障流程、运维手册与 SOP 规范，新人可直接提问获得标准流程。',
    docCount: 6, indexed: true, owner: '陈志远', builtin: true, updatedAt: daysAgo(2),
  })

  const docs = [
    {
      title: '大屏无信号 / 黑屏排查 SOP',
      tags: ['大屏', '无信号', '黑屏', '拼接', 'SOP'],
      content:
        '一、定界：确认是整屏黑屏还是单窗口无信号；整屏黑屏优先查拼接处理器与主信号链路，单窗口查对应输入源。' +
        '二、链路排查：信号源 → 编码节点(ECIS)/光纤节点(FSP) → 网络/光纤 → 解码/拼接处理器 → 大屏，逐段确认。' +
        '三、高频原因：POE 交换机端口拥塞导致编解码丢包；拼接处理器输入通道松动；预案被误切换；光纤模块收光弱。' +
        '四、处置：先切热备份链路恢复显示，再定位故障段；涉密 FSP 链路严禁跨网调度。' +
        '五、升级标准：指挥/涉密场景中断超 5 分钟立即升级现场工程师并启用应急预案。版本 v2.1。',
    },
    {
      title: '坐席 KVM 切换 / 推屏失败排查 SOP',
      tags: ['KVM', '坐席', '推屏', 'ECIS', 'SOP'],
      content:
        '一、确认现象：是键鼠接管失败、推屏上大屏失败，还是抓取大屏信号回席位失败。' +
        '二、权限校验：ECIS 平台确认该坐席对目标主机/大屏是否有调度权限，权限不足是最常见原因。' +
        '三、状态排查：确认编码/解码节点在线、码流正常、USB 透传链路无中断。' +
        '四、网络：跨楼宇调度确认骨干带宽与丢包，坐席预览回显卡顿时优先降码率。' +
        '五、处置：权限问题走授权流程；节点离线先重启节点；仍失败升级平台厂商支持。',
    },
    {
      title: '中控场景不联动排查手册',
      tags: ['中控', '场景', '联动', 'PGM', 'SOP'],
      content:
        '一、定位：确认是整个场景不执行，还是某一路设备（灯光/窗帘/矩阵/功放）不动作。' +
        '二、脚本：ThinkControl 检查场景脚本逻辑与时序，涉电设备必须按序上电，时序错误会导致联动中断。' +
        '三、链路：被控设备不走中控的常见原因——矩阵/大屏未回执、RS232/485 接线松动、红外码库不匹配。' +
        '四、验证：单步手动下发指令定位到具体设备，再回看脚本等待与回执判断。' +
        '五、禁止：未确认回执连续重发涉电指令，可能冲击设备。',
    },
    {
      title: '会议室话筒无声 / 音频故障处置',
      tags: ['话筒', '无声', '音频', '扩声', 'SOP'],
      content:
        '一、定界：单只话筒无声还是整室无声；整室无声查音频处理器/功放，单只查话筒单元与拾音。' +
        '二、链路：话筒 → 音频处理器(反馈抑制/混音) → 功放 → 音箱；无纸化终端另查网络音频。' +
        '三、高频原因：话筒未开麦/主席优先静音、音频处理器输入通道静音、反馈抑制器误触发、功放保护。' +
        '四、处置：中控确认场景已开麦开音；逐级监听定位断点；啸叫先降增益再查反馈抑制。' +
        '五、智慧教室吊麦阵列无声，优先确认录播主机与扩声麦联机状态。',
    },
    {
      title: '录播 / 直播失败排查流程',
      tags: ['录播', '直播', '流媒体', 'SOP'],
      content:
        '一、确认：是录制未启动、无画面、无声音，还是直播推流失败。' +
        '二、信号：录播主机是否收到摄像机/教师画面与吊麦音频，采集终端在线与否。' +
        '三、资源：录播主机磁盘空间、流媒体网关推流地址与带宽、平台点播服务状态。' +
        '四、处置：先手动触发补录保现场，再排查采集与推流；常态化录播失败核对课程表联动。' +
        '五、登记：故障课程与时段登记，便于课后补录与资源补传。',
    },
    {
      title: '显控告警分级与降噪管理规范',
      tags: ['告警', '降噪', '分级', '规范'],
      content:
        '一、分级：P1 指挥/会议/教学中断（电话+短信）、P2 核心功能受损（IM）、P3 趋势与容量（工单）、P4 提示（仅看板）。' +
        '二、降噪：同设备同指标 5 分钟窗口聚合；根因告警与派生告警关联后只通知根因；抖动类连续 3 次才触发。' +
        '三、无效治理：每月统计 Top 噪声告警（如触摸屏心跳抖动、短时离线自恢复），无处置动作的降级或下线。' +
        '四、AI 辅助：告警中心自动关联同一时间窗内编解码/拼接/中控/矩阵/录播告警，输出根因候选，人工确认后沉淀案例。',
    },
  ]
  docs.forEach((d, i) => {
    store.insert('documents', {
      id: `doc_sop_${i + 1}`,
      spaceId: sopSpace.id,
      title: d.title,
      tags: d.tags,
      content: d.content,
      version: i === 0 ? 'v2.1' : 'v1.0',
      source: '内部沉淀',
      indexed: true,
      updatedAt: daysAgo(i + 2),
    })
  })

  /* ================= 显控告警风暴数据（降噪演示） ================= */
  // 事件一：指挥中心 LED 主屏信号中断（根因在 ECIS 编码链路，其余为派生/噪声）
  const incident1Alerts = [
    { id: 'AL-3001', source: 'ecis-node', target: 'ECIS-OUT-LED-01', metric: 'video_loss_rate', severity: 'critical', title: '大屏输出节点视频流丢包 38%', message: 'LED 主屏花屏/黑屏，丢包率超阈值 5%', value: 38, unit: '%', status: 'active', firedAt: minutesAgo(26) },
    { id: 'AL-3002', source: 'switch', target: 'POE-SW-A2', metric: 'port_util', severity: 'critical', title: 'POE 交换机端口流量饱和 96%', message: '编解码上行端口拥塞', value: 96, unit: '%', status: 'active', firedAt: minutesAgo(28) },
    { id: 'AL-3003', source: 'matrix', target: 'ESP-MAX-01', metric: 'input_signal', severity: 'warning', title: '拼接处理器输入通道 3 无信号', message: '对应输入源码流中断', value: 0, unit: '', status: 'active', firedAt: minutesAgo(22) },
    { id: 'AL-3004', source: 'ecis-seat', target: 'KVM-05', metric: 'push_timeout', severity: 'warning', title: '坐席 KVM-05 推屏超时', message: '推屏上大屏失败，回显异常', value: 5, unit: 's', status: 'active', firedAt: minutesAgo(19), related: true },
    { id: 'AL-3005', source: 'ecis-node', target: 'ECIS-OUT-LED-01', metric: 'video_loss_rate', severity: 'warning', title: '视频流丢包告警（重复）', message: '同源重复触发', value: 31, unit: '%', status: 'active', firedAt: minutesAgo(20), dedupKey: 'AL-3001' },
  ]
  // 事件二：3 号无纸化会议室「开会模式」中控联动失败
  const incident2Alerts = [
    { id: 'AL-3010', source: 'control', target: 'PGM3-3F', metric: 'scene_exec', severity: 'critical', title: '中控场景脚本执行超时', message: '开会模式联动未在阈值内完成', value: 30, unit: 's', status: 'active', firedAt: minutesAgo(11) },
    { id: 'AL-3011', source: 'matrix', target: 'MATRIX-3F', metric: 'switch_ack', severity: 'critical', title: '矩阵 HDMI 通道 2 切换无回执', message: '中控未收到切换回执', value: 0, unit: '', status: 'active', firedAt: minutesAgo(12) },
    { id: 'AL-3012', source: 'audio', target: 'MIC-ARRAY-3F', metric: 'audio_level', severity: 'warning', title: '话筒阵列无声', message: '扩声通道无音频电平', value: 0, unit: 'dB', status: 'active', firedAt: minutesAgo(10) },
    { id: 'AL-3013', source: 'control', target: 'PGM3-3F', metric: 'scene_exec', severity: 'warning', title: '场景执行超时告警（重复）', message: '同源重复触发', value: 28, unit: 's', status: 'active', firedAt: minutesAgo(9), dedupKey: 'AL-3010' },
  ]
  // 噪声/抖动告警（不该打扰人）
  const noiseAlerts = [
    { id: 'AL-3020', source: 'touch', target: 'TP-5F', metric: 'heartbeat', severity: 'warning', title: '触摸屏 TP-5F 心跳抖动', message: '丢失 2 次心跳后自行恢复', value: 2, unit: '次', status: 'recovered', firedAt: minutesAgo(40) },
    { id: 'AL-3021', source: 'rec', target: 'REC-02', metric: 'ntp_drift', severity: 'info', title: '录播主机 REC-02 校时漂移', message: '单次 NTP 漂移，已校正', value: 320, unit: 'ms', status: 'recovered', firedAt: minutesAgo(35) },
    { id: 'AL-3022', source: 'ecis-seat', target: 'KVM-12', metric: 'online', severity: 'info', title: '坐席 KVM-12 短时离线', message: '离线 30 秒后自动恢复，疑似重启', value: 30, unit: 's', status: 'recovered', firedAt: minutesAgo(30) },
  ]
  for (const a of [...incident1Alerts, ...incident2Alerts, ...noiseAlerts]) {
    store.insert('opsAlerts', { kind: 'root', acknowledged: false, assignee: null, tags: [], ...a })
  }

  /* ================= 事件（AI 关联分析结果） ================= */
  store.insert('incidents', {
    id: 'inc_001',
    title: '指挥中心 LED 主屏信号中断（ECIS 编码链路拥塞）',
    status: 'investigating', severity: 'P1', domain: 'ecis', source: 'AI 关联分析',
    alertIds: ['AL-3001', 'AL-3002', 'AL-3003', 'AL-3004'],
    suppressedIds: ['AL-3005'],
    rootCause: 'POE 交换机 A2 上行端口流量饱和（96%），导致 ECIS 编解码丢包 38%，大屏输出节点码流中断，拼接处理器对应输入无信号，坐席推屏超时。',
    confidence: 'high',
    suggested: ['切换大屏至热备份链路恢复显示', '扩容/分流 POE-SW-A2 上行端口', '排查突发流量源（录播/预览回显）', '为指挥中心链路启用带宽预留'],
    sopDocId: 'doc_sop_1',
    impact: '指挥中心 LED 主屏黑屏约 8 分钟，未影响涉密业务',
    assignee: '陈志远', firedAt: minutesAgo(26), aiAnalyzed: true,
  })
  store.insert('incidents', {
    id: 'inc_002',
    title: '3 号无纸化会议室「开会模式」中控联动失败',
    status: 'open', severity: 'P2', domain: 'control', source: 'AI 关联分析',
    alertIds: ['AL-3010', 'AL-3011', 'AL-3012'],
    suppressedIds: ['AL-3013'],
    rootCause: '中控场景脚本在矩阵 HDMI 通道 2 切换处未收到回执，联动时序中断，导致大屏未切换、话筒阵列未开音。',
    confidence: 'high',
    suggested: ['手动单步下发矩阵切换定位回执链路', '检查 MATRIX-3F 串口/网口接线', '场景脚本增加回执等待与超时分支', '会议前做一次联动自检'],
    sopDocId: 'doc_sop_3',
    impact: '3 号会议室开会模式需手动补救，会议延迟约 5 分钟',
    assignee: null, firedAt: minutesAgo(12), aiAnalyzed: false,
  })

  /* ================= 设备资产数据质量 ================= */
  const dq = [
    {
      id: 'dq_asset_dup', name: '设备资产编号重复检查', dataset: 'asset.device', type: 'duplicate',
      severity: 'P1', enabled: true, owner: '林晚晴', schedule: '每小时',
      lastRunAt: minutesAgo(18), lastStatus: 'failed', lastCount: 14, previousCount: 3, trend: 'up',
      detail: '发现 14 条设备编号重复记录，集中在新录入的 ECIS 编解码节点批次，疑似批量导入未去重。',
      sample: ['ECIS4C-0088', 'ECIS4C-0091', 'ESP-MAX-0012'],
    },
    {
      id: 'dq_asset_missing', name: '设备关键字段缺失检查', dataset: 'asset.device', type: 'missing',
      severity: 'P2', enabled: true, owner: '林晚晴', schedule: '每日',
      lastRunAt: hoursAgo(3), lastStatus: 'warning', lastCount: 37, previousCount: 33, trend: 'flat',
      detail: '安装位置或责任人为空的设备 37 台，占新入库 6.2%，影响巡检派单。',
      sample: ['PGM3-3F（缺责任人）', 'TP-5F（缺安装位置）'],
    },
    {
      id: 'dq_fw_threshold', name: '固件版本基线检查', dataset: 'asset.device', type: 'threshold',
      severity: 'P2', enabled: true, owner: '周启明', schedule: '每日',
      lastRunAt: minutesAgo(18), lastStatus: 'warning', lastCount: 6, previousCount: 0, trend: 'up',
      detail: '6 台拼接卡/编解码节点固件低于安全基线 v3.2，存在已知漏洞，建议纳入升级计划。',
      sample: ['ESP-MAX-0007: v2.9', 'ECIS2C-0033: v3.0'],
    },
    {
      id: 'dq_tag_spec', name: '设备位置标签规范检查', dataset: 'asset.device', type: 'tag',
      severity: 'P3', enabled: true, owner: '赵以安', schedule: '每周',
      lastRunAt: hoursAgo(20), lastStatus: 'passed', lastCount: 2, previousCount: 11, trend: 'down',
      detail: '位置标签不符合「楼栋-楼层-房间」规范的设备 2 台，较上周 11 台明显改善。',
      sample: ['MIC-ARRAY-3F: 标签=三楼（缺房间号）'],
    },
  ]
  for (const r of dq) {
    const inserted = store.insert('dqRules', r)
    store.insert('dqRuns', {
      ruleId: inserted.id, runAt: inserted.lastRunAt, status: inserted.lastStatus,
      issueCount: inserted.lastCount, previousCount: inserted.previousCount,
    })
  }

  /* ================= Agent 方案中心（按平台域 + 经典工程方案，一键装配） ================= */
  const solutions = [
    /* ---- 综合运维底座（featured） ---- */
    {
      id: 'sol_ops_rca', name: '显控告警智能降噪', domain: 'ops', icon: 'BellRing',
      tagline: '把几十条设备告警变成 1 个根因',
      pain: '指挥中心/会议室/教室设备众多，告警风暴下重复与派生告警淹没真正根因，夜间被无效告警打扰。',
      desc: 'AI 关联同一时间窗内编解码、拼接、中控、矩阵、录播等设备告警，自动去重分组、识别根因、匹配 SOP 并给出处置建议。',
      skillIds: ['sk_alert_rca', 'sk_log_diagnose'], connectorIds: ['conn_ioms', 'conn_kb'],
      prompt: '分析过去 30 分钟的设备告警，降噪分组并给出根因、影响面和处置建议。',
      usedCount: 168, featured: true,
    },
    {
      id: 'sol_ops_kb', name: '显控运维知识问答', domain: 'ops', icon: 'BookOpen',
      tagline: '把少数专家的经验变成全员可问的标准流程',
      pain: '大屏黑屏、KVM 推屏失败、中控不联动等排障经验集中在少数工程师傅手中，人员流动即经验流失。',
      desc: '将显控故障案例、排查流程、运维手册与 SOP 规范统一沉淀到知识空间，Agent 带来源引用回答“大屏无信号怎么查”等问题。',
      skillIds: ['sk_knowledge'], connectorIds: ['conn_kb'],
      prompt: '指挥中心大屏突然无信号，请给出标准排查流程。',
      usedCount: 132, featured: true,
    },
    {
      id: 'sol_device_patrol', name: '整网设备智能巡检', domain: 'ops', icon: 'Radar',
      tagline: '一句话巡遍整网显控设备',
      pain: '编解码节点、拼接处理器、中控、矩阵、录播分散在各楼宇，人工巡检耗时且易漏。',
      desc: 'Agent 巡检整网设备在线状态、双备份、固件与温度，输出异常设备与处理建议，可定时巡检并生成报告。',
      skillIds: ['sk_device_patrol', 'sk_alert_rca'], connectorIds: ['conn_ioms', 'conn_kb'],
      prompt: '巡检整网显控设备，输出异常设备、风险等级与处理建议。',
      usedCount: 88, featured: true,
    },
    {
      id: 'sol_dq', name: '设备资产数据治理', domain: 'ops', icon: 'ShieldCheck',
      tagline: '台账重复、缺字段、错标签自动发现',
      pain: '设备资产台账靠人工维护，编号重复、字段缺失、标签不规范，影响巡检派单与盘点。',
      desc: 'Agent 按规则质检设备台账重复编号、关键字段缺失、固件版本与位置标签规范，输出问题清单与治理建议。',
      skillIds: ['sk_dq_check'], connectorIds: ['conn_ioms'],
      prompt: '跑一遍设备资产台账质检，按严重度输出问题清单和治理建议。',
      usedCount: 71, featured: false,
    },

    /* ---- 分布式坐席（方案 A 指挥中心 / 涉密 FSP） ---- */
    {
      id: 'sol_cmd_center', name: '指挥中心显控一体化', domain: 'ecis', icon: 'MonitorDot',
      tagline: '坐席 KVM 调度 + 大屏预案 + 中控联动',
      pain: '指挥中心信号多、坐席多，跨席位调度、推屏上大屏、应急切换靠人工逐台操作，慢且易错。',
      desc: 'ECIS 分布式坐席统一调度：一套键鼠跨主机、一键推屏上 LED 大屏、抓取回席位；配合拼接预案与中控联动，保存应急预案一键切换。',
      skillIds: ['sk_ecis_kvm', 'sk_signal_preset', 'sk_scene_exec'], connectorIds: ['conn_ecis', 'conn_matrix', 'conn_control'],
      prompt: '把 3 号坐席的指挥席信号推上指挥中心 LED 主屏，并切换大屏为应急指挥布局，先出调度计划。',
      usedCount: 76, featured: true,
    },
    {
      id: 'sol_fsp_secure', name: '涉密光纤坐席管控', domain: 'fsp', icon: 'ShieldAlert',
      tagline: '纯光纤物理隔离，涉密指挥安全调度',
      pain: '公安/电网/涉密指挥场景要求物理隔离、毫秒级、无丢包，IP 方案不满足保密要求。',
      desc: 'FSP 纯光纤坐席：FPGA 硬件交换、物理隔离、大屏预案调度；所有切换先出计划，涉密写操作强制人工审批，全程留痕可审计。',
      skillIds: ['sk_fsp_dispatch', 'sk_alert_rca'], connectorIds: ['conn_fsp', 'conn_ioms'],
      prompt: '切换到应急指挥预案，把涉密信号调度到指挥席，先出切换计划待审批。',
      usedCount: 27, featured: false,
    },

    /* ---- 矩阵拼接（方案 D 报告厅） ---- */
    {
      id: 'sol_matrix_hall', name: '报告厅大屏拼接管控', domain: 'matrix', icon: 'LayoutGrid',
      tagline: '开窗漫游预案，一键切换多画面布局',
      pain: '报告厅/多功能厅信号切换、多画面开窗漫游靠手动操作矩阵，会议中切换慢、出错影响汇报。',
      desc: '拼接处理器开窗、漫游、叠加、底图字幕与预案轮巡；矩阵批量操作走灰度计划与回执校验，高风险写操作人工审批。',
      skillIds: ['sk_signal_preset', 'sk_matrix_batch'], connectorIds: ['conn_matrix', 'conn_ioms'],
      prompt: '把报告厅大屏切换为 2×2 监控布局并轮巡预案，先出开窗计划。',
      usedCount: 58, featured: false,
    },

    /* ---- 中央控制（联动大脑） ---- */
    {
      id: 'sol_control_scene', name: '中控一键场景联动', domain: 'control', icon: 'SlidersHorizontal',
      tagline: '开会/散会/应急，一句话联动全场设备',
      pain: '会议室、报告厅设备多（大屏、矩阵、灯光、窗帘、功放、摄像机、空调），开会前要逐台开关，繁琐且易漏。',
      desc: '中控一键场景：开会/散会/观影/应急模式下设备联动与时序上电；自然语言发起，高风险涉电操作经审批执行，全程留痕。',
      skillIds: ['sk_scene_exec', 'sk_device_patrol'], connectorIds: ['conn_control', 'conn_ioms'],
      prompt: '3 号会议室进入开会模式，联动大屏、矩阵、灯光、功放，先出场景执行计划。',
      usedCount: 92, featured: false,
    },

    /* ---- 数字会议（方案 B 无纸化会议室） ---- */
    {
      id: 'sol_conference', name: '无纸化智慧会议室', domain: 'conference', icon: 'Presentation',
      tagline: '会前-会中-会后全流程 + AI 会议纪要',
      pain: '会议预约、签到、材料分发、表决、纪要分散在多个环节，会后整理纪要耗时。',
      desc: 'Almeet 会务全流程：会前预约签到、材料分发；会中无纸化批注、投票表决、发言管理；会后 AI 转写自动生成会议纪要；中控一键切换会议模式。',
      skillIds: ['sk_meeting_assist', 'sk_scene_exec'], connectorIds: ['conn_almeet', 'conn_control'],
      prompt: '整理今天上午常务会的签到、表决结果，并根据 AI 转写生成会议纪要。',
      usedCount: 63, featured: false,
    },

    /* ---- 智慧教育（方案 C 智慧教室） ---- */
    {
      id: 'sol_education', name: '智慧教室 AI 督导', domain: 'education', icon: 'GraduationCap',
      tagline: '巡课录播一键巡检，AI 课堂分析',
      pain: '多间教室的录播、扩声、中控分散，巡课与设备检查靠人工跑腿，录课失败常课后才发现。',
      desc: '灵析督导 + 录播：常态化录课、巡课、AI 课堂行为分析；中控一键切换上课/录播/休息模式，远程巡检多间教室，异常即时上报。',
      skillIds: ['sk_class_inspect', 'sk_device_patrol'], connectorIds: ['conn_lingxi', 'conn_rec', 'conn_gateway'],
      prompt: '巡一遍教学楼全部智慧教室，输出录播/扩声异常的教室与处理建议。',
      usedCount: 41, featured: false,
    },
  ]
  for (const s of solutions) store.insert('solutions', s)

  return { sopSpace }
}
