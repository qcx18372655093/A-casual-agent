<template>
  <div class="px-6 py-5">
    <!-- 头部 -->
    <div class="flex flex-wrap items-center gap-3">
      <div>
        <h1 class="font-display text-xl font-bold">
          SMART6000 集控台
          <span class="stamp warning ml-1"><i></i>演示数据</span>
        </h1>
        <p class="mt-1 text-xs text-muted-foreground">以 NET-6000（SMART6000）AI 中控主机为落地载体的教室集控：一键上课/下课场景、设备集控、AI 识别状态回传</p>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <span class="mono-tag">NET-6000 × {{ hosts.length }}</span>
        <button class="btn-outline btn-sm" @click="load"><RefreshCw :size="12" /> 刷新</button>
      </div>
    </div>

    <!-- 豆包式命令栏：自然语言 + 场景快捷入口（功能闭环） -->
    <div class="mt-4">
      <AppCommandBar
        placeholder="发消息，如「A101 一键上课」「检查 B201 功放故障」；或点击下方场景直接执行…"
        :chips="cmdChips"
        :busy="planning"
        hint="场景为高风险写操作：先出执行计划，确认后下发"
        @chip="onChip"
        @submit="onSubmit"
        @plus="onPatrol"
      />
    </div>

    <!-- 统计 -->
    <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      <div class="card p-4">
        <p class="text-xs text-muted-foreground">在线主机</p>
        <p class="mt-1 font-display text-2xl font-bold text-success">{{ stats.online || 0 }}</p>
        <p class="mt-0.5 text-xs text-muted-foreground">共 {{ stats.total || 0 }} 台</p>
      </div>
      <div class="card p-4">
        <p class="text-xs text-muted-foreground">异常/离线</p>
        <p class="mt-1 font-display text-2xl font-bold text-danger">{{ (stats.degraded || 0) + (stats.offline || 0) }}</p>
        <p class="mt-0.5 text-xs text-muted-foreground">降级 {{ stats.degraded || 0 }} · 离线 {{ stats.offline || 0 }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs text-muted-foreground">AI 识别运行中</p>
        <p class="mt-1 font-display text-2xl font-bold">{{ stats.aiRunning || 0 }}</p>
        <p class="mt-0.5 text-xs text-muted-foreground">课堂识别引擎</p>
      </div>
      <div class="card p-4">
        <p class="text-xs text-muted-foreground">今日场景执行</p>
        <p class="mt-1 font-display text-2xl font-bold">{{ stats.todaySceneExecs || 0 }}</p>
        <p class="mt-0.5 text-xs text-muted-foreground">一键上课/下课等</p>
      </div>
    </div>

    <div class="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-5">
      <!-- 主机列表 -->
      <section class="xl:col-span-3">
        <div class="flex items-center gap-2">
          <Cpu :size="16" class="text-primary" />
          <h2 class="section-title">主机集群</h2>
        </div>
        <div class="mt-3 space-y-3">
          <div
            v-for="h in hosts" :key="h.id"
            class="card cursor-pointer p-4 transition-shadow hover:shadow-lg"
            :class="selected?.id === h.id && 'ring-2 ring-primary/20'"
            @click="selectHost(h)"
          >
            <div class="flex items-center gap-2">
              <span class="stamp" :class="statusTone(h.status)"><i></i>{{ statusText(h.status) }}</span>
              <span class="font-mono text-xs text-muted-foreground">{{ h.model }}</span>
              <span v-if="h.aiStatus === 'running'" class="stamp info"><i></i>AI 识别中</span>
              <span class="ml-auto font-mono text-xs text-muted-foreground">{{ h.ip }}</span>
            </div>
            <h3 class="mt-2 text-sm font-bold">{{ h.name }}</h3>
            <p class="mt-1 text-xs text-muted-foreground">{{ h.building }} · {{ h.room }} · 固件 {{ h.firmware }}</p>
            <div class="mt-2 flex flex-wrap items-center gap-1.5">
              <span v-if="h.scene" class="stamp success"><i></i>{{ h.scene }}</span>
              <span class="mono-tag">{{ h.devices?.length || 0 }} 台受控设备</span>
              <span v-if="h.recognitionRate" class="mono-tag">识别率 {{ h.recognitionRate }}%</span>
            </div>
            <p v-if="h.issue" class="mt-2 rounded-md bg-warning/10 p-2 text-xs text-warning">{{ h.issue }}</p>
          </div>
        </div>
      </section>

      <!-- 主机详情 + 场景控制 -->
      <section class="xl:col-span-2">
        <div class="flex items-center gap-2">
          <SlidersHorizontal :size="16" class="text-primary" />
          <h2 class="section-title">场景与设备</h2>
        </div>

        <div v-if="!selected" class="card mt-3 p-8 text-center text-sm text-muted-foreground">
          <MonitorSmartphone :size="28" class="mx-auto text-muted-foreground/50" />
          <p class="mt-3">从左侧选择一台主机查看详情</p>
        </div>

        <template v-else>
          <!-- 主机详情卡 -->
          <div class="card mt-3 p-4">
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-bold">{{ selected.name }}</h3>
              <span class="stamp" :class="statusTone(selected.status)"><i></i>{{ statusText(selected.status) }}</span>
            </div>
            <!-- 接口占用 -->
            <div class="mt-3 grid grid-cols-3 gap-2">
              <div v-for="(count, name) in selected.interfaces" :key="name" class="rounded-md bg-muted/50 p-2 text-center">
                <p class="font-mono text-sm font-bold">{{ count }}</p>
                <p class="text-xs text-muted-foreground">{{ ifaceName(name) }}</p>
              </div>
            </div>
            <!-- 指标 -->
            <div class="mt-3 flex gap-4 text-xs text-muted-foreground">
              <span v-if="selected.metrics?.tempC != null">温度 {{ selected.metrics.tempC }}°C</span>
              <span v-if="selected.metrics?.uptimeHours">运行 {{ Math.round(selected.metrics.uptimeHours / 24) }} 天</span>
              <span>今日场景 {{ selected.metrics?.todaySceneExecs || 0 }} 次</span>
            </div>
          </div>

          <!-- 场景执行 -->
          <div class="card mt-3 p-4">
            <div class="flex items-center gap-2">
              <Zap :size="14" class="text-primary" />
              <h3 class="text-sm font-bold">场景联动</h3>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <button
                v-for="s in scenes" :key="s.key"
                class="btn-outline justify-center"
                :disabled="selected.status !== 'online' || planning"
                @click="planScene(s.key)"
              >
                <component :is="sceneIcon(s.key)" :size="14" />
                {{ s.name }}
              </button>
            </div>
            <p class="mt-2 text-xs text-muted-foreground">场景为高风险写操作：先生成执行计划，确认后执行</p>
          </div>

          <!-- 设备控制 -->
          <div class="card mt-3 p-4">
            <div class="flex items-center gap-2">
              <Power :size="14" class="text-primary" />
              <h3 class="text-sm font-bold">受控设备</h3>
              <span class="mono-tag ml-auto">{{ selected.devices?.length || 0 }}</span>
            </div>
            <div class="mt-3 space-y-2">
              <div v-for="d in selected.devices" :key="d.id" class="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2">
                <span class="h-2 w-2 rounded-full" :class="deviceDot(d.status)"></span>
                <div class="min-w-0 flex-1">
                  <p class="text-xs font-medium">{{ d.name }}</p>
                  <p class="font-mono text-xs text-muted-foreground">{{ d.control }}</p>
                </div>
                <span class="stamp" :class="deviceTone(d.status)"><i></i>{{ deviceText(d.status) }}</span>
                <div class="flex gap-1">
                  <button class="btn-ghost btn-sm" :disabled="selected.status !== 'online' || ctrlBusy" @click="controlDevice(d, 'on')">开</button>
                  <button class="btn-ghost btn-sm" :disabled="selected.status !== 'online' || ctrlBusy" @click="controlDevice(d, 'off')">关</button>
                </div>
              </div>
            </div>
          </div>
        </template>
      </section>
    </div>

    <!-- 场景计划确认 Modal -->
    <Modal :open="planOpen" title="场景执行计划" width="720px" @close="planOpen = false">
      <div v-if="planning" class="py-12 text-center text-sm text-muted-foreground">
        <Loader2 :size="22" class="mx-auto animate-spin" />
        <p class="mt-3">正在核对主机与设备状态，生成执行计划…</p>
      </div>
      <div v-else-if="plan">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <span class="stamp" :class="plan.scene?.risk === 'high' ? 'danger' : 'warning'"><i></i>{{ plan.scene?.name }}</span>
          <span class="stamp muted"><i></i>{{ plan.targetCount }} 台目标主机</span>
          <span class="stamp success"><i></i>{{ plan.executableCount }} 台可执行</span>
          <span class="stamp warning ml-auto"><i></i>演示数据 · 高风险需确认</span>
        </div>

        <!-- 执行步骤 -->
        <div class="rounded-lg border border-border">
          <p class="border-b border-border bg-muted/40 px-3 py-2 text-xs font-semibold">联动时序（{{ plan.steps?.length || 0 }} 步）</p>
          <div class="max-h-[200px] space-y-0 overflow-y-auto p-3">
            <div v-for="s in plan.steps" :key="s.order" class="flex items-center gap-2.5 py-1.5 text-xs">
              <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono font-bold text-primary">{{ s.order }}</span>
              <span>{{ s.label }}</span>
              <span class="mono-tag ml-auto">{{ s.device }} · {{ s.action }}</span>
            </div>
          </div>
        </div>

        <!-- 阻断项 -->
        <div v-if="plan.targets?.some((t) => t.blockers.length)" class="mt-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
          <p class="text-xs font-semibold text-warning">阻断项（以下主机不会下发）</p>
          <div v-for="t in plan.targets.filter((t) => t.blockers.length)" :key="t.hostId" class="mt-1.5 text-xs">
            <span class="font-medium">{{ t.host }}</span>
            <span class="text-muted-foreground">：{{ t.blockers.join('；') }}</span>
          </div>
        </div>

        <div class="mt-4 flex items-center gap-2">
          <button class="btn-primary" :disabled="execBusy || plan.executableCount === 0" @click="execScene">
            <Play :size="14" /> {{ execBusy ? '执行中…' : `确认执行（${plan.executableCount} 台）` }}
          </button>
          <button class="btn-outline" @click="planOpen = false">取消</button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Cpu, SlidersHorizontal, MonitorSmartphone, Zap, Power, RefreshCw, Loader2, Play, GraduationCap, Moon, ClipboardCheck, LogOut, Radar } from 'lucide-vue-next'
import { api } from '../api.js'
import { toast } from '../store.js'
import Modal from '../components/Modal.vue'
import AppCommandBar from '../components/AppCommandBar.vue'

const router = useRouter()

const hosts = ref([])
const stats = ref({})
const scenes = ref([])
const selected = ref(null)
const planning = ref(false)
const planOpen = ref(false)
const plan = ref(null)
const execBusy = ref(false)
const ctrlBusy = ref(false)

async function load() {
  const d = await api.get('/api/smart/hosts')
  hosts.value = d.list || []
  stats.value = d.stats || {}
  scenes.value = d.scenes || []
  if (selected.value) {
    const cur = hosts.value.find((h) => h.id === selected.value.id)
    if (cur) selected.value = cur
  }
}

function selectHost(h) { selected.value = h }

// 命令栏：场景 chips（含集群巡检），点击即闭环到执行计划
const cmdChips = computed(() => [
  ...(scenes.value || []).map((s) => ({ key: s.key, label: s.name, icon: sceneIcon(s.key), cls: 'text-chip-cyan-fg' })),
  { key: '__patrol', label: '集群巡检', icon: Radar, cls: 'text-chip-orange-fg' },
])

// chip 闭环：未选主机时自动选中第一台在线主机，再生成执行计划
function onChip(key) {
  if (key === '__patrol') return onPatrol()
  const target = selected.value?.status === 'online'
    ? selected.value
    : hosts.value.find((h) => h.status === 'online')
  if (!target) { toast('当前没有在线主机可执行场景', 'error'); return }
  selected.value = target
  planScene(key)
}

function onPatrol() {
  const offline = hosts.value.filter((h) => h.status !== 'online')
  const summary = offline.length
    ? `发现 ${offline.length} 台异常主机：${offline.map((h) => `${h.name}（${h.status === 'degraded' ? '降级' : '离线'}）`).join('、')}`
    : `${hosts.value.length} 台主机全部在线`
  toast(summary, offline.length ? 'error' : 'success')
}

// 自然语言闭环：交给 AI 任务编排（携带教室项目上下文）
function onSubmit(text) {
  router.push({
    path: '/tasks/new',
    query: { prompt: `【SMART6000 集控】${text}`, projectId: 'p_classroom' },
  })
}

function statusTone(s) { return { online: 'success', degraded: 'warning', offline: 'danger' }[s] || 'muted' }
function statusText(s) { return { online: '在线', degraded: '降级', offline: '离线' }[s] || s }
function ifaceName(k) { return { ethernet: '网口', netBus: 'NET总线', com: 'COM串口', ir: 'IR红外', io: 'I/O', relay: 'RELAY' }[k] || k }
function sceneIcon(key) { return { class_start: GraduationCap, class_end: LogOut, break: Moon, exam: ClipboardCheck }[key] || Zap }

function deviceDot(s) {
  return { on: 'bg-success', off: 'bg-muted-foreground/40', standby: 'bg-warning', fault: 'bg-danger', recording: 'bg-danger', unknown: 'bg-muted-foreground/30' }[s] || 'bg-muted-foreground/40'
}
function deviceTone(s) {
  return { on: 'success', off: 'muted', standby: 'warning', fault: 'danger', recording: 'danger', unknown: 'muted' }[s] || 'muted'
}
function deviceText(s) {
  return { on: '运行', off: '关闭', standby: '待机', fault: '故障', recording: '录制中', unknown: '未知', open: '开', closed: '关' }[s] || s
}

async function planScene(sceneKey) {
  planning.value = true
  planOpen.value = true
  plan.value = null
  try {
    const d = await api.post('/api/smart/scene/plan', { hostId: selected.value.id, scene: sceneKey })
    plan.value = d
    plan.value._hostId = selected.value.id
    plan.value._scene = sceneKey
  } catch (err) {
    planOpen.value = false
    toast(err.message, 'error')
  } finally {
    planning.value = false
  }
}

async function execScene() {
  execBusy.value = true
  try {
    const d = await api.post('/api/smart/scene/exec', { hostId: plan.value._hostId, scene: plan.value._scene })
    toast(`场景「${d.scene || plan.value.scene?.name}」已执行（${d.applied?.length || 0} 步）`)
    planOpen.value = false
    await load()
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    execBusy.value = false
  }
}

async function controlDevice(d, cmd) {
  ctrlBusy.value = true
  try {
    await api.post('/api/smart/device/control', { hostId: selected.value.id, device: d.id, command: cmd })
    toast(`${d.name} 已${cmd === 'on' ? '开启' : '关闭'}`)
    await load()
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    ctrlBusy.value = false
  }
}

onMounted(load)
</script>
