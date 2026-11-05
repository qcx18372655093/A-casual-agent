<template>
  <div class="px-6 py-5">
    <div class="flex items-center gap-2">
      <p class="text-sm text-muted-foreground">连接器是 AI 访问外部系统的唯一通道：先授权，再按项目范围开放；高风险写操作始终需要人工审批</p>
      <button class="btn-outline btn-sm ml-auto" @click="triggerImport"><Upload :size="12" /> 导入 JSON</button>
      <button class="btn-primary btn-sm" @click="openCreate"><Plus :size="12" /> 新建连接器</button>
      <span class="stamp info"><i></i>MCP 协议接入</span>
    </div>
    <input ref="importFileEl" type="file" accept=".json,application/json" class="hidden" @change="onImportFile" />

    <Skeleton v-if="loading" kind="cards" :count="6" />

    <div v-else class="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
      <div v-for="c in list" :key="c.id" class="card p-4">
        <div class="flex items-center gap-2">
          <span v-if="c.custom" class="chip-icon h-7 w-7 flex-none" :class="tintChipClass(c.tint)">
            <component :is="abilityIcon(c.icon)" :size="14" :stroke-width="1.8" />
          </span>
          <component v-else :is="typeIcon(c.category)" :size="16" class="text-muted-foreground" />
          <h3 class="text-sm font-semibold">{{ c.name }}</h3>
          <span v-if="c.dataSource === 'demo'" class="stamp warning" title="演示连接器：返回内置示例数据"><i></i>演示数据</span>
          <StatusStamp class="ml-auto" :status="c.status" :map="CONNECTOR_STATUS" />
        </div>
        <p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">{{ c.desc }}</p>

        <div class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span>类型：{{ c.category }} · {{ c.protocol }}</span>
          <span>环境：{{ c.env }}</span>
          <span>权限范围：{{ scopeLabel(c.scopes) }}</span>
          <span>最近同步：{{ c.lastSyncAt ? fmtRelative(c.lastSyncAt) : '—' }}</span>
          <span>维护方：{{ c.owner }}</span>
          <span v-if="mcpOf(c)">MCP Server：{{ mcpOf(c).name }}@{{ mcpOf(c).version }}</span>
        </div>

        <div v-if="c.testResult" class="mt-3 rounded-sm border px-3 py-2 text-xs"
          :class="c.testResult.ok ? 'border-success/40 bg-success/[0.06]' : 'border-destructive/40 bg-destructive/[0.06]'">
          <span :class="c.testResult.ok ? 'text-success' : 'text-destructive'">{{ c.testResult.ok ? '连通正常' : '连通失败' }}</span>
          <span class="ml-2 text-muted-foreground">{{ c.testResult.message }} · {{ c.testResult.latencyMs }}ms · {{ fmtRelative(c.testResult.at) }}</span>
        </div>

        <div class="mt-3 flex items-center gap-2 border-t border-border/70 pt-3">
          <template v-if="c.status !== 'connected'">
            <button class="btn-primary btn-sm" :disabled="c._acting" @click="authorize(c)"><KeyRound :size="12" /> {{ c.status === 'expired' ? '重新授权' : '授权接入' }}</button>
          </template>
          <template v-else>
            <button class="btn-outline btn-sm" :disabled="c._acting" @click="test(c)"><PlugZap :size="12" /> {{ c._acting ? '测试中…' : '测试连通性' }}</button>
            <button
              v-if="ws"
              class="btn-outline btn-sm"
              :class="wsConnIds.includes(c.id) && '!border-success/40 !bg-success/10 !text-success'"
              :disabled="wsConnIds.includes(c.id) || c._granting"
              :title="wsConnIds.includes(c.id) ? `已授权给「${ws.name}」` : `授权给当前工作区「${ws.name}」`"
              @click="grantToWs(c)"
            >
              <component :is="wsConnIds.includes(c.id) ? Check : FolderPlus" :size="12" />
              {{ wsConnIds.includes(c.id) ? '已授给工作区' : c._granting ? '授权中…' : '授给工作区' }}
            </button>
            <button class="btn-outline btn-sm" :disabled="c._acting" @click="revoke(c)"><Unplug :size="12" /> 撤销授权</button>
          </template>
          <button v-if="c.custom" class="btn-ghost btn-sm text-destructive" title="删除自定义连接器" @click="removeConnector(c)"><Trash2 :size="12" /></button>
          <button class="btn-ghost btn-sm" :class="c.custom ? '' : 'ml-auto'" @click="openDetail(c)">详情 <ChevronRight :size="12" /></button>
        </div>
      </div>
    </div>

    <!-- 详情抽屉 -->
    <Drawer :open="showDetail" :title="current?.name || ''" width="max-w-2xl" @close="showDetail = false">
      <template v-if="current">
        <div class="flex flex-wrap items-center gap-2">
          <StatusStamp :status="current.status" :map="CONNECTOR_STATUS" />
          <span v-if="current.dataSource === 'demo'" class="stamp warning"><i></i>演示数据</span>
          <span class="stamp info"><i></i>{{ current.env }}</span>
        </div>
        <p class="mt-3 text-sm leading-relaxed text-muted-foreground">{{ current.desc }}</p>

        <div v-if="server" class="mt-5">
          <div class="flex items-center gap-2">
            <p class="mono-tag text-muted-foreground">MCP SERVER</p>
            <span class="font-mono text-xs">{{ server.name }}@{{ server.version }}</span>
            <span class="stamp muted"><i></i>{{ server.risk }}</span>
            <span class="stamp muted"><i></i>{{ server.dataClassification }}</span>
          </div>
          <p class="mt-1 text-xs text-muted-foreground">{{ server.desc }}</p>

          <table class="table-base mt-3 w-full">
            <thead>
              <tr><th>工具</th><th>说明</th><th>读写</th><th>风险</th><th>参数</th><th class="text-right">调试</th></tr>
            </thead>
            <tbody>
              <tr v-for="t in server.tools" :key="t.name">
                <td class="font-mono text-xs">{{ t.name }}</td>
                <td class="text-xs">{{ t.desc }}</td>
                <td>
                  <span class="stamp" :class="t.sideEffect === 'read' ? 'info' : 'warning'">
                    <i></i>{{ SIDE_EFFECT[t.sideEffect]?.label }}
                  </span>
                </td>
                <td>
                  <span class="stamp" :class="RISK_META[t.risk]?.tone"><i></i>{{ RISK_META[t.risk]?.label }}</span>
                </td>
                <td class="font-mono text-[10px] text-muted-foreground">{{ Object.keys(t.schema?.properties || {}).join(', ') || '—' }}</td>
                <td class="text-right">
                  <button class="btn-ghost btn-xs" :disabled="current.status !== 'connected'" :title="current.status !== 'connected' ? '授权接入后可试运行' : ''" @click="openTest(t.name)"><FlaskConical :size="11" /> 试运行</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 自定义声明式 HTTP 工具 -->
        <div v-if="current.tools?.length" class="mt-5">
          <div class="flex items-center gap-2">
            <p class="mono-tag text-muted-foreground">声明工具（HTTP）</p>
            <span class="font-mono text-2xs text-muted-foreground">{{ current.tools.length }} 个 · 授权接入后 AI 可调用</span>
          </div>
          <table class="table-base mt-3 w-full">
            <thead>
              <tr><th>工具</th><th>说明</th><th>方法</th><th>风险</th><th>参数</th><th class="text-right">调试</th></tr>
            </thead>
            <tbody>
              <tr v-for="t in current.tools" :key="t.name">
                <td class="font-mono text-xs">{{ t.name }}</td>
                <td class="text-xs">{{ t.desc }}</td>
                <td><span class="stamp" :class="t.method === 'GET' ? 'info' : 'warning'"><i></i>{{ t.method }}</span></td>
                <td><span class="stamp" :class="RISK_META[t.risk]?.tone"><i></i>{{ RISK_META[t.risk]?.label }}</span></td>
                <td class="font-mono text-[10px] text-muted-foreground">{{ (t.params || []).map((p) => p.name).join(', ') || '—' }}</td>
                <td class="text-right">
                  <button class="btn-ghost btn-xs" :disabled="current.status !== 'connected'" :title="current.status !== 'connected' ? '授权接入后可试运行' : ''" @click="openTest(t.name)"><FlaskConical :size="11" /> 试运行</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else-if="!server && current.custom" class="mt-5 rounded-sm border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
          该连接器尚未声明工具，AI 暂无可调用入口。可删除后重新创建并在「声明工具」中登记 HTTP 接口。
        </div>

        <div class="mt-5 rounded-sm border border-border bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          授权后，AI 仅能在项目允许的范围内调用该连接器；所有调用均记录审计日志。撤销授权会立即阻断调用并通知受影响项目的负责人。
        </div>
      </template>
    </Drawer>

    <!-- 新建连接器 -->
    <Modal :open="showCreate" title="新建自定义连接器" subtitle="登记外部系统后，再完成授权接入；AI 只会在被授权的项目范围内调用" @close="showCreate = false">
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">连接器名称 *</label>
            <input v-model="form.name" class="input mt-1" placeholder="如：3 号楼中控网关" />
          </div>
          <div>
            <label class="label">系统类型</label>
            <input v-model="form.category" class="input mt-1" placeholder="如：设备平台 / 消息渠道" />
          </div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="label">协议</label>
            <input v-model="form.protocol" class="input mt-1" placeholder="HTTP/MCP" />
          </div>
          <div>
            <label class="label">环境</label>
            <input v-model="form.env" class="input mt-1" placeholder="生产/测试" />
          </div>
          <div>
            <label class="label">维护方</label>
            <input v-model="form.owner" class="input mt-1" placeholder="如：信息部" />
          </div>
        </div>
        <div>
          <label class="label">图标与配色</label>
          <div class="mt-1.5 rounded-md border border-border bg-muted/30 px-3 py-2.5">
            <IconPicker v-model="form.icon" v-model:tint="form.tint" />
          </div>
        </div>
        <div>
          <label class="label">权限范围</label>
          <select v-model="form.scope" class="input mt-1">
            <option value="read">只读（查询/读取）</option>
            <option value="write">可写（含下发/变更，需审批）</option>
          </select>
        </div>
        <div>
          <label class="label">说明</label>
          <textarea v-model="form.desc" class="input mt-1 h-16 resize-none" placeholder="连接的系统、可提供的数据或操作"></textarea>
        </div>

        <!-- 声明式 HTTP 工具编辑 -->
        <div>
          <div class="flex items-center justify-between">
            <label class="label">声明工具（HTTP 接口，授权后 AI 可直接调用）</label>
            <button type="button" class="btn-outline btn-xs" @click="addTool"><Plus :size="11" /> 添加工具</button>
          </div>
          <p v-if="!form.tools.length" class="mt-1.5 text-2xs text-muted-foreground">暂不声明也可以，先登记连接器，之后再补充（删除重建）。</p>
          <div v-for="(t, i) in form.tools" :key="i" class="mt-2 space-y-2 rounded-md border border-border bg-muted/30 p-3">
            <div class="flex items-center gap-2">
              <input v-model="t.name" class="input flex-1 font-mono text-xs" placeholder="工具名，如 ecis.list_nodes（小写 point.case）" />
              <select v-model="t.method" class="input w-24">
                <option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option>
              </select>
              <button type="button" class="btn-ghost btn-xs text-danger" @click="form.tools.splice(i, 1)"><Trash2 :size="12" /></button>
            </div>
            <input v-model="t.desc" class="input text-xs" placeholder="工具说明（AI 据此决定何时调用）" />
            <input v-model="t.url" class="input font-mono text-xs" placeholder="接口地址，支持 {{参数}} 模板，如 https://host/api/nodes/{{nodeId}}" />
            <textarea v-model="t.paramsText" class="input h-14 resize-none font-mono text-2xs" placeholder="入参（每行一个：参数名|说明|必填）&#10;nodeId|节点编号|必填"></textarea>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn-outline" @click="showCreate = false">取消</button>
        <button class="btn-primary" :disabled="saving" @click="submitCreate">{{ saving ? '创建中…' : '创建连接器' }}</button>
      </template>
    </Modal>

    <!-- 工具试运行台 -->
    <ToolTestModal :open="testOpen" :tool-name="testTool" @close="testOpen = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { KeyRound, PlugZap, Unplug, ChevronRight, Server, MessageSquare, BookOpen, Workflow, ShoppingCart, Building2, FolderPlus, Check, Plus, Upload, Trash2, FlaskConical } from 'lucide-vue-next'
import { api } from '../api.js'
import { toast, currentProject, refreshProjects } from '../store.js'
import { CONNECTOR_STATUS, SIDE_EFFECT, RISK_META, fmtRelative } from '../utils.js'
import StatusStamp from '../components/StatusStamp.vue'
import Drawer from '../components/Drawer.vue'
import Modal from '../components/Modal.vue'
import Skeleton from '../components/Skeleton.vue'
import ToolTestModal from '../components/ToolTestModal.vue'
import IconPicker from '../components/IconPicker.vue'
import { abilityIcon, tintChipClass } from '../icons.js'

const testOpen = ref(false)
const testTool = ref('')
function openTest(name) {
  testTool.value = name
  testOpen.value = true
}

const list = ref([])
const servers = ref([])
const loading = ref(true)
const showDetail = ref(false)
const current = ref(null)

const server = computed(() => servers.value.find((s) => s.connectorId === current.value?.id) || null)

function mcpOf(c) {
  return servers.value.find((s) => s.connectorId === c.id) || null
}

function typeIcon(type) {
  const map = { 设备平台: Server, 企业服务: Workflow, 消息渠道: MessageSquare, 知识库: BookOpen, 采购系统: ShoppingCart }
  return map[type] || Building2
}

function scopeLabel(scope) {
  return (scope || []).map((s) => SIDE_EFFECT[s]?.label || s).join(' + ')
}

async function load() {
  loading.value = true
  try {
    const data = await api.get('/api/connectors')
    list.value = data.list.map((c) => ({ ...c, _acting: false }))
    servers.value = data.mcpServers || []
  } finally {
    loading.value = false
  }
}

async function authorize(c) {
  c._acting = true
  try {
    await api.post(`/api/connectors/${c.id}/authorize`)
    toast(`「${c.name}」已授权接入（演示流程）`)
    await load()
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    c._acting = false
  }
}

async function revoke(c) {
  if (!window.confirm(`确认撤销「${c.name}」的授权？AI 将无法再调用该连接器。`)) return
  c._acting = true
  try {
    await api.post(`/api/connectors/${c.id}/revoke`)
    toast('授权已撤销')
    await load()
  } finally {
    c._acting = false
  }
}

/* 授权到当前工作区（项目 × AI 搭配闭环） */
const ws = currentProject
const wsConnIds = computed(() => ws.value?.connectorIds || [])
async function grantToWs(c) {
  if (!ws.value || c._granting) return
  c._granting = true
  try {
    await api.patch(`/api/projects/${ws.value.id}`, { connectorIds: [...ws.value.connectorIds, c.id] })
    toast(`「${c.name}」已授权给工作区「${ws.value.name}」，AI 立即可调用`)
    refreshProjects()
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    c._granting = false
  }
}

async function test(c) {
  c._acting = true
  try {
    const data = await api.post(`/api/connectors/${c.id}/test`)
    const r = data.result || {}
    c.testResult = {
      ok: !!r.ok,
      message: r.ok ? `${r.note || '连接正常'}（${r.env}）` : r.reason || '连接失败',
      latencyMs: r.latencyMs ?? '—',
      at: new Date().toISOString(),
    }
    toast(r.ok ? '连通测试通过' : '连通测试失败', r.ok ? 'success' : 'error')
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    c._acting = false
  }
}

function openDetail(c) {
  current.value = c
  showDetail.value = true
}

/* ---------- 新建 / 导入 / 删除自定义连接器 ---------- */
const showCreate = ref(false)
const saving = ref(false)
const importFileEl = ref(null)
const emptyTool = () => ({ name: '', desc: '', method: 'GET', url: '', paramsText: '' })
const emptyForm = () => ({ name: '', category: '', protocol: 'HTTP', env: '生产', owner: '', scope: 'read', desc: '', icon: 'globe', tint: 'cyan', tools: [] })
const form = ref(emptyForm())

function openCreate() {
  form.value = emptyForm()
  showCreate.value = true
}

function addTool() {
  form.value.tools.push(emptyTool())
}

function parseToolParams(text) {
  return String(text || '').split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => {
      const [name, desc, req] = l.split('|').map((x) => (x || '').trim())
      return { name, desc: desc || name, required: req === '必填' || req === 'required' }
    })
    .filter((p) => p.name)
}

async function submitCreate() {
  if (!form.value.name.trim()) {
    toast('请填写连接器名称', 'error')
    return
  }
  const tools = form.value.tools
    .map((t) => ({ name: t.name.trim(), desc: t.desc.trim() || t.name.trim(), method: t.method, url: t.url.trim(), params: parseToolParams(t.paramsText) }))
    .filter((t) => t.name || t.url)
  for (const t of tools) {
    if (!/^[a-z][a-z0-9]*(\.[a-z0-9_]+)+$/.test(t.name)) return toast(`工具名「${t.name || '(空)'}」需为小写 point.case，如 ecis.list_nodes`, 'error')
    if (!/^https?:\/\//.test(t.url)) return toast(`工具「${t.name}」缺少合法接口地址`, 'error')
  }
  saving.value = true
  try {
    const scopes = form.value.scope === 'write' ? ['read', 'write'] : ['read']
    await api.post('/api/connectors', {
      name: form.value.name.trim(),
      category: form.value.category.trim() || '自定义系统',
      protocol: form.value.protocol.trim() || 'HTTP',
      env: form.value.env.trim() || '生产',
      owner: form.value.owner.trim() || '自定义',
      icon: form.value.icon,
      tint: form.value.tint,
      scopes,
      desc: form.value.desc.trim(),
      tools,
    })
    toast(tools.length ? `连接器已创建（含 ${tools.length} 个声明工具），授权后 AI 即可调用` : '连接器已创建（未连接），可在卡片上完成授权接入')
    showCreate.value = false
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
      const payload = JSON.parse(reader.result)
      const data = await api.post('/api/connectors/import', { payload })
      toast(data.duplicated ? `已存在同名连接器「${data.connector?.name}」，未重复导入` : `连接器「${data.connector?.name}」导入成功`)
      await load()
    } catch (err) {
      toast(err.message || '导入失败，请检查 JSON 格式', 'error')
    } finally {
      ev.target.value = ''
    }
  }
  reader.readAsText(file)
}

async function removeConnector(c) {
  if (!window.confirm(`确认删除自定义连接器「${c.name}」？将同步从已授权项目中移除，预置连接器不可删除。`)) return
  try {
    await api.del(`/api/connectors/${c.id}`)
    toast('连接器已删除')
    await Promise.all([load(), refreshProjects()])
  } catch (err) {
    toast(err.message, 'error')
  }
}

onMounted(load)
</script>
