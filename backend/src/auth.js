/**
 * 轻量账户认证模块（文件库自实现，T2 角色分级：admin / approver / member）
 * - users：身份（username 唯一、scrypt 加盐口令哈希、角色）
 * - sessions：不透明随机令牌（7 天有效期），前端经 Authorization: Bearer 携带
 */
import crypto from 'node:crypto'
import { store, audit } from './store.js'

const SESSION_TTL_MS = 7 * 24 * 3600 * 1000

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 32).toString('hex')
}

/** 输出给前端的安全用户视图（不含口令哈希） */
export function publicUser(u) {
  if (!u) return null
  return { id: u.id, username: u.username, name: u.name, role: u.role, roleName: u.roleName, avatar: u.avatar }
}

/** 播种演示账户（平台演示数据的一部分；幂等，仅在 users 为空时执行） */
export function seedUsers() {
  if (store.list('users').length > 0) return
  const defs = [
    { username: 'admin', password: 'admin123', name: '陈志远', role: 'admin', roleName: '管理员 · 项目负责人', avatar: '陈' },
    { username: 'approver', password: 'approver123', name: '李晓梅', role: 'approver', roleName: '审批人', avatar: '李' },
    { username: 'member', password: 'member123', name: '王一帆', role: 'member', roleName: '项目成员', avatar: '王' },
  ]
  for (const d of defs) {
    const salt = crypto.randomBytes(8).toString('hex')
    store.insert('users', {
      id: `u_${d.username}`,
      username: d.username,
      salt,
      passwordHash: hashPassword(d.password, salt),
      name: d.name,
      role: d.role,
      roleName: d.roleName,
      avatar: d.avatar,
    })
  }
  store.save()
}

export function findUserByUsername(username) {
  return store.find('users', (u) => u.username === String(username || '').trim())
}

function createSession(userId) {
  const token = crypto.randomBytes(24).toString('hex')
  store.insert('sessions', {
    token,
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  })
  store.save()
  return token
}

function destroySession(token) {
  const sess = store.find('sessions', (s) => s.token === token)
  if (sess) {
    store.remove('sessions', sess.id)
    store.save()
  }
}

/** 鉴权中间件：校验 Bearer 令牌，挂载 req.user */
export function requireAuth(req, res, next) {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '')
  const token = m ? m[1] : null
  const sess = token ? store.find('sessions', (s) => s.token === token) : null
  if (!sess) return res.status(401).json({ error: '未登录或登录已过期' })
  if (new Date(sess.expiresAt).getTime() < Date.now()) {
    destroySession(token)
    return res.status(401).json({ error: '登录已过期，请重新登录' })
  }
  const user = store.get('users', sess.userId)
  if (!user) return res.status(401).json({ error: '账号不存在或已被移除' })
  req.user = user
  req.sessionToken = token
  next()
}

/** POST /api/auth/login */
export function handleLogin(req, res) {
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: '请输入用户名和密码' })
  const user = findUserByUsername(username)
  if (!user || hashPassword(password, user.salt) !== user.passwordHash) {
    audit(String(username).slice(0, 30), 'auth.login', 'user', null, '登录失败：用户名或密码错误', 'failed')
    return res.status(401).json({ error: '用户名或密码错误' })
  }
  const token = createSession(user.id)
  audit(user.name, 'auth.login', 'user', user.id, '登录系统')
  res.json({ token, user: publicUser(user) })
}

/** POST /api/auth/logout（需登录） */
export function handleLogout(req, res) {
  destroySession(req.sessionToken)
  audit(req.user.name, 'auth.logout', 'user', req.user.id, '退出登录')
  res.json({ ok: true })
}

/** GET /api/auth/me（需登录） */
export function handleMe(req, res) {
  res.json({ user: publicUser(req.user) })
}
