/**
 * API 应用组装层（createApiApp）
 * ----------------------------------------
 * 仅负责：中间件顺序 + 路由挂载 + 兜底错误处理。
 * 业务逻辑全部下沉到 routes/（控制器）与 services/（领域服务），
 * 数据访问走 store.js，外部能力走 mcp/skills/llm/ingest 等服务模块。
 *
 * 中间件顺序（关键）：
 *   1. CORS
 *   2. body parser（25mb，支持文件 base64 上传）
 *   3. 公开路由（/api/auth/login、/api/health，无需登录）
 *   4. requireAuth 认证闸门
 *   5. 受保护业务路由
 *   6. /api 404 + 统一错误处理
 */
import express from 'express'

import { config } from './config/index.js'
import { corsMiddleware } from './middleware/cors.js'
import { notFoundHandler, errorHandler } from './middleware/error.js'
import { requireAuth } from './auth.js'

import publicRoutes from './routes/public.js'
import authRoutes from './routes/auth.js'
import metaRoutes from './routes/meta.js'
import projectRoutes from './routes/projects.js'
import taskRoutes from './routes/tasks.js'
import chatRoutes from './routes/chat.js'
import automationRoutes from './routes/automations.js'
import runRoutes from './routes/runs.js'
import connectorRoutes from './routes/connectors.js'
import deviceRoutes from './routes/devices.js'
import skillRoutes from './routes/skills.js'
import toolRoutes from './routes/tools.js'
import knowledgeRoutes from './routes/knowledge.js'
import approvalRoutes from './routes/approvals.js'
import todoRoutes from './routes/todos.js'
import notificationRoutes from './routes/notifications.js'
import auditRoutes from './routes/audit.js'
import caseRoutes from './routes/cases.js'
import opsRoutes from './routes/ops.js'
import dataQualityRoutes from './routes/data-quality.js'
import solutionRoutes from './routes/solutions.js'
import smartRoutes from './routes/smart.js'
import meetingRoutes from './routes/meetings.js'
import visionRoutes from './routes/vision.js'

export function createApiApp() {
  const app = express()

  /* 1. 跨域（前后端分离后允许跨域直连，可配置 ALLOWED_ORIGINS） */
  app.use(corsMiddleware)

  /* 2. 请求体解析：知识上传识别支持 15MB 文件（base64 约 20MB），上限 25mb */
  app.use(express.json({ limit: config.jsonLimit }))

  /* 3. 公开路由（无需登录） */
  app.use('/api', publicRoutes)

  /* 4. 其余 /api/* 一律要求登录（Bearer 会话令牌） */
  app.use('/api', requireAuth)
  app.use('/api', authRoutes)

  /* 5. 受保护业务路由（按领域挂载） */
  app.use('/api', metaRoutes) // bootstrap、stats/dashboard
  app.use('/api/projects', projectRoutes)
  app.use('/api/tasks', taskRoutes)
  app.use('/api/chat', chatRoutes) // POST /api/chat/stream（SSE）
  app.use('/api/automations', automationRoutes)
  app.use('/api/runs', runRoutes) // GET /api/runs/:id
  app.use('/api/connectors', connectorRoutes)
  app.use('/api/devices', deviceRoutes)
  app.use('/api/skills', skillRoutes)
  app.use('/api/tools', toolRoutes) // POST /api/tools/test
  app.use('/api', knowledgeRoutes) // /spaces、/knowledge/parse、/knowledge/search、/docs
  app.use('/api/approvals', approvalRoutes)
  app.use('/api/todos', todoRoutes)
  app.use('/api/notifications', notificationRoutes)
  app.use('/api/audit', auditRoutes)
  app.use('/api/cases', caseRoutes)
  app.use('/api', opsRoutes) // /alerts、/incidents
  app.use('/api/data-quality', dataQualityRoutes)
  app.use('/api/solutions', solutionRoutes)
  app.use('/api/smart', smartRoutes) // SMART6000（NET-6000）集控台
  app.use('/api/meetings', meetingRoutes) // 会议助手：转写 + 纪要（SSE）
  app.use('/api/vision', visionRoutes) // SSLX 视频识别（SSE）

  /* 6. 兜底：未匹配接口 404 + 统一错误处理 */
  app.use('/api', notFoundHandler)
  app.use(errorHandler)

  return app
}
