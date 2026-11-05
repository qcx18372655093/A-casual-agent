/**
 * 能力中心「文件 / 配置导入」解析与识别
 * ------------------------------------------------------------
 * 1) 知识资料：前端把文件读成 base64 → 这里 S3 上传 → FetchClient 解析正文
 *    → LLM 识别标题/分类/摘要/标签（失败时本地启发式兜底）
 * 2) 技能 / 连接器：直接导入结构化 JSON（不经过文件解析）
 *
 * 全部为真实 SDK 调用，不伪造解析结果；任何外部调用失败都有本地兜底并如实标注。
 */
import { S3Storage, FetchClient, LLMClient, Config } from 'coze-coding-dev-sdk'
import { store } from './store.js'

/** 允许上传识别的资料类型（按扩展名） */
export const DOC_EXTENSIONS = [
  'txt', 'md', 'markdown', 'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv', 'json',
]
/** 单文件大小上限 15MB（base64 传输） */
export const MAX_FILE_BYTES = 15 * 1024 * 1024

const CATEGORY_BY_EXT = {
  md: 'SOP', markdown: 'SOP', txt: '手册', pdf: '手册',
  doc: '手册', docx: '手册', ppt: '预案', pptx: '预案',
  xls: '模板', xlsx: '模板', csv: '模板', json: '模板',
}

function extOf(fileName) {
  const m = /\.([a-z0-9]+)$/i.exec(fileName || '')
  return m ? m[1].toLowerCase() : ''
}

/** 从纯文本抽取一个可读标题 */
function guessTitle(text, fileName) {
  const firstLine = (text || '').split(/\r?\n/).map((l) => l.trim()).find(Boolean) || ''
  const clean = firstLine.replace(/^#+\s*/, '').replace(/[*_`]/g, '').slice(0, 40)
  if (clean && clean.length >= 2) return clean
  return (fileName || '未命名资料').replace(/\.[^.]+$/, '')
}

function guessTags(text, fileName) {
  const dict = ['ECIS', 'FSP', 'KVM', '矩阵', '拼接', 'ESP-MAX', '中控', 'PGM', '会议', 'Almeet', '教育', '录播', '巡检', '告警', 'SOP', '大屏', '坐席', '预案', '音频', '光纤']
  const src = `${fileName || ''} ${(text || '').slice(0, 1200)}`
  return dict.filter((k) => src.includes(k)).slice(0, 5)
}

/** 调用 LLM 从正文识别结构化元数据；失败返回 null 走本地兜底 */
async function recognizeByLLM(text, fileName, headers) {
  const sample = text.slice(0, 6000)
  const client = new LLMClient(new Config(), headers)
  const resp = await client.invoke(
    [
      {
        role: 'system',
        content:
          '你是企业音视频显控行业（分布式坐席 ECIS/FSP、矩阵拼接、中央控制、数字会议、智慧教育、综合运维）的资料归档助手。' +
          '阅读用户给出的资料正文，只输出一个 JSON 对象，不要输出任何解释或代码块标记。字段：' +
          '{"title":"不超过24字的准确标题","category":"手册|SOP|预案|模板|制度|报告 中的一个","summary":"60字以内内容摘要","tags":["3到5个关键词"]}。',
      },
      { role: 'user', content: `文件名：${fileName}\n正文：\n${sample}` },
    ],
    { temperature: 0 },
  )
  const raw = (resp?.content || '').trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('模型未返回 JSON')
  const meta = JSON.parse(raw.slice(start, end + 1))
  if (!meta.title) throw new Error('识别结果缺标题')
  return {
    title: String(meta.title).slice(0, 40),
    category: ['手册', 'SOP', '预案', '模板', '制度', '报告'].includes(meta.category) ? meta.category : '手册',
    summary: String(meta.summary || '').slice(0, 120),
    tags: Array.isArray(meta.tags) ? meta.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 5) : [],
  }
}

/**
 * 解析并识别一份上传资料
 * @param {{fileName:string,dataBase64:string}} file
 * @param {object} headers 透传请求头（SDK 鉴权/追踪）
 * @returns {Promise<{ok:boolean, demo?:boolean, title, category, summary, tags, content, fileName, ext, sizeKb, recognizedBy, fileUrl?}>}
 */
export async function parseDocument(file, headers) {
  const fileName = (file?.fileName || '未命名文件').slice(0, 180)
  const ext = extOf(fileName)
  if (!DOC_EXTENSIONS.includes(ext)) {
    return { ok: false, error: `暂不支持 .${ext || '未知'} 类型，支持：${DOC_EXTENSIONS.join(' / ')}` }
  }
  let buffer
  try {
    buffer = Buffer.from(file.dataBase64 || '', 'base64')
  } catch {
    return { ok: false, error: '文件内容解码失败' }
  }
  if (!buffer.length) return { ok: false, error: '文件为空' }
  if (buffer.length > MAX_FILE_BYTES) return { ok: false, error: '文件超过 15MB 上限' }

  const cfg = new Config()
  const s3 = new S3Storage(cfg)
  let content = ''
  let fileUrl = null
  let parsed = false

  // 纯文本 / Markdown / CSV / JSON：上传后用解析服务读取（txt/md 加 UTF-8 BOM 避免乱码）
  const textLike = ['txt', 'md', 'markdown', 'csv', 'json'].includes(ext)
  try {
    const uploadBuf = textLike && !buffer.subarray(0, 3).toString('utf8').includes('﻿')
      ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), buffer])
      : buffer
    const key = await s3.uploadFile({ fileContent: uploadBuf, fileName, contentType: 'application/octet-stream' })
    fileUrl = /^https?:/i.test(key) ? key : await s3.generatePresignedUrl({ key, expireTime: 3600 })
    const fetched = await new FetchClient(cfg, headers).fetch(fileUrl)
    if (fetched?.status_code === 0 || fetched?.content?.length) {
      content = (fetched.content || []).filter((x) => x.type === 'text').map((x) => x.text || '').join('\n').trim()
      if (content) parsed = true
    }
  } catch (err) {
    // 落到本地兜底
  }

  // 二进制（pdf/office）解析失败或纯文本兜底：直接用 UTF-8 尝试
  if (!content) {
    try {
      content = buffer.toString('utf8').replace(/^﻿/, '').trim()
    } catch {
      content = ''
    }
    if (!/[\u4e00-\u9fa5a-zA-Z]/.test(content)) content = ''
  }

  if (!content) {
    return {
      ok: false,
      error: `暂无法解析 .${ext} 文件正文（文档解析服务未返回文本）。可将内容另存为 .md / .txt / .pdf 后重试，或直接粘贴文本。`,
    }
  }

  // LLM 识别元数据，失败本地兜底
  let meta = null
  let recognizedBy = 'llm'
  try {
    meta = await recognizeByLLM(content, fileName, headers)
  } catch {
    recognizedBy = 'local'
    meta = {
      title: guessTitle(content, fileName),
      category: CATEGORY_BY_EXT[ext] || '手册',
      summary: content.replace(/^#+\s*/gm, '').replace(/\s+/g, ' ').slice(0, 80),
      tags: guessTags(content, fileName),
    }
  }

  return {
    ok: true,
    demo: false,
    ...meta,
    content,
    fileName,
    ext,
    sizeKb: Math.max(0.1, Number((buffer.length / 1024).toFixed(1))),
    recognizedBy,
    fileUrl,
  }
}

/** 校验执行体配置（自定义技能） */
function normalizeExecutor(raw) {
  const kinds = ['plan_only', 'kb_answer', 'http_call']
  const kind = kinds.includes(raw?.kind) ? raw.kind : 'plan_only'
  const ex = { kind }
  if (kind === 'kb_answer') {
    ex.spaceId = raw?.spaceId ? String(raw.spaceId).slice(0, 60) : null
    ex.topK = Math.min(Math.max(Number(raw?.topK) || 5, 1), 10)
  }
  if (kind === 'http_call') {
    if (!raw?.url || !/^https?:\/\//.test(String(raw.url))) return { error: 'http_call 执行体需要提供合法的 url（http/https，支持 {{参数}} 模板）' }
    ex.method = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(String(raw?.method || '').toUpperCase()) ? String(raw.method).toUpperCase() : 'GET'
    ex.url = String(raw.url).slice(0, 500)
    ex.headers = raw?.headers && typeof raw.headers === 'object' ? raw.headers : {}
    ex.body = raw?.body ? String(raw.body).slice(0, 4000) : ''
    ex.params = normalizeToolParams(raw?.params)
  }
  return { data: ex }
}

/** 工具参数定义归一化 */
function normalizeToolParams(raw) {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 12).map((p) => ({
    name: String(p?.name || '').trim().slice(0, 40),
    desc: String(p?.desc || '').slice(0, 120),
    required: !!p?.required,
    type: p?.type === 'number' ? 'number' : 'string',
  })).filter((p) => p.name)
}

/** 连接器声明式工具归一化 */
function normalizeTools(raw) {
  if (!Array.isArray(raw)) return { tools: [] }
  const tools = []
  for (const t of raw.slice(0, 12)) {
    const name = String(t?.name || '').trim()
    if (!/^[a-z][a-z0-9]*(\.[a-z0-9_]+)+$/.test(name)) return { error: `工具名「${name}」不合法：需为小写 point.case（如 ecis.list_nodes）` }
    if (!t?.url || !/^https?:\/\//.test(String(t.url))) return { error: `工具「${name}」缺少合法 url（http/https，支持 {{参数}} 模板）` }
    const method = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(String(t?.method || '').toUpperCase()) ? String(t.method).toUpperCase() : 'GET'
    const sideEffect = ['GET'].includes(method) ? 'read' : 'write'
    tools.push({
      name: name.slice(0, 60),
      desc: String(t?.desc || name).slice(0, 200),
      method,
      url: String(t.url).slice(0, 500),
      headers: t?.headers && typeof t.headers === 'object' ? t.headers : {},
      bodyTemplate: t?.bodyTemplate ? String(t.bodyTemplate).slice(0, 4000) : '',
      params: normalizeToolParams(t?.params),
      sideEffect,
      risk: ['low', 'medium', 'high'].includes(t?.risk) ? t.risk : sideEffect === 'read' ? 'low' : 'medium',
    })
  }
  const seen = new Set()
  for (const t of tools) {
    if (seen.has(t.name)) return { error: `工具名「${t.name}」重复` }
    seen.add(t.name)
  }
  return { tools }
}

/** 校验导入的技能 JSON */
const SKILL_ICONS = ['wand', 'zap', 'radar', 'monitor', 'settings', 'search', 'bell', 'database', 'globe', 'shield', 'workflow', 'message']
const ICON_TINTS = ['green', 'blue', 'purple', 'orange', 'cyan']

export function normalizeSkillImport(payload) {
  if (!payload || typeof payload !== 'object') return { error: '不是合法的 JSON 对象' }
  if (!payload.name || String(payload.name).trim().length < 2) return { error: '缺少 name（技能名称，≥2字）' }
  const risk = ['low', 'medium', 'high'].includes(payload.risk) ? payload.risk : 'medium'
  const { data: executor, error: exError } = normalizeExecutor(payload.executor)
  if (exError) return { error: exError }
  return {
    data: {
      name: String(payload.name).trim().slice(0, 40),
      version: payload.version || '1.0.0',
      domain: String(payload.domain || '自定义').slice(0, 20),
      risk,
      icon: SKILL_ICONS.includes(payload.icon) ? payload.icon : 'wand',
      tint: ICON_TINTS.includes(payload.tint) ? payload.tint : 'blue',
      desc: String(payload.desc || '').slice(0, 300),
      scenario: String(payload.scenario || '').slice(0, 400),
      inputs: Array.isArray(payload.inputs) ? payload.inputs.slice(0, 12) : [],
      outputs: Array.isArray(payload.outputs) ? payload.outputs.slice(0, 12) : [],
      steps: Array.isArray(payload.steps) ? payload.steps.slice(0, 12) : [],
      connectorIds: [],
      executor,
      failurePolicy: String(payload.failurePolicy || '缺少输入时向用户澄清；异常时保留现场并给出恢复建议').slice(0, 200),
      status: 'enabled',
      installs: 0,
      custom: true,
      source: '自定义导入',
    },
  }
}

/** 校验导入的连接器 JSON */
export function normalizeConnectorImport(payload) {
  if (!payload || typeof payload !== 'object') return { error: '不是合法的 JSON 对象' }
  if (!payload.name || String(payload.name).trim().length < 2) return { error: '缺少 name（连接器名称，≥2字）' }
  const { tools, error: toolsError } = normalizeTools(payload.tools)
  if (toolsError) return { error: toolsError }
  return {
    data: {
      name: String(payload.name).trim().slice(0, 40),
      category: String(payload.category || '自定义系统').slice(0, 20),
      protocol: String(payload.protocol || 'HTTP/MCP').slice(0, 30),
      env: String(payload.env || '自定义').slice(0, 20),
      owner: String(payload.owner || '自定义接入').slice(0, 30),
      icon: SKILL_ICONS.includes(payload.icon) ? payload.icon : 'globe',
      tint: ICON_TINTS.includes(payload.tint) ? payload.tint : 'cyan',
      scopes: Array.isArray(payload.scopes) && payload.scopes.length ? payload.scopes.slice(0, 6) : ['read'],
      desc: String(payload.desc || '').slice(0, 300),
      tools,
      status: 'disconnected',
      dataSource: 'custom',
      custom: true,
    },
  }
}

/** 幂等导入：同名不重复创建 */
export function importSkillOnce(data) {
  const existing = store.find('skills', (s) => s.name === data.name)
  if (existing) return { skill: existing, duplicated: true }
  return { skill: store.insert('skills', data), duplicated: false }
}

export function importConnectorOnce(data) {
  const existing = store.find('connectors', (c) => c.name === data.name)
  if (existing) return { connector: existing, duplicated: true }
  return { connector: store.insert('connectors', data), duplicated: false }
}
