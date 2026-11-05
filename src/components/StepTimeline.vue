<template>
  <div v-if="steps.length" class="relative space-y-3 pl-4">
    <span class="absolute top-1 bottom-1 left-[5px] w-px bg-border"></span>
    <div v-for="(s, i) in steps" :key="s.id || `${s.tool}-${i}`" class="relative">
      <span
        class="absolute top-1 -left-4 h-2.5 w-2.5 rounded-full border-2 border-background"
        :class="dotClass(s)"
      ></span>
      <div class="flex items-center gap-1.5">
        <p class="truncate text-xs font-medium">{{ s.name }}</p>
        <span v-if="s.demo" class="stamp warning flex-none" title="演示连接器数据"><i></i>演示</span>
      </div>
      <p class="mt-0.5 font-mono text-[10px] break-all text-muted-foreground">{{ s.tool }}</p>
      <p v-if="s.summary" class="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{{ s.summary }}</p>
      <p class="mt-0.5 font-mono text-[10px] text-muted-foreground/70">
        {{ statusLabel(s) }}<template v-if="s.durationMs != null"> · {{ fmtDuration(s.durationMs) }}</template>
      </p>
    </div>
  </div>
  <p v-else class="text-xs text-muted-foreground">尚无执行步骤。AI 调用技能或 MCP 工具时，步骤会逐条点亮。</p>
</template>

<script setup>
import { fmtDuration } from '../utils.js'

defineProps({
  steps: { type: Array, default: () => [] },
})

function dotClass(s) {
  if (s.status === 'running') return 'bg-info animate-pulse'
  if (s.status === 'ok') return 'bg-success'
  if (s.status === 'error') return 'bg-destructive'
  if (s.status === 'blocked' || s.status === 'waiting') return 'bg-warning'
  return 'bg-muted-foreground'
}

function statusLabel(s) {
  const map = { running: '执行中', ok: '完成', error: '失败', blocked: '被策略拦截', waiting: '等待审批' }
  return map[s.status] || s.status
}
</script>
