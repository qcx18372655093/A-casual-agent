import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

const rawDomain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || ''
const domain = rawDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
const port = Number(process.env.DEPLOY_RUN_PORT || 5000)
// 后端独立服务端口（backend/ 项目，仅内网）
const backendPort = Number(process.env.BACKEND_PORT || 5001)

// 前后端分离：前端为纯 Vue SPA，所有 /api/* 请求经 vite proxy 转发到独立后端服务（含 SSE 流式）
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
        // SSE 流式接口（/api/chat/stream 等）需要即时转发，不做缓冲
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            console.error('[proxy] 后端连接失败:', err.message)
            if (res && !res.headersSent && typeof res.writeHead === 'function') {
              res.writeHead(502, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: '后端服务未启动或不可达（backend）' }))
            }
          })
        },
      },
    },
    // ws 服务本地监听 6000；客户端经公网域名 + /hot/vite-hmr 路径接入（host 缺省回退 location.hostname）
    hmr: domain
      ? { protocol: 'wss', clientPort: 443, path: '/hot/vite-hmr', port: 6000 }
      : { port: 6000, path: '/hot/vite-hmr' },
    // 后端运行时落盘 backend/data/db.json，排除监听避免触发整页刷新
    watch: {
      ignored: ['**/backend/data/**', '**/backend/node_modules/**'],
    },
  },
})
