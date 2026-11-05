/**
 * Agent 方案中心：平台域解决方案目录与一键装配（技能/连接器合并授权到项目）
 */
import { Router } from 'express'
import { store, audit } from '../store.js'
import { ok, notFound, actor } from '../utils/http.js'

const router = Router()

router.get('/', (req, res) => {
  let list = store.list('solutions')
  const { domain } = req.query
  if (domain && domain !== 'all') list = list.filter((s) => s.domain === domain)
  const projects = store.list('projects')
  list = list.map((s) => {
    const appliedProjects = projects.filter((p) => (p.skillIds || []).some((id) => s.skillIds.includes(id))).length
    return { ...s, appliedProjects }
  })
  ok(res, { list, demo: true })
})

router.post('/:id/apply', (req, res) => {
  const sol = store.get('solutions', req.params.id)
  if (!sol) return notFound(res, '方案不存在')
  let project = null
  if (req.body.projectId) {
    project = store.get('projects', req.body.projectId)
    if (!project) return notFound(res, '项目不存在')
  } else {
    const projectId = `p_sol_${sol.id}`
    project = store.get('projects', projectId)
    if (!project) {
      project = store.insert('projects', {
        id: projectId,
        name: `${sol.name}工作区`,
        code: `SOL-${store.list('projects').length + 1}`,
        domain: sol.domain,
        status: 'active',
        owner: actor(req),
        aiInstruction: `围绕「${sol.name}」开展工作：${sol.pain}`,
        operationBoundary: '演示环境：所有业务数据来自演示连接器，写操作必须经计划与审批。',
        knowledgeScopes: [],
        members: [{ name: actor(req), role: '负责人' }],
        skillIds: [],
        connectorIds: [],
        progress: 0,
        health: 'healthy',
      })
    }
  }
  const skillIds = [...new Set([...(project.skillIds || []), ...sol.skillIds])]
  const connectorIds = [...new Set([...(project.connectorIds || []), ...sol.connectorIds])]
  const updated = store.update('projects', project.id, { skillIds, connectorIds })
  store.update('solutions', sol.id, { usedCount: (sol.usedCount || 0) + 1 })
  audit(
    actor(req),
    'solution.apply',
    'project',
    project.id,
    `装配方案「${sol.name}」：+${sol.skillIds.length} 技能 / +${sol.connectorIds.length} 连接器`,
  )
  ok(res, { project: updated, prompt: sol.prompt, addedSkills: sol.skillIds, addedConnectors: sol.connectorIds })
})

export default router
