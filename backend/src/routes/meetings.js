/**
 * 会议助手：语音转写（ASR）+ 会议纪要（LLM 流式生成）
 * - POST /:id/transcribe  上传音频 base64 → ASR 识别为带时间戳的转写文本（真实调用）
 * - GET  /:id/minutes/stream  基于转写文本流式生成结构化会议纪要（SSE）
 * 全部接口需登录；转写/纪要结果落库可复用。
 */
import { Router } from 'express'
import { ASRClient, LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk'
import { store, audit } from '../store.js'
import { config } from '../config/index.js'
import { ok, notFound, badRequest, actor } from '../utils/http.js'

const router = Router()

const uid = () => `mt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

/* ------------------------------------------------------------------ */
/* 会议列表 / 详情                                                       */
/* ------------------------------------------------------------------ */
router.get('/', (req, res) => {
  const projectId = req.query.projectId
  let list = store.list('meetings')
  if (projectId) list = list.filter((m) => m.projectId === projectId)
  list = [...list].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  ok(res, { list })
})

router.get('/:id', (req, res) => {
  const m = store.get('meetings', req.params.id)
  if (!m) return notFound(res, '会议不存在')
  ok(res, { meeting: m })
})

/* ------------------------------------------------------------------ */
/* 新建会议记录                                                          */
/* ------------------------------------------------------------------ */
router.post('/', (req, res) => {
  const { title, location, projectId } = req.body || {}
  if (!title) return badRequest(res, '缺少会议标题')
  const meeting = {
    id: uid(),
    title,
    location: location || '',
    projectId: projectId || null,
    status: 'scheduled',
    durationMin: 0,
    transcript: null,
    minutes: null,
    audioName: null,
    demo: false,
    createdAt: new Date().toISOString(),
    createdBy: actor(req),
  }
  store.insert('meetings', meeting)
  audit(actor(req), 'meeting.create', 'meetings', meeting.id, `新建会议「${title}」`)
  ok(res, { meeting })
})

/* ------------------------------------------------------------------ */
/* 语音转写：base64 音频 → ASR → 带时间戳转写文本（真实调用 ASR 服务）      */
/* ------------------------------------------------------------------ */
router.post('/:id/transcribe', async (req, res) => {
  const m = store.get('meetings', req.params.id)
  if (!m) return notFound(res, '会议不存在')

  const { audioBase64, fileName, audioUrl } = req.body || {}
  if (!audioBase64 && !audioUrl) return badRequest(res, '请上传音频文件或提供音频 URL')

  /* 限制：base64 约 20MB（原始文件约 15MB，由 jsonLimit 拦截），超限 413 */
  const fmt = (fileName || '').split('.').pop()?.toLowerCase() || 'mp3'
  const allowed = ['wav', 'mp3', 'ogg', 'm4a', 'aac', 'flac', 'opus']
  if (fileName && !allowed.includes(fmt)) {
    return badRequest(res, `不支持的音频格式 .${fmt}（支持 ${allowed.join('/')}）`)
  }

  try {
    const asr = new ASRClient(new Config(), HeaderUtils.extractForwardHeaders(req.headers))
    const payload = { uid: m.id }
    if (audioUrl) payload.url = audioUrl
    else payload.base64Data = audioBase64
    const result = await asr.recognize(payload)

    const transcript = {
      text: result.text || '',
      duration: result.duration || 0,
      utterances: (result.utterances || []).map((u) => ({
        text: u.text, start: u.start_time, end: u.end_time,
      })),
      engine: 'doubao-asr',
      transcribedAt: new Date().toISOString(),
    }
    m.transcript = transcript
    m.status = 'transcribed'
    m.audioName = fileName || m.audioName
    if (transcript.duration) m.durationMin = Math.max(1, Math.round(transcript.duration / 60000))
    store.save()
    audit(actor(req), 'meeting.transcribe', 'meetings', m.id, `转写会议「${m.title}」（${transcript.utterances.length} 句）`)
    ok(res, { meeting: m, transcript })
  } catch (err) {
    return res.status(502).json({ error: `语音转写失败：${err.message}` })
  }
})

/* ------------------------------------------------------------------ */
/* 会议纪要：SSE 流式生成（LLM）— POST 以便前端携带 Bearer 令牌            */
/* ------------------------------------------------------------------ */
router.post('/:id/minutes/stream', async (req, res) => {
  const m = store.get('meetings', req.params.id)
  if (!m) return notFound(res, '会议不存在')
  if (!m.transcript?.text) return badRequest(res, '请先完成语音转写')

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()
  res.write('retry: 3000\n\n')

  const emit = (event, data) => {
    try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`) } catch { /* closed */ }
  }

  emit('start', { meetingId: m.id, title: m.title })

  const sys = [
    '你是「Creator 会议助手」，负责把会议语音转写稿整理为结构化会议纪要（Markdown）。',
    '输出结构（严格按此组织）：',
    '## 会议概要（3-5 句）',
    '## 关键议题（分点，标注讨论结论）',
    '## 决议事项（明确的结论）',
    '## 行动项（表格：事项 / 负责人 / 时限）',
    '## 风险与遗留问题',
    '要求：忠实于转写原文，不臆造事实；人名/设备型号/数字保持原样；行动项若原文未指定负责人则标「待确认」。',
  ].join('\n')

  const userContent = [
    `会议标题：${m.title}`,
    m.location ? `地点：${m.location}` : '',
    m.durationMin ? `时长：约 ${m.durationMin} 分钟` : '',
    '',
    '转写稿如下：',
    m.transcript.text,
  ].filter(Boolean).join('\n')

  let full = ''
  try {
    const client = new LLMClient(new Config(), HeaderUtils.extractForwardHeaders(req.headers))
    const stream = client.stream(
      [
        { role: 'system', content: sys },
        { role: 'user', content: userContent },
      ],
      { model: config.llmModel, temperature: 0.3 }
    )
    for await (const chunk of stream) {
      const c = chunk?.content
      if (c) {
        const t = typeof c === 'string' ? c : String(c)
        full += t
        emit('delta', { text: t })
      }
    }
    m.minutes = { markdown: full.trim(), generatedAt: new Date().toISOString(), model: config.llmModel }
    m.status = 'minutes_ready'
    store.save()
    audit(actor(req), 'meeting.minutes', 'meetings', m.id, `生成会议纪要「${m.title}」`)
    emit('done', { meetingId: m.id, status: m.status })
  } catch (err) {
    emit('error', { message: `纪要生成失败：${err.message}` })
  }
  res.end()
})

export default router
