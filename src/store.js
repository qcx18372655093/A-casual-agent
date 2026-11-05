import { reactive, computed } from 'vue'
import { api, getToken, setToken } from './api.js'

/** 全局状态（用户信息、枚举、项目列表、通知、轻提示、上下文面板、当前工作区） */
export const gs = reactive({
  booted: false,
  user: null,
  env: null,
  modes: [],
  models: [],
  projectTypes: [],
  projects: [],
  currentProjectId: null,
  unread: 0,
  toasts: [],
  contextOpen: true,
})

/* ---------- 登录认证 ---------- */
/** 登录：保存令牌并拉取全量引导数据 */
export async function login(username, password) {
  const data = await api.post('/api/auth/login', { username, password })
  setToken(data.token)
  gs.user = data.user
  gs.booted = false
  await bootstrap()
  return data.user
}

/** 登出：注销会话并回登录页 */
export async function logout() {
  try {
    await api.post('/api/auth/logout')
  } catch {
    /* 会话可能已失效，忽略 */
  }
  setToken(null)
  window.location.href = '/login'
}

/** 是否已有登录令牌（仅本地判断，服务端校验由接口 401 兜底） */
export function hasToken() {
  return !!getToken()
}

export async function bootstrap() {
  if (gs.booted) return
  const data = await api.get('/api/bootstrap')
  gs.user = data.user
  gs.env = data.env
  gs.modes = data.modes
  gs.models = data.models
  gs.projectTypes = data.projectTypes
  try {
    const proj = await api.get('/api/projects')
    gs.projects = proj.list || []
  } catch {
    gs.projects = []
  }
  /* 恢复上次选择的工作区；若项目已不存在则清空 */
  try {
    const saved = localStorage.getItem('creator_workspace_project')
    gs.currentProjectId = gs.projects.some((p) => p.id === saved) ? saved : null
  } catch {
    gs.currentProjectId = null
  }
  gs.booted = true
  refreshUnread()
}

/** 项目列表变更后（新建/能力调整）调用以刷新全局项目缓存 */
export async function refreshProjects() {
  try {
    const data = await api.get('/api/projects')
    gs.projects = data.list || []
  } catch {
    /* 静默 */
  }
}

export async function refreshUnread() {
  try {
    const data = await api.get('/api/notifications')
    gs.unread = data.list.filter((n) => !n.read).length
  } catch {
    /* 静默 */
  }
}

/* ---------- 当前工作区（项目 × AI 搭配核心）---------- */
export const currentProject = computed(() => gs.projects.find((p) => p.id === gs.currentProjectId) || null)

export function setCurrentProject(id, { silent = false } = {}) {
  gs.currentProjectId = id || null
  try {
    if (id) localStorage.setItem('creator_workspace_project', id)
    else localStorage.removeItem('creator_workspace_project')
  } catch {
    /* 隐私模式等场景忽略 */
  }
  if (!silent) {
    const p = gs.projects.find((x) => x.id === id)
    if (p) toast(`已切换当前工作区：${p.name}`, 'success')
  }
}

let toastSeq = 0
export function toast(message, type = 'info') {
  const id = ++toastSeq
  gs.toasts.push({ id, message, type })
  setTimeout(() => {
    gs.toasts = gs.toasts.filter((t) => t.id !== id)
  }, 3200)
}
