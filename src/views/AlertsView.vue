<template>
  <div :class="embedded ? '' : 'px-6 py-5'">
    <!-- 头部 -->
    <div class="flex flex-wrap items-center gap-3">
      <div>
        <h1 :class="embedded ? 'text-base font-bold' : 'font-display text-xl font-bold'">
          告警降噪 · 根因分析
          <span class="stamp warning ml-1"><i></i>演示数据</span>
        </h1>
        <p class="mt-1 text-xs text-muted-foreground">AI 将编解码节点、拼接处理器、中控、矩阵、录播等设备告警关联降噪，把几十条告警变成几个真正需要处理的事件</p>
      </div>
      <button class="btn-primary ml-auto" :disabled="analyzing" @click="runAnalysis">
        <Wand2 :size="14" /> {{ analyzing ? 'AI 分析中…' : 'AI 关联分析' }}
      </button>
    </div>

    <!-- 统计 -->
    <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      <div class="card p-4">
        <p class="text-xs text-muted-foreground">活跃告警</p>
        <p class="mt-1 font-display text-2xl font-bold">{{ stats.total || 0 }}</p>
        <p class="mt-0.5 text-xs text-danger">严重 {{ stats.critical || 0 }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs text-muted-foreground">AI 关联事件</p>
        <p class="mt-1 font-display text-2xl font-bold">{{ stats.incidents || 0 }}</p>
        <p class="mt-0.5 text-xs text-muted-foreground">同源告警已归并</p>
      </div>
      <div class="card p-4">
        <p class="text-xs text-muted-foreground">降噪抑制</p>
        <p class="mt-1 font-display text-2xl font-bold text-success">{{ stats.suppressed || 0 }}</p>
        <p class="mt-0.5 text-xs text-muted-foreground">重复/派生告警</p>
      </div>
      <div class="card p-4">
        <p class="text-xs text-muted-foreground">待确认根因</p>
        <p class="mt-1 font-display text-2xl font-bold text-warning">{{ incidents.filter((i) => i.status !== 'resolved').length }}</p>
        <p class="mt-0.5 text-xs text-muted-foreground">需人工确认后沉淀</p>
      </div>
    </div>

    <!-- 事件（AI 关联结果） -->
    <section class="mt-5">
      <div class="flex items-center gap-2">
        <BrainCircuit :size="16" class="text-primary" />
        <h2 class="section-title">关联事件</h2>
      </div>
      <div class="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div v-for="inc in incidents" :key="inc.id" class="card p-4">
          <div class="flex items-center gap-2">
            <span class="stamp" :class="inc.severity === 'P1' ? 'danger' : 'warning'"><i></i>{{ inc.severity }}</span>
            <span class="stamp" :class="inc.confidence === 'high' ? 'success' : 'muted'"><i></i>{{ inc.confidence === 'high' ? '高置信' : '待核实' }}</span>
            <span class="stamp muted ml-auto"><i></i>{{ statusText(inc.status) }}</span>
          </div>
          <h3 class="mt-2 text-sm font-bold">{{ inc.title }}</h3>
          <p class="mt-1.5 rounded-md bg-muted/60 p-2.5 text-xs leading-relaxed">
            <span class="font-semibold">AI 根因假设：</span>{{ inc.rootCause }}
          </p>
          <div class="mt-2 flex flex-wrap gap-1">
            <span v-for="a in inc.alertIds" :key="a" class="mono-tag">{{ a }}</span>
            <span v-for="a in inc.suppressedIds" :key="'s' + a" class="stamp muted line-through"><i></i>{{ a }} 已抑制</span>
          </div>
          <p class="mt-2 text-xs text-muted-foreground">影响面：{{ inc.impact }}</p>
          <div class="mt-2 flex items-center gap-2">
            <select v-model="inc.status" class="input h-8 w-32 text-xs" @change="updateIncident(inc)">
              <option value="open">待处理</option>
              <option value="investigating">排查中</option>
              <option value="resolved">已解决</option>
            </select>
            <button class="btn-outline btn-sm" @click="askSop(inc)">
              <MessageCircleQuestion :size="12" /> 追问处置流程
            </button>
            <span class="ml-auto text-xs text-muted-foreground">{{ inc.assignee || '未认领' }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 原始告警流 -->
    <section class="mt-5">
      <div class="flex flex-wrap items-center gap-2">
        <Activity :size="16" class="text-primary" />
        <h2 class="section-title">原始告警流</h2>
        <div class="ml-auto flex gap-1">
          <button v-for="f in filters" :key="f.v" class="btn-ghost btn-sm" :class="statusFilter === f.v && '!bg-primary !text-primary-foreground'" @click="statusFilter = f.v; load()">{{ f.t }}</button>
        </div>
      </div>
      <div class="card mt-3 overflow-hidden">
        <table class="table-base">
          <thead>
            <tr>
              <th>级别</th><th>告警</th><th>来源 / 对象</th><th>指标值</th><th>状态</th><th>降噪</th><th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in alerts" :key="a.id" :class="a.suppressed ? 'opacity-50' : ''">
              <td><span class="stamp" :class="sevTone(a.severity)"><i></i>{{ sevText(a.severity) }}</span></td>
              <td>
                <p class="font-medium">{{ a.title }}</p>
                <p class="text-xs text-muted-foreground">{{ a.message }}</p>
              </td>
              <td><span class="mono-tag">{{ a.source }}</span><p class="text-xs text-muted-foreground">{{ a.target }}</p></td>
              <td class="font-mono text-xs">{{ a.value }}{{ a.unit }}</td>
              <td>
                <span class="stamp" :class="a.status === 'active' ? 'warning' : 'muted'"><i></i>{{ a.status === 'active' ? '活跃' : '已恢复' }}</span>
              </td>
              <td>
                <span v-if="a.suppressed" class="stamp success"><i></i>已抑制</span>
                <span v-else-if="a.dedupKey" class="stamp muted"><i></i>重复</span>
                <span v-else-if="a.status === 'recovered'" class="stamp muted"><i></i>抖动自愈</span>
                <span v-else class="text-xs text-muted-foreground">—</span>
              </td>
              <td>
                <button v-if="a.status === 'active' && !a.acknowledged" class="btn-ghost btn-sm" @click="ack(a)">确认已知晓</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- AI 分析抽屉 -->
    <Modal :open="analysisOpen" title="AI 告警关联分析" width="820px" @close="analysisOpen = false">
      <div v-if="analyzing" class="py-16 text-center text-sm text-muted-foreground">
        <Loader2 :size="22" class="mx-auto animate-spin" />
        <p class="mt-3">正在关联时间窗内的告警、匹配 SOP…</p>
      </div>
      <div v-else>
        <div class="mb-3 flex flex-wrap gap-2 text-xs">
          <span class="stamp info"><i></i>{{ analysisData.groupCount || 0 }} 个事件</span>
          <span class="stamp success"><i></i>抑制 {{ analysisData.suppressedCount || 0 }} 条重复告警</span>
          <span class="stamp muted"><i></i>{{ analysisData.noiseCount || 0 }} 条抖动自愈不打扰</span>
          <span class="stamp warning ml-auto"><i></i>演示监控数据 · 根因需人工确认</span>
        </div>
        <MarkdownText :text="analysisText" class="md max-h-[60vh] overflow-y-auto" />
      </div>
    </Modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Wand2, BrainCircuit, Activity, Loader2, MessageCircleQuestion } from 'lucide-vue-next'
import { api } from '../api.js'
import { toast } from '../store.js'
import Modal from '../components/Modal.vue'
import MarkdownText from '../components/MarkdownText.vue'

/* embedded=true 时作为项目「智能应用」内嵌运行，发起追问自动携带 projectId */
const props = defineProps({
  embedded: { type: Boolean, default: false },
  projectId: { type: String, default: '' },
})

const router = useRouter()
const alerts = ref([])
const incidents = ref([])
const stats = ref({})
const statusFilter = ref('all')
const filters = [
  { v: 'all', t: '全部' },
  { v: 'active', t: '活跃' },
  { v: 'recovered', t: '已恢复' },
]

const analyzing = ref(false)
const analysisOpen = ref(false)
const analysisText = ref('')
const analysisData = ref({})

async function load() {
  const q = statusFilter.value === 'all' ? '' : `?status=${statusFilter.value}`
  const d = await api.get(`/api/alerts${q}`)
  alerts.value = (d.list || []).sort((a, b) => new Date(b.firedAt) - new Date(a.firedAt))
  incidents.value = d.incidents || []
  stats.value = d.stats || {}
}

async function runAnalysis() {
  analyzing.value = true
  analysisOpen.value = true
  analysisText.value = ''
  try {
    const d = await api.post('/api/alerts/analyze', { timeWindow: '60m' })
    analysisData.value = d
    analysisText.value = d.analysis
    await load()
  } catch (err) {
    analysisText.value = `分析失败：${err.message}`
  } finally {
    analyzing.value = false
  }
}

async function ack(a) {
  await api.patch(`/api/alerts/${a.id}`, { acknowledged: true })
  toast('已确认该告警')
  load()
}

async function updateIncident(inc) {
  await api.patch(`/api/incidents/${inc.id}`, { status: inc.status })
  toast('事件状态已更新')
}

function askSop(inc) {
  const pid = props.projectId ? `&projectId=${encodeURIComponent(props.projectId)}` : ''
  router.push(`/tasks/new?${pid ? pid.slice(1) + '&' : ''}prompt=${encodeURIComponent(`针对事件「${inc.title}」，请结合知识库 SOP 给出标准处置流程与注意事项。根因假设：${inc.rootCause}`)}`)
}

function sevText(s) {
  return { critical: '严重', warning: '警告', info: '提示' }[s] || s
}
function sevTone(s) {
  return { critical: 'danger', warning: 'warning', info: 'muted' }[s] || 'muted'
}
function statusText(s) {
  return { open: '待处理', investigating: '排查中', resolved: '已解决' }[s] || s
}

onMounted(load)
</script>
