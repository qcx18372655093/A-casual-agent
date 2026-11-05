<template>
  <aside class="flex w-72 flex-none flex-col border-l border-border bg-card">
    <!-- 头部 -->
    <div class="flex h-13 flex-none items-center justify-between border-b border-border px-4 py-2.5">
      <h3 class="text-[14px] font-semibold">工作上下文</h3>
      <button class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title="收起面板" @click="gs.contextOpen = false">
        <X :size="15" />
      </button>
    </div>

    <div class="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4">
      <!-- 系统连接状态 -->
      <section>
        <div class="mb-2.5 flex items-center justify-between">
          <p class="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
            <span class="h-1.5 w-1.5 rounded-full bg-success"></span>系统连接状态
          </p>
          <span class="text-[11px] text-muted-foreground">{{ onlineCount }} / {{ connectors.length }} 在线</span>
        </div>
        <div class="space-y-1">
          <div v-for="c in connectors" :key="c.id" class="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-muted">
            <span class="chip-icon h-8 w-8" :class="chipOf(c).cls">
              <component :is="chipOf(c).icon" :size="15" :stroke-width="1.8" />
            </span>
            <div class="min-w-0 flex-1 leading-tight">
              <p class="truncate text-[13px] font-medium">{{ c.name }}</p>
              <p class="truncate text-[11px] text-muted-foreground">{{ c.desc || c.category }}</p>
            </div>
            <span
              class="h-1.5 w-1.5 flex-none rounded-full"
              :class="c.status === 'connected' ? 'bg-success' : 'bg-muted-foreground/40'"
              :title="c.status === 'connected' ? '在线' : '未连接'"
            ></span>
          </div>
          <div v-if="connectors.length === 0" class="px-1.5 py-3 text-[12px] text-muted-foreground">暂无连接器</div>
        </div>
      </section>

      <!-- 中控设备 -->
      <section>
        <div class="mb-2.5 flex items-center justify-between">
          <p class="text-[12px] font-medium text-muted-foreground">中控设备</p>
          <span class="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">演示数据</span>
        </div>
        <div class="space-y-1">
          <div v-for="d in panelDevices" :key="d.id" class="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
            <span class="chip-icon h-8 w-8" :class="deviceChip(d).cls">
              <component :is="deviceChip(d).icon" :size="15" :stroke-width="1.8" />
            </span>
            <div class="min-w-0 flex-1 leading-tight">
              <p class="truncate text-[13px] font-medium">{{ d.name }}</p>
              <p class="text-[11px]" :class="d.status === 'online' ? 'text-success' : d.status === 'degraded' ? 'text-warning' : 'text-muted-foreground'">
                {{ deviceStatusText(d) }}
              </p>
            </div>
            <button
              class="relative h-5 w-9 flex-none cursor-pointer rounded-full transition-colors duration-200"
              :class="d.status !== 'offline' ? 'bg-success' : 'bg-muted-foreground/30'"
              :title="d.status !== 'offline' ? '点击关闭' : '点击开启'"
              @click="toggleDevice(d)"
            >
              <span
                class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200"
                :class="d.status !== 'offline' ? 'left-4.5' : 'left-0.5'"
              ></span>
            </button>
          </div>
          <div v-if="panelDevices.length === 0" class="px-1.5 py-3 text-[12px] text-muted-foreground">暂无设备</div>
        </div>
        <!-- 快捷操作 -->
        <div class="mt-2 flex flex-wrap gap-2">
          <button v-for="a in quickActions" :key="a.label" class="btn-outline !px-2.5 !py-1 text-[11px]" :disabled="a.disabled()" @click="a.run()">
            <component :is="a.icon" :size="12" :stroke-width="1.8" />
            {{ a.label }}
          </button>
        </div>
      </section>

      <!-- 待处理事项 -->
      <section>
        <div class="mb-2.5 flex items-center justify-between">
          <p class="text-[12px] font-medium text-muted-foreground">待处理事项</p>
          <span class="text-[11px] text-muted-foreground">{{ todos.length > 0 ? `${todos.length} 项` : '清空' }}</span>
        </div>
        <div class="space-y-1">
          <div v-for="t in todos" :key="t.id" class="flex items-start gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-muted">
            <button
              class="mt-0.5 flex h-4 w-4 flex-none cursor-pointer items-center justify-center rounded border border-border bg-card transition-colors hover:border-success"
              title="标记完成"
              @click="completeTodo(t)"
            ></button>
            <div class="min-w-0 flex-1 leading-tight">
              <p class="text-[13px] font-medium">{{ t.title }}</p>
              <p class="mt-0.5 text-[11px]" :class="t.priority === 'high' ? 'text-danger' : 'text-muted-foreground'">
                {{ t.priority === 'high' ? '高优先级' : '普通' }}{{ t.projectName ? ` · ${t.projectName}` : '' }}
              </p>
            </div>
          </div>
          <div v-if="todos.length === 0" class="px-1.5 py-3 text-[12px] text-muted-foreground">今日事项已全部处理</div>
        </div>
        <RouterLink to="/approvals" class="mt-1.5 inline-block px-1.5 text-[12px] font-medium text-info hover:underline">
          查看全部 →
        </RouterLink>
      </section>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  X,
  LayoutGrid,
  ShoppingCart,
  Network,
  Package,
  Plug,
  Lightbulb,
  MonitorSmartphone,
  Cpu,
  Projector,
  Gauge,
  Power,
  Play,
  Pause,
} from 'lucide-vue-next'
import { gs, toast } from '../store.js'
import { api } from '../api.js'

const connectors = ref([])
const devices = ref([])
const todos = ref([])

const onlineCount = computed(() => connectors.value.filter((c) => c.status === 'connected').length)

// 面板展示三台代表性设备：灯光 / 中控 / 网关（工程设备）
const panelDevices = computed(() => {
  const pick = []
  const byType = (re) => devices.value.find((d) => re.test(`${d.type}${d.name}`))
  const light = byType(/灯光/)
  const control = byType(/中控/)
  const gateway = byType(/网关|工程/)
  for (const d of [light, control, gateway]) if (d && !pick.includes(d)) pick.push(d)
  for (const d of devices.value) {
    if (pick.length >= 3) break
    if (!pick.includes(d)) pick.push(d)
  }
  return pick
})

function chipOf(c) {
  const t = `${c.category || ''}${c.name || ''}`
  if (/采购|订单/.test(t)) return { icon: ShoppingCart, cls: 'bg-chip-orange-bg text-chip-orange-fg' }
  if (/网关|网络/.test(t)) return { icon: Network, cls: 'bg-chip-blue-bg text-chip-blue-fg' }
  if (/产品|版本/.test(t)) return { icon: Package, cls: 'bg-chip-purple-bg text-chip-purple-fg' }
  if (/应用|任务|管理/.test(t)) return { icon: LayoutGrid, cls: 'bg-chip-green-bg text-chip-green-fg' }
  return { icon: Plug, cls: 'bg-chip-cyan-bg text-chip-cyan-fg' }
}

function deviceChip(d) {
  const t = `${d.type || ''}${d.name || ''}`
  if (/灯光/.test(t)) return { icon: Lightbulb, cls: 'bg-chip-orange-bg text-chip-orange-fg' }
  if (/中控/.test(t)) return { icon: MonitorSmartphone, cls: 'bg-chip-blue-bg text-chip-blue-fg' }
  if (/投影/.test(t)) return { icon: Projector, cls: 'bg-chip-purple-bg text-chip-purple-fg' }
  if (/环传|传感/.test(t)) return { icon: Gauge, cls: 'bg-chip-cyan-bg text-chip-cyan-fg' }
  return { icon: Cpu, cls: 'bg-chip-green-bg text-chip-green-fg' }
}

function deviceStatusText(d) {
  if (d.status === 'online') return d.config?.load ? `运行中 · ${d.config.load}%` : '已开启'
  if (d.status === 'degraded') return '运行中 · 异常'
  return '已关闭'
}

function findDevice(re) {
  return devices.value.find((d) => re.test(`${d.type}${d.name}`))
}

const quickActions = computed(() => [
  {
    label: '关灯',
    icon: Power,
    disabled: () => !findDevice(/灯光/),
    run: () => setDevice(/灯光/, false, '已关闭办公区灯光（演示数据）'),
  },
  {
    label: '开启会议室',
    icon: Play,
    disabled: () => !findDevice(/中控/),
    run: () => setDevice(/中控/, true, '会议室中控已开启（演示数据）'),
  },
  {
    label: '暂停工程',
    icon: Pause,
    disabled: () => !findDevice(/网关|工程/),
    run: () => setDevice(/网关|工程/, false, '工程设备已暂停（演示数据）'),
  },
])

async function setDevice(re, on, message) {
  const d = findDevice(re)
  if (!d) return
  await toggleDevice(d, on, message)
}

async function toggleDevice(d, forceOn, message) {
  const on = forceOn !== undefined ? forceOn : d.status === 'offline'
  try {
    const data = await api.post(`/api/devices/${d.id}/toggle`, { on })
    const i = devices.value.findIndex((x) => x.id === d.id)
    if (i >= 0) devices.value[i] = data.device
    toast(message || `${data.device.name}已${on ? '开启' : '关闭'}（演示数据）`)
  } catch (err) {
    toast(err.message, 'error')
  }
}

async function completeTodo(t) {
  try {
    await api.post(`/api/todos/${t.id}/complete`)
    todos.value = todos.value.filter((x) => x.id !== t.id)
    toast('待办已完成')
  } catch (err) {
    toast(err.message, 'error')
  }
}

onMounted(async () => {
  try {
    const [c, d, t] = await Promise.all([
      api.get('/api/connectors'),
      api.get('/api/devices'),
      api.get('/api/todos?status=pending'),
    ])
    connectors.value = c.list || []
    devices.value = d.list || []
    todos.value = (t.list || []).slice(0, 5)
  } catch {
    /* 静默 */
  }
})
</script>
