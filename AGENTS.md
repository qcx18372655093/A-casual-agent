# 项目上下文

Creator · AI 项目工作台 —— 以 AI 为中心的项目研发工作平台，同时是贴合天誉创高（CREATOR）**音视频显控一体化**业务的企业级 Agent 平台，覆盖**分布式坐席（ECIS/FSP）、矩阵拼接、中央控制、数字会议、智慧教育**五大主线与**综合运维集控**底座，主打指挥中心、会议室、报告厅、智慧教室场景。核心特征：自有 Skill（技能）体系与 MCP 连接器能力嵌入大模型，项目即授权边界；AI 统一以「做一做」（craft）方式发起任务（问/想/做模式选择已从 UI 移除），高风险操作全程审批闸门，演示数据强制标注，全程可审计。

### 版本技术栈

- **Frontend**: Vue 3 (JavaScript, 非 TS) + Vue Router + Vite 8（纯 SPA，独立于后端）
- **Styling**: Tailwind CSS 4（`@tailwindcss/vite`，`@theme` 定义 design tokens）
- **Backend**: Express 5（ESM），**独立 Node 项目 `backend/`**（自有 package.json，pnpm workspace），监听 `BACKEND_PORT`（默认 5001，仅内网）
- **Auth**: 自建轻量认证（backend/src/auth.js）：scrypt 口令哈希 + Bearer 会话令牌（7 天），角色 admin/approver/member；除 `/api/auth/login`、`/api/health` 外全部 /api 需登录
- **LLM**: coze-coding-dev-sdk（LLMClient/Config/HeaderUtils；ASRClient 语音转写、TTSClient 语音合成；多模态 content parts: image_url/video_url），默认模型 `doubao-seed-2-0-pro-260215`
- **持久化**: 文件型 JSON 库（开发 `backend/data/db.json`，生产 `/tmp/creator-data`）
- **包管理**: 仅 pnpm（pnpm-workspace.yaml 管理 backend）

## 目录结构

```
├── index.html              # SPA 入口
├── vite.config.js          # vite 纯前端 dev server：/api 代理到 BACKEND_PORT（SSE 流式透传）
├── pnpm-workspace.yaml     # workspace：根 + backend，一次 pnpm install 装全部
├── scripts/                # dev.sh（拉起后端 + vite）/ build.sh / start.sh / prod.js（生产网关：spawn 后端 + dist 静态 + /api 流式代理）
├── backend/                # ★ 独立后端项目（纯 ESM JS，自有 package.json，pnpm workspace）
│   └── src/
│       ├── index.js        # 入口：initStore + createApiApp + listen BACKEND_PORT（仅启动引导，无业务）
│       ├── app.js          # 应用组装：express 实例 + 全局中间件顺序 + 按域挂载 routes + 404/错误兜底（不含路由处理函数）
│       ├── config/index.js # 集中配置：PORT/CORS/DATA_DIR/LLM_MODEL/文件限制（全部读环境变量，含默认值）
│       ├── middleware/     # 横切中间件：cors.js（动态 Origin）、error.js（404 + 统一错误处理）
│       ├── utils/http.js   # HTTP 工具：ok/created/sendHttpError/badRequest/notFound/forbidden、actor(req)
│       ├── routes/         # 路由层（按业务域拆分，仅做参数解析/调用 service/HTTP 响应）：
│       │                   #   public(health) / auth / meta(bootstrap) / projects / tasks / chat(SSE) /
│       │                   #   automations + runs / connectors / skills / tools(调试台) / knowledge /
│       │                   #   approvals / todos / notifications / audit / cases / devices /
│       │                   #   ops(alerts|incidents) / data-quality / solutions /
│       │                   #   smart(SMART6000集控) / meetings(ASR+纪要SSE) / vision(多模态识别SSE)
│       ├── services/       # 业务编排层：automation.js（executeAutomation 跨技能+LLM 流程）
│       ├── auth.js         # 认证服务与中间件：users/sessions 集合、登录/登出/me、requireAuth、requireRole、seedUsers
│       ├── chat.js         # SSE 处理器（chat/stream、tasks/:id/resume）
│       ├── llm.js          # 两阶段 LLM 编排：JSON 决策 + 流式答复、计划/审批闸门
│       ├── mcp.js          # MCP 工具层：注册表 + 声明式 HTTP 工具引擎 + 知识库检索（CJK 二元分词）
│       ├── skills.js       # Skill 执行器：内置映射 + 自定义三执行体（plan_only/kb_answer/http_call）
│       ├── ingest.js       # 能力中心导入与文件识别：parseDocument（S3→预签名→FetchClient→LLM 识别）、normalize*
│       ├── store.js        # 数据访问层：文件型 JSON（防抖落盘 + 原子写 + audit；空库播种 + 补播）
│       ├── seed.js         # 基础演示种子数据（仅导出 seedAll）
│       ├── seed-platform.js# 显控 Agent 平台种子：9 连接器 / 13 技能 / 告警事件 / 台账质检 / 10 solutions / SOP 知识空间
│       └── seed-smart.js   # SMART6000 种子：4 演示主机(demoSmartHosts) / 4 场景时序(SMART_SCENES) / 2 演示会议 /
│                           #   连接器 conn_smart6000 + MCP mcp_smart6000(4 工具) / 技能 sk_smart_scene / 方案 sol_smart6000；
│                           #   含存量库字段修复（旧 enabled 布尔值 → status:'enabled'）
├── src/
│   ├── main.js / router.js（含登录守卫）/ api.js（Bearer 令牌 + 401 回登录页）/ store.js（login/logout/bootstrap）/ utils.js
│   ├── styles/main.css     # @theme tokens + 组件类（.btn-*/.stamp/.card/.md/.select-pill/.func-chip...）
│   ├── components/         # SideBar（deepseek 风格，含通知/用户菜单/登出）、WorkContextPanel（右侧工作上下文）、StatusStamp、PlanCard、ApprovalCard（link-context 来源链接）、
│   │                       #   StepTimeline、MarkdownText、AppCommandBar（豆包式命令栏：输入+功能chips，智能应用页复用）等
│   └── views/              # 页面（Login/Home(deepseek 居中对话工作台)/Projects(支持 ?create=1)/ProjectDetail(含「智能应用」「待办与审批 inbox」tab)/Tasks/TaskChat(无模式选择，统一 craft)/Automations/Connectors/Skills/Knowledge/Approvals/Audit/Explore(案例库 /cases)/Alerts(可嵌入)/DataQuality(可嵌入)/Solutions(能力拓展)/
│                           #   SmartControl(/smart-control SMART6000集控台，含 AppCommandBar)/Meetings(/meetings 会议助手，含 AppCommandBar)/Vision(/vision SSLX识别，含 AppCommandBar)）
└── DESIGN.md               # 设计规范（柔和 AI 工作空间意象，必须先读再改 UI）
```

## 核心架构约定（改动前必读）

### 产品形态（AI 工作空间，deepseek 式布局）
- **整体布局（参考 deepseek-harness）**：纯左侧栏 + 主内容区，**无顶栏**（TopBar 已移除，通知/用户菜单迁入侧栏底部，上下文面板开关也在侧栏底部）。侧栏可折叠（`collapsed` ref）。
- 首页 `/` 是居中对话工作台：品牌区（logo+标题+预览版徽章）→ 豆包式大输入框（Enter/Ctrl+Enter 发送；**输入框内下沿内嵌智能应用 chips**：录音转写·会议纪要/视频识别）→ 平台域 chips（预填 prompt 直发任务）。**无工作区/模型选择器、无最近任务区**；发起任务自动携带 `gs.currentProjectId`（工作区在侧栏列表设定）。提交跳转 `/tasks/new?prompt&projectId`（**不再传 mode**，TaskChatView 统一以 `craft` 发起）。
- **当前工作区**（`gs.currentProjectId`，localStorage 持久化）：首页工作区选择器选择后，Composer 发起的任务自动携带 projectId；项目详情/技能/连接器页均可一键扩展项目能力（PATCH /api/projects/:id 的 skillIds/connectorIds）。store.js 提供 `currentProject` computed、`setCurrentProject()`、`refreshProjects()`。
- 右侧全局「工作上下文」面板（WorkContextPanel）：连接器在线状态、中控设备开关（/api/devices toggle）、待办勾选完成；显隐由 `gs.contextOpen` 控制。
- 侧栏信息架构（SideBar.vue，deepseek 风格）：品牌+折叠按钮 → 「新会话」按钮（回首页）→ 主导航「工作台/项目」（**AI 任务、待办与审批已从导航移除**：任务在项目详情「任务」tab，待办审批在项目详情「待办与审批」tab）→ 能力与拓展组「技能/系统连接器/知识空间/自动化/Agent 方案中心（/solutions)/案例库（/cases)」→ 工作区列表（读 gs.projects，点击=设为当前工作区+进详情，「+」跳 /projects?create=1 直接开新建弹窗）→ 底部「通知（角标）/审计日志/上下文面板开关/用户菜单（登出）」。**无智能应用组**（会议助手/视频识别入口在首页输入框 chips，/meetings、/vision、/smart-control 路由均保留）。`/explore` 重定向到 `/solutions`。
- **平台能力围绕项目组织，不做全局运维工具台**：
  - 项目详情「智能应用」tab（ProjectDetailView）：按 `project.skillIds` 映射展示已授权应用（alerts→sk_alert_rca、data-quality→sk_dq_check），通过 `:project-id/:project-name/:embedded` props **内嵌** `<AlertsView>`/`<DataQualityView>`（两页同时作为 /alerts、/data-quality 独立路由存在）。未授权应用引导跳 /solutions 装配。应用内"追问/治理"动作均携带该 projectId。
  - 项目详情「待办与审批」tab（key: inbox）：`/api/approvals?projectId=`（pending 可审批 decide）+ `/api/todos?projectId=`（POST /:id/complete / POST /:id/reopen 切换）+ 审批历史；ApprovalCard `link-context` 展示来源项目×会话。后端 approvals/todos 路由均支持 `?projectId=` 过滤（前端 inbox 按当前 projectId 拉取）。
  - 智能应用三页（/smart-control、/meetings、/vision）统一内嵌 `AppCommandBar.vue`（豆包式命令栏：自然语言输入 Enter 发送 + 功能 chips 一行）。chips 点击直接闭环页内功能（SMART 场景→自动选在线主机出计划；会议→触发文件选择器/生成纪要/新建；视觉→选场景+开文件选择）；自然语言 submit → 跳 `/tasks/new?prompt=【应用名】…&projectId=p_classroom` 交给 AI 编排闭环。
  - 告警降噪 RCA：`opsAlerts`（dedupKey 指纹）+ `incidents`（alertIds/suppressedIds）；`POST /api/alerts/analyze` = 确定性 Skill `correlateAlerts`（时间窗+指纹抑制+按事件归组）汇聚证据 → 真实 LLM invoke 输出 Markdown 分析，LLM 失败降级文本且不报错；返回 demo:true。
  - 数据质量：`dqRules`/`dqRuns`；`POST /api/data-quality/run` 执行 skill.data_quality_check 并回写规则趋势、插运行记录。
  - 能力拓展（方案中心）：`solutions`（domain: `ops` 综合运维集控 / `ecis` 分布式坐席 / `fsp` 光纤坐席 / `matrix` 矩阵拼接 / `control` 中央控制 / `conference` 数字会议 / `education` 智慧教育 = 公司业务平台域，含 skillIds/connectorIds/prompt）；`POST /api/solutions/:id/apply` 合并授权到指定 projectId，无 projectId 则幂等新建 `p_sol_<id>` 工作区。装配→项目「智能应用」即出现对应应用。
  - 所有平台连接器/数据均为演示（demo:true），高风险技能（matrix_batch_plan 等）只出计划，执行走审批闸门。
- **SMART6000 / 会议助手 / SSLX 视觉识别（侧栏「智能应用」组）**：
  - SMART6000 集控（/smart-control）：NET-6000 AI 中控主机集群演示。`demoSmartHosts`（4 台：在线/降级/离线，各 8 台受控设备+接口占用）；`SMART_SCENES`（class_start/class_end/break/exam 四场景设备联动时序，seed-smart.js 导出）。MCP 工具 smart.list_hosts/get_host（读）+ smart.scene_exec/device_control（写/high 风险）。`POST /api/smart/scene/plan` 走技能 skill.smart_scene_plan 只出计划（核对主机状态+故障设备阻断项）；`/scene/exec`、`/device/control` 经 executeMcpTool 落库+审计。全部 demo:true。
  - 会议助手（/meetings）：`meetings` 集合。`POST /:id/transcribe`（base64 音频 → ASRClient.recognize 真实转写，格式白名单 wav/mp3/ogg/m4a，≤15MB）；`POST /:id/minutes/stream`（SSE：LLM 从转写稿流式生成结构化纪要——概要/议题/决议/行动项/风险）。前端用 streamPost（仅 POST 能带 Authorization 头）。
  - SSLX 视觉识别（/vision）：现成多模态大模型（config.llmModel，支持 image_url/video_url），不训练模型。`VISION_SCENES` 四场景提示词模板（课堂行为/设备状态/板书提取/安全巡检）；`POST /api/vision/recognize`（SSE 流式识别，结果落 `visionTasks` 集合）。
  - 种子补播：seed-smart.js 幂等注册连接器/MCP Server/技能/方案并授权 p_classroom；含存量库字段升级（旧版 enabled 布尔值 → status:'enabled'）。
- **能力中心可自助扩展（添加 / JSON 导入 / 文件上传识别）**：
  - 技能中心 `/skills`：「新建技能」（POST /api/skills）、「导入 JSON」（POST /api/skills/import，body.payload 可为 JSON 字符串或对象，经 normalizeSkillImport 校验）、自定义技能可删除（DELETE /api/skills/:id，仅 `custom:true`，级联从 projects.skillIds 移除）；预置技能只可停用不可删。
  - 连接器中心 `/connectors`：同构的新建（POST /api/connectors）、导入（/import）、删除自定义（DELETE 级联 connectorIds）；新建连接器默认 `status:'disconnected'`，需授权接入。
  - 知识空间 `/knowledge`：可新建（POST /api/spaces，team/project，同名 409）/删除空空间（DELETE，builtin 403、有文档 409）；「上传识别」两步式——先 POST /api/knowledge/parse（base64 文件 → parseDocument：S3 上传拿 key→generatePresignedUrl→FetchClient 解析正文→LLM 只回 JSON 元数据，失败本地兜底；txt/md 等纯文本上传前拼 UTF-8 BOM 防 latin1 乱码；限制 15MB 与扩展名白名单），前端展示可编辑的标题/分类/标签/摘要/正文，用户确认后再 POST /api/spaces/:id/docs 入库。支持 txt/md/pdf/Office/csv/json。
  - 预置资源一律带 `builtin:true` 且不可删；用户自建带 `custom:true`。删除按钮仅对 custom 渲染。
  - **自定义能力可真实执行（闭环）**：
    - 技能执行体 EXECUTORS（skills.js）：`plan_only`（只出计划）/ `kb_answer`（kbSearch 检索知识空间，可按 spaceId 过滤 + topK）/ `http_call`（复用 executeHttpTool 真实 HTTP 调用）；创建/导入后自动分配 toolName `skill.cx_<id.slice(4)>`；`custom && enabled` 技能进入 getAvailableSkillTools（参数 schema 按执行体确定性生成），LLM 决策可直接调用；executeSkillTool 为 async 双路径（内置映射优先，未命中回退通用执行器）。
    - 连接器声明式 HTTP 工具（mcp.js）：connector.tools[]（工具名正则 `/^[a-z][a-z0-9]*(\.[a-z0-9_]+)+$/`，method/url/headers/body/params），renderTemplate 替换 `{{参数}}`，AbortSignal 15s 超时，非 2xx → `{ok:false,error:'HTTP xxx'}`；GET 自动判定 `action:'read',risk:'low'`，其余 write/medium；连接器 connected 且被项目授权后经 getAvailableMcpTools 动态进入 LLM 工具清单，executeMcpTool 内置优先、未命中回退自定义工具。
    - 工具调试台 `POST /api/tools/test`：{name,args} → 解析技能/MCP 工具描述符 → 计时执行返回 {ms,result,tool}；`risk=high` 拒绝（403，引导走对话+审批）、连接器未连接 409、未登记 404；全程 audit('tool.test')。前端 ToolTestModal 组件在技能抽屉与连接器抽屉复用。
    - 工具名全局查重：新建/导入技能与连接器时 validateToolNames 对所有来源查重，冲突 409「请更换前缀」。
- 用户文档：`USER_MANUAL.md`（系统使用说明手册，第 9 章为平台域方案）。
- 能力体系架构文档：`CAPABILITY_MODEL.md`（MCP 协议/Tool/Skill 三层定义、调用链路与拓展机制分析；改 llm.js/mcp.js/skills.js 前必读）。

### 后端分层架构（改动后端必读）
- 分层职责：`routes/`（HTTP 适配：取参、鉴权结果处理、状态码，不写复杂业务）→ `services/`（跨实体业务编排，如 automation）→ `skills.js/mcp.js/llm.js/ingest.js`（领域能力）→ `store.js`（唯一数据访问出口）。`app.js` 只做组装，禁止在其中写路由处理函数。
- 新增接口：在对应 `routes/<域>.js` 加 `router.METHOD`，需要跨步骤流程抽到 `services/`；统一用 `utils/http.js` 的 `ok/created/badRequest/notFound/forbidden/sendHttpError` 返回，操作人用 `actor(req)`。
- 配置只从 `config/index.js` 取（环境变量 + 默认值），禁止在业务文件散落 `process.env` 与硬编码端口/超时。
- `executeSkillTool`/`executeMcpTool` 均为 **async**，任何调用点必须 `await`（历史事故：data-quality/run、alerts/analyze、automation 漏 await 导致 Promise 被当结果，接口 400 空体）。
- 语法自检：`pnpm -C backend run check`（node --check 全量 src）。

### 前后端分离与热重启
- **开发双进程**：后端 `backend/`（`node --watch-path=src`，源码变更自动重启，监听 `${BACKEND_PORT:-5001}`）+ 前端 vite（`${DEPLOY_RUN_PORT}`）。`scripts/dev.sh` 先健康检查/拉起后端，再启动 vite；vite 把所有 `/api/*` 代理到后端（SSE 流式透传，含错误兜底 502）。
- **生产网关**：`scripts/prod.js` 单入口——spawn 后端子进程（崩溃 1s 自动重启）+ 托管 `dist/` 静态 + `/api` 流式代理（fetch + Readable.fromWeb 管道，SSE 不缓冲；客户端断连用 `res.on('close')` abort 上游）。
- 后端数据落盘 `backend/data/db.json`（**在 backend/src 之外**，`--watch-path=src` 不会因写库重启——历史事故：watcher 误监听数据目录导致 SSE 流被反复截断）。
- HMR：6000 端口 + `/hot/vite-hmr` 路径，客户端经公网 wss:443 接入。
- CORS：后端放开（`ALLOWED_ORIGINS` 可配，缺省回显 Origin），前端可跨域直连后端；常规仍走同源代理。

### 登录认证（backend/src/auth.js）
- users（username 唯一、scrypt 加盐哈希、role: admin/approver/member）+ sessions（48 位十六进制令牌，7 天过期）。
- 端点：`POST /api/auth/login`（无需登录）→ `{token, user}`；`GET /api/auth/me`、`POST /api/auth/logout`（需登录）；`GET /api/health`（无需登录，探活）。
- 闸门：`app.use('/api', requireAuth)` 保护其余全部接口；审批决策（/api/approvals/:id/decide、任务对话内 approve/reject）仅 approver/admin 角色（403）。
- 前端：令牌存 localStorage `creator_token`；api.js 自动带 `Authorization: Bearer`，401 清令牌跳 `/login?redirect=...`；router beforeEach 守卫；TopBar 用户菜单登出。
- 演示账户（登录页可点击填充）：`admin/admin123`（陈志远·管理员）、`approver/approver123`（李晓梅·审批人）、`member/member123`（王一帆·成员）；存量库由 initStore 自动补播。
- 审计操作人统一 `actor(req)`（= 当前登录用户），任务发起人 task.actor 取登录用户。

### LLM 两阶段编排（backend/src/llm.js）
SDK 无原生 function calling，且自由文本内嵌标签协议在该模型上不可靠（只承诺不输出标签）。因此：
1. **决策阶段**（非流式 `invoke`，temperature 0）：模型只输出一个 JSON——`{"action":"answer"}` / `{"action":"tool","name","arguments"}` / `{"action":"plan","plan"}`；`parseDecision` 容错提取。
2. **执行阶段**：工具经模式策略（Ask/未确认 Plan 禁写）与高风险闸门（转人工审批，任务挂起 waiting_approval）后执行，结果以 `<tool_result>` 写回上下文。
3. **答复阶段**（流式 `stream`）：独立回答提示词，纯正文 SSE delta 输出。
- 审批通过走 `resumeWithApprovedTool`：直接执行挂起工具再回主循环。
- SSE 断连判定一律用 `res.on('close')`（`req.on('close')` 在请求体读完即触发，会误杀事件）。

### 数据可信
- 工具结果 `demo=true`（演示连接器）必须沿链路标注：step.demo → task.demo → 回答中显著标注「演示数据」。
- 禁止把 Mock/演示数据伪装成真实执行结果。

## 开发规范

- 仅 pnpm；端口必须读 `DEPLOY_RUN_PORT`；域名读 `COZE_PROJECT_DOMAIN_DEFAULT`。
- 前端为 JavaScript：不加 TS 类型语法；组件用 `<script setup>`。
- UI 必须遵循 `DESIGN.md`（语义化 token，禁止硬编码色值/圆角，禁止蓝紫渐变与玻璃拟态；状态用 Lucide 图标+色点，禁 emoji）。
- 服务端为 ESM：`import` 语法，文件扩展名 `.js` 不可省。

## 常用命令

```bash
pnpm install          # 安装全部依赖（workspace：前端 + backend）
bash scripts/dev.sh   # 开发：拉起后端（:5001，--watch 热重启）+ vite（:5000，/api 代理）
pnpm run build        # 构建前端 dist
pnpm run start        # 生产：node scripts/prod.js（网关 spawn 后端 + 静态 + 流式代理）
pnpm -C backend run dev    # 仅启动后端（开发）
pnpm -C backend run check  # 后端语法自检
```

## 测试与排障

- 静态检查与接口冒烟一律使用 test_run 工具；多步流程（如 Plan→确认→审批）必须放在同一条命令内（管线每条命令的 /tmp 相互隔离）。**除 /api/auth/login、/api/health 外所有接口需先登录拿 token 再带 Authorization 头测试**。
- SSE 测试用 `curl -s -N ... -o 文件` 后 `awk '/^event:/{print $2}'` 统计事件；JSON 响应用 `json.JSONDecoder().raw_decode` 解析（管线会追加 HTTP_CODE 行）。
- 日志：`/app/work/logs/bypass//app.log`（前端/vite）→ `backend.log`（后端服务）→ `dev.log` → `console.log`，单次读取 ≤ 50 行。
- 重置演示数据：`rm -f backend/data/db.json && touch backend/src/store.js`（--watch 触发后端重启并重新播种，含演示账户）。
