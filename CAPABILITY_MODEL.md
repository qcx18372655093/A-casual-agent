# Creator 能力体系分析：MCP 协议 · Tool · Skill 的定义与拓展

> 本文基于当前代码库逐层分析三件事：**MCP 统一协议怎么定义、Tool 怎么定义/使用/拓展、Skill 怎么定义/拓展**，并给出"让用户使用更方便"的可落地改进方案。
> 关键源码位置均已标注，便于按图索骥。

---

## 0. 总览：四层能力模型

当前项目的能力体系是一个**自研轻量级 MCP 风格协议**（不是 Anthropic 官方 MCP 协议的完整实现，但同构），自下而上分四层：

```
┌─────────────────────────────────────────────────────────┐
│  LLM 编排层  backend/src/llm.js                                │
│  两阶段：JSON 决策(选工具) → 执行 → 流式答复                │
├─────────────────────────────────────────────────────────┤
│  Skill 层  backend/src/skills.js                               │
│  任务能力单元 = 元数据声明 + 确定性执行器(EXECUTORS)         │
│  对外形态：skill.xxx 工具                                  │
├─────────────────────────────────────────────────────────┤
│  MCP Tool 层  backend/src/mcp.js                               │
│  原子工具注册表 MCP_TOOLS = { name → execute() }           │
│  声明形态：mcpServers[].tools[]（desc/risk/schema）         │
├─────────────────────────────────────────────────────────┤
│  Connector 层  connectors / mcpServers 集合（store.js）     │
│  外部系统的"授权与连接"边界：状态、权限范围、数据分级         │
└─────────────────────────────────────────────────────────┘
```

一句话理解三者关系：**Connector 解决"连得上"，MCP Tool 解决"能做什么原子操作"，Skill 解决"为完成一类任务把多个工具按章法组合起来"**。LLM 只认识两类可调用物：`skill.*`（技能工具）与 `<server>.<action>`（MCP 工具）。

---

## 1. MCP 统一协议怎么定义

### 1.1 三级数据模型（store.js 三个集合）

**① Connector（连接器）— `connectors` 集合**（种子见 `seed.js` / `seed-platform.js`）

```js
{
  id: 'conn_ecis',
  name: 'ECIS 分布式管理平台',
  category: 'ecis',            // 业务域分类
  protocol: 'MCP',             // 协议标识
  env: '生产',                  // 环境
  owner: '周启明',              // 维护方
  scopes: ['坐席调度', '信号预览'], // 权限范围（声明）
  desc: '...',
  status: 'connected',         // disconnected | connected ← 授权闸门
  dataSource: 'demo',          // demo | custom ← 演示数据标注源头
  builtin: true,               // 预置不可删；custom:true 为用户自建
}
```

**② MCP Server（适配服务）— `mcpServers` 集合**（`seed.js:186`）

一个连接器下挂一个适配服务，携带审计元信息与工具清单：

```js
{
  id: 'mcp_gateway',
  name: 'edu-device-gateway',
  version: '1.4.2',
  connectorId: 'conn_gateway',      // 绑定连接器
  dataClassification: '内部',        // 数据分级
  risk: 'medium',
  networkTarget: 'gateway.test.internal:8443',
  status: 'audited',
  tools: [ /* 见 ③ */ ],
}
```

**③ Tool 声明 — `mcpServers[].tools[]`**（`seed.js:196`）

```js
{
  name: 'gateway.reboot_device',
  desc: '重启指定设备（高风险：造成分钟级服务中断，需审批）',
  sideEffect: 'write',             // read | write ← 模式策略闸门依据
  risk: 'high',                    // low | medium | high ← 审批闸门依据
  schema: {                        // JSON Schema，注入 LLM 决策提示词
    type: 'object',
    properties: { deviceId: { type: 'string' }, reason: { type: 'string' } },
    required: ['deviceId', 'reason'],
  },
}
```

### 1.2 命名与返回契约（协议的核心约束）

- **工具命名**：`<server前缀>.<动作>`，如 `gateway.list_devices`、`workorder.create_ticket`、`kb.search`。前缀即归属的 MCP Server。
- **统一返回契约**（`mcp.js` 所有 execute 的返回）：

```js
// 成功
{ ok: true, demo: true, data: {...}, sources: ['XX平台（演示连接器）'] }
// 失败
{ ok: false, error: '人类可读的失败原因' }
```

- **demo 标注铁律**：演示连接器返回必须 `demo: true`，沿链路传递 `step.demo → task.demo → AI 答复显著标注「演示数据」`（`llm.js:330-339`）。
- **写操作附加约束**：支持 `ctx.approvalId`（审批上下文回写）与幂等（`workorder.create_ticket` 用 `clientRequestId` 去重，防重试产生重复工单）。

### 1.3 执行入口与授权链（`mcp.js:304-337`）

```js
getAvailableMcpTools(connectorIds)  // 过滤：连接器 connected + 在项目授权清单内 → 产出给 LLM 的工具清单
executeMcpTool(name, args, ctx)     // 检查：工具已登记 → 连接器 connected → execute() → 异常兜底为 {ok:false}
```

授权链是双重闸门：**连接器级**（connected 才可用）× **项目级**（在项目 connectorIds 内才对该项目可见）。

### 1.4 与官方 MCP 协议的差异（现状定位）

| 维度 | 官方 MCP | 本项目现状 |
|---|---|---|
| 传输 | stdio / Streamable HTTP | 进程内函数调用（无网络传输） |
| 工具发现 | `tools/list` 动态发现 | 静态注册表 `MCP_TOOLS` + 种子声明 |
| Schema | JSON Schema | 同构（已采用） |
| 鉴权 | OAuth 等 | connector.status + 项目授权（自研闸门） |

**结论**：当前是"协议语义同构、传输本地化"的实现。优点是演示/审批/审计链路完全可控；代价是新增工具需要改代码（见第 4 节改进方案）。

---

## 2. Tool 怎么定义、使用、拓展

### 2.1 定义：声明 + 实现两处配对

一个 MCP 工具的完整定义 = **静态声明**（`mcpServers[].tools[]`，给 LLM 和人看）+ **运行时实现**（`MCP_TOOLS` 注册表，给系统执行）：

```js
// backend/src/mcp.js — 实现侧
'gateway.list_devices': {
  serverId: 'mcp_gateway',
  connectorId: 'conn_gateway',
  desc: '查询设备台账清单，可按楼栋、类型、状态过滤',
  sideEffect: 'read',
  risk: 'low',
  execute(args) {
    // args 即 LLM 按 schema 填的参数；返回统一契约
    return { ok: true, demo: true, data: { total, devices } }
  },
}
```

### 2.2 使用链路（LLM 如何用上工具）

`backend/src/llm.js` 两阶段编排：

1. **决策阶段**（`buildDecisionPrompt`，非流式、temperature=0）：把项目可用的 skill 工具与 MCP 工具以"名称｜来源｜只读/写｜风险｜描述｜参数 Schema"逐行注入提示词，模型只许输出一个 JSON：`{"action":"answer"}` / `{"action":"tool","name","arguments"}` / `{"action":"plan","plan"}`。
2. **执行阶段**（`runTaskLoop`）：
   - `resolveToolDescriptor` 在可用清单里解析工具（未授权/未登记 → 以 `<tool_result>` 告知模型"工具不可用"）；
   - **模式策略闸门**：`ask` 与未确认的 `plan` 模式禁止 write 工具（拦截并记录策略步骤）；
   - **高风险闸门**：`risk === 'high'` 自动创建审批单，任务挂起 `waiting_approval`，审批通过后 `resumeWithApprovedTool` 续跑；
   - 执行结果以 `<tool_result name="..." demo="...">JSON</tool_result>` 写回模型上下文。
3. **答复阶段**（`buildAnswerPrompt`，流式 SSE）：独立提示词，纯正文输出，强制 demo 标注与"观测事实/可能原因/建议措施/已执行操作"四段式诊断结构。

### 2.3 拓展现状

| 方式 | 入口 | 结果 |
|---|---|---|
| 预置 | `seed.js` / `seed-platform.js` 种子里声明 mcpServers + 在 `mcp.js` 写 execute | 完整可用 |
| 新建/导入连接器 | `POST /api/connectors` / `/api/connectors/import`（`ingest.js` 校验） | **只完成登记**：无 MCP Server、无工具声明、无执行体，AI 无法调用 |

**关键缺口①**：自定义连接器是"空壳"——没有 tools 声明，也没有 execute 实现，`getAvailableMcpTools` 永远过滤不到它。用户建了连接器、点了授权，AI 依然用不上。

---

## 3. Skill 怎么定义、使用、拓展

### 3.1 定义：元数据（`skills` 集合）+ 执行器（`EXECUTORS`）

**元数据**（`seed-platform.js:80` 示例）：

```js
{
  id: 'sk_alert_rca',
  name: '显控告警降噪与根因分析',
  version: '1.3.0', domain: '综合运维', risk: 'low',
  desc: '...',                      // 能力描述（注入 LLM）
  scenario: '...',                  // 适用场景（注入 LLM，帮助模型选技能）
  inputs: [{ name: 'timeWindow', type: 'string', required: false, desc: '时间窗，如 30m' }],
  outputs: [{ name: 'clusters', type: 'array', desc: '...' }],
  steps: ['拉取告警', '关联去重', ...],   // 声明的步骤（展示+约束）
  deps: { connectors: ['conn_ioms'], mcp: ['ioms.list_alerts'] },  // 依赖声明
  failurePolicy: '连接器不可用时明确标注"无法确认"，不得编造',
  status: 'enabled', installs: 168,
  builtin: true,                    // 或 custom: true
}
```

**执行器**（`skills.js` 的 `EXECUTORS`）：`skillId → 函数`，做**确定性数据汇聚**（查库、调 MCP 工具、检索知识库），返回证据包 `{ok, demo, data, sources}`；**推理与成文交给 LLM**（Skill 嵌入大模型调用链，而非端到端自动化脚本）。

**名称绑定**：`SKILL_TOOL_MAP` 把对外工具名映射到 skillId，如 `'skill.alert_root_cause' → 'sk_alert_rca'`。

### 3.2 暴露给 LLM 的机制（`skills.js:544-566`）

`getAvailableSkillTools(skillIds)` 做三件事：
1. 按项目已挂载 `skillIds` + 技能 `status==='enabled'` 过滤；
2. 把 `skill.inputs` **动态转成 JSON Schema**（string/number + required），注入决策提示词；
3. `sideEffect` 由 `risk` 推导：`high → write`（因此高风险技能自动走审批闸门）。

### 3.3 拓展现状（四种来源）

| 来源 | 路径 | 可否被 AI 调用 |
|---|---|---|
| 预置种子 | seed + EXECUTORS 配对 | ✅ 完整可用 |
| 技能市场安装 | `POST /api/skills/install`（复制元数据） | ❌ 仅元数据，无执行器 |
| 新建表单 | `POST /api/skills` | ❌ 仅元数据，无执行器 |
| JSON 导入 | `POST /api/skills/import`（normalizeSkillImport 校验） | ❌ 仅元数据，无执行器 |

**关键缺口②**：与连接器同构——后三种方式创建的 Skill **只是"声明"，不是"能力"**。`getAvailableSkillTools` 只遍历硬编码的 `SKILL_TOOL_MAP`（18 个映射），自定义技能永远不会被注入提示词；即使模型猜到工具名，`executeSkillTool` 也会返回"未登记的技能工具"。

---

## 4. 现状缺口小结

| # | 缺口 | 影响 |
|---|---|---|
| ① | 自定义连接器无工具声明与执行体 | 建了又授权，AI 仍用不上；用户困惑"连接成功但没用" |
| ② | 自定义/市场技能无执行器 | 技能卡片好看但对话中调用不到，能力中心"只能看不能用" |
| ③ | 新增工具必须改两处代码（声明+实现）并重启 | 业务方无法自助扩展，违背"项目即能力扩展"定位 |
| ④ | 连接器"连通测试"是整器的，不能单工具填参调试 | 排错粒度粗 |
| ⑤ | 无真实 MCP Server 接入（无网络传输层） | 无法对接客户现场已有的 MCP 服务 |

### 4.1 落地状态（已迭代）

| 缺口 | 状态 | 实现 |
|---|---|---|
| ① 自定义连接器空壳 | ✅ 已闭环 | connector.tools[] 声明式 HTTP 工具（renderTemplate `{{参数}}`、15s 超时、GET=read/low 其余 write/medium）；connected+项目授权后经 `getAvailableMcpTools` 动态注入 LLM 工具清单，`executeMcpTool` 内置优先、未命中回退自定义执行（mcp.js） |
| ② 自定义技能无执行器 | ✅ 已闭环 | EXECUTORS 通用执行器：`plan_only` / `kb_answer`（kbSearch，可按 spaceId 过滤+topK）/ `http_call`；创建/导入自动分配 toolName `skill.cx_*`；`getAvailableSkillTools` 动态纳入 custom+enabled 技能并按执行体生成 schema；`executeSkillTool` async 双路径回退（skills.js） |
| ③ 扩展需改代码重启 | ✅ 已闭环 | 新建/导入即生效，工具名全局查重（409），零代码零重启 |
| ④ 无单工具调试 | ✅ 已闭环 | `POST /api/tools/test` 调试台（计时、契约透传、risk=high 403 引导审批、未连接 409、全程 audit）；前端 ToolTestModal 在技能/连接器抽屉复用 |
| ⑤ 真实 MCP 传输层 | ⏳ 未做 | 见 P2，后续迭代 |

已验证闭环：新建 kb_answer 技能 → 挂载项目 → 对话中 AI 自主决策调用 `skill.cx_*`（命中知识库 5 条）→ SSE 流式成文；新建含声明工具的连接器 → 授权 → 调试台真实 HTTP 200；高风险工具调试 403。

---

## 5. 让用户使用更方便：改进方案（按优先级）

### P0 — 让"自定义能力"真正可调用（通用执行器，不改架构）

核心思路：**执行体模板化**，用户建技能/连接器时选择执行方式，系统自动绑定通用执行器，业务零代码扩展。

**① 技能执行器模板（三选一，新建/导入时声明 `executor.type`）**

| 模板 | 适用 | 定义方式 |
|---|---|---|
| `kb_answer` 知识问答型 | SOP 问答、规范咨询 | 填：检索提示词模板（query 由用户问题生成）→ 通用执行器调 `kb.search` 汇聚片段交 LLM 成文 |
| `plan_only` 计划生成型 | 高风险操作流程（只出计划走审批） | 填：预检项/步骤/风险/回滚模板 → 通用执行器组装计划对象（复用现有 sk_upgrade/sk_ecis_kvm 模式） |
| `http_call` 接口调用型 | 对接真实 REST 系统 | 填：URL/Method/参数映射/鉴权头 → 通用执行器发起真实 HTTP 请求并透传结果 |

落地改动：`SKILL_TOOL_MAP` 从"硬编码"改为"硬编码内置 + 按 `skill.toolName` 动态生成"；`executeSkillTool` 在查不到内置执行器时回落到通用执行器。收益：新建技能立刻能在对话中被 AI 调用。

**② 连接器工具自助登记（自定义连接器 = 声明式 HTTP 工具集）**

新建/导入连接器时允许附带 `tools[]`：每个工具填 名称/描述/只读写/风险/JSON Schema/HTTP 端点模板。后端把这类工具注册进一个"动态 HTTP 执行器"（按模板 fetch 真实接口）。`getAvailableMcpTools` 从"只读 MCP_TOOLS 硬编码"扩展为"硬编码 + 连接器自带声明"。收益：客户现场系统（REST API）可自助接入，AI 立即可调用。

### P1 — 调试与可信度

- **单工具调试台**：连接器详情 → 工具清单里每个工具可填参试调（schema 驱动自动生成表单），返回原始契约 JSON；替代现在只有整器"连通测试"。
- **技能试运行**：技能详情页"试运行"按钮，填 inputs → 直接调 `executeSkillTool` 看证据包。
- **导入即校验**：导入技能/连接器 JSON 时静态检查 deps 引用的连接器是否存在、schema 是否合法，给逐条错误而非笼统 400。

### P2 — 对接真实 MCP 生态

- Connector 增加 `transport: 'local' | 'mcp-http' | 'mcp-stdio'`；为 `mcp-http` 实现 `tools/list` + `tools/call` 客户端，填一个 MCP Server URL 即自动发现工具并注册（schema/desc 直接来自远端）。
- 工具调用加超时/重试/熔断配置；高风险工具的审批单自动附带 schema 渲染的"变更预览"。

### P3 — 运营化

- 技能/连接器版本升级与变更日志；市场安装后挂接到项目的"升级提醒"。
- 工具级调用统计（次数/成功率/耗时）沉淀到连接器详情页，替代静态 `calls30d`。

---

## 6. 建议的落地顺序

1. **先做 P0-① 技能执行器模板**（改动集中在 skills.js + 新建技能表单，收益最直接：能力中心从"登记处"变"生产线"）。
2. **再做 P0-② 连接器声明式工具**（mcp.js 增加动态执行器 + 连接器表单加 tools 编辑）。
3. P1 调试台与 P2 真实 MCP 接入随后迭代。

每一步都应保持现有铁律不变：统一返回契约、demo 标注沿链路透出、高风险一律审批闸门、全量审计。
