<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="fixed inset-0 z-[90] flex items-center justify-center p-4">
        <div class="modal-mask absolute inset-0 bg-foreground/25 backdrop-blur-[2px]" @click="$emit('close')"></div>
        <div
          class="modal-panel card relative z-10 max-h-[85vh] w-full overflow-y-auto shadow-[var(--shadow-lift)]"
          :style="{ maxWidth: width }"
        >
          <div class="flex items-center justify-between border-b border-border px-5 py-3">
            <div>
              <h3 class="font-display text-base font-bold">{{ title }}</h3>
              <p v-if="subtitle" class="mt-0.5 text-xs text-muted-foreground">{{ subtitle }}</p>
            </div>
            <button class="btn-ghost" @click="$emit('close')"><X :size="16" /></button>
          </div>
          <div class="px-5 py-4">
            <slot />
          </div>
          <div v-if="$slots.footer" class="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { X } from 'lucide-vue-next'

defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  width: { type: String, default: '560px' },
})
defineEmits(['close'])
</script>

<style scoped>
/* 遮罩淡入淡出 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
/* 面板：缩放 + 轻微上浮 */
.modal-enter-active .modal-panel {
  transition:
    opacity 0.2s ease,
    transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}
.modal-leave-active .modal-panel {
  transition:
    opacity 0.14s ease,
    transform 0.14s ease-in;
}
.modal-enter-from .modal-panel {
  opacity: 0;
  transform: scale(0.96) translateY(8px);
}
.modal-leave-to .modal-panel {
  opacity: 0;
  transform: scale(0.98) translateY(4px);
}
</style>
