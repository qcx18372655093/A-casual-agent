import { LLMClient, Config } from 'coze-coding-dev-sdk'
import { store, audit } from './store.js'
import { getAvailableMcpTools, executeMcpTool } from './mcp.js'
import { getAvailableSkillTools, executeSkillTool, getSkillByToolName } from './skills.js'

/** 工作模式：表达用户希望 AI 如何工作 */
export const MODES = {
  ask: { key: 'ask', name: '问一问', desc: '问答、解释与只读查询；不执行写入、发送、控制等有副作用操作' },
  plan: { key: 'plan', name: '想一想', desc: '先澄清目标并生成计划，用户确认后才执行；重要变更默认推荐' },
  craft: { key: 'craft', name: '做一做', desc: '在授权范围内直接完成任务；超范围或高风险操作暂停请求确认' },
}

const DEFAULT_MODEL = 'doubao-seed-2-0-pro-260215'
export const MODEL_CHOICES = [
  { id: 'doubao-seed-2-0-pro-260215', name: 'Doubao Seed 2.0 Pro', desc: '旗舰通用，复杂推理与工具执行' },
  { id: 'doubao-seed-2-0-lite-260215', name: 'Doubao Seed 2.0 Lite', desc: '均衡型，兼顾成本与效果' },
  { id: 'doubao-seed-2-0-mini-260215', name: 'Doubao Seed 2.0 Mini', desc: '低时延，轻量任务' },
  { id: 'glm-4-7-251222', name: 'GLM 4.7', desc: '编程与多步推理' },
]

const MAX_ROUNDS = 8

/* ------------------------------------------------------------------ */
/* 提示词：共享上下文块                                                  */
/* ------------------------------------------------------------------ */
function buildContextLines(task, project) {
  const mode = MODES[task.mode] || MODES.ask
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
  const lines = []
  lines.push('你是「Creator」工作台的项目 AI 助手。Creator 是以 AI 为中心的项目工作平台：你通过可调用的 Skill（技能）与 MCP 工具（连接器能力）在授权范围内完成用户的项目工作。')
  lines.push(`当前时间：${now}（Asia/Shanghai）；当前用户：${task.actor || '陈志远'}（项目负责人，拥有本项目全部授权）`)
  lines.push(`工作模式：${mode.name}（${mode.desc}）`)

  if (project) {
    lines.push('\n【项目上下文】')
    lines.push(`项目：${project.name}（${project.type} / 负责人：${project.owner}）`)
    lines.push(`项目目标：${project.goal}`)
    lines.push(`AI 工作指令：\n${project.instructions}`)
    lines.push(`操作边界：\n${project.boundaries}`)
    lines.push('任务上下文仅在本项目与授权范围内延续，不得跨项目泄露资料。')
  } else {
    lines.push('\n【上下文】独立任务空间（未关联项目）。不附带任何项目资料、连接器与技能授权；如确需这些能力，告知用户需在对应项目中发起或先完成授权。')
  }
  return lines
}

function listAvailableTools(project) {
  const skillTools = project ? getAvailableSkillTools(project.skillIds || []) : []
  const mcpTools = project ? getAvailableMcpTools(project.connectorIds || []) : []
  return { skillTools, mcpTools }
}

/* ------------------------------------------------------------------ */
/* 决策提示词：模型以严格 JSON 决定"回答 / 调用工具 / 提交计划"           */
/* ------------------------------------------------------------------ */
function buildDecisionPrompt(task, project) {
  const lines = buildContextLines(task, project)
  const { skillTools, mcpTools } = listAvailableTools(project)
  const planStage = task.mode === 'plan' && !task.planConfirmed
  const writeAllowed = task.mode === 'craft' || (task.mode === 'plan' && task.planConfirmed)

  lines.push('\n【可调用的能力】')
  if (skillTools.length || mcpTools.length) {
    if (skillTools.length) {
      lines.push('平台 Skill（技能工具）：')
      for (const t of skillTools) {
        lines.push(`- ${t.name}｜${t.skillName} v${t.version}｜${t.sideEffect === 'write' ? '写操作' : '只读'}｜风险:${t.risk}｜${t.desc}｜参数:${JSON.stringify(t.schema)}`)
      }
    }
    if (mcpTools.length) {
      lines.push('MCP 工具（来自已授权连接器）：')
      for (const t of mcpTools) {
        lines.push(`- ${t.name}｜${t.server}｜${t.sideEffect === 'read' ? '只读' : '写操作'}｜风险:${t.risk}｜${t.desc}｜参数:${JSON.stringify(t.schema)}`)
      }
    }
  } else {
    lines.push('（当前任务没有可调用的 Skill 或 MCP 工具）')
  }

  lines.push('\n【你的职责：为本轮对话做决策】')
  lines.push('根据对话历史与工具执行结果，决定下一步动作。只输出一个 JSON 对象，禁止输出任何其他文字、解释或代码块围栏。')
  lines.push('可选动作：')
  lines.push('1. {"action":"answer"} —— 信息已足够、或无需工具，直接由另一个回答模块为用户生成最终答复。')
  lines.push('2. {"action":"tool","name":"工具名","arguments":{...}} —— 需要获取数据或执行操作。每轮只能选一个工具；系统执行后会在下一轮以 <tool_result> 形式把结果给你。')
  if (planStage) {
    lines.push('3. {"action":"plan","plan":{"title":"...","goal":"...","steps":[{"title":"...","detail":"...","tools":["工具名"],"risk":"low|medium|high"}],"scope":"将访问的数据范围","risks":["..."],"sideEffects":["..."]}} —— 想一想模式的核心产出：在充分了解现状后提交计划，等待用户确认。')
  }

  lines.push('\n【决策规则（强制）】')
  if (task.mode === 'ask') {
    lines.push('- 问一问：只能选只读工具；用户需求涉及写操作时选 answer，由回答模块说明需切换「做一做」并获授权。')
  } else if (planStage) {
    lines.push('- 想一想（计划阶段）：只能选只读工具了解现状；信息足够后必须提交 plan；禁止选写操作工具。')
  } else {
    lines.push('- 做一做：在授权范围内直接执行；高风险工具系统会自动转人工审批，属正常流程。')
  }
  if (!writeAllowed) lines.push('- 当前阶段禁止选择任何"写操作"工具。')
  lines.push('- 对话中已有 <tool_result> 且足以回答时，选 answer，不要重复调用同一工具。')
  lines.push('- 不要编造工具结果中不存在的数据。')
  return lines.join('\n')
}

/* ------------------------------------------------------------------ */
/* 回答提示词：流式生成面向用户的最终答复（不含任何工具协议）             */
/* ------------------------------------------------------------------ */
function buildAnswerPrompt(task, project) {
  const lines = buildContextLines(task, project)
  const executing = task.mode === 'craft' || (task.mode === 'plan' && task.planConfirmed)
  lines.push('\n【你的职责：生成最终答复】')
  lines.push('对话历史中的 <tool_result name="..." demo="..."> 是系统真实执行工具返回的数据。基于这些数据与已有上下文，直接为用户生成最终答复。')
  lines.push('- 严禁编造工具结果中不存在的数据；证据不足写「待核实」，不得把相关性表述为确定因果。')
  lines.push('- 工具结果中 demo=true 表示数据来自演示连接器：回答中必须显著标注「演示数据」，严禁冒充真实生产状态。')
  lines.push('- 诊断类结论分四段表述：观测事实 / 可能原因 / 建议措施 / 已执行操作；为关键判断给出数据来源、时间范围与不确定性。')
  lines.push('- 引用知识库内容时注明文档名与版本。')
  lines.push('- 使用 Markdown 组织回答，密度适中，重要清单用表格。')
  lines.push('- 不要输出任何 XML 标签（如 <tool_call>、<plan>），不要使用代码块围栏包裹全文，直接输出答复正文。')
  if (task.mode === 'ask') {
    lines.push('- 问一问：只读问答。用户需求涉及写操作时，说明需切换到「做一做」并获授权，不要假装已执行。')
  } else if (!executing) {
    lines.push('- 想一想（计划阶段）：聚焦现状分析与方案说明；计划卡片已由系统单独生成，正文不要重复罗列完整计划 JSON。')
  } else {
    lines.push('- 做一做：说明已执行的操作、结果与交付物；高风险操作（设备重启、配置修改、固件升级、对外发送）需展示对象、变更内容、影响范围与回滚建议。')
  }
  return lines.join('\n')
}

/* 从模型输出中稳健提取决策 JSON */
function parseDecision(text) {
  const s = String(text || '')
  const i = s.indexOf('{')
  const j = s.lastIndexOf('}')
  if (i === -1 || j <= i) return { action: 'answer' }
  try {
    const d = JSON.parse(s.slice(i, j + 1))
    if (d && typeof d.action === 'string') return d
  } catch {
    /* fallthrough */
  }
  return { action: 'answer' }
}

async function decideAction(client, task, project) {
  const messages = [{ role: 'system', content: buildDecisionPrompt(task, project) }, ...task.llmMessages]
  const resp = await client.invoke(messages, { model: task.model || DEFAULT_MODEL, temperature: 0 })
  return parseDecision(resp?.content)
}

/* ------------------------------------------------------------------ */
/* 工具解析与执行                                                       */
/* ------------------------------------------------------------------ */
function resolveToolDescriptor(toolName, project) {
  const skillTools = project ? getAvailableSkillTools(project.skillIds || []) : []
  const mcpTools = project ? getAvailableMcpTools(project.connectorIds || []) : []
  const sk = skillTools.find((t) => t.name === toolName)
  if (sk) return { kind: 'skill', ...sk }
  const mc = mcpTools.find((t) => t.name === toolName)
  if (mc) return { kind: 'mcp', ...mc }
  return null
}

function summarizeResult(result) {
  if (!result.ok) return `失败：${result.error}`
  const d = result.data || {}
  if (d.total !== undefined) return `返回 ${d.total} 条记录`
  if (d.problemCount !== undefined) return `发现 ${d.problemCount} 台异常设备`
  if (d.anomalyCount !== undefined) return `发现 ${d.anomalyCount} 项异常`
  if (d.upgradePlan) return '已生成升级计划（未执行）'
  if (d.rebooted) return '设备已重启（演示环境）'
  if (d.updated) return '配置已更新（演示环境）'
  if (d.created && d.ticket) return `工单已创建：${d.ticket.id}`
  if (d.deduped) return `幂等去重：复用已有工单 ${d.ticket?.id}`
  if (d.excerpts) return `命中 ${d.excerpts.length} 条知识片段`
  return '执行完成'
}

/* ------------------------------------------------------------------ */
/* 主循环：JSON 决策（工具/计划/回答）+ 流式答复 + 计划/审批闸门          */
/* ------------------------------------------------------------------ */
export async function runTaskLoop(task, headers, emit) {
  const project = task.projectId ? store.get('projects', task.projectId) : null
  const client = new LLMClient(new Config(), headers)
  let aborted = false
  const safeEmit = (type, data) => {
    if (aborted) return
    try {
      emit(type, data)
    } catch {
      aborted = true
    }
  }

  const persist = () => store.save()

  let rounds = 0
  while (rounds < MAX_ROUNDS) {
    if (aborted) return { finished: false, reason: 'aborted' }
    rounds += 1

    /* ---- 决策：模型以严格 JSON 决定下一步（非流式）---- */
    let decision
    try {
      decision = await decideAction(client, task, project)
    } catch {
      decision = { action: 'answer' }
    }
    if (!decision || typeof decision !== 'object') decision = { action: 'answer' }

    /* ---- 提交计划（想一想·未确认阶段）---- */
    if (decision.action === 'plan' && task.mode === 'plan' && !task.planConfirmed) {
      const plan = decision.plan && typeof decision.plan === 'object' ? decision.plan : null
      if (!plan || !Array.isArray(plan.steps) || plan.steps.length === 0) {
        task.llmMessages.push({ role: 'user', content: '<tool_result name="plan">计划结构不完整：需要 title、goal 与非空 steps 数组。请重新决策。</tool_result>' })
        continue
      }
      task.llmMessages.push({ role: 'assistant', content: `<plan>${JSON.stringify(plan)}</plan>` })
      task.plan = plan
      task.status = 'waiting_confirm'
      persist()
      safeEmit('plan', { plan })
      safeEmit('status', { status: 'waiting_confirm' })
      return { finished: false, reason: 'waiting_confirm' }
    }

    /* ---- 工具调用 ---- */
    if (decision.action === 'tool' && typeof decision.name === 'string' && decision.name) {
      const toolName = decision.name
      const toolArgs = decision.arguments && typeof decision.arguments === 'object' ? decision.arguments : {}
      task.llmMessages.push({ role: 'assistant', content: `<tool_call>${JSON.stringify({ name: toolName, arguments: toolArgs })}</tool_call>` })
      const descriptor = resolveToolDescriptor(toolName, project)

      if (!descriptor) {
        task.llmMessages.push({
          role: 'user',
          content: `<tool_result name="${toolName}">工具不可用：未登记、未启用、未安装或连接器未授权。请改用当前可用能力，或如实告知用户需要先完成授权。</tool_result>`,
        })
        continue
      }

      // 模式约束：Ask / 未确认的 Plan 禁止写工具
      const writeAllowed = task.mode === 'craft' || (task.mode === 'plan' && task.planConfirmed)
      if (descriptor.sideEffect === 'write' && !writeAllowed) {
        const modeName = MODES[task.mode]?.name || task.mode
        task.llmMessages.push({
          role: 'user',
          content: `<tool_result name="${toolName}">策略拦截：「${modeName}」模式禁止调用写操作工具。请向用户说明需要切换模式并获得授权。</tool_result>`,
        })
        const step = {
          id: `st_${Date.now()}`,
          kind: 'policy',
          name: '策略拦截',
          tool: toolName,
          status: 'blocked',
          summary: `「${modeName}」模式禁止写操作`,
          ts: new Date().toISOString(),
        }
        task.steps.push(step)
        persist()
        safeEmit('step', step)
        continue
      }

      // 高风险闸门：转人工审批，任务挂起
      if (descriptor.risk === 'high') {
        const approval = store.insert('approvals', {
          no: store.nextSeq('approval'),
          kind: 'high-risk-operation',
          title: `高风险操作审批：${descriptor.desc || toolName}`,
          taskId: task.id,
          projectId: task.projectId || null,
          applicant: `${task.actor || '陈志远'}（AI 任务发起）`,
          object: toolArgs.deviceId || toolArgs.file || toolArgs.title || toolName,
          change: `${toolName} ${JSON.stringify(toolArgs)}`,
          impact: descriptor.kind === 'mcp' ? '对目标系统产生实际变更（演示连接器：仅演示环境）' : '高风险技能操作',
          rollback: '按工具/技能的回滚策略执行；失败转人工处理',
          status: 'pending',
          approver: '李晓梅',
          expireAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        })
        task.pendingToolCall = { name: toolName, arguments: toolArgs, approvalId: approval.id }
        task.status = 'waiting_approval'
        task.demo = task.demo || false
        const step = {
          id: `st_${Date.now()}`,
          kind: 'approval',
          name: '高风险操作转审批',
          tool: toolName,
          status: 'waiting',
          summary: `等待 ${approval.approver} 审批`,
          ts: new Date().toISOString(),
        }
        task.steps.push(step)
        store.insert('notifications', {
          kind: 'approval',
          title: `待审批：${approval.title}`,
          body: `AI 任务「${task.title}」请求执行高风险操作，等待审批。`,
          link: `/tasks/${task.id}`,
          read: false,
        })
        audit('系统', 'approval.submit', 'approval', approval.id, `高风险操作转人工审批：${toolName}`)
        persist()
        safeEmit('approval', { approval })
        safeEmit('status', { status: 'waiting_approval' })
        return { finished: false, reason: 'waiting_approval' }
      }

      // 常规执行
      const step = {
        id: `st_${Date.now()}_${rounds}`,
        kind: descriptor.kind,
        name: descriptor.kind === 'skill' ? descriptor.skillName : toolName,
        tool: toolName,
        status: 'running',
        args: toolArgs,
        ts: new Date().toISOString(),
      }
      task.steps.push(step)
      persist()
      safeEmit('step', step)

      const started = Date.now()
      const result =
        descriptor.kind === 'skill'
          ? await Promise.resolve(executeSkillTool(toolName, toolArgs))
          : await Promise.resolve(executeMcpTool(toolName, toolArgs, { taskId: task.id }))
      const durationMs = Date.now() - started

      step.status = result.ok ? 'ok' : 'error'
      step.durationMs = durationMs
      step.summary = summarizeResult(result)
      step.demo = !!result.demo
      if (result.demo) task.demo = true
      if (result.sources) step.sources = result.sources
      audit('系统', 'tool.invoke', descriptor.kind === 'skill' ? 'skill' : 'mcp', toolName, `AI 调用${descriptor.kind === 'skill' ? '技能' : ' MCP 工具'} ${toolName}：${step.summary}`, result.ok ? 'success' : 'failed')
      persist()
      safeEmit('step', step)

      task.llmMessages.push({
        role: 'user',
        content: `<tool_result name="${toolName}" demo="${result.demo ? 'true' : 'false'}">${JSON.stringify(result.ok ? result.data : { error: result.error })}</tool_result>`,
      })
      persist()
      continue
    }

    /* ---- 最终答复：流式生成（无工具协议，纯正文）---- */
    let assistantText = ''
    let streamError = null
    try {
      const messages = [{ role: 'system', content: buildAnswerPrompt(task, project) }, ...task.llmMessages]
      const stream = client.stream(messages, { model: task.model || DEFAULT_MODEL, temperature: 0.3 })
      for await (const chunk of stream) {
        if (aborted) return { finished: false, reason: 'aborted' }
        const c = chunk?.content
        if (c) {
          const t = typeof c === 'string' ? c : String(c)
          assistantText += t
          safeEmit('delta', { text: t })
        }
      }
    } catch (err) {
      streamError = err
    }

    if (streamError) {
      safeEmit('error', { message: `模型调用失败：${streamError.message}` })
      task.status = 'failed'
      task.error = streamError.message
      persist()
      return { finished: true, reason: 'error' }
    }

    const visible = assistantText.trim()
    task.llmMessages.push({ role: 'assistant', content: visible })
    if (visible) {
      task.messages.push({ role: 'assistant', content: visible, ts: new Date().toISOString() })
    }
    task.status = 'completed'
    task.pendingToolCall = undefined
    persist()
    safeEmit('status', { status: 'completed' })
    return { finished: true, reason: 'completed' }
  }

  // 超过最大轮次
  task.llmMessages.push({ role: 'user', content: '【系统】工具调用轮次已达上限，请基于已获得的信息给出结论。' })
  task.status = 'completed'
  persist()
  safeEmit('status', { status: 'completed' })
  return { finished: true, reason: 'max_rounds' }
}

/** 审批通过后：直接执行挂起的工具并继续对话 */
export async function resumeWithApprovedTool(task, headers, emit) {
  const pending = task.pendingToolCall
  if (!pending) return runTaskLoop(task, headers, emit)
  const descriptor = resolveToolDescriptor(pending.name, task.projectId ? store.get('projects', task.projectId) : null)
  task.pendingToolCall = undefined

  const step = {
    id: `st_${Date.now()}_approved`,
    kind: descriptor?.kind || 'mcp',
    name: descriptor?.kind === 'skill' ? descriptor.skillName : pending.name,
    tool: pending.name,
    status: 'running',
    args: pending.arguments,
    ts: new Date().toISOString(),
  }
  task.steps.push(step)
  store.save()
  emit('step', step)

  const started = Date.now()
  const result = descriptor
    ? descriptor.kind === 'skill'
      ? await Promise.resolve(executeSkillTool(pending.name, pending.arguments))
      : await Promise.resolve(executeMcpTool(pending.name, pending.arguments, { taskId: task.id, approvalId: pending.approvalId }))
    : { ok: false, error: '工具不再可用（授权可能已变更），请重新评估' }
  step.status = result.ok ? 'ok' : 'error'
  step.durationMs = Date.now() - started
  step.summary = summarizeResult(result)
  step.demo = !!result.demo
  step.approved = true
  if (result.demo) task.demo = true
  audit('系统', 'tool.invoke', 'mcp', pending.name, `审批通过后执行 ${pending.name}：${step.summary}`, result.ok ? 'success' : 'failed')
  task.llmMessages.push({
    role: 'user',
    content: `<tool_result name="${pending.name}" demo="${result.demo ? 'true' : 'false'}" approved="true">${JSON.stringify(result.ok ? result.data : { error: result.error })}</tool_result>`,
  })
  task.status = 'running'
  store.save()
  emit('step', step)
  return runTaskLoop(task, headers, emit)
}
