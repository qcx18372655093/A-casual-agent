<template>
  <div class="px-6 py-5">
    <div class="flex items-center gap-3">
      <p class="text-sm text-muted-foreground">Skill 是可复用的专业能力：声明输入输出、执行步骤与依赖，由 AI 按规则调用</p>
      <div class="ml-auto flex items-center gap-2">
        <button class="btn-outline btn-sm" @click="triggerImport"><Upload :size="12" /> 导入 JSON</button>
        <button class="btn-primary btn-sm" @click="openCreate"><Plus :size="12" /> 新建技能</button>
        <div class="flex rounded-sm border border-border p-0.5">
          <button class="px-3 py-1 text-xs rounded-[3px]" :class="tab === 'installed' ? 'bg-accent font-medium' : 'text-muted-foreground'" @click="tab = 'installed'">已安装 {{ installed.length }}</button>
          <button class="px-3 py-1 text-xs rounded-[3px]" :class="tab === 'market' ? 'bg-accent font-medium' : 'text-muted-foreground'" @click="tab = 'market'">能力市场 {{ market.length }}</button>
        </div>
      </div>
    </div>
    <input ref="importFileEl" type="file" accept=".json,application/json" class="hidden" @change="onImportFile" />

    <Skeleton v-if="loading" kind="cards" :count="6" />

    <!-- 已安装 -->
    <div v-else-if="tab === 'installed'" class="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
      <div v-for="s in installed" :key="s.id" class="card flex flex-col p-4" :class="s.status !== 'enabled' && 'opacity-70'">
        <div class="flex items-center gap-2">
          <span v-if="s.custom" class="chip-icon h-7 w-7 flex-none" :class="tintChipClass(s.tint)">
            <component :is="abilityIcon(s.icon)" :size="14" :stroke-width="1.8" />
          </span>
          <Wand2 v-else :size="15" class="text-primary" />
          <h3 class="text-sm font-semibold">{{ s.name }}</h3>
          <span class="font-mono text-[10px] text-muted-foreground">v{{ s.version }}</span>
          <span class="stamp ml-auto" :class="s.status === 'enabled' ? 'success' : 'muted'"><i></i>{{ s.status === 'enabled' ? '已启用' : '已停用' }}</span>
        </div>
        <p class="mt-1.5 flex-1 text-xs leading-relaxed text-muted-foreground">{{ s.desc }}</p>
        <div class="mt-2 flex flex-wrap gap-1">
          <span class="stamp muted"><i></i>{{ s.domain }}</span>
          <span class="stamp" :class="RISK_META[s.risk]?.tone"><i></i>{{ RISK_META[s.risk]?.label }}</span>
          <span v-if="s.usesDemo" class="stamp warning" title="该技能会访问演示连接器数据"><i></i>演示数据</span>
        </div>
        <div class="mt-3 flex items-center gap-2 border-t border-border/70 pt-3">
          <button class="btn-outline btn-sm" @click="toggle(s)">
            <component :is="s.status === 'enabled' ? Pause : Play" :size="12" /> {{ s.status === 'enabled' ? '停用' : '启用' }}
          </button>
          <button
            v-if="ws && s.status === 'enabled'"
            class="btn-outline btn-sm"
            :class="wsSkillIds.includes(s.id) && '!border-success/40 !bg-success/10 !text-success'"
            :disabled="wsSkillIds.includes(s.id) || s._mounting"
            :title="wsSkillIds.includes(s.id) ? `已挂载到「${ws.name}」` : `挂载到当前工作区「${ws.name}」`"
            @click="mountToWs(s)"
          >
            <component :is="wsSkillIds.includes(s.id) ? Check : FolderPlus" :size="12" />
            {{ wsSkillIds.includes(s.id) ? '已在工作区' : s._mounting ? '挂载中…' : '挂到工作区' }}
          </button>
          <button v-if="s.custom" class="btn-ghost btn-sm text-destructive" title="删除自定义技能" @click="removeSkill(s)">
            <Trash2 :size="12" />
          </button>
          <button class="btn-ghost btn-sm" :class="s.custom ? '' : 'ml-auto'" @click="openDetail(s)">声明与依赖 <ChevronRight :size="12" /></button>
        </div>
      </div>
    </div>

    <!-- 市场 -->
    <div v-else class="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
      <div v-for="s in market" :key="s.id" class="card flex flex-col p-4">
        <div class="flex items-center gap-2">
          <PackagePlus :size="15" class="text-muted-foreground" />
          <h3 class="text-sm font-semibold">{{ s.name }}</h3>
          <span class="font-mono text-[10px] text-muted-foreground">v{{ s.version }}</span>
          <span class="ml-auto font-mono text-[10px] text-muted-foreground">{{ s.installs }} 次安装</span>
        </div>
        <p class="mt-1.5 flex-1 text-xs leading-relaxed text-muted-foreground">{{ s.desc }}</p>
        <div class="mt-2 flex flex-wrap gap-1">
          <span class="stamp muted"><i></i>{{ s.domain }}</span>
          <span class="stamp muted"><i></i>{{ s.vendor }}</span>
          <span class="stamp" :class="RISK_META[s.risk]?.tone"><i></i>{{ RISK_META[s.risk]?.label }}</span>
        </div>
        <div class="mt-3 border-t border-border/70 pt-3">
          <button class="btn-primary btn-sm" :disabled="s._installing" @click="install(s)">
            <Download :size="12" /> {{ s._installing ? '安装中…' : '安装' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 详情抽屉 -->
    <Drawer :open="showDetail" :title="current?.name || ''" width="max-w-2xl" @close="showDetail = false">
      <template v-if="current">
        <div class="flex flex-wrap items-center gap-2">
          <span v-if="current.custom" class="chip-icon h-7 w-7 flex-none" :class="tintChipClass(current.tint)">
            <component :is="abilityIcon(current.icon)" :size="14" :stroke-width="1.8" />
          </span>
          <span class="font-mono text-xs">{{ current.toolName }}@v{{ current.version }}</span>
          <span class="stamp" :class="RISK_META[current.risk]?.tone"><i></i>{{ RISK_META[current.risk]?.label }}</span>
          <span v-if="current.usesDemo" class="stamp warning"><i></i>演示数据</span>
          <span v-if="current.custom" class="stamp info"><i></i>{{ EXECUTOR_LABELS[current.executor?.kind] || '计划生成' }}</span>
          <button v-if="current.toolName" class="btn-outline btn-sm ml-auto" @click="openTest(current.toolName)"><FlaskConical :size="12" /> 试运行</button>
        </div>
        <p class="mt-3 text-sm leading-relaxed text-muted-foreground">{{ current.desc }}</p>

        <div class="mt-5">
          <p class="mono-tag text-muted-foreground">适用场景</p>
          <p class="mt-1 text-sm">{{ current.scenario }}</p>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p class="mono-tag text-muted-foreground">输入参数</p>
            <table class="table-base mt-2 w-full">
              <thead><tr><th>参数</th><th>类型</th><th>必填</th><th>说明</th></tr></thead>
              <tbody>
                <tr v-for="i in current.inputs" :key="i.name">
                  <td class="font-mono text-xs">{{ i.name }}</td>
                  <td class="font-mono text-[10px]">{{ i.type }}</td>
                  <td class="text-xs">{{ i.required ? '是' : '否' }}</td>
                  <td class="text-xs text-muted-foreground">{{ i.desc }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <p class="mono-tag text-muted-foreground">输出</p>
            <table class="table-base mt-2 w-full">
              <thead><tr><th>字段</th><th>类型</th><th>说明</th></tr></thead>
              <tbody>
                <tr v-for="o in current.outputs" :key="o.name">
                  <td class="font-mono text-xs">{{ o.name }}</td>
                  <td class="font-mono text-[10px]">{{ o.type }}</td>
                  <td class="text-xs text-muted-foreground">{{ o.desc }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="mt-4">
          <p class="mono-tag text-muted-foreground">执行步骤</p>
          <ol class="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li v-for="(st, i) in current.steps" :key="i">{{ st }}</li>
          </ol>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p class="mono-tag text-muted-foreground">依赖连接器</p>
            <div class="mt-1.5 flex flex-wrap gap-1">
              <span v-for="cid in current.deps?.connectors || []" :key="cid" class="stamp info"><i></i>{{ connectorName(cid) }}</span>
              <span v-if="!(current.deps?.connectors || []).length" class="text-xs text-muted-foreground">无</span>
            </div>
          </div>
          <div>
            <p class="mono-tag text-muted-foreground">失败策略</p>
            <p class="mt-1.5 text-xs text-muted-foreground">{{ current.failurePolicy }}</p>
          </div>
        </div>

        <div v-if="current.changelog?.length" class="mt-4">
          <p class="mono-tag text-muted-foreground">版本记录</p>
          <div class="mt-1.5 space-y-1">
            <p v-for="(c, i) in current.changelog" :key="i" class="font-mono text-[11px] text-muted-foreground">v{{ c.version }} · {{ c.note }}</p>
          </div>
        </div>
      </template>
    </Drawer>

    <!-- 新建技能 -->
    <Modal :open="showCreate" title="新建自定义技能" subtitle="选择执行方式后技能即刻可被 AI 真实调用；高风险动作仍走人工审批" @close="showCreate = false">
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">技能名称 *</label>
            <input v-model="form.name" class="input mt-1" placeholder="如：LED 大屏定时巡检" />
          </div>
          <div>
            <label class="label">业务域</label>
            <input v-model="form.domain" class="input mt-1" placeholder="如：矩阵拼接 / 中控" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">风险等级</label>
            <select v-model="form.risk" class="input mt-1">
              <option value="low">低（只读查询）</option>
              <option value="medium">中（一般操作）</option>
              <option value="high">高（批量/下发/写操作）</option>
            </select>
          </div>
          <div>
            <label class="label">版本</label>
            <input v-model="form.version" class="input mt-1" placeholder="1.0.0" />
          </div>
        </div>
        <div>
          <label class="label">图标与配色</label>
          <div class="mt-1.5 rounded-md border border-border bg-muted/30 px-3 py-2.5">
            <IconPicker v-model="form.icon" v-model:tint="form.tint" />
          </div>
        </div>
        <div>
          <label class="label">执行方式（决定 AI 调用它时做什么）</label>
          <select v-model="form.executorKind" class="input mt-1">
            <option value="plan_only">计划生成 — 按声明步骤输出执行计划，无需外部系统</option>
            <option value="kb_answer">知识问答 — 检索知识空间命中片段，由 AI 汇总回答</option>
            <option value="http_call">HTTP 调用 — 调用一个外部接口并返回结果</option>
          </select>
        </div>
        <div v-if="form.executorKind === 'kb_answer'">
          <label class="label">知识空间</label>
          <select v-model="form.spaceId" class="input mt-1">
            <option value="">全部知识空间</option>
            <option v-for="sp in spaces" :key="sp.id" :value="sp.id">{{ sp.name }}</option>
          </select>
          <p class="mt-1 text-2xs text-muted-foreground">AI 调用时以 query 参数检索；可在知识空间页面上传 SOP / 预案文档</p>
        </div>
        <template v-if="form.executorKind === 'http_call'">
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="label">请求方法</label>
              <select v-model="form.httpMethod" class="input mt-1">
                <option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option>
              </select>
            </div>
            <div class="col-span-2">
              <label class="label">接口地址 *</label>
              <input v-model="form.httpUrl" class="input mt-1 font-mono text-xs" placeholder="https://api.example.com/nodes/{{nodeId}}" />
            </div>
          </div>
          <div>
            <label class="label">入参定义（每行一个：参数名|说明|必填）</label>
            <textarea v-model="form.httpParamsText" class="input mt-1 h-16 resize-none font-mono text-xs" placeholder="nodeId|节点编号|必填&#10;reason|操作原因"></textarea>
          </div>
          <div>
            <label class="label">请求体模板（POST/PUT/PATCH 生效，支持 {{参数}}）</label>
            <textarea v-model="form.httpBody" class="input mt-1 h-16 resize-none font-mono text-xs" placeholder='{"node":"{{nodeId}}","action":"restart"}'></textarea>
          </div>
        </template>
        <div>
          <label class="label">能力描述 *</label>
          <textarea v-model="form.desc" class="input mt-1 h-16 resize-none" placeholder="这个技能做什么、解决什么问题（AI 据此决定何时调用）"></textarea>
        </div>
        <div>
          <label class="label">适用场景</label>
          <textarea v-model="form.scenario" class="input mt-1 h-16 resize-none" placeholder="什么情况下 AI 应调用它"></textarea>
        </div>
        <div v-if="form.executorKind === 'plan_only'">
          <label class="label">执行步骤（每行一步）</label>
          <textarea v-model="form.stepsText" class="input mt-1 h-24 resize-none font-mono text-xs" placeholder="1. 读取设备状态&#10;2. 汇总异常&#10;3. 生成处置建议"></textarea>
        </div>
        <div v-if="form.executorKind !== 'http_call'">
          <label class="label">入参声明（可选，每行一个：参数名|说明|必填）</label>
          <textarea v-model="form.inputsText" class="input mt-1 h-14 resize-none font-mono text-xs" placeholder="roomId|会议室编号&#10;date|日期|必填"></textarea>
          <p class="mt-1 text-2xs text-muted-foreground">声明后将在技能详情中展示，帮助使用者与 AI 理解调用所需的参数</p>
        </div>
      </div>
      <template #footer>
        <button class="btn-outline" @click="showCreate = false">取消</button>
        <button class="btn-primary" :disabled="saving" @click="submitCreate">{{ saving ? '创建中…' : '创建并启用' }}</button>
      </template>
    </Modal>

    <!-- 工具试运行台 -->
    <ToolTestModal :open="testOpen" :tool-name="testTool" @close="testOpen = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Wand2, Play, Pause, ChevronRight, PackagePlus, Download, FolderPlus, Check, Plus, Upload, Trash2, FlaskConical } from 'lucide-vue-next'
import { api } from '../api.js'
import { toast, currentProject, refreshProjects } from '../store.js'
import { RISK_META } from '../utils.js'
import Drawer from '../components/Drawer.vue'
import Modal from '../components/Modal.vue'
import ToolTestModal from '../components/ToolTestModal.vue'
import Skeleton from '../components/Skeleton.vue'
import IconPicker from '../components/IconPicker.vue'
import { abilityIcon, tintChipClass } from '../icons.js'

const EXECUTOR_LABELS = { plan_only: '计划生成', kb_answer: '知识问答', http_call: 'HTTP 调用' }

const list = ref([])
const market = ref([])
const connectors = ref([])
const loading = ref(true)
const tab = ref('installed')
const showDetail = ref(false)
const current = ref(null)
const showCreate = ref(false)
const saving = ref(false)
const importFileEl = ref(null)
const spaces = ref([])
const testOpen = ref(false)
const testTool = ref('')

function openTest(toolName) {
  testTool.value = toolName
  testOpen.value = true
}
const blankForm = () => ({
  name: '', domain: '', risk: 'medium', version: '1.0.0', desc: '', scenario: '', stepsText: '',
  icon: 'wand', tint: 'blue', inputsText: '',
  executorKind: 'plan_only', spaceId: '', httpMethod: 'GET', httpUrl: '', httpParamsText: '', httpBody: '',
})
const form = ref(blankForm())

function openCreate() {
  form.value = blankForm()
  showCreate.value = true
  if (!spaces.value.length) {
    api.get('/api/spaces').then((d) => { spaces.value = d.list || [] }).catch(() => {})
  }
}

function parseParams(text) {
  return String(text || '').split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => {
      const [name, desc, req] = l.split('|').map((x) => (x || '').trim())
      return { name, desc: desc || name, required: req === '必填' || req === 'required' }
    })
    .filter((p) => p.name)
}

function buildExecutor(f) {
  if (f.executorKind === 'kb_answer') return { kind: 'kb_answer', spaceId: f.spaceId || null }
  if (f.executorKind === 'http_call') {
    return { kind: 'http_call', method: f.httpMethod, url: f.httpUrl.trim(), body: f.httpBody, params: parseParams(f.httpParamsText) }
  }
  return { kind: 'plan_only' }
}

async function submitCreate() {
  const f = form.value
  if (!f.name.trim() || !f.desc.trim()) return toast('请填写技能名称与能力描述', 'error')
  if (f.executorKind === 'http_call' && !/^https?:\/\//.test(f.httpUrl.trim())) return toast('请填写合法的接口地址（http/https）', 'error')
  saving.value = true
  try {
    await api.post('/api/skills', {
      name: f.name.trim(),
      domain: f.domain.trim() || '自定义',
      risk: f.risk,
      version: f.version.trim() || '1.0.0',
      icon: f.icon,
      tint: f.tint,
      desc: f.desc.trim(),
      scenario: f.scenario.trim(),
      inputs: f.executorKind === 'http_call' ? [] : parseParams(f.inputsText).map((p) => ({ ...p, type: 'string' })),
      steps: f.stepsText.split('\n').map((x) => x.trim()).filter(Boolean),
      executor: buildExecutor(f),
    })
    toast('自定义技能已创建并启用，AI 现在可以调用它')
    showCreate.value = false
    tab.value = 'installed'
    await load()
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    saving.value = false
  }
}

function triggerImport() {
  importFileEl.value?.click()
}

function onImportFile(ev) {
  const file = ev.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async () => {
    try {
      await api.post('/api/skills/import', { payload: String(reader.result || '') })
      toast(`技能「${file.name}」导入成功`)
      tab.value = 'installed'
      await load()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      ev.target.value = ''
    }
  }
  reader.readAsText(file)
}

async function removeSkill(s) {
  if (!window.confirm(`确认删除自定义技能「${s.name}」？将同时从相关项目移除。`)) return
  try {
    await api.del(`/api/skills/${s.id}`)
    toast('已删除')
    await Promise.all([load(), refreshProjects()])
  } catch (err) {
    toast(err.message, 'error')
  }
}

const installed = computed(() => list.value)

function connectorName(id) {
  return connectors.value.find((c) => c.id === id)?.name || id
}

async function load() {
  loading.value = true
  try {
    const data = await api.get('/api/skills')
    list.value = data.list
    market.value = data.market.map((m) => ({ ...m, _installing: false }))
    connectors.value = data.connectors || []
  } finally {
    loading.value = false
  }
}

async function toggle(s) {
  try {
    await api.post(`/api/skills/${s.id}/toggle`)
    await load()
    toast(s.status === 'enabled' ? '已停用' : '已启用')
  } catch (err) {
    toast(err.message, 'error')
  }
}

async function install(s) {
  s._installing = true
  try {
    await api.post('/api/skills/install', { marketId: s.id })
    toast(`「${s.name}」已安装`)
    tab.value = 'installed'
    await load()
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    s._installing = false
  }
}

function openDetail(s) {
  current.value = s
  showDetail.value = true
}

/* 挂载到当前工作区（项目 × AI 搭配闭环） */
const ws = currentProject
const wsSkillIds = computed(() => ws.value?.skillIds || [])
async function mountToWs(s) {
  if (!ws.value || s._mounting) return
  s._mounting = true
  try {
    await api.patch(`/api/projects/${ws.value.id}`, { skillIds: [...ws.value.skillIds, s.id] })
    toast(`「${s.name}」已挂载到工作区「${ws.value.name}」，AI 立即可调用`)
    refreshProjects()
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    s._mounting = false
  }
}

onMounted(load)
</script>
