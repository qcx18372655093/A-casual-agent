<template>
  <div class="px-6 py-5">
    <p class="text-sm text-muted-foreground">从真实场景中沉淀的任务案例：复制为任务，一键发起同款工作</p>

    <Skeleton v-if="loading" kind="cards" :count="6" />

    <div v-else class="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
      <div v-for="c in list" :key="c.id" class="card flex flex-col p-5">
        <div class="flex items-center gap-2">
          <component :is="scenarioIcon(c.scenario)" :size="16" class="text-primary" />
          <span class="text-xs text-muted-foreground">{{ c.scenario }}</span>
          <span class="stamp warning ml-auto" title="案例基于演示连接器数据运行"><i></i>演示场景</span>
        </div>
        <h3 class="mt-2 font-display text-base font-bold">{{ c.title }}</h3>
        <p class="mt-1.5 flex-1 text-xs leading-relaxed text-muted-foreground">{{ c.goal }}</p>

        <div class="mt-3 rounded-sm border border-border bg-muted/50 px-3 py-2">
          <p class="mono-tag text-muted-foreground">参考提问</p>
          <p class="mt-1 text-xs leading-relaxed">{{ c.prompt }}</p>
        </div>

        <div class="mt-3 flex flex-wrap gap-1">
          <span v-for="sid in c.skillIds || []" :key="sid" class="stamp info"><i></i>{{ skillName(sid) }}</span>
          <span class="stamp muted ml-auto"><i></i>{{ c.usedCount }} 次使用</span>
        </div>

        <div class="mt-3 flex items-center gap-2 border-t border-border/70 pt-3">
          <p class="text-xs text-muted-foreground">复制后统一以「做一做」发起，高风险操作走审批</p>
          <button class="btn-primary btn-sm ml-auto" :disabled="c._copying" @click="copy(c)">
            <Copy :size="12" /> {{ c._copying ? '发起中…' : '复制为任务' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Copy, ClipboardList, FolderKanban, Wand2, Plug, BookOpen } from 'lucide-vue-next'
import { api } from '../api.js'
import { toast } from '../store.js'
import Skeleton from '../components/Skeleton.vue'

const router = useRouter()
const list = ref([])
const skills = ref([])
const loading = ref(true)

function scenarioIcon(s) {
  const key = String(s || '').split('/')[0].trim()
  const map = { 日常办公: ClipboardList, 项目协作: FolderKanban, 专业任务: Wand2, 服务协作: Plug, 资料与知识: BookOpen }
  return map[key] || ClipboardList
}

function skillName(id) {
  return skills.value.find((s) => s.id === id)?.name || id
}

async function load() {
  loading.value = true
  try {
    const [cData, sData] = await Promise.all([api.get('/api/cases'), api.get('/api/skills')])
    list.value = cData.list.map((c) => ({ ...c, _copying: false }))
    skills.value = sData.list
  } finally {
    loading.value = false
  }
}

async function copy(c) {
  c._copying = true
  try {
    const data = await api.post(`/api/cases/${c.id}/copy`)
    toast('已复制为任务，正在发起')
    router.push(`/tasks/new?prompt=${encodeURIComponent(data.prompt)}&projectId=${data.projectId || ''}`)
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    c._copying = false
  }
}

onMounted(load)
</script>
