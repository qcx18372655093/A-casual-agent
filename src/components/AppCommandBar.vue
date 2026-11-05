<template>
  <div class="card overflow-hidden">
    <!-- 输入区（豆包式） -->
    <div class="flex items-start gap-3 p-4">
      <button
        class="mt-0.5 grid size-7 flex-none place-items-center rounded-full border border-border text-muted-foreground transition hover:bg-muted"
        title="功能入口"
        @click="$emit('plus')"
      >
        <Plus :size="14" />
      </button>
      <textarea
        v-model="text"
        rows="2"
        class="flex-1 resize-none bg-transparent pt-1 text-[13.5px] leading-relaxed outline-none placeholder:text-muted-foreground/70"
        :placeholder="placeholder"
        @keydown.meta.enter="submit"
        @keydown.ctrl.enter="submit"
        @keydown.enter.exact.prevent="submit"
      ></textarea>
      <button
        class="mt-0.5 grid size-8 flex-none place-items-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 active:scale-95 disabled:opacity-40"
        :disabled="!text.trim()"
        title="发送（Enter）"
        @click="submit"
      >
        <ArrowUp :size="15" />
      </button>
    </div>
    <!-- 功能 chips -->
    <div class="flex flex-wrap items-center gap-2 border-t border-border/60 bg-muted/30 px-4 py-2.5">
      <button
        v-for="c in chips"
        :key="c.key"
        class="func-chip"
        :disabled="busy"
        @click="$emit('chip', c.key)"
      >
        <component :is="c.icon" :size="13" :class="c.cls" />
        {{ c.label }}
      </button>
      <span v-if="hint" class="ml-auto hidden text-[11px] text-muted-foreground lg:block">{{ hint }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Plus, ArrowUp } from 'lucide-vue-next'

defineProps({
  placeholder: { type: String, default: '发消息，或点击下方功能快捷入口…' },
  chips: { type: Array, default: () => [] },
  hint: { type: String, default: '' },
  busy: { type: Boolean, default: false },
})
const emit = defineEmits(['chip', 'submit', 'plus'])
const text = ref('')

function submit() {
  const v = text.value.trim()
  if (!v) return
  emit('submit', v)
  text.value = ''
}
</script>
