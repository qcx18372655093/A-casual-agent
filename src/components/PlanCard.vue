<template>
  <div class="rounded-md border border-warning/50 bg-warning/[0.04]">
    <div class="flex items-center gap-2 border-b border-warning/30 px-4 py-2.5">
      <ClipboardList :size="15" class="text-warning" />
      <span class="text-sm font-semibold">执行计划待确认</span>
      <span class="stamp warning ml-auto"><i></i>plan</span>
    </div>
    <div class="space-y-3 px-4 py-3">
      <div>
        <p class="text-sm font-medium">{{ plan.title }}</p>
        <p v-if="plan.goal" class="mt-0.5 text-xs text-muted-foreground">{{ plan.goal }}</p>
      </div>

      <div v-if="plan.steps?.length">
        <p class="mono-tag text-muted-foreground">执行步骤</p>
        <ol class="mt-1.5 space-y-1.5">
          <li v-for="(s, i) in plan.steps" :key="i" class="flex items-start gap-2.5 text-[13px]">
            <span class="mt-0.5 flex h-4.5 w-4.5 flex-none items-center justify-center rounded-sm border border-border font-mono text-[10px] text-muted-foreground">{{ i + 1 }}</span>
            <div class="min-w-0">
              <span class="font-medium">{{ s.title }}</span>
              <span v-if="s.detail" class="text-muted-foreground"> — {{ s.detail }}</span>
              <div class="mt-0.5 flex flex-wrap gap-1">
                <span v-for="t in s.tools || []" :key="t" class="stamp muted"><i></i>{{ t }}</span>
                <span v-if="s.risk" class="stamp" :class="RISK_META[s.risk]?.tone || 'muted'"><i></i>{{ RISK_META[s.risk]?.label || s.risk }}</span>
              </div>
            </div>
          </li>
        </ol>
      </div>

      <div v-if="plan.scope" class="text-xs">
        <span class="mono-tag text-muted-foreground">数据范围：</span>{{ plan.scope }}
      </div>

      <div v-if="plan.risks?.length" class="text-xs">
        <span class="mono-tag text-muted-foreground">风险：</span>
        <span class="text-destructive">{{ plan.risks.join('；') }}</span>
      </div>

      <div v-if="plan.sideEffects?.length" class="text-xs">
        <span class="mono-tag text-muted-foreground">副作用：</span>{{ plan.sideEffects.join('；') }}
      </div>

      <div v-if="pending" class="flex items-center gap-2 border-t border-warning/30 pt-3">
        <button class="btn-primary" :disabled="acting" @click="$emit('confirm')">
          <Check :size="14" /> {{ acting ? '确认中…' : '确认执行' }}
        </button>
        <button class="btn-outline" :disabled="acting" @click="$emit('cancel')">取消计划</button>
        <span class="ml-auto text-[11px] text-muted-foreground">确认后 AI 将按计划执行；高风险步骤仍会单独请求审批</span>
      </div>
      <div v-else class="flex items-center gap-2 border-t border-warning/30 pt-3">
        <span class="stamp success"><i></i>已确认，按计划执行</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ClipboardList, Check } from 'lucide-vue-next'
import { RISK_META } from '../utils.js'

defineProps({
  plan: { type: Object, required: true },
  pending: { type: Boolean, default: true },
  acting: { type: Boolean, default: false },
})
defineEmits(['confirm', 'cancel'])
</script>
