/**
 * SSLX 视频识别：基于现成多模态大模型（doubao-seed-2-0-pro，支持图片/视频输入）
 * 不做模型训练，直接以提示词驱动的视觉理解完成识别任务。
 * - POST /recognize  上传图片/视频 base64 → 流式输出结构化识别结论（SSE）
 * - GET  /tasks      历史识别任务列表
 * 典型场景：课堂行为分析、设备状态识别、板书/屏幕内容提取、安全巡检。
 */
import { Router } from 'express'
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk'
import { store, audit } from '../store.js'
import { config } from '../config/index.js'
import { ok, badRequest, actor } from '../utils/http.js'

const router = Router()

const uid = () => `vt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

/** 预置识别场景：提示词模板驱动，无需训练 */
export const VISION_SCENES = {
  classroom_behavior: {
    key: 'classroom_behavior',
    name: '课堂行为分析',
    desc: '识别师生行为状态：听讲/举手/互动/低头/离座等分布',
    prompt: '你是智慧教室课堂行为分析引擎。分析这张课堂画面，输出：1) 学生总数与到课估计；2) 行为分布（听讲/举手发言/小组互动/低头/其他）占比；3) 讲台区域状态；4) 课堂专注度评级（高/中/低）与依据；5) 需要关注的情况。用 Markdown 结构化输出，数字尽量具体。',
  },
  device_status: {
    key: 'device_status',
    name: '设备状态识别',
    desc: '识别大屏/投影/灯光/面板等设备画面中的运行状态',
    prompt: '你是显控设备运维识别引擎。分析这张设备画面，输出：1) 画面中的设备清单；2) 每台设备的运行状态判断（正常/异常/待机/关机）与依据（指示灯、屏幕内容、报错信息）；3) 发现的异常或风险点；4) 处置建议。用 Markdown 表格 + 分点输出。',
  },
  content_extract: {
    key: 'content_extract',
    name: '板书/屏幕内容提取',
    desc: '提取黑板板书、投影课件、大屏画面中的文字与图表信息',
    prompt: '你是教学内容数字化引擎。分析这张画面，输出：1) 画面中的文字内容（尽量完整转录）；2) 图表/公式描述；3) 内容主题与知识点归纳；4) 适用场景标签。用 Markdown 结构化输出。',
  },
  safety_patrol: {
    key: 'safety_patrol',
    name: '安全巡检识别',
    desc: '识别教室/机房画面中的安全隐患：通道占用/违规用电/无人设备等',
    prompt: '你是校园安全巡检引擎。分析这张画面，输出：1) 场景类型判断；2) 安全隐患清单（消防通道占用、违规用电、设备过热迹象、人员滞留等）；3) 风险等级（高/中/低/无）；4) 整改建议。用 Markdown 结构化输出，无隐患也要明确说明。',
  },
}

/* ------------------------------------------------------------------ */
/* 历史识别任务                                                          */
/* ------------------------------------------------------------------ */
router.get('/tasks', (req, res) => {
  const list = [...store.list('visionTasks')].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  ok(res, { list: list.slice(0, 50), scenes: Object.values(VISION_SCENES) })
})

/* ------------------------------------------------------------------ */
/* 流式识别：SSE                                                          */
/* ------------------------------------------------------------------ */
router.post('/recognize', async (req, res) => {
  const { scene, dataBase64, fileName, note } = req.body || {}
  const sc = VISION_SCENES[scene]
  if (!sc) return badRequest(res, '未知识别场景')
  if (!dataBase64) return badRequest(res, '请上传图片或视频文件')
  const mediaType = req.body?.mediaType === 'video' ? 'video' : 'image'

  const mime = mediaType === 'video' ? 'video/mp4' : 'image/jpeg'
  const dataUri = dataBase64.startsWith('data:') ? dataBase64 : `data:${mime};base64,${dataBase64}`

  /* SSE 头 */
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()
  res.write('retry: 3000\n\n')
  const emit = (event, data) => {
    try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`) } catch { /* closed */ }
  }

  const task = {
    id: uid(),
    scene,
    sceneName: sc.name,
    mediaType,
    fileName: fileName || (mediaType === 'video' ? 'video.mp4' : 'image.jpg'),
    note: note || '',
    status: 'running',
    result: null,
    createdAt: new Date().toISOString(),
    createdBy: actor(req),
  }
  store.insert('visionTasks', task)
  emit('start', { taskId: task.id, scene: sc.name })

  let full = ''
  try {
    const client = new LLMClient(new Config(), HeaderUtils.extractForwardHeaders(req.headers))
    const content = [
      { type: 'text', text: sc.prompt + (note ? `\n\n补充说明：${note}` : '') },
      mediaType === 'video' ? { type: 'video_url', video_url: { url: dataUri } } : { type: 'image_url', image_url: { url: dataUri } },
    ]
    const stream = client.stream(
      [{ role: 'user', content }],
      { model: config.llmModel, temperature: 0.2 }
    )
    for await (const chunk of stream) {
      const c = chunk?.content
      if (c) {
        const t = typeof c === 'string' ? c : String(c)
        full += t
        emit('delta', { text: t })
      }
    }
    task.status = 'done'
    task.result = full.trim()
    task.model = config.llmModel
    store.save()
    audit(actor(req), 'vision.recognize', 'visionTasks', task.id, `SSLX 识别「${sc.name}」(${task.fileName})`)
    emit('done', { taskId: task.id, status: 'done' })
  } catch (err) {
    task.status = 'failed'
    task.error = err.message
    store.save()
    emit('error', { message: `识别失败：${err.message}` })
  }
  res.end()
})

export default router
