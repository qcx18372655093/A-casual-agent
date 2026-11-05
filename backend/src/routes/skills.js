/**
 * 技能中心：目录、技能市场、安装、启停、新建/导入（含执行体）、删除自定义
 */
import { Router } from 'express'
import { store, audit } from '../store.js'
import { ok, notFound, actor } from '../utils/http.js'
import { normalizeSkillImport, importSkillOnce } from '../ingest.js'
import { SKILL_TOOL_MAP } from '../skills.js'
import { ensureSkillToolName } from './_shared.js'

const router = Router()

const TOOL_NAME_BY_SKILL_ID = Object.fromEntries(Object.entries(SKILL_TOOL_MAP).map(([tool, id]) => [id, tool]))

router.get('/', (req, res) => {
  const list = store.list('skills').map((s) => ({
    ...s,
    toolName: TOOL_NAME_BY_SKILL_ID[s.id] || s.toolName || null,
    usesDemo: (s.deps?.connectors || []).some((cid) => store.get('connectors', cid)?.dataSource === 'demo'),
    connectorDeps: (s.deps?.connectors || [])
      .map((cid) => {
        const c = store.get('connectors', cid)
        return c ? { id: c.id, name: c.name, status: c.status, demo: c.dataSource === 'demo' } : null
      })
      .filter(Boolean),
  }))
  ok(res, {
    list,
    market: store.list('marketSkills'),
    connectors: store
      .list('connectors')
      .map((c) => ({ id: c.id, name: c.name, status: c.status, demo: c.dataSource === 'demo' })),
  })
})

router.get('/market', (req, res) => {
  ok(res, { list: store.list('marketSkills') })
})

router.post('/install', (req, res) => {
  const { marketId, projectId } = req.body || {}
  const m = store.get('marketSkills', marketId)
  if (!m) return notFound(res, '市场技能不存在')
  const existing = store.find('skills', (s) => s.name === m.name)
  let skill = existing
  if (!existing) {
    skill = store.insert('skills', {
      name: m.name,
      version: m.version,
      domain: m.domain,
      risk: m.risk,
      desc: m.desc,
      scenario: m.scenario,
      inputs: m.inputs,
      outputs: m.outputs,
      steps: [],
      connectorIds: [],
      failurePolicy: '缺少输入时向用户澄清；异常时保留现场并给出恢复建议',
      status: 'enabled',
      installs: 0,
    })
  }
  if (projectId) {
    const p = store.get('projects', projectId)
    if (p && !p.skillIds.includes(skill.id)) {
      p.skillIds.push(skill.id)
      store.save()
    }
  }
  store.update('marketSkills', m.id, { installed: true })
  audit(actor(req), 'skill.install', 'skill', skill.id, `安装技能「${skill.name}」${projectId ? '并挂载到项目' : ''}`)
  ok(res, { skill })
})

router.post('/:id/toggle', (req, res) => {
  const s = store.get('skills', req.params.id)
  if (!s) return notFound(res, '技能不存在')
  const next = s.status === 'enabled' ? 'disabled' : 'enabled'
  store.update('skills', s.id, { status: next })
  audit(actor(req), 'skill.toggle', 'skill', s.id, `${next === 'enabled' ? '启用' : '停用'}技能「${s.name}」`)
  ok(res, { skill: store.get('skills', s.id) })
})

/* 新建自定义技能（表单，经统一归一化） */
router.post('/', (req, res) => {
  const { data, error } = normalizeSkillImport(req.body || {})
  if (error) return res.status(400).json({ error })
  const { skill, duplicated } = importSkillOnce(data)
  if (duplicated) return res.status(409).json({ error: `已存在同名技能「${data.name}」` })
  ensureSkillToolName(skill)
  audit(actor(req), 'skill.create', 'skill', skill.id, `新建自定义技能「${skill.name}」`)
  ok(res, { skill: store.get('skills', skill.id) })
})

/* 导入技能 JSON */
router.post('/import', (req, res) => {
  let payload = req.body?.payload
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload)
    } catch {
      return res.status(400).json({ error: 'JSON 解析失败：请检查格式' })
    }
  }
  const { data, error } = normalizeSkillImport(payload)
  if (error) return res.status(400).json({ error })
  const { skill, duplicated } = importSkillOnce(data)
  if (duplicated) return res.status(409).json({ error: `已存在同名技能「${data.name}」` })
  ensureSkillToolName(skill)
  audit(actor(req), 'skill.import', 'skill', skill.id, `导入技能「${skill.name}」`)
  ok(res, { skill: store.get('skills', skill.id) })
})

router.delete('/:id', (req, res) => {
  const s = store.get('skills', req.params.id)
  if (!s) return notFound(res, '技能不存在')
  if (!s.custom) return res.status(403).json({ error: '预置技能不可删除，可在列表中停用' })
  store.list('projects').forEach((p) => {
    if (p.skillIds.includes(s.id)) {
      p.skillIds = p.skillIds.filter((x) => x !== s.id)
      store.save()
    }
  })
  store.remove('skills', s.id)
  audit(actor(req), 'skill.delete', 'skill', s.id, `删除自定义技能「${s.name}」`)
  ok(res, { deleted: true })
})

export default router
