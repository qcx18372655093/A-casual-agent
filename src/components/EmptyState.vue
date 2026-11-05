<template>
  <div class="flex flex-col items-center justify-center px-6 py-12 text-center">
    <div class="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
      <component :is="icon" :size="18" :stroke-width="1.6" />
    </div>
    <p class="mt-3 text-sm font-medium">{{ title }}</p>
    <p v-if="desc" class="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{{ desc }}</p>
    <div class="mt-4"><slot /></div>
  </div>
</template>

<script setup>
import { Inbox } from 'lucide-vue-next'

defineProps({
  icon: { type: [Object, Function], default: () => Inbox },
  title: { type: String, default: '暂无数据' },
  desc: { type: String, default: '' },
})
</script>
