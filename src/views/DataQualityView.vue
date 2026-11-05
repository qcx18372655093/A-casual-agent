<template>
  <div :class="embedded ? '' : 'px-6 py-5'">
    <div class="flex flex-wrap items-center gap-3">
      <div>
        <h1 :class="embedded ? 'text-base font-bold' : 'font-display text-xl font-bold'">数据质量监控 <span class="stamp warning ml-1"><i></i>演示数据</span></h1>
        <p class="mt-1 text-xs text-muted-foreground">对重复、缺失、超阈值、标签不规范等问题自动监控，Agent 输出问题清单、影响面与治理建议</p>
      </div>
      <button class="btn-primary ml-auto" :disabled="running" @click="runCheck">
        <Play :size="14" /> {{ running ? '质检执行中…' : '立即质检' }}
      </button>
    </div>

    <!-- 统计 -->
    <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
      <div class="card p-4"><p class="text-xs text-muted-foreground">启用规则</p><p class="mt-1 font-display text-2xl font-bold">{{ stats.enabled || 0 }}<span class="text-sm font-normal text-muted-foreground">/{{ stats.rules || 0 }}</span></p></div>
      <div class="card p-4"><p class="text-xs text-muted-foreground">不通过</p><p class="mt-1 font-display text-2xl font-bold text-danger">{{ stats.failed || 0 }}</p></div>
      <div class="card p-4"><p class="text-xs text-muted-foreground">预警</p><p class="mt-1 font-display text-2xl font-bold text-warning">{{ stats.warning || 0 }}</p></div>
      <div class="card p-4"><p class="text-xs text-muted-foreground">问题记录</p><p class="mt-1 font-display text-2xl font-bold">{{ stats.issues || 0 }}</p></div>
      <div class="card p-4"><p class="text-xs text-muted-foreground">AI 治理建议</p>
        <button class="mt-1 text-left text-xs text-primary underline underline-offset-2" @click="askAI">向 Agent 提问</button>
      </div>
    </div>

    <!-- 规则 -->
    <div class="card mt-4 overflow-hidden">
      <table class="table-base">
        <thead>
          <tr><th>规则</th><th>数据集</th><th>类型</th><th>级别</th><th>问题数 / 环比</th><th>最近执行</th><th>状态</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="r in rules" :key="r.id">
            <td>
              <p class="font-medium">{{ r.name }}</p>
              <p class="max-w-md text-xs text-muted-foreground">{{ r.detail }}</p>
            </td>
            <td><span class="mono-tag">{{ r.dataset }}</span></td>
            <td><span class="stamp info"><i></i>{{ typeText(r.type) }}</span></td>
            <td><span class="stamp" :class="r.severity === 'P1' ? 'danger' : r.severity === 'P2' ? 'warning' : 'muted'"><i></i>{{ r.severity }}</span></td>
            <td>
              <span class="font-mono text-sm font-semibold" :class="r.lastStatus === 'failed' ? 'text-danger' : r.lastStatus === 'warning' ? 'text-warning' : 'text-success'">{{ r.lastCount }}</span>
              <TrendIcon :trend="r.trend" />
            </td>
            <td class="text-xs text-muted-foreground">{{ fmtTime(r.lastRunAt) }}<br /><span class="mono-tag">{{ r.schedule }}</span></td>
            <td>
              <span class="stamp" :class="r.lastStatus === 'passed' ? 'success' : r.lastStatus === 'failed' ? 'danger' : 'warning'"><i></i>{{ statusText(r.lastStatus) }}</span>
            </td>
            <td>
              <button class="btn-ghost btn-sm" @click="toggleRule(r)">{{ r.enabled ? '停用' : '启用' }}</button>
              <button class="btn-ghost btn-sm" @click="showDetail(r)">明细</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Modal :open="detailOpen" :title="detail?.name || '规则明细'" width="640px" @close="detailOpen = false">
      <div v-if="detail" class="space-y-3 text-sm">
        <p class="text-muted-foreground">{{ detail.detail }}</p>
        <div>
          <p class="label">问题样例</p>
          <div class="mt-1 space-y-1">
            <p v-for="(s, i) in detail.sample" :key="i" class="mono-tag w-fit">{{ s }}</p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3 text-xs">
          <p class="text-muted-foreground">负责人：{{ detail.owner }}</p>
          <p class="text-muted-foreground">频次：{{ detail.schedule }}</p>
        </div>
        <button class="btn-outline btn-sm" @click="detailOpen = false; askAI(detail)">让 Agent 给出治理方案</button>
      </div>
    </Modal>
  </div>
</template>

<script setup>
import { ref, onMounted, h } from 'vue'
import { useRouter } from 'vue-router'
import { Play, TrendingUp, TrendingDown, Minus } from 'lucide-vue-next'
import { api } from '../api.js'
import { toast } from '../store.js'
import { fmtTime } from '../utils.js'
import Modal from '../components/Modal.vue'

/* embedded=true 时作为项目「智能应用」内嵌运行，向 Agent 提问自动携带 projectId */
const props = defineProps({
  embedded: { type: Boolean, default: false },
  projectId: { type: String, default: '' },
})

const router = useRouter()
const rules = ref([])
const stats = ref({})
const running = ref(false)
const detailOpen = ref(false)
const detail = ref(null)

const TrendIcon = {
  props: { trend: String },
  setup(props) {
    return () => {
      if (props.trend === 'up') return h(TrendingUp, { size: 13, class: 'inline ml-1 text-danger' })
      if (props.trend === 'down') return h(TrendingDown, { size: 13, class: 'inline ml-1 text-success' })
      return h(Minus, { size: 13, class: 'inline ml-1 text-muted-foreground' })
    }
  },
}

async function load() {
  const d = await api.get('/api/data-quality')
  rules.value = d.list
  stats.value = d.stats
}

async function runCheck() {
  running.value = true
  try {
    const d = await api.post('/api/data-quality/run', {})
    toast(`质检完成：${d.failed} 不通过 / ${d.warning} 预警，共 ${d.totalIssues} 条问题`)
    await load()
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    running.value = false
  }
}

async function toggleRule(r) {
  await api.patch(`/api/data-quality/${r.id}`, { enabled: !r.enabled })
  toast(`规则已${r.enabled ? '停用' : '启用'}`)
  load()
}

function showDetail(r) {
  detail.value = r
  detailOpen.value = true
}

function askAI(r = null) {
  const prompt = r
    ? `数据质量规则「${r.name}」发现 ${r.lastCount} 条问题（${r.detail}），请给出根因排查方向与治理方案。`
    : '汇总当前全部数据质量问题，按严重度排序，给出根因方向、治理动作和预防建议。'
  const pid = props.projectId ? `&projectId=${encodeURIComponent(props.projectId)}` : ''
  router.push(`/tasks/new?${pid ? pid.slice(1) + '&' : ''}prompt=${encodeURIComponent(prompt)}`)
}

function typeText(t) {
  return { duplicate: '重复值', missing: '缺失值', threshold: '阈值越界', tag: '标签规范' }[t] || t
}
function statusText(s) {
  return { passed: '通过', warning: '预警', failed: '不通过' }[s] || s
}

onMounted(load)
</script>
