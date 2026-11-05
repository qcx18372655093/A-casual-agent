<template>
  <div>
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="(comp, key) in ABILITY_ICONS"
        :key="key"
        type="button"
        class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border transition-all duration-150"
        :class="[
          tintChipClass(tint),
          modelValue === key ? 'border-foreground/40 shadow-[var(--shadow-card)]' : 'border-transparent hover:bg-muted',
        ]"
        :title="key"
        @click="$emit('update:modelValue', key)"
      >
        <component :is="comp" :size="15" :stroke-width="1.8" />
      </button>
    </div>
    <div class="mt-2.5 flex items-center gap-2">
      <span class="text-[11px] text-muted-foreground">配色</span>
      <button
        v-for="t in ABILITY_TINTS"
        :key="t"
        type="button"
        class="h-5 w-5 cursor-pointer rounded-full border-2 transition-all duration-150"
        :class="tint === t ? 'scale-110 border-foreground/50' : 'border-transparent hover:scale-105'"
        :style="{ background: TINT_COLORS[t] }"
        :title="t"
        @click="$emit('update:tint', t)"
      ></button>
    </div>
  </div>
</template>

<script setup>
import { ABILITY_ICONS, ABILITY_TINTS, tintChipClass } from '../icons.js'

defineProps({
  modelValue: { type: String, default: 'wand' },
  tint: { type: String, default: 'blue' },
})
defineEmits(['update:modelValue', 'update:tint'])

/* 色点背景与 chip token 的 fg 色一致 */
const TINT_COLORS = { green: '#16a34a', blue: '#3b82f6', purple: '#8b5cf6', orange: '#ea8c1f', cyan: '#0ea5b7' }
</script>
