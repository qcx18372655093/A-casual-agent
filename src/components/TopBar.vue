<template>
  <header class="flex h-13 flex-none items-center gap-3 border-b border-border bg-background px-5 py-2.5">
    <!-- 面包屑 -->
    <nav class="flex items-center gap-1.5 text-[13px]">
      <span class="text-muted-foreground">Creator 工作空间</span>
      <ChevronRight :size="13" class="text-muted-foreground/50" />
      <span class="font-medium">{{ route.meta.title || '工作台' }}</span>
    </nav>

    <div class="ml-auto flex items-center gap-1">
      <!-- 搜索 -->
      <button class="btn-ghost" title="搜索（知识空间）" @click="router.push('/knowledge')">
        <Search :size="15" :stroke-width="1.8" />
        <span class="text-[13px]">搜索</span>
      </button>
      <!-- 分享 -->
      <button class="btn-ghost" title="复制当前页面链接" @click="share">
        <Share2 :size="15" :stroke-width="1.8" />
        <span class="text-[13px]">分享</span>
      </button>
      <!-- 更多 -->
      <div class="relative">
        <button class="btn-ghost" @click="showMore = !showMore">
          <MoreHorizontal :size="16" :stroke-width="1.8" />
        </button>
        <div v-if="showMore" class="fixed inset-0 z-40" @click="showMore = false"></div>
        <div v-if="showMore" class="card absolute right-0 z-50 mt-1 w-44 py-1 shadow-[var(--shadow-lift)]">
          <button
            v-for="m in moreLinks"
            :key="m.to"
            class="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            @click="router.push(m.to); showMore = false"
          >
            <component :is="m.icon" :size="14" :stroke-width="1.8" />
            {{ m.label }}
          </button>
          <div class="my-1 border-t border-border"></div>
          <button
            class="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            @click="gs.contextOpen = !gs.contextOpen; showMore = false"
          >
            <PanelRight :size="14" :stroke-width="1.8" />
            {{ gs.contextOpen ? '收起上下文面板' : '展开上下文面板' }}
          </button>
        </div>
      </div>

      <!-- 通知 -->
      <div class="relative">
        <button class="btn-ghost relative" @click="toggleNotif">
          <Bell :size="15" :stroke-width="1.8" />
          <span
            v-if="gs.unread > 0"
            class="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 font-mono text-[9px] font-bold text-white"
          >
            {{ gs.unread }}
          </span>
        </button>
        <div v-if="showNotif" class="fixed inset-0 z-40" @click="showNotif = false"></div>
        <div v-if="showNotif" class="card absolute right-0 z-50 mt-1 w-96 shadow-[var(--shadow-lift)]">
          <div class="flex items-center justify-between border-b border-border px-3 py-2">
            <span class="text-xs font-medium text-muted-foreground">通知</span>
            <button class="btn-ghost text-xs" @click="readAll">全部已读</button>
          </div>
          <div class="max-h-80 overflow-y-auto">
            <div v-if="notifs.length === 0" class="px-4 py-6 text-center text-sm text-muted-foreground">暂无通知</div>
            <div
              v-for="n in notifs"
              :key="n.id"
              class="border-b border-border/50 px-3 py-2.5 last:border-0"
              :class="n.read ? 'opacity-55' : ''"
            >
              <div class="flex items-center gap-2">
                <span class="stamp" :class="n.kind === 'approval' ? 'warning' : n.kind === 'anomaly' ? 'danger' : 'info'">
                  <i></i>{{ n.kind === 'approval' ? '审批' : n.kind === 'anomaly' ? '异常' : '自动化' }}
                </span>
                <span class="text-[10px] text-muted-foreground">{{ fmtRelative(n.createdAt) }}</span>
              </div>
              <p class="mt-1 text-[13px] font-medium">{{ n.title }}</p>
              <p class="mt-0.5 text-xs text-muted-foreground">{{ n.body }}</p>
              <RouterLink v-if="n.link" :to="n.link" class="mt-1 inline-block text-xs font-medium text-info hover:underline" @click="showNotif = false">
                前往处理 →
              </RouterLink>
            </div>
          </div>
        </div>
      </div>

      <!-- 用户 -->
      <div class="relative ml-1 border-l border-border pl-3">
        <button class="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-muted" @click="showUser = !showUser">
          <span class="flex h-7 w-7 items-center justify-center rounded-full bg-chip-blue-bg text-[11px] font-semibold text-chip-blue-fg">
            {{ gs.user?.avatar }}
          </span>
          <div class="text-left leading-tight">
            <p class="text-[13px] font-medium">{{ gs.user?.name }}</p>
            <p class="text-[10px] text-muted-foreground">{{ gs.user?.roleName }}</p>
          </div>
        </button>
        <div v-if="showUser" class="fixed inset-0 z-40" @click="showUser = false"></div>
        <div v-if="showUser" class="card absolute right-0 z-50 mt-1 w-40 py-1 shadow-[var(--shadow-lift)]">
          <div class="border-b border-border px-3 py-2">
            <p class="text-[13px] font-medium">{{ gs.user?.name }}</p>
            <p class="mt-0.5 font-mono text-[10px] text-muted-foreground">{{ gs.user?.username }}</p>
          </div>
          <button
            class="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
            @click="showUser = false; logout()"
          >
            <LogOut :size="14" :stroke-width="1.8" />
            退出登录
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Bell, ChevronRight, Search, Share2, MoreHorizontal, PanelRight, ScrollText, Compass, Library, LogOut } from 'lucide-vue-next'
import { gs, refreshUnread, toast, logout } from '../store.js'
import { api } from '../api.js'
import { fmtRelative } from '../utils.js'

const route = useRoute()
const router = useRouter()
const showNotif = ref(false)
const showMore = ref(false)
const showUser = ref(false)
const notifs = ref([])

const moreLinks = [
  { to: '/solutions', label: 'Agent 方案中心', icon: Compass },
  { to: '/cases', label: '案例库', icon: Library },
  { to: '/alerts', label: '告警中心', icon: Bell },
  { to: '/audit', label: '审计日志', icon: ScrollText },
]

async function toggleNotif() {
  showNotif.value = !showNotif.value
  if (showNotif.value) await load()
}

async function load() {
  try {
    const data = await api.get('/api/notifications')
    notifs.value = data.list
  } catch {
    /* 静默 */
  }
}

async function readAll() {
  try {
    await api.post('/api/notifications/read-all')
    await load()
    refreshUnread()
  } catch {
    /* 静默 */
  }
}

async function share() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    toast('链接已复制，可分享给团队成员')
  } catch {
    toast('复制失败，请手动复制地址栏链接', 'error')
  }
}
</script>
