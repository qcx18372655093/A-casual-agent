<template>
  <aside
    class="flex flex-none flex-col border-r border-border bg-sidebar transition-all duration-200"
    :class="collapsed ? 'w-16' : 'w-60'"
  >
    <!-- 品牌 + 折叠 -->
    <div class="flex items-center gap-2.5 px-3 pt-4 pb-3" :class="collapsed ? 'justify-center' : ''">
      <span class="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-chip-green-bg">
        <Bot :size="18" :stroke-width="2" class="text-chip-green-fg" />
      </span>
      <template v-if="!collapsed">
        <div class="min-w-0 flex-1 leading-tight">
          <p class="truncate text-[14px] font-semibold">AI 项目工作台</p>
          <p class="mono-tag text-[9px] text-muted-foreground/70">CREATOR · v0.9.2-preview</p>
        </div>
      </template>
      <button
        class="flex h-6 w-6 flex-none cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        :title="collapsed ? '展开侧栏' : '收起侧栏'"
        @click="collapsed = !collapsed"
      >
        <PanelLeftClose v-if="!collapsed" :size="15" />
        <PanelLeftOpen v-else :size="15" />
      </button>
    </div>

    <!-- 新会话 -->
    <div class="px-3 pb-2">
      <button
        class="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[13px] font-medium transition-all duration-150 hover:border-foreground/30 hover:shadow-sm"
        :class="collapsed && '!px-0'"
        title="新会话"
        @click="router.push('/')"
      >
        <Plus :size="15" :stroke-width="2" />
        <span v-if="!collapsed">新会话</span>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto pb-2">
      <!-- 主导航 -->
      <nav class="space-y-0.5 px-3 py-2">
        <RouterLink v-for="item in workNav" :key="item.to" :to="item.to" custom v-slot="{ navigate }">
          <button
            @click="navigate"
            class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors duration-150"
            :class="[
              isActive(item) ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              collapsed && 'justify-center !px-0',
            ]"
            :title="collapsed ? item.label : ''"
          >
            <component :is="item.icon" :size="16" :stroke-width="1.8" class="flex-none" />
            <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
          </button>
        </RouterLink>
      </nav>

      <!-- 能力与拓展 -->
      <div class="px-3 pt-1">
        <p v-if="!collapsed" class="px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">能力与拓展</p>
        <nav class="space-y-0.5">
          <RouterLink v-for="item in capabilityNav" :key="item.to" :to="item.to" custom v-slot="{ navigate }">
            <button
              @click="navigate"
              class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors duration-150"
              :class="[
                isActive(item) ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                collapsed && 'justify-center !px-0',
              ]"
              :title="collapsed ? item.label : ''"
            >
              <component :is="item.icon" :size="16" :stroke-width="1.8" class="flex-none" />
              <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
            </button>
          </RouterLink>
        </nav>
      </div>

      <!-- 工作区（我的项目） -->
      <div class="mt-1 px-3 pt-1">
        <div class="flex items-center justify-between px-2.5 py-1.5">
          <span v-if="!collapsed" class="text-[11px] font-medium text-muted-foreground">工作区</span>
          <button
            class="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            :class="collapsed && 'mx-auto'"
            title="新建项目"
            @click="router.push('/projects?create=1')"
          >
            <Plus :size="14" />
          </button>
        </div>
        <div class="space-y-0.5">
          <button
            v-for="p in gs.projects"
            :key="p.id"
            class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors duration-150"
            :class="[
              route.path === `/projects/${p.id}` ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              collapsed && 'justify-center !px-0',
            ]"
            :title="collapsed ? p.name : ''"
            @click="pickWorkspace(p)"
          >
            <component :is="projectIcon(p)" :size="14" :stroke-width="1.8" class="flex-none" />
            <template v-if="!collapsed">
              <span class="truncate">{{ p.name }}</span>
              <span
                v-if="gs.currentProjectId === p.id"
                class="ml-auto flex-none rounded-full bg-success/15 px-1.5 py-0.5 text-[9px] font-medium text-success"
                title="当前工作区"
              >工作区</span>
            </template>
          </button>
          <p v-if="!collapsed && gs.projects.length === 0" class="px-2.5 py-2 text-xs text-muted-foreground">暂无项目</p>
        </div>
      </div>
    </div>

    <!-- 底部：通知 / 审计 / 用户 -->
    <div class="border-t border-border px-3 py-2.5">
      <div class="flex items-center gap-1" :class="collapsed ? 'flex-col' : ''">
        <!-- 通知 -->
        <div class="relative">
          <button
            class="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="通知"
            @click="toggleNotif"
          >
            <Bell :size="16" :stroke-width="1.8" />
            <span
              v-if="gs.unread > 0"
              class="absolute top-0.5 right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-0.5 font-mono text-[8px] font-bold text-white"
            >{{ gs.unread }}</span>
          </button>
          <div v-if="showNotif" class="fixed inset-0 z-40" @click="showNotif = false"></div>
          <div v-if="showNotif" class="card absolute bottom-full left-0 z-50 mb-2 w-96 shadow-[var(--shadow-lift)]">
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
        <!-- 审计 -->
        <button
          class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="审计日志"
          @click="router.push('/audit')"
        >
          <ScrollText :size="16" :stroke-width="1.8" />
        </button>
        <!-- 上下文面板 -->
        <button
          class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          :title="gs.contextOpen ? '收起上下文面板' : '展开上下文面板'"
          @click="gs.contextOpen = !gs.contextOpen"
        >
          <PanelRight :size="16" :stroke-width="1.8" />
        </button>

        <!-- 用户 -->
        <div class="relative" :class="collapsed ? '' : 'ml-auto'">
          <button
            class="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-muted"
            @click="showUser = !showUser"
          >
            <span class="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-chip-blue-bg text-[11px] font-semibold text-chip-blue-fg">
              {{ gs.user?.avatar }}
            </span>
            <template v-if="!collapsed">
              <div class="text-left leading-tight">
                <p class="max-w-24 truncate text-[12px] font-medium">{{ gs.user?.name }}</p>
                <p class="text-[10px] text-muted-foreground">{{ gs.user?.roleName }}</p>
              </div>
            </template>
          </button>
          <div v-if="showUser" class="fixed inset-0 z-40" @click="showUser = false"></div>
          <div v-if="showUser" class="card absolute bottom-full right-0 z-50 mb-2 w-44 py-1 shadow-[var(--shadow-lift)]">
            <div class="border-b border-border px-3 py-2">
              <p class="text-[13px] font-medium">{{ gs.user?.name }}</p>
              <p class="text-[11px] text-muted-foreground">{{ gs.user?.roleName }} · {{ gs.user?.username }}</p>
            </div>
            <button
              class="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-danger transition-colors hover:bg-muted"
              @click="doLogout"
            >
              <LogOut :size="14" :stroke-width="1.8" />
              退出登录
            </button>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Bot,
  Plus,
  House,
  LayoutGrid,
  Blocks,
  Puzzle,
  BookMarked,
  Zap,
  Compass,
  Library,
  ScrollText,
  MonitorSmartphone,
  Wrench,
  Package,
  FolderKanban,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRight,
  Bell,
  LogOut,
} from 'lucide-vue-next'
import { api } from '../api.js'
import { gs, logout, refreshUnread, setCurrentProject } from '../store.js'
import { fmtRelative } from '../utils.js'

const route = useRoute()
const router = useRouter()
const collapsed = ref(false)
const showNotif = ref(false)
const showUser = ref(false)
const notifs = ref([])

/* 主导航：工作台 + 项目（AI 任务与待办审批已并入项目内，不再单列） */
const workNav = [
  { to: '/', label: '工作台', icon: House, exact: true },
  { to: '/projects', label: '项目', icon: LayoutGrid },
]

/* 能力与拓展 */
const capabilityNav = [
  { to: '/skills', label: '技能', icon: Blocks },
  { to: '/connectors', label: '系统连接器', icon: Puzzle },
  { to: '/knowledge', label: '知识空间', icon: BookMarked },
  { to: '/automations', label: '自动化', icon: Zap },
  { to: '/solutions', label: 'Agent 方案中心', icon: Compass },
  { to: '/cases', label: '案例库', icon: Library },
]

function isActive(item) {
  if (item.exact) return route.path === item.to
  return route.path.startsWith(item.to)
}

/* 工作区点击：设为当前工作区并进入项目详情 */
function pickWorkspace(p) {
  setCurrentProject(p.id, { silent: true })
  router.push(`/projects/${p.id}`)
}

function projectIcon(p) {
  const t = `${p.type || ''} ${p.name || ''}`
  if (/中控|设备|运维/.test(t)) return MonitorSmartphone
  if (/交付|版本|产品/.test(t)) return Package
  if (/改造|工程/.test(t)) return Wrench
  return FolderKanban
}

async function toggleNotif() {
  showUser.value = false
  showNotif.value = !showNotif.value
  if (showNotif.value) {
    try {
      const data = await api.get('/api/notifications')
      notifs.value = data.list || []
    } catch {
      notifs.value = []
    }
  }
}

async function readAll() {
  try {
    await api.post('/api/notifications/read-all')
    notifs.value = notifs.value.map((n) => ({ ...n, read: true }))
    refreshUnread()
  } catch {
    /* 静默 */
  }
}

async function doLogout() {
  showUser.value = false
  await logout()
}
</script>
