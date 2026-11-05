<template>
  <div class="mx-auto max-w-6xl px-6 py-8">
    <div class="rise flex items-end justify-between">
      <div>
        <h2 class="font-display text-2xl font-black">公司项目</h2>
        <p class="mt-1 text-sm text-muted-foreground">项目是 AI 任务的授权边界：成员、指令、连接器与技能均在项目内管理。</p>
      </div>
      <button class="btn-primary" @click="showCreate = true"><Plus :size="14" /> 新建项目</button>
    </div>

    <!-- 筛选 -->
    <div class="rise rise-1 mt-5 flex flex-wrap items-center gap-2">
      <input v-model="q" class="input w-56" placeholder="搜索项目名称 / 目标…" />
      <select v-model="type" class="input w-40">
        <option value="">全部类型</option>
        <option v-for="t in gs.projectTypes" :key="t" :value="t">{{ t }}</option>
      </select>
      <select v-model="status" class="input w-36">
        <option value="">全部状态</option>
        <option value="active">进行中</option>
        <option value="paused">已暂停</option>
        <option value="archived">已归档</option>
      </select>
    </div>

    <!-- 项目列表 -->
    <div class="rise rise-2 mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
      <div
        v-for="p in list"
        :key="p.id"
        class="card group cursor-pointer p-5 transition-colors duration-150 hover:border-primary/50"
        @click="$router.push(`/projects/${p.id}`)"
      >
        <div class="flex items-start justify-between gap-3">
          <h3 class="font-display text-lg leading-snug font-bold group-hover:text-primary">{{ p.name }}</h3>
          <StatusStamp :status="p.status" :map="PROJECT_STATUS" />
        </div>
        <p class="mt-2 line-clamp-2 min-h-10 text-[13px] leading-relaxed text-muted-foreground">{{ p.goal }}</p>
        <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span>{{ p.type }}</span>
          <span>负责人 {{ p.owner }}</span>
          <span>任务 {{ p.taskCount }}</span>
          <span>资料 {{ p.docCount }}</span>
          <span class="ml-auto">{{ fmtRelative(p.updatedAt || p.createdAt) }}更新</span>
        </div>
      </div>
    </div>
    <EmptyState v-if="!loading && list.length === 0" title="没有符合条件的项目" desc="调整筛选条件，或创建一个新项目" />

    <!-- 新建项目 -->
    <Modal :open="showCreate" title="新建项目" subtitle="创建后可在项目设置中配置 AI 工作指令、连接器与技能" @close="showCreate = false">
      <div class="space-y-3">
        <div>
          <label class="label">项目名称 *</label>
          <input v-model="form.name" class="input mt-1" placeholder="例如：智慧教室运维项目" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">项目类型 *</label>
            <select v-model="form.type" class="input mt-1">
              <option v-for="t in gs.projectTypes" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div>
            <label class="label">负责人</label>
            <input v-model="form.owner" class="input mt-1" placeholder="负责人姓名" />
          </div>
        </div>
        <div>
          <label class="label">项目目标</label>
          <textarea v-model="form.goal" class="input mt-1 h-20 resize-none" placeholder="这个项目要达成什么？"></textarea>
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <button class="btn-outline" @click="showCreate = false">取消</button>
          <button class="btn-primary" :disabled="creating || !form.name.trim()" @click="create">
            {{ creating ? '创建中…' : '创建项目' }}
          </button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Plus } from 'lucide-vue-next'
import { gs, toast, refreshProjects } from '../store.js'
import { api } from '../api.js'
import { fmtRelative } from '../utils.js'
import StatusStamp from '../components/StatusStamp.vue'
import EmptyState from '../components/EmptyState.vue'
import Modal from '../components/Modal.vue'

const route = useRoute()

const PROJECT_STATUS = {
  active: { label: '进行中', tone: 'success' },
  paused: { label: '已暂停', tone: 'warning' },
  archived: { label: '已归档', tone: 'muted' },
}

const list = ref([])
const loading = ref(true)
const q = ref('')
const type = ref('')
const status = ref('')
const showCreate = ref(false)
const creating = ref(false)
const form = ref({ name: '', type: '运维运营', owner: '陈志远', goal: '' })

async function load() {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (q.value) params.set('q', q.value)
    if (type.value) params.set('type', type.value)
    if (status.value) params.set('status', status.value)
    const data = await api.get(`/api/projects?${params}`)
    list.value = data.list
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    loading.value = false
  }
}

async function create() {
  creating.value = true
  try {
    const data = await api.post('/api/projects', form.value)
    toast('项目已创建')
    showCreate.value = false
    form.value = { name: '', type: '运维运营', owner: '陈志远', goal: '' }
    list.value.unshift({ ...data.project, taskCount: 0, docCount: 0 })
    refreshProjects()
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    creating.value = false
  }
}

let timer = null
watch([q, type, status], () => {
  clearTimeout(timer)
  timer = setTimeout(load, 250)
})

onMounted(() => {
  load()
  if (route.query.create === '1') showCreate.value = true
})
</script>
