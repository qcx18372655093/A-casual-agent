/**
 * 集中配置：全部来自环境变量，禁止在业务代码中硬编码
 */
export const config = {
  /** 后端服务端口（仅内网，前端经 vite proxy / 生产网关转发） */
  port: Number(process.env.BACKEND_PORT || 5001),
  host: process.env.BACKEND_HOST || '0.0.0.0',
  env: process.env.COZE_PROJECT_ENV || 'DEV',
  isProd: process.env.COZE_PROJECT_ENV === 'PROD',
  /** 允许跨域来源（逗号分隔），缺省放开便于开发 */
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim()),
  /** 请求体上限：知识上传识别支持 15MB 文件（base64 约 20MB） */
  jsonLimit: process.env.JSON_LIMIT || '25mb',
  /** 默认 LLM 模型（豆包 Seed 2.0 Pro，支持文本/图片/视频多模态输入） */
  llmModel: process.env.LLM_MODEL || 'doubao-seed-2-0-pro-260215',
}
