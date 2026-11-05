<template>
  <!-- 登录页：无侧边栏框架 -->
  <router-view v-if="isPublicRoute" />

  <div v-else-if="gs.booted" class="flex h-full">
    <SideBar />
    <main class="min-w-0 flex-1 overflow-y-auto">
      <router-view v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </router-view>
    </main>
    <WorkContextPanel v-if="gs.contextOpen" class="max-xl:hidden" />

    <!-- 轻提示 -->
    <div class="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-80 flex-col gap-2">
      <div
        v-for="t in gs.toasts"
        :key="t.id"
        class="card rise pointer-events-auto px-3 py-2.5 text-sm shadow-[var(--shadow-lift)]"
        :class="t.type === 'error' ? 'border-destructive/50 text-destructive' : ''"
      >
        {{ t.message }}
      </div>
    </div>
  </div>
  <div v-else class="flex h-full items-center justify-center">
    <div class="text-center">
      <p class="font-display text-2xl font-bold">Creator</p>
      <p class="mono-tag mt-2 text-muted-foreground">AI WORKBENCH LOADING…</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { gs, bootstrap, hasToken } from './store.js'
import SideBar from './components/SideBar.vue'
import WorkContextPanel from './components/WorkContextPanel.vue'

const route = useRoute()
const isPublicRoute = computed(() => !!route.meta.public)

onMounted(() => {
  if (hasToken() && !gs.booted) bootstrap()
})
</script>
