<template>
  <div class="mx-auto max-w-6xl px-6 py-8">
    <div class="rise flex items-end justify-between">
      <div>
        <h2 class="font-display text-2xl font-black">任务中心</h2>
        <p class="mt-1 text-sm text-muted-foreground">每个任务都是一条可回看的执行台账：输入、计划、工具调用、审批与产物。</p>
      </div>
      <button class="btn-primary" @click="$router.push({ path: '/tasks/new' })">
        <Plus :size="14" /> 发起任务
      </button>
    </div>

    <!-- 筛选 -->
    <div class="rise rise-1 mt-5 flex flex-wrap items-center gap-2">
      <input v-model="q" class="input w-56" placeholder="搜索任务标题…" />
      <select v-model="status" class="input w-44">
        <option value="">全部状态</option>
        <option value="running">运行中</option>
        <option value="waiting_confirm">待确认计划</option>
        <option value="waiting_approval">待审批</option>
        <option value="completed">已完成</option>
        <option value="failed">失败</option>
        <option value="cancelled">已取消</option>
      </select>
      <select v-model="projectId" class="input w-56">
        <option value="">全部项目</option>
        <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
    </div>

    <!-- 列表 -->
    <div class="rise rise-2 card mt-4">
      <table v-if="list.length" class="table-base w-full">
        <thead>
          <tr><th>编号</th><th>任务</th><th>项目</th><th>状态</th><th>数据</th><th>发起时间</th></tr>
        </thead>
        <tbody>
          <tr v-for="t in list" :key="t.id" class="cursor-pointer transition-colors hover:bg-muted/50" @click="$router.push(`/tasks/${t.id}`)">
            <td class="font-mono text-xs text-muted-foreground">{{ t.displayId }}</td>
            <td class="max-w-72 truncate font-medium">{{ t.title }}</td>
            <td class="text-xs text-muted-foreground">{{ projectName(t.projectId) }}</td>
            <td><StatusStamp :status="t.status" :map="TASK_STATUS" /></td>
            <td>
              <span v-if="t.demo" class="stamp warning" title="使用了演示连接器数据"><i></i>演示</span>
              <span v-else class="stamp muted"><i></i>—</span>
            </td>
            <td class="font-mono text-xs text-muted-foreground">{{ fmtTime(t.createdAt) }}</td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-else-if="!loading" title="没有符合条件的任务" />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { Plus } from 'lucide-vue-next'
import { toast } from '../store.js'
import { api } from '../api.js'
import { TASK_STATUS, fmtTime } from '../utils.js'
import StatusStamp from '../components/StatusStamp.vue'
import EmptyState from '../components/EmptyState.vue'

const list = ref([])
const projects = ref([])
const loading = ref(true)
const q = ref('')
const status = ref('')
const projectId = ref('')

function projectName(id) {
  if (!id) return '独立任务'
  return projects.value.find((p) => p.id === id)?.name || id
}

async function load() {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (q.value) params.set('q', q.value)
    if (status.value) params.set('status', status.value)
    if (projectId.value) params.set('projectId', projectId.value)
    const data = await api.get(`/api/tasks?${params}`)
    list.value = data.list
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    loading.value = false
  }
}

let timer = null
watch([q, status, projectId], () => {
  clearTimeout(timer)
  timer = setTimeout(load, 250)
})

onMounted(async () => {
  load()
  try {
    const data = await api.get('/api/projects')
    projects.value = data.list
  } catch {
    /* 静默 */
  }
})
</script>
