<template>
  <!-- 骨架屏加载占位：cards=卡片网格 / rows=列表行 -->
  <div v-if="kind === 'cards'" class="mt-4 grid gap-3" :class="colsClass">
    <div v-for="i in count" :key="i" class="card p-4">
      <div class="flex items-center gap-2">
        <div class="skeleton h-9 w-9 flex-none !rounded-md"></div>
        <div class="skeleton h-3.5 w-32"></div>
        <div class="skeleton ml-auto h-4 w-14 !rounded-full"></div>
      </div>
      <div class="skeleton mt-3 h-3 w-full"></div>
      <div class="skeleton mt-2 h-3 w-4/5"></div>
      <div class="skeleton mt-2 h-3 w-3/5"></div>
      <div class="mt-4 flex gap-2 border-t border-border/60 pt-3">
        <div class="skeleton h-7 w-16"></div>
        <div class="skeleton h-7 w-20"></div>
      </div>
    </div>
  </div>
  <div v-else class="mt-4 space-y-2">
    <div v-for="i in count" :key="i" class="card flex items-center gap-3 px-4 py-3">
      <div class="skeleton h-8 w-8 flex-none !rounded-md"></div>
      <div class="min-w-0 flex-1">
        <div class="skeleton h-3.5 w-2/5"></div>
        <div class="skeleton mt-1.5 h-3 w-3/5"></div>
      </div>
      <div class="skeleton h-4 w-14 flex-none !rounded-full"></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  kind: { type: String, default: 'cards' }, // cards | rows
  count: { type: Number, default: 6 },
  cols: { type: Number, default: 3 },
})
const colsClass = computed(() => ({ 1: 'grid-cols-1', 2: 'xl:grid-cols-2', 3: 'xl:grid-cols-2 2xl:grid-cols-3' })[props.cols] || 'xl:grid-cols-2 2xl:grid-cols-3')
</script>
