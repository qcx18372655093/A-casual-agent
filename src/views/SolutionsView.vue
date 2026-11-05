<template>
  <div class="px-6 py-5">
    <div>
      <h1 class="font-display text-xl font-bold">Agent 方案中心</h1>
      <p class="mt-1 text-xs text-muted-foreground">按公司业务平台沉淀的 Agent 能力包：每个方案是一组 Skill + 连接器 + 推荐用法，装配到你的项目后，该项目的 AI 立刻获得解决对应痛点的能力</p>
    </div>

    <!-- 目标项目：方案始终装配到具体公司项目 -->
    <div class="card mt-4 flex flex-wrap items-center gap-3 px-4 py-3">
      <FolderKanban :size="16" class="flex-none text-primary" />
      <span class="text-[13px] font-medium">要拓展的项目</span>
      <select v-model="targetProjectId" class="input h-8 min-w-56 !text-[12px]">
        <option value="">— 选择公司项目（装配时也可新建工作区）—</option>
        <option v-for="p in gs.projects" :key="p.id" :value="p.id">{{ p.name }}（{{ p.type }}）</option>
      </select>
      <span v-if="targetProject" class="text-[11px] text-muted-foreground">
        当前已授权 {{ (targetProject.skillIds || []).length }} 技能 · {{ (targetProject.connectorIds || []).length }} 连接器
      </span>
      <button v-if="targetProjectId" class="btn-ghost btn-sm ml-auto" @click="router.push(`/projects/${targetProjectId}`)">
        打开项目 <ArrowRight :size="12" />
      </button>
    </div>

    <!-- 平台域切换 -->
    <div class="mt-4 flex flex-wrap gap-2">
      <button v-for="d in domains" :key="d.v" class="btn-outline btn-sm" :class="domain === d.v && '!bg-primary !text-primary-foreground !border-primary'" @click="domain = d.v; load()">
        {{ d.t }}
      </button>
    </div>

    <Skeleton v-if="loading" kind="cards" :count="6" />

    <div v-else class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
      <div v-for="s in list" :key="s.id" class="card flex flex-col p-5" :class="s.featured ? 'ring-1 ring-primary/10' : ''">
        <div class="flex items-start gap-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-md" :class="domainChip(s.domain)">
            <component :is="iconMap[s.icon] || Sparkles" :size="20" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h3 class="truncate font-display text-base font-bold">{{ s.name }}</h3>
              <span v-if="s.featured" class="stamp info"><i></i>推荐</span>
            </div>
            <p class="mt-0.5 text-xs font-medium text-primary">{{ s.tagline }}</p>
          </div>
        </div>

        <p class="mt-3 text-xs font-semibold">痛点</p>
        <p class="mt-1 text-xs leading-relaxed text-muted-foreground">{{ s.pain }}</p>
        <p class="mt-2 text-xs leading-relaxed">{{ s.desc }}</p>

        <div class="mt-3 flex flex-wrap gap-1">
          <span v-for="sid in s.skillIds" :key="sid" class="stamp info"><i></i>{{ skillName(sid) }}</span>
          <span v-for="cid in s.connectorIds" :key="cid" class="stamp success"><i></i>{{ connectorName(cid) }}</span>
        </div>

        <div class="mt-4 flex items-center gap-2 border-t border-border/70 pt-3">
          <span class="text-xs text-muted-foreground">{{ s.usedCount }} 次装配 · {{ s.appliedProjects }} 个项目在用</span>
          <div class="ml-auto flex gap-2">
            <button class="btn-ghost btn-sm" @click="tryPrompt(s)">
              <MessageSquare :size="12" /> 先试用
            </button>
            <button class="btn-primary btn-sm" @click="openApply(s)">
              <Wand2 :size="12" /> 一键装配
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 装配弹窗 -->
    <Modal :open="applyOpen" :title="`装配方案：${target?.name || ''}`" width="560px" @close="applyOpen = false">
      <div v-if="target" class="space-y-4">
        <p class="text-xs leading-relaxed text-muted-foreground">装配后，以下能力将加入项目授权，AI 在该项目内即可调用：</p>
        <div class="flex flex-wrap gap-1">
          <span v-for="sid in target.skillIds" :key="sid" class="stamp info"><i></i>{{ skillName(sid) }}</span>
          <span v-for="cid in target.connectorIds" :key="cid" class="stamp success"><i></i>{{ connectorName(cid) }}</span>
        </div>

        <div v-if="targetProject" class="rounded-md border border-success/30 bg-success/5 p-3">
          <label class="flex cursor-pointer items-start gap-2 text-sm">
            <input v-model="applyMode" type="radio" value="selected" class="mt-0.5" />
            <span>
              <span class="font-semibold">装配到「{{ targetProject.name }}」</span>
              <span class="block text-xs text-muted-foreground">与现有能力合并，不重复添加</span>
            </span>
          </label>
        </div>
        <div class="rounded-md border border-border p-3">
          <label class="flex cursor-pointer items-start gap-2 text-sm">
            <input v-model="applyMode" type="radio" value="new" class="mt-0.5" />
            <span>
              <span class="font-semibold">创建新的方案工作区</span>
              <span class="block text-xs text-muted-foreground">自动建一个专属项目并装配，适合先试点</span>
            </span>
          </label>
        </div>
        <p class="rounded-md bg-muted/60 p-2.5 text-xs text-muted-foreground">
          <ShieldCheck :size="12" class="mr-1 inline" /> 项目是授权边界：装配只决定“能用什么”；高风险操作仍需计划确认与人工审批。
        </p>
        <div class="flex justify-end gap-2">
          <button class="btn-outline" @click="applyOpen = false">取消</button>
          <button class="btn-primary" :disabled="applying" @click="apply">
            {{ applying ? '装配中…' : '确认装配并发起对话' }}
          </button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  BellRing, BookOpen, Radar, ShieldCheck, MonitorDot, ShieldAlert, LayoutGrid,
  SlidersHorizontal, Presentation, GraduationCap, Sparkles, Wand2, MessageSquare, FolderKanban, ArrowRight,
} from 'lucide-vue-next'
import { api } from '../api.js'
import { gs, toast, refreshProjects } from '../store.js'
import Modal from '../components/Modal.vue'
import Skeleton from '../components/Skeleton.vue'

const router = useRouter()
const route = useRoute()
const targetProjectId = ref(route.query.projectId || gs.currentProjectId || '')
const list = ref([])
const skills = ref([])
const connectors = ref([])
const loading = ref(true)
const domain = ref('all')
const domains = [
  { v: 'all', t: '全部平台' },
  { v: 'ops', t: '综合运维集控' },
  { v: 'ecis', t: '分布式坐席' },
  { v: 'fsp', t: '光纤坐席' },
  { v: 'matrix', t: '矩阵拼接' },
  { v: 'control', t: '中央控制' },
  { v: 'conference', t: '数字会议' },
  { v: 'education', t: '智慧教育' },
]
const iconMap = {
  BellRing, BookOpen, Radar, ShieldCheck, MonitorDot, ShieldAlert, LayoutGrid, SlidersHorizontal, Presentation, GraduationCap,
}

const applyOpen = ref(false)
const target = ref(null)
const applying = ref(false)
const applyMode = ref('new')

const targetProject = computed(() => gs.projects.find((p) => p.id === targetProjectId.value) || null)

function domainChip(d) {
  return {
    ops: 'bg-chip-green-bg text-chip-green-fg',
    ecis: 'bg-chip-blue-bg text-chip-blue-fg',
    fsp: 'bg-chip-purple-bg text-chip-purple-fg',
    matrix: 'bg-chip-orange-bg text-chip-orange-fg',
    control: 'bg-chip-cyan-bg text-chip-cyan-fg',
    conference: 'bg-chip-blue-bg text-chip-blue-fg',
    education: 'bg-chip-green-bg text-chip-green-fg',
  }[d] || 'bg-chip-orange-bg text-chip-orange-fg'
}

function skillName(id) {
  return skills.value.find((s) => s.id === id)?.name || id
}
function connectorName(id) {
  return connectors.value.find((c) => c.id === id)?.name || id
}

async function load() {
  loading.value = true
  try {
    const [d, sk, cn] = await Promise.all([
      api.get(`/api/solutions?domain=${domain.value}`),
      api.get('/api/skills'),
      api.get('/api/connectors'),
    ])
    list.value = d.list
    skills.value = sk.list
    connectors.value = cn.list
  } finally {
    loading.value = false
  }
}

function openApply(s) {
  target.value = s
  applyMode.value = targetProjectId.value ? 'selected' : 'new'
  applyOpen.value = true
}

function tryPrompt(s) {
  const pid = targetProjectId.value ? `&projectId=${encodeURIComponent(targetProjectId.value)}` : ''
  router.push(`/tasks/new?${pid ? pid.slice(1) + '&' : ''}prompt=${encodeURIComponent(s.prompt)}`)
}

async function apply() {
  applying.value = true
  try {
    const payload = applyMode.value === 'selected' && targetProjectId.value ? { projectId: targetProjectId.value } : {}
    const d = await api.post(`/api/solutions/${target.value.id}/apply`, payload)
    await refreshProjects()
    if (applyMode.value === 'new') gs.setCurrentProject(d.project.id)
    toast('方案装配完成，能力已加入项目授权')
    applyOpen.value = false
    router.push(`/tasks/new?projectId=${d.project.id}&prompt=${encodeURIComponent(target.value.prompt)}`)
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    applying.value = false
  }
}

watch(
  () => route.query.projectId,
  (pid) => {
    if (pid) targetProjectId.value = String(pid)
  },
)

onMounted(load)
</script>
