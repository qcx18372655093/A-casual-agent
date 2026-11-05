/**
 * 知识空间：空间 CRUD、文档入库/删除、上传 AI 识别、检索
 */
import { Router } from 'express'
import { HeaderUtils } from 'coze-coding-dev-sdk'
import { store, audit } from '../store.js'
import { ok, notFound, actor } from '../utils/http.js'
import { parseDocument } from '../ingest.js'
import { kbSearch } from '../mcp.js'

const router = Router()

/* ---------- 空间 ---------- */

router.get('/spaces', (req, res) => {
  ok(res, {
    list: store.list('spaces').map((s) => ({
      ...s,
      docCount: store.list('documents', (d) => d.spaceId === s.id).length,
      projectName: s.projectId ? store.get('projects', s.projectId)?.name : null,
    })),
  })
})

router.post('/spaces', (req, res) => {
  const name = String((req.body || {}).name || '').trim()
  if (!name) return res.status(400).json({ error: '请填写空间名称' })
  const scope = (req.body || {}).scope === 'project' ? 'project' : 'team'
  const duplicated = store.find('spaces', (s) => s.name === name)
  if (duplicated) return res.status(409).json({ error: `已存在同名空间「${name}」` })
  const space = store.insert('spaces', {
    name: name.slice(0, 40),
    scope,
    desc: String((req.body || {}).desc || '').slice(0, 200),
    projectId: (req.body || {}).projectId || null,
    owner: actor(req),
  })
  audit(actor(req), 'knowledge.space.create', 'space', space.id, `新建知识空间「${space.name}」`)
  ok(res, { space })
})

router.delete('/spaces/:id', (req, res) => {
  const space = store.get('spaces', req.params.id)
  if (!space) return notFound(res, '知识空间不存在')
  if (space.builtin) return res.status(403).json({ error: '预置知识空间不可删除' })
  if (store.list('documents', (d) => d.spaceId === space.id).length) {
    return res.status(409).json({ error: '空间内仍有资料，请先清空后再删除' })
  }
  store.remove('spaces', space.id)
  audit(actor(req), 'knowledge.space.delete', 'space', space.id, `删除知识空间「${space.name}」`)
  ok(res, { deleted: true })
})

router.get('/spaces/:id/docs', (req, res) => {
  ok(res, { list: store.list('documents', (d) => d.spaceId === req.params.id) })
})

/* ---------- 文档 ---------- */

/* 第一步：上传文件 → 解析正文 + AI 识别标题/分类/摘要/标签（不立即入库，前端确认后再写库） */
router.post('/parse', async (req, res) => {
  try {
    const result = await parseDocument((req.body || {}).file || {}, HeaderUtils.extractForwardHeaders(req.headers))
    if (!result.ok) return res.status(400).json({ error: result.error })
    audit(
      actor(req),
      'knowledge.parse',
      'document',
      null,
      `解析识别文件「${result.fileName}」（${result.recognizedBy === 'llm' ? 'AI 识别' : '规则识别'}）`,
    )
    ok(res, result)
  } catch (err) {
    res.status(500).json({ error: `文件解析失败：${err.message}` })
  }
})

/* 第二步：确认入库 */
router.post('/spaces/:id/docs', (req, res) => {
  const space = store.get('spaces', req.params.id)
  if (!space) return notFound(res, '知识空间不存在')
  const { title, category, content, tags, summary, source, fileName } = req.body || {}
  if (!title || !content) return res.status(400).json({ error: '缺少文档标题或内容' })
  const doc = store.insert('documents', {
    spaceId: space.id,
    title,
    category: category || '未分类',
    version: 'v1.0',
    tags: Array.isArray(tags) ? tags : [],
    summary: summary || '',
    size: `${(Buffer.byteLength(content) / 1024).toFixed(1)} KB`,
    source: source || (fileName ? `文件导入：${String(fileName).slice(0, 60)}` : '手动上传'),
    indexed: true,
    content,
  })
  store.update('spaces', space.id, { updatedAt: new Date().toISOString() })
  audit(actor(req), 'knowledge.upload', 'document', doc.id, `上传文档「${title}」至「${space.name}」`)
  ok(res, { document: doc })
})

router.delete('/docs/:id', (req, res) => {
  const doc = store.get('documents', req.params.id)
  if (!doc) return notFound(res, '文档不存在')
  store.remove('documents', doc.id)
  audit(actor(req), 'knowledge.delete', 'document', doc.id, `删除文档「${doc.title}」`)
  ok(res, { deleted: true })
})

/* ---------- 检索 ---------- */

router.get('/search', (req, res) => {
  const q = req.query.q || ''
  ok(res, { query: q, list: kbSearch(q, 8) })
})

export default router
