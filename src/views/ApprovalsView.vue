<template>
  <div class="px-6 py-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <p class="text-sm text-muted-foreground">待办与审批按「项目 × 会话」组织，高风险操作在此等待人工裁决；批准后可选择立即继续执行对应任务</p>
      <span v-if="currentProject" class="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <i class="h-1.5 w-1.5 rounded-full bg-success"></i> 当前工作区：{{ currentProject.name }}
      </span>
    </div>

    <Skeleton v-if="loading" kind="rows" :count="5" />
    <template v-else>
      <!-- 项目筛选 -->
      <div v-if="filterOptions.length > 1" class="mt-4 flex flex-wrap items-center gap-2">
        <button
          v-for="opt in filterOptions"
          :key="opt.id || 'all'"
          class="btn-sm rounded-full border px-3 py-1 text-xs transition-colors"
          :class="filter === opt.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground'"
          @click="filter = opt.id"
        >
          {{ opt.name }}
          <span v-if="opt.count" class="ml-1 font-mono text-[10px] opacity-70">{{ opt.count }}</span>
        </button>
      </div>

      <!-- 按项目分组：待审批 + 待办 -->
      <EmptyState
        v-if="!groups.length"
        :icon="ShieldCheck"
        title="没有待处理事项"
        desc="当 AI 请求高风险操作、自动化发现异常或收到指派时，会按项目归集到这里"
        class="mt-6"
      />
      <div v-else class="mt-4 space-y-4">
        <section v-for="g in groups" :key="g.id || 'none'" class="card overflow-hidden">
          <!-- 项目组头部 -->
          <header class="flex flex-wrap items-center gap-2.5 border-b border-border/60 px-4 py-3">
            <span class="flex h-7 w-7 items-center justify-center rounded-lg" :class="[g.chipBg, g.chipFg]">
              <component :is="g.icon" :size="14" />
            </span>
            <RouterLink v-if="g.id" :to="`/projects/${g.id}`" class="text-sm font-semibold transition-colors hover:text-primary">
              {{ g.name }}
            </RouterLink>
            <span v-else class="text-sm font-semibold">{{ g.name }}</span>
            <span v-if="g.type" class="stamp muted"><i></i>{{ g.type }}</span>
            <span v-if="g.id && g.id === gs.currentProjectId" class="stamp success"><i></i>当前工作区</span>
            <span class="ml-auto font-mono text-[10px] text-muted-foreground">
              待审批 {{ g.approvals.length }} · 待办 {{ g.todos.length }}
            </span>
            <RouterLink v-if="g.id" :to="`/projects/${g.id}`" class="btn-ghost btn-sm text-xs">
              进入项目 <ArrowUpRight :size="12" />
            </RouterLink>
          </header>

          <div class="space-y-4 px-4 py-4">
            <!-- 组内待审批 -->
            <div v-if="g.approvals.length">
              <p class="mono-tag text-muted-foreground">待审批 {{ g.approvals.length }}</p>
              <div class="mt-2 space-y-3">
                <ApprovalCard
                  v-for="a in g.approvals"
                  :key="a.id"
                  :approval="a"
                  :acting="a._acting"
                  link-context
                  @decide="(d) => decide(a, d)"
                />
              </div>
            </div>

            <!-- 组内待办 -->
            <div v-if="g.todos.length">
              <p class="mono-tag text-muted-foreground">待办 {{ g.todos.length }}</p>
              <div class="card mt-2 divide-y divide-border/60">
                <div v-for="t in g.todos" :key="t.id" class="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
                  <span class="stamp" :class="priorityTone(t.priority)"><i></i>{{ t.priority || 'P3' }}</span>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm">{{ t.title }}</p>
                    <!-- 来源绑定：会话 / 自动化运行 -->
                    <p class="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground">
                      <RouterLink
                        v-if="t.taskId"
                        :to="`/tasks/${t.taskId}`"
                        class="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                      >
                        <MessagesSquare :size="11" /> 会话：{{ t.taskTitle || t.taskId }}
                      </RouterLink>
                      <RouterLink
                        v-else-if="t.runId"
                        :to="`/automations?run=${t.runId}`"
                        class="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                      >
                        <Bot :size="11" /> {{ t.source || `自动化运行 ${t.runId}` }}
                      </RouterLink>
                      <span v-else class="inline-flex items-center gap-1"><Bot :size="11" /> {{ t.source || '手动指派' }}</span>
                      <span v-if="t.assignee" class="inline-flex items-center gap-1"><UserRound :size="11" /> {{ t.assignee }}</span>
                    </p>
                  </div>
                  <span class="font-mono text-[10px] text-muted-foreground">{{ fmtRelative(t.createdAt) }}</span>
                  <button class="btn-outline btn-sm" @click="completeTodo(t)"><Check :size="12" /> 完成</button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- 审批历史 -->
      <p class="mono-tag mt-8 text-muted-foreground">审批历史</p>
      <table class="table-base mt-3 w-full">
        <thead>
          <tr><th>编号</th><th>事项</th><th>项目</th><th>来源会话</th><th>申请人</th><th>结果</th><th>裁决人</th><th>时间</th></tr>
        </thead>
        <tbody>
          <tr v-for="h in history" :key="h.id">
            <td class="font-mono text-[10px]">AP-{{ h.no }}</td>
            <td class="max-w-xs truncate text-sm">{{ h.title }}</td>
            <td class="text-xs">
              <RouterLink v-if="h.projectId && h.projectName" :to="`/projects/${h.projectId}`" class="transition-colors hover:text-primary">
                {{ h.projectName }}
              </RouterLink>
              <span v-else class="text-muted-foreground">—</span>
            </td>
            <td class="max-w-[180px] truncate text-xs">
              <RouterLink v-if="h.taskId && h.taskTitle" :to="`/tasks/${h.taskId}`" class="inline-flex items-center gap-1 transition-colors hover:text-primary">
                <MessagesSquare :size="11" /> {{ h.taskTitle }}
              </RouterLink>
              <span v-else class="text-muted-foreground">—</span>
            </td>
            <td class="text-xs">{{ h.applicant }}</td>
            <td><StatusStamp :status="h.status" :map="APPROVAL_STATUS" /></td>
            <td class="text-xs">{{ h.decidedBy || h.approver || '—' }}</td>
            <td class="font-mono text-[10px] text-muted-foreground">{{ h.decidedAt ? fmtRelative(h.decidedAt) : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ShieldCheck, Check, FolderKanban, MessagesSquare, Bot, UserRound, ArrowUpRight, Layers } from 'lucide-vue-next'
import { api } from '../api.js'
import { gs, currentProject, toast, refreshUnread } from '../store.js'
import { APPROVAL_STATUS, fmtRelative } from '../utils.js'
import ApprovalCard from '../components/ApprovalCard.vue'
import StatusStamp from '../components/StatusStamp.vue'
import EmptyState from '../components/EmptyState.vue'
import Skeleton from '../components/Skeleton.vue'

const router = useRouter()
const pending = ref([])
const history = ref([])
const todos = ref([])
const loading = ref(true)
const filter = ref('all')

const CHIPS = [
  { bg: 'bg-chip-green-bg', fg: 'text-chip-green-fg' },
  { bg: 'bg-chip-blue-bg', fg: 'text-chip-blue-fg' },
  { bg: 'bg-chip-purple-bg', fg: 'text-chip-purple-fg' },
  { bg: 'bg-chip-orange-bg', fg: 'text-chip-orange-fg' },
  { bg: 'bg-chip-cyan-bg', fg: 'text-chip-cyan-fg' },
]

function priorityTone(p) {
  if (p === 'P1' || p === 'high') return 'danger'
  if (p === 'P2' || p === 'medium') return 'warning'
  return 'muted'
}

/* 按项目分桶：待审批与待办归入同一项目组 */
const allGroups = computed(() => {
  const buckets = new Map()
  const bucket = (projectId) => {
    const key = projectId || null
    if (!buckets.has(key)) {
      const proj = key ? gs.projects.find((p) => p.id === key) : null
      buckets.set(key, {
        id: key,
        name: proj?.name || pending.value.find((a) => a.projectId === key)?.projectName || todos.value.find((t) => t.projectId === key)?.projectName || '未关联项目',
        type: proj?.type || null,
        icon: proj ? FolderKanban : Layers,
        approvals: [],
        todos: [],
      })
    }
    return buckets.get(key)
  }
  for (const a of pending.value) bucket(a.projectId).approvals.push(a)
  for (const t of todos.value) bucket(t.projectId).todos.push(t)
  const list = [...buckets.values()]
  /* 当前工作区项目排最前，其余按待处理数量排序，未关联垫底 */
  list.sort((x, y) => {
    if (x.id === gs.currentProjectId) return -1
    if (y.id === gs.currentProjectId) return 1
    if (!x.id) return 1
    if (!y.id) return -1
    return y.approvals.length + y.todos.length - (x.approvals.length + x.todos.length)
  })
  return list.map((g, i) => ({ ...g, chipBg: CHIPS[i % CHIPS.length].bg, chipFg: CHIPS[i % CHIPS.length].fg }))
})

const groups = computed(() => (filter.value === 'all' ? allGroups.value : allGroups.value.filter((g) => g.id === filter.value)))

const filterOptions = computed(() => {
  const opts = [{ id: 'all', name: '全部项目', count: pending.value.length + todos.value.length }]
  for (const g of allGroups.value) {
    opts.push({ id: g.id, name: g.name, count: g.approvals.length + g.todos.length })
  }
  return opts
})

async function load() {
  loading.value = true
  try {
    const [apData, tdData] = await Promise.all([api.get('/api/approvals'), api.get('/api/todos?status=pending')])
    pending.value = apData.list.filter((a) => a.status === 'pending').map((a) => ({ ...a, _acting: false }))
    history.value = apData.list.filter((a) => a.status !== 'pending')
    todos.value = tdData.list
  } finally {
    loading.value = false
  }
}

async function decide(a, action) {
  a._acting = true
  try {
    const data = await api.post(`/api/approvals/${a.id}/decide`, { decision: action === 'approve' ? 'approved' : 'rejected' })
    toast(action === 'approve' ? '已批准' : '已拒绝')
    await refreshUnread()
    await load()
    // 批准后引导回到任务继续执行
    if (action === 'approve' && data.approval?.taskId) {
      router.push(`/tasks/${data.approval.taskId}`)
    }
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    a._acting = false
  }
}

async function completeTodo(t) {
  await api.post(`/api/todos/${t.id}/complete`)
  await load()
}

onMounted(load)
</script>
