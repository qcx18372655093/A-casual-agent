/**
 * 自动化执行服务：技能检查（确定性）+ LLM 生成报告（真实模型调用）
 * 从原 app.js 原样抽出，行为零改动。
 */
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk'
import { store, audit } from '../store.js'
import { executeSkillTool, SKILL_TOOL_MAP } from '../skills.js'

const TOOL_NAME_BY_SKILL_ID = Object.fromEntries(Object.entries(SKILL_TOOL_MAP).map(([tool, id]) => [id, tool]))

/**
 * @param {object} automation 自动化规则
 * @param {object} headers  转发给 LLM SDK 的请求头
 * @param {string} triggeredBy 触发来源（manual/schedule）
 */
export async function executeAutomation(automation, headers, triggeredBy) {
  const startedAt = Date.now()
  const run = store.insert('automationRuns', {
    id: `run_${startedAt.toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    automationId: automation.id,
    automationName: automation.name,
    projectId: automation.projectId,
    status: 'running',
    triggeredBy,
    startedAt: new Date(startedAt).toISOString(),
    steps: [],
    demo: true,
  })

  try {
    const toolName = TOOL_NAME_BY_SKILL_ID[automation.skillId]
    run.steps.push({ title: '读取连接器数据', status: 'ok', ts: new Date().toISOString() })
    const skillResult = await executeSkillTool(toolName, automation.skillArgs || {})
    run.steps.push({
      title: `执行技能「${store.get('skills', automation.skillId)?.name || automation.skillId}」`,
      status: skillResult.ok ? 'ok' : 'error',
      ts: new Date().toISOString(),
    })
    if (!skillResult.ok) throw new Error(skillResult.error)

    // LLM 生成报告
    run.steps.push({ title: 'AI 生成报告', status: 'running', ts: new Date().toISOString() })
    const client = new LLMClient(new Config(), headers)
    const resp = await client.invoke(
      [
        {
          role: 'system',
          content:
            '你是项目自动化报告生成器。基于给定检查数据（JSON）生成结构清晰的中文报告（Markdown）：总体结论 / 检查覆盖 / 异常清单（对象、现象、时间、建议）/ 无法确认项。数据标注 demo=true 时必须在报告中注明「数据来源为演示连接器」。只使用数据中已有信息，不得编造。',
        },
        {
          role: 'user',
          content: `自动化任务：${automation.name}\n执行指令：${automation.instruction}\n检查数据：\n${JSON.stringify(skillResult.data)}`,
        },
      ],
      { temperature: 0.2 },
    )
    run.steps[run.steps.length - 1].status = 'ok'

    const anomalies = skillResult.data?.anomalyCount ?? skillResult.data?.problemCount ?? 0
    run.report = resp.content
    run.anomalyCount = anomalies
    run.summary = anomalies > 0 ? `发现 ${anomalies} 项异常，已生成报告并创建待办` : '检查通过，未发现异常'
    run.status = anomalies > 0 ? 'partial' : 'success'

    if (anomalies > 0) {
      const list = skillResult.data?.anomalies || skillResult.data?.problems || []
      for (const a of list.slice(0, 3)) {
        store.insert('todos', {
          projectId: automation.projectId,
          title: `处理异常：${a.name || a.id} — ${a.issue || a.alerts?.[0]?.message || '状态异常'}`,
          source: `自动化「${automation.name}」运行 ${run.id}`,
          status: 'pending',
          priority: 'high',
          dueDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
          runId: run.id,
        })
      }
      store.insert('notifications', {
        kind: 'anomaly',
        title: `自动化「${automation.name}」发现 ${anomalies} 项异常`,
        body: run.summary,
        link: `/automations?run=${run.id}`,
        read: false,
      })
    }
  } catch (err) {
    run.status = 'failed'
    run.summary = `运行失败：${err.message}`
    run.steps.push({ title: '失败', status: 'error', ts: new Date().toISOString(), error: err.message })
  }

  run.finishedAt = new Date().toISOString()
  run.durationSec = Math.round((Date.now() - startedAt) / 1000)
  store.save()
  audit('系统', 'automation.run', 'automation', automation.id, `自动化「${automation.name}」运行完成：${run.summary}`, run.status === 'failed' ? 'failed' : 'success')
  return run
}

export { HeaderUtils }
