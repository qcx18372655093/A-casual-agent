<template>
  <div class="px-6 py-5">
    <div class="flex items-center gap-2">
      <p class="text-sm text-muted-foreground">把重复性工作交给自动化：按计划调用技能，异常时生成待办与提醒</p>
      <button class="btn-primary ml-auto" @click="openCreate"><Plus :size="14" /> 新建自动化</button>
    </div>

    <Skeleton v-if="loading" kind="cards" :count="4" :cols="2" />
    <EmptyState v-else-if="!list.length" :icon="CalendarClock" title="暂无自动化任务" desc="创建一个自动化，让重复工作按节奏自动运转" />

    <div v-else class="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
      <div v-for="a in list" :key="a.id" class="card p-4">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-semibold">{{ a.name }}</h3>
          <StatusStamp :status="a.status" :map="AUTOMATION_STATUS" />
          <button
            class="ml-auto text-xs"
            :class="a.status === 'enabled' ? 'text-success' : 'text-muted-foreground'"
            :title="a.status === 'enabled' ? '点击暂停' : '点击启用'"
            @click="toggle(a)"
          >
            <component :is="a.status === 'enabled' ? ToggleRight : ToggleLeft" :size="22" />
          </button>
        </div>
        <p class="mt-1 text-xs text-muted-foreground">{{ a.projectName }} · 技能「{{ a.skillName }}」</p>

        <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span class="flex items-center gap-1"><Clock :size="12" /> {{ scheduleLabel(a.schedule) }}</span>
          <span>下次运行 {{ a.nextRunAt ? fmtRelative(a.nextRunAt) : '—' }}</span>
          <span>{{ a.safetyLevel === 'read-only' ? '只读巡检' : '受控执行' }} · 异常自动生成待办</span>
          <span v-if="a.notifyTargets?.length">通知 {{ a.notifyTargets.join('、') }}</span>
        </div>

        <div v-if="a.lastRun" class="mt-3 flex items-center gap-2 rounded-sm border border-border bg-muted/50 px-3 py-2 text-xs">
          <span class="text-muted-foreground">最近运行</span>
          <StatusStamp :status="a.lastRun.status" :map="RUN_STATUS" />
          <span class="truncate text-muted-foreground">{{ a.lastRun.summary }}</span>
          <span class="ml-auto flex-none font-mono text-[10px] text-muted-foreground">{{ fmtRelative(a.lastRun.finishedAt || a.lastRun.startedAt) }}</span>
        </div>

        <div class="mt-3 flex items-center gap-2 border-t border-border/70 pt-3">
          <button class="btn-outline btn-sm" :disabled="a._triggering" @click="trigger(a)">
            <Play :size="12" /> {{ a._triggering ? '执行中…' : '立即执行' }}
          </button>
          <button class="btn-outline btn-sm" @click="openRuns(a)"><History :size="12" /> 运行记录</button>
          <button class="btn-outline btn-sm" @click="openEdit(a)"><Pencil :size="12" /> 编辑</button>
          <button class="btn-ghost btn-sm ml-auto text-destructive" @click="remove(a)"><Trash2 :size="12" /></button>
        </div>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <Modal :open="showForm" :title="form.id ? '编辑自动化' : '新建自动化'" @close="showForm = false">
      <div class="space-y-3">
        <div>
          <label class="label">名称 *</label>
          <input v-model="form.name" class="input mt-1" placeholder="如：每日教室巡查" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">所属项目 *</label>
            <select v-model="form.projectId" class="input mt-1">
              <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <div>
            <label class="label">调用技能 *</label>
            <select v-model="form.skillId" class="input mt-1">
              <option v-for="s in enabledSkills" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">运行节奏</label>
            <select v-model="form.scheduleKind" class="input mt-1">
              <option value="daily">每天</option>
              <option value="weekday">每个工作日</option>
              <option value="hourly">每小时</option>
              <option value="30min">每 30 分钟</option>
            </select>
          </div>
          <div v-if="form.scheduleKind === 'daily' || form.scheduleKind === 'weekday'">
            <label class="label">时间（Asia/Shanghai）</label>
            <input v-model="form.time" type="time" class="input mt-1" />
          </div>
        </div>
        <div>
          <label class="label">结果通知对象（逗号分隔）</label>
          <input v-model="form.notifyText" class="input mt-1" placeholder="如：值班群, 陈志远" />
        </div>
        <p class="rounded-sm border border-border bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          自动化按只读安全级别执行；发现异常时自动生成待办并通知上述对象，全部运行留痕可审计。
        </p>
      </div>
      <template #footer>
        <button class="btn-outline" @click="showForm = false">取消</button>
        <button class="btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存' }}</button>
      </template>
    </Modal>

    <!-- 运行记录抽屉 -->
    <Drawer :open="showRuns" :title="`运行记录 · ${current?.name || ''}`" @close="showRuns = false">
      <div v-if="!runs.length" class="py-10 text-center text-sm text-muted-foreground">暂无运行记录</div>
      <div v-else class="space-y-4">
        <div v-for="r in runs" :key="r.id" class="card p-4">
          <div class="flex items-center gap-2">
            <StatusStamp :status="r.status" :map="RUN_STATUS" />
            <span class="font-mono text-[10px] text-muted-foreground">{{ r.triggeredBy === 'manual' ? '手动触发' : '计划触发' }}</span>
            <span v-if="r.anomalyCount" class="stamp warning"><i></i>{{ r.anomalyCount }} 项异常</span>
            <span class="ml-auto font-mono text-[10px] text-muted-foreground">{{ fmtTime(r.startedAt) }}</span>
          </div>
          <p class="mt-2 text-xs text-muted-foreground">{{ r.summary }}</p>
          <div v-if="r.steps?.length" class="mt-2 flex flex-wrap gap-1">
            <span v-for="(st, i) in r.steps" :key="i" class="stamp" :class="st.status === 'ok' ? 'success' : st.status === 'error' ? 'danger' : 'muted'">
              <i></i>{{ st.title }}
            </span>
          </div>
          <template v-if="r.report">
            <button class="btn-ghost btn-sm mt-2" @click="r._open = !r._open">
              <component :is="r._open ? ChevronDown : ChevronRight" :size="12" /> 巡查报告
            </button>
            <div v-if="r._open" class="mt-2 border-t border-border/60 pt-2">
              <MarkdownText :text="r.report" />
            </div>
          </template>
        </div>
      </div>
    </Drawer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Plus, Clock, Play, History, Pencil, Trash2, ToggleLeft, ToggleRight, CalendarClock, ChevronDown, ChevronRight } from 'lucide-vue-next'
import { api } from '../api.js'
import { toast } from '../store.js'
import { AUTOMATION_STATUS, RUN_STATUS, fmtTime, fmtRelative } from '../utils.js'
import StatusStamp from '../components/StatusStamp.vue'
import EmptyState from '../components/EmptyState.vue'
import Modal from '../components/Modal.vue'
import Drawer from '../components/Drawer.vue'
import Skeleton from '../components/Skeleton.vue'
import MarkdownText from '../components/MarkdownText.vue'

const list = ref([])
const projects = ref([])
const skills = ref([])
const loading = ref(true)
const showForm = ref(false)
const saving = ref(false)
const showRuns = ref(false)
const runs = ref([])
const current = ref(null)
const form = ref(emptyForm())

const enabledSkills = computed(() => skills.value.filter((s) => s.status === 'enabled'))

function emptyForm() {
  return { id: '', name: '', projectId: '', skillId: '', scheduleKind: 'daily', time: '08:00', notifyText: '值班群', onAnomalyTodo: true }
}

function scheduleLabel(s) {
  if (!s) return '—'
  if (s.text) return s.text
  const map = { daily: `每天 ${s.time || ''}`, weekday: `每个工作日 ${s.time || ''}`, interval: `每 ${s.every || '1h'}` }
  return `${map[s.kind] || s.kind} · ${s.timezone || 'Asia/Shanghai'}`
}

function buildSchedule(f) {
  const tz = 'Asia/Shanghai'
  if (f.scheduleKind === 'daily') return { kind: 'daily', time: f.time, timezone: tz, text: `每天 ${f.time}（${tz}）` }
  if (f.scheduleKind === 'weekday') return { kind: 'weekday', time: f.time, timezone: tz, text: `每个工作日 ${f.time}（${tz}）` }
  if (f.scheduleKind === '30min') return { kind: 'interval', every: '30m', text: '每 30 分钟' }
  return { kind: 'interval', every: '1h', text: '每小时' }
}

async function load() {
  loading.value = true
  try {
    const [a, p, s] = await Promise.all([api.get('/api/automations'), api.get('/api/projects'), api.get('/api/skills')])
    list.value = a.list.map((x) => ({ ...x, _triggering: false }))
    projects.value = p.list
    skills.value = s.list
  } finally {
    loading.value = false
  }
}

function openCreate() {
  form.value = emptyForm()
  form.value.projectId = projects.value[0]?.id || ''
  form.value.skillId = enabledSkills.value[0]?.id || ''
  showForm.value = true
}

function openEdit(a) {
  const kind = a.schedule?.kind === 'interval' ? (a.schedule?.every === '30m' ? '30min' : 'hourly') : a.schedule?.kind || 'daily'
  form.value = {
    id: a.id, name: a.name, projectId: a.projectId, skillId: a.skillId,
    scheduleKind: kind, time: a.schedule?.time || '08:00',
    notifyText: (a.notifyTargets || []).join(', '), onAnomalyTodo: true,
  }
  showForm.value = true
}

async function save() {
  const f = form.value
  if (!f.name.trim() || !f.projectId || !f.skillId) return toast('请填写名称、项目与技能', 'error')
  saving.value = true
  try {
    const body = {
      name: f.name.trim(), projectId: f.projectId, skillId: f.skillId,
      schedule: buildSchedule(f),
      notifyTargets: f.notifyText.split(/[,，]/).map((x) => x.trim()).filter(Boolean),
    }
    if (f.id) await api.patch(`/api/automations/${f.id}`, body)
    else await api.post('/api/automations', body)
    toast('已保存')
    showForm.value = false
    await load()
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    saving.value = false
  }
}

async function toggle(a) {
  await api.patch(`/api/automations/${a.id}`, { status: a.status === 'enabled' ? 'paused' : 'enabled' })
  await load()
}

async function trigger(a) {
  a._triggering = true
  try {
    const data = await api.post(`/api/automations/${a.id}/trigger`)
    toast(`运行完成：${data.run.status === 'success' ? '成功' : data.run.status === 'partial' ? '部分异常' : '失败'}`)
    await load()
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    a._triggering = false
  }
}

async function remove(a) {
  if (!window.confirm(`确认删除自动化「${a.name}」？`)) return
  await api.del(`/api/automations/${a.id}`)
  toast('已删除')
  await load()
}

async function openRuns(a) {
  current.value = a
  const data = await api.get(`/api/automations/${a.id}/runs`)
  runs.value = data.list.map((r) => ({ ...r, _open: false }))
  showRuns.value = true
}

onMounted(load)
</script>
