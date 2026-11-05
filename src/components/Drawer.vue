<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="open" class="fixed inset-0 z-[90]">
        <div class="absolute inset-0 bg-foreground/25 backdrop-blur-[2px]" @click="$emit('close')"></div>
        <div
          class="drawer-panel absolute top-0 right-0 flex h-full w-full flex-col border-l border-border bg-background shadow-[var(--shadow-lift)]"
          :style="{ maxWidth: width }"
        >
          <div class="flex flex-none items-center justify-between border-b border-border px-5 py-3">
            <div class="min-w-0">
              <h3 class="font-display truncate text-base font-bold">{{ title }}</h3>
              <p v-if="subtitle" class="mt-0.5 truncate text-xs text-muted-foreground">{{ subtitle }}</p>
            </div>
            <button class="btn-ghost flex-none" @click="$emit('close')"><X :size="16" /></button>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <slot />
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
  width: { type: String, default: '520px' },
})
defineEmits(['close'])
</script>

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.22s ease;
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}
.drawer-enter-active .drawer-panel {
  transition: transform 0.26s cubic-bezier(0.22, 1, 0.36, 1);
}
.drawer-leave-active .drawer-panel {
  transition: transform 0.18s cubic-bezier(0.4, 0, 1, 1);
}
.drawer-enter-from .drawer-panel,
.drawer-leave-to .drawer-panel {
  transform: translateX(100%);
}
</style>
