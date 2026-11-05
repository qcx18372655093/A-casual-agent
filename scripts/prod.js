/**
 * 生产编排网关（前后端分离）：
 * 1) 拉起独立后端服务（backend/src/index.js，BACKEND_PORT，崩溃自动重启）
 * 2) 本进程监听 DEPLOY_RUN_PORT：托管 dist 静态资源 + SPA 兜底 + /api 流式代理（支持 SSE）
 */
import express from 'express'
import { spawn } from 'node:child_process'
import { Readable } from 'node:stream'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const distDir = path.join(root, 'dist')
const PORT = Number(process.env.DEPLOY_RUN_PORT || 5000)
const BACKEND_PORT = Number(process.env.BACKEND_PORT || 5001)

let shuttingDown = false
let child = null
function startBackend() {
  child = spawn('node', ['backend/src/index.js'], {
    cwd: root,
    env: { ...process.env, BACKEND_PORT: String(BACKEND_PORT) },
    stdio: 'inherit',
  })
  child.on('exit', (code, sig) => {
    if (shuttingDown) return
    console.error(`[prod] backend exited (code=${code} sig=${sig}), restarting in 1s`)
    setTimeout(startBackend, 1000)
  })
}
startBackend()

const app = express()

// /api → 后端流式代理（body 原样透传，响应管道输出，SSE 不缓冲）
app.use('/api', async (req, res) => {
  const controller = new AbortController()
  res.on('close', () => {
    if (!res.writableEnded) controller.abort()
  })
  try {
    const headers = { ...req.headers }
    delete headers.host
    delete headers.connection
    delete headers['content-length']
    const hasBody = !['GET', 'HEAD'].includes(req.method)
    const upstream = await fetch(`http://localhost:${BACKEND_PORT}${req.originalUrl}`, {
      method: req.method,
      headers,
      body: hasBody ? req : undefined,
      duplex: hasBody ? 'half' : undefined,
      signal: controller.signal,
    })
    res.status(upstream.status)
    upstream.headers.forEach((value, key) => {
      const k = key.toLowerCase()
      if (['connection', 'transfer-encoding', 'keep-alive'].includes(k)) return
      res.setHeader(key, value)
    })
    if (upstream.body) Readable.fromWeb(upstream.body).pipe(res)
    else res.end()
  } catch (err) {
    if (controller.signal.aborted) return
    console.error('[prod] proxy error:', err.message)
    if (!res.headersSent) res.status(502).json({ error: '后端服务暂不可用，请稍后重试' })
    else res.destroy()
  }
})

app.use(express.static(distDir, { maxAge: '1h', index: false }))

// SPA 兜底（Express 5 不使用通配路由，改用中间件判断）
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) return next()
  const indexHtml = path.join(distDir, 'index.html')
  if (fs.existsSync(indexHtml)) return res.sendFile(indexHtml)
  return res.status(503).send('前端资源未构建，请先执行 pnpm run build')
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[prod] Creator 网关已启动: http://localhost:${PORT} → 后端 127.0.0.1:${BACKEND_PORT}`)
})

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    shuttingDown = true
    try {
      child?.kill()
    } catch {
      /* 忽略 */
    }
    process.exit(0)
  })
}
