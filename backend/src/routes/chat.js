/**
 * AI 对话：SSE 流式入口（挂载于 /api/chat）
 */
import { Router } from 'express'
import { handleChatStream } from '../chat.js'

const router = Router()

router.post('/stream', handleChatStream)

export default router
