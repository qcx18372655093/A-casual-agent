/**
 * 路由层共享：技能工具名分配与全局工具名查重
 */
import { store } from '../store.js'
import { allToolNames } from '../mcp.js'

/** 自定义技能创建/导入后分配工具名 skill.cx_xxx（幂等），与原 app.js 行为一致 */
export function ensureSkillToolName(skill) {
  if (skill && !skill.toolName) {
    store.update('skills', skill.id, { toolName: `skill.cx_${skill.id.slice(4)}` })
  }
}

/** 校验连接器声明工具名不与现有工具冲突；无冲突返回 null */
export function validateToolNames(tools) {
  if (!tools?.length) return null
  const taken = allToolNames()
  for (const t of tools) {
    if (taken.has(t.name)) return `工具名「${t.name}」已被占用（预置工具或其他连接器），请更换前缀`
  }
  return null
}
