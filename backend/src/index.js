/**
 * Creator 后端独立服务入口
 * 端口：BACKEND_PORT（默认 5001，仅内网，前端经 vite proxy / 生产网关转发访问）
 */
import { initStore } from './store.js'
import { createApiApp } from './app.js'

const port = Number(process.env.BACKEND_PORT || 5001)

await initStore()

const app = createApiApp()
app.listen(port, '0.0.0.0', () => {
  console.log(`[backend] Creator API 服务已启动: http://localhost:${port} (env=${process.env.COZE_PROJECT_ENV || 'DEV'})`)
})
