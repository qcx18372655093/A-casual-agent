/** 展示辅助：状态映射、时间格式化 */

export const TASK_STATUS = {
  running: { label: '运行中', tone: 'info' },
  waiting_confirm: { label: '待确认计划', tone: 'warning' },
  waiting_approval: { label: '待审批', tone: 'warning' },
  completed: { label: '已完成', tone: 'success' },
  failed: { label: '失败', tone: 'danger' },
  cancelled: { label: '已取消', tone: 'muted' },
}

export const CONNECTOR_STATUS = {
  connected: { label: '已连接', tone: 'success' },
  unauthorized: { label: '未授权', tone: 'muted' },
  expired: { label: '授权过期', tone: 'warning' },
  revoked: { label: '已撤销', tone: 'danger' },
}

export const RUN_STATUS = {
  running: { label: '运行中', tone: 'info' },
  success: { label: '成功', tone: 'success' },
  partial: { label: '部分异常', tone: 'warning' },
  failed: { label: '失败', tone: 'danger' },
}

export const APPROVAL_STATUS = {
  pending: { label: '待审批', tone: 'warning' },
  approved: { label: '已批准', tone: 'success' },
  rejected: { label: '已拒绝', tone: 'danger' },
}

export const SKILL_STATUS = {
  enabled: { label: '已启用', tone: 'success' },
  disabled: { label: '已停用', tone: 'muted' },
}

export const AUTOMATION_STATUS = {
  enabled: { label: '已启用', tone: 'success' },
  paused: { label: '已暂停', tone: 'muted' },
}

export const PROJECT_STATUS = {
  active: { label: '进行中', tone: 'success' },
  paused: { label: '已暂停', tone: 'muted' },
  archived: { label: '已归档', tone: 'muted' },
}

export const SIDE_EFFECT = {
  read: { label: '只读', tone: 'info' },
  write: { label: '写入', tone: 'warning' },
  create: { label: '创建', tone: 'warning' },
  'control-with-approval': { label: '受控操作(需审批)', tone: 'warning' },
}

export const RISK_META = {
  low: { label: '低风险', tone: 'success' },
  medium: { label: '中风险', tone: 'warning' },
  high: { label: '高风险', tone: 'danger' },
}

export function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function fmtDate(iso) {
  if (!iso) return '—'
  return String(iso).slice(0, 10)
}

export function fmtRelative(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} 天前`
  return fmtDate(iso)
}

export function fmtDuration(ms) {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
