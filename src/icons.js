/**
 * 自定义能力（技能/连接器）的可选图标与颜色映射
 * 与后端 ingest.js 的 SKILL_ICONS / ICON_TINTS 白名单保持一致
 */
import {
  Wand2,
  Zap,
  Radar,
  MonitorPlay,
  Settings2,
  FileSearch,
  Bell,
  Database,
  Globe,
  ShieldCheck,
  Workflow,
  MessageSquare,
} from 'lucide-vue-next'

export const ABILITY_ICONS = {
  wand: Wand2,
  zap: Zap,
  radar: Radar,
  monitor: MonitorPlay,
  settings: Settings2,
  search: FileSearch,
  bell: Bell,
  database: Database,
  globe: Globe,
  shield: ShieldCheck,
  workflow: Workflow,
  message: MessageSquare,
}

export const ABILITY_TINTS = ['green', 'blue', 'purple', 'orange', 'cyan']

/** chip 色卡类名（与 @theme 的 chip-* token 对应） */
export function tintChipClass(tint) {
  const t = ABILITY_TINTS.includes(tint) ? tint : 'blue'
  return `bg-chip-${t}-bg text-chip-${t}-fg`
}

export function abilityIcon(key) {
  return ABILITY_ICONS[key] || Wand2
}
