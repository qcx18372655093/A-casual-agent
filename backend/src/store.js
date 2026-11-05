import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isProd = process.env.COZE_PROJECT_ENV === 'PROD'
// 生产环境仅 /tmp 可写（临时目录，数据可能被系统定期清理）；开发环境落盘 backend/data（在 src 之外，避免 --watch 监听触发重启）
const dataDir = isProd ? path.join('/tmp', 'creator-data') : path.resolve(__dirname, '../data')
const dbFile = path.join(dataDir, 'db.json')

export const COLLECTIONS = [
  'projects',
  'connectors',
  'mcpServers',
  'skills',
  'marketSkills',
  'tasks',
  'automations',
  'automationRuns',
  'spaces',
  'documents',
  'approvals',
  'todos',
  'auditLogs',
  'notifications',
  'cases',
  'activities',
  'demoDevices',
  'demoAlerts',
  'demoWorkorders',
  'opsAlerts',
  'incidents',
  'dqRules',
  'dqRuns',
  'solutions',
  'demoSmartHosts',
  'meetings',
  'visionTasks',
  'users',
  'sessions',
]

function shortId(prefix) {
  const t = Date.now().toString(36)
  const r = crypto.randomBytes(3).toString('hex')
  return `${prefix}_${t}${r}`
}

class Store {
  constructor() {
    this.data = null
    this.timer = null
  }

  load() {
    fs.mkdirSync(dataDir, { recursive: true })
    if (fs.existsSync(dbFile)) {
      try {
        this.data = JSON.parse(fs.readFileSync(dbFile, 'utf8'))
      } catch {
        this.data = null
      }
    }
    if (!this.data || typeof this.data !== 'object') this.data = {}
    for (const c of COLLECTIONS) {
      if (!Array.isArray(this.data[c])) this.data[c] = []
    }
  }

  get isEmpty() {
    return COLLECTIONS.every((c) => (this.data[c] || []).length === 0)
  }

  flush() {
    const tmp = `${dbFile}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2))
    fs.renameSync(tmp, dbFile)
  }

  save() {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      try {
        this.flush()
      } catch (err) {
        console.error('[store] flush failed:', err.message)
      }
    }, 150)
  }

  list(col, filter) {
    const arr = this.data[col] || []
    return filter ? arr.filter(filter) : arr.slice()
  }

  get(col, id) {
    return (this.data[col] || []).find((x) => x.id === id) || null
  }

  find(col, pred) {
    return (this.data[col] || []).find(pred) || null
  }

  insert(col, obj) {
    const rec = { id: obj.id || shortId(col.slice(0, 3)), createdAt: new Date().toISOString(), ...obj }
    this.data[col].push(rec)
    this.save()
    return rec
  }

  update(col, id, patch) {
    const rec = this.get(col, id)
    if (!rec) return null
    Object.assign(rec, patch, { updatedAt: new Date().toISOString() })
    this.save()
    return rec
  }

  remove(col, id) {
    const arr = this.data[col] || []
    const idx = arr.findIndex((x) => x.id === id)
    if (idx === -1) return false
    arr.splice(idx, 1)
    this.save()
    return true
  }

  nextSeq(key) {
    if (!this.data._seq || typeof this.data._seq !== 'object') this.data._seq = {}
    this.data._seq[key] = (this.data._seq[key] || 1000) + 1
    this.save()
    return this.data._seq[key]
  }
}

export const store = new Store()

/** 审计记录：登录、授权、资料访问、AI 工具调用、自动化修改、审批、系统操作 */
export function audit(actor, action, targetType, targetId, detail, result = 'success') {
  return store.insert('auditLogs', {
    seq: store.nextSeq('audit'),
    actor,
    action,
    targetType,
    targetId,
    detail,
    result,
  })
}

/** 初始化：加载数据，空库时写入种子数据 */
export async function initStore() {
  store.load()
  if (store.isEmpty) {
    const { seedAll } = await import('./seed.js')
    seedAll()
    console.log('[store] seeded demo dataset')
  }
  // 平台扩展（多平台域 + 告警/质检/方案）：存量库做一次性补播
  if (store.list('solutions').length === 0 && store.get('skills', 'sk_health')) {
    const { seedPlatform } = await import('./seed-platform.js')
    seedPlatform()
    console.log('[store] seeded platform extension')
  }
  // 账户体系：存量库无用户时补播演示账户（幂等）
  if (store.list('users').length === 0) {
    const { seedUsers } = await import('./auth.js')
    seedUsers()
    console.log('[store] seeded user accounts')
  }
  // SMART6000 集控 / 会议助手 / SSLX 视频识别（幂等补播）
  const { seedSmart } = await import('./seed-smart.js')
  seedSmart()
  store.flush()
}
