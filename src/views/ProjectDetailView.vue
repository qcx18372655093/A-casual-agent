<template>
  <div v-if="project" class="mx-auto max-w-6xl px-6 py-8">
    <!-- 头部 -->
    <div class="rise">
      <RouterLink to="/projects" class="mono-tag text-muted-foreground hover:text-foreground">← 公司项目</RouterLink>
      <div class="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="font-display text-2xl font-black">{{ project.name }}</h2>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <span class="stamp primary"><i></i>{{ project.type }}</span>
            <StatusStamp :status="project.status" :map="PROJECT_STATUS" />
            <span class="mono-tag text-muted-foreground">负责人 {{ project.owner }}</span>
            <span class="mono-tag text-muted-foreground">创建于 {{ fmtDate(project.createdAt) }}</span>
          </div>
        </div>
        <div class="flex flex-none items-center gap-2">
          <button
            class="btn-outline"
            :class="isCurrentWs && '!border-success/40 !bg-success/10 !text-success'"
            @click="toggleWorkspace"
          >
            <component :is="isCurrentWs ? Check : Target" :size="14" />
            {{ isCurrentWs ? '当前工作区' : '设为当前工作区' }}
          </button>
          <button class="btn-primary" @click="$router.push({ path: '/tasks/new', query: { projectId: project.id } })">
            <Sparkles :size="14" /> 发起 AI 任务
          </button>
        </div>
      </div>
    </div>

    <!-- 页签 -->
    <div class="rise rise-1 mt-6 flex gap-1 border-b border-border">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="relative px-3 py-2 text-sm transition-colors duration-150"
        :class="tab === t.key ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'"
        @click="tab = t.key"
      >
        {{ t.label }}
        <span v-if="tab === t.key" class="absolute right-0 bottom-0 left-0 h-0.5 bg-primary"></span>
      </button>
    </div>

    <!-- 概览 -->
    <div v-if="tab === 'overview'" class="rise mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div class="space-y-4 lg:col-span-2">
        <div class="card p-5">
          <p class="mono-tag text-muted-foreground">项目目标</p>
          <p class="mt-2 text-sm leading-relaxed">{{ project.goal || '未填写' }}</p>
        </div>
        <div class="card p-5">
          <p class="mono-tag text-muted-foreground">AI 工作指令</p>
          <p class="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{{ project.instructions || '未配置——AI 将以通用助手身份工作' }}</p>
        </div>
        <div class="card border-warning/40 p-5">
          <p class="mono-tag text-warning">操作边界</p>
          <p class="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{{ project.boundaries || '未配置' }}</p>
        </div>
      </div>
      <div class="space-y-4">
        <div class="card p-5">
          <div class="flex items-center justify-between">
            <p class="mono-tag text-muted-foreground">授权连接器（{{ connectors.length }}）</p>
            <RouterLink to="/connectors" class="text-[11px] text-muted-foreground hover:text-foreground">管理 →</RouterLink>
          </div>
          <div class="mt-3 space-y-2">
            <div v-for="c in connectors" :key="c.id" class="group flex items-center justify-between gap-2 text-sm">
              <span class="truncate">{{ c.name }}</span>
              <div class="flex flex-none items-center gap-1.5">
                <span v-if="c.dataSource === 'demo'" class="stamp warning"><i></i>演示</span>
                <StatusStamp :status="c.status" :map="CONNECTOR_STATUS" />
                <button
                  class="hidden h-5 w-5 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-danger group-hover:flex"
                  title="移出授权范围"
                  @click="removeCapability('connector', c.id)"
                >
                  <X :size="12" />
                </button>
              </div>
            </div>
            <p v-if="connectors.length === 0" class="text-xs text-muted-foreground">未授权任何连接器</p>
          </div>
          <!-- 一键扩展：把已接入的连接器纳入本项目授权范围 -->
          <div v-if="availableConnectors.length" class="mt-3 border-t border-border pt-3">
            <div class="flex items-center gap-2">
              <select v-model="pickConnector" class="input !h-8 flex-1 !text-[12px]">
                <option value="">添加连接器到授权范围…</option>
                <option v-for="c in availableConnectors" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
              <button class="btn-outline btn-sm flex-none" :disabled="!pickConnector || capSaving" @click="addCapability('connector')">
                <Plus :size="12" /> 添加
              </button>
            </div>
          </div>
        </div>
        <div class="card p-5">
          <div class="flex items-center justify-between">
            <p class="mono-tag text-muted-foreground">挂载技能（{{ skills.length }}）</p>
            <RouterLink to="/skills" class="text-[11px] text-muted-foreground hover:text-foreground">管理 →</RouterLink>
          </div>
          <div class="mt-3 space-y-2">
            <div v-for="s in skills" :key="s.id" class="group flex items-center justify-between gap-2 text-sm">
              <span class="truncate">{{ s.name }} <span class="font-mono text-[10px] text-muted-foreground">v{{ s.version }}</span></span>
              <div class="flex flex-none items-center gap-1.5">
                <StatusStamp :status="s.status" :map="SKILL_STATUS" />
                <button
                  class="hidden h-5 w-5 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-danger group-hover:flex"
                  title="移出项目"
                  @click="removeCapability('skill', s.id)"
                >
                  <X :size="12" />
                </button>
              </div>
            </div>
            <p v-if="skills.length === 0" class="text-xs text-muted-foreground">未挂载技能</p>
          </div>
          <!-- 一键扩展：把已安装技能挂载到本项目 -->
          <div v-if="availableSkills.length" class="mt-3 border-t border-border pt-3">
            <div class="flex items-center gap-2">
              <select v-model="pickSkill" class="input !h-8 flex-1 !text-[12px]">
                <option value="">挂载技能到本项目…</option>
                <option v-for="s in availableSkills" :key="s.id" :value="s.id">{{ s.name }} v{{ s.version }}</option>
              </select>
              <button class="btn-outline btn-sm flex-none" :disabled="!pickSkill || capSaving" @click="addCapability('skill')">
                <Plus :size="12" /> 挂载
              </button>
            </div>
          </div>
        </div>
        <div class="card p-5">
          <p class="mono-tag text-muted-foreground">近期动态</p>
          <div class="mt-3 space-y-2.5">
            <div v-for="a in activities.slice(0, 6)" :key="a.id" class="text-xs">
              <p class="leading-relaxed">{{ a.text }}</p>
              <p class="mt-0.5 font-mono text-[10px] text-muted-foreground">{{ a.actor }} · {{ fmtRelative(a.createdAt) }}</p>
            </div>
            <p v-if="activities.length === 0" class="text-xs text-muted-foreground">暂无动态</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 智能应用：项目授权范围内可直接运行的 Agent 应用 -->
    <div v-else-if="tab === 'apps'" class="rise mt-5">
      <!-- 内嵌运行中的应用 -->
      <div v-if="runningApp" class="mb-4">
        <button class="btn-ghost btn-sm mb-3" @click="runningApp = ''">
          <ArrowRight :size="13" class="rotate-180" /> 返回应用列表
        </button>
        <div class="card p-5">
          <AlertsView v-if="runningApp === 'alerts'" embedded :project-id="project.id" />
          <DataQualityView v-else-if="runningApp === 'dq'" embedded :project-id="project.id" />
        </div>
      </div>

      <template v-else>
        <div class="flex items-center justify-between gap-3">
          <p class="text-[13px] text-muted-foreground">
            Agent 应用由项目已挂载的技能驱动；未授权的应用可在方案中心一键装配到本项目。
          </p>
          <button class="btn-outline btn-sm flex-none" @click="goSolutions">
            <Plus :size="13" /> 从方案中心拓展
          </button>
        </div>

        <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="a in availableApps"
            :key="a.key"
            class="card flex flex-col p-4"
            :class="a.mounted ? '' : 'opacity-70'"
          >
            <div class="flex items-start justify-between">
              <span class="chip-icon h-9 w-9" :class="a.cls">
                <component :is="a.icon" :size="17" :stroke-width="1.8" />
              </span>
              <span v-if="a.mounted" class="stamp success"><i></i>已授权</span>
              <span v-else class="stamp muted"><i></i>未授权</span>
            </div>
            <p class="mt-3 text-[13.5px] font-semibold">{{ a.name }}</p>
            <p class="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">{{ a.desc }}</p>
            <div class="mt-3 border-t border-border/70 pt-3">
              <button v-if="a.mounted" class="btn-primary btn-sm w-full" @click="runApp(a)">
                <Sparkles :size="12" /> 运行应用
              </button>
              <button v-else class="btn-outline btn-sm w-full" @click="goSolutions">
                <Plus :size="12" /> 装配该能力
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 任务 -->
    <div v-else-if="tab === 'tasks'" class="rise card mt-5">
      <table v-if="tasks.length" class="table-base w-full">
        <thead><tr><th>编号</th><th>任务</th><th>状态</th><th>发起时间</th></tr></thead>
        <tbody>
          <tr v-for="t in tasks" :key="t.id" class="cursor-pointer transition-colors hover:bg-muted/50" @click="$router.push(`/tasks/${t.id}`)">
            <td class="font-mono text-xs text-muted-foreground">{{ t.displayId }}</td>
            <td class="font-medium">{{ t.title }}</td>
            <td><StatusStamp :status="t.status" :map="TASK_STATUS" /></td>
            <td class="font-mono text-xs text-muted-foreground">{{ fmtTime(t.createdAt) }}</td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-else title="项目内还没有任务" desc="点击右上角「发起 AI 任务」开始" />
    </div>

    <!-- 待办与审批（项目会话相关） -->
    <div v-else-if="tab === 'inbox'" class="rise mt-5 space-y-4">
      <Skeleton v-if="inboxLoading" type="rows" :rows="3" />
      <template v-else>
        <!-- 待审批（高风险闸门） -->
        <div>
          <div class="flex items-center gap-2">
            <h3 class="mono-tag text-muted-foreground">待审批</h3>
            <span class="stamp danger"><i></i>{{ pendingApprovals.length }}</span>
          </div>
          <div v-if="pendingApprovals.length" class="mt-3 space-y-3">
            <ApprovalCard
              v-for="a in pendingApprovals"
              :key="a.id"
              :approval="a"
              :acting="actingApprovalId === a.id"
              link-context
              @decide="(d) => decideApproval(a, d)"
            />
          </div>
          <div v-else class="mt-3 rounded-md border border-dashed border-border px-4 py-5 text-center">
            <p class="text-xs text-muted-foreground">当前没有等待裁决的高风险操作</p>
          </div>
        </div>

        <!-- 项目待办 -->
        <div>
          <div class="flex items-center gap-2">
            <h3 class="mono-tag text-muted-foreground">项目待办</h3>
            <span class="stamp muted"><i></i>{{ inboxTodos.filter((t) => t.status !== 'done').length }} 未完成</span>
          </div>
          <div v-if="inboxTodos.length" class="card mt-3 divide-y divide-border/60">
            <div
              v-for="t in inboxTodos"
              :key="t.id"
              class="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
              @click="toggleTodo(t)"
            >
              <span
                class="grid size-4 flex-none place-items-center rounded border transition-colors"
                :class="t.status === 'done' ? 'border-success bg-success text-white' : 'border-border bg-card'"
              >
                <Check v-if="t.status === 'done'" :size="11" />
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-sm" :class="t.status === 'done' && 'text-muted-foreground line-through'">{{ t.title }}</p>
                <p class="mt-0.5 text-[11px] text-muted-foreground">
                  <RouterLink v-if="t.taskId && t.taskTitle" :to="`/tasks/${t.taskId}`" class="hover:text-foreground" @click.stop>
                    来源会话：{{ t.taskTitle }}
                  </RouterLink>
                  <span v-else>项目内手动添加</span>
                </p>
              </div>
              <span class="font-mono text-[10px] text-muted-foreground">{{ fmtRelative(t.createdAt) }}</span>
            </div>
          </div>
          <div v-else class="mt-3 rounded-md border border-dashed border-border px-4 py-5 text-center">
            <p class="text-xs text-muted-foreground">暂无待办，AI 任务产生的高风险步骤与待办会汇总到这里</p>
          </div>
        </div>

        <!-- 审批历史 -->
        <div v-if="doneApprovals.length">
          <h3 class="mono-tag text-muted-foreground">审批历史</h3>
          <div class="mt-3 space-y-2">
            <div v-for="a in doneApprovals" :key="a.id" class="card flex items-center gap-3 px-4 py-3">
              <StatusStamp :status="a.status" :map="APPROVAL_STATUS" />
              <p class="min-w-0 flex-1 truncate text-sm">{{ a.title }}</p>
              <RouterLink v-if="a.taskId" :to="`/tasks/${a.taskId}`" class="text-[11px] text-muted-foreground hover:text-foreground">
                来源会话
              </RouterLink>
              <span class="font-mono text-[10px] text-muted-foreground">{{ fmtRelative(a.decidedAt || a.createdAt) }}</span>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 资料 -->
    <div v-else-if="tab === 'docs'" class="rise card mt-5">
      <table v-if="docs.length" class="table-base w-full">
        <thead><tr><th>文档</th><th>分类</th><th>版本</th><th>大小</th><th>更新时间</th></tr></thead>
        <tbody>
          <tr v-for="d in docs" :key="d.id">
            <td class="font-medium">{{ d.title }}</td>
            <td class="text-muted-foreground">{{ d.category }}</td>
            <td class="font-mono text-xs">{{ d.version }}</td>
            <td class="font-mono text-xs text-muted-foreground">{{ d.size }}</td>
            <td class="font-mono text-xs text-muted-foreground">{{ fmtDate(d.updatedAt) }}</td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-else title="项目知识空间暂无资料" desc="前往「知识空间」上传文档、手册与模板">
        <RouterLink to="/knowledge" class="btn-outline">打开知识空间</RouterLink>
      </EmptyState>
    </div>

    <!-- 自动化 -->
    <div v-else-if="tab === 'automations'" class="rise mt-5 space-y-3">
      <template v-if="automations.length">
        <div v-for="a in automations" :key="a.id" class="card flex flex-wrap items-center gap-3 p-4">
          <div class="min-w-0 flex-1">
            <p class="font-medium">{{ a.name }}</p>
            <p class="mt-0.5 font-mono text-[11px] text-muted-foreground">{{ a.schedule?.text }} · 技能：{{ skillName(a.skillId) }}</p>
          </div>
          <div class="text-right text-xs text-muted-foreground">
            <p>上次运行</p>
            <p class="mt-0.5 font-mono">{{ a.lastRun ? fmtRelative(a.lastRun.startedAt) : '从未运行' }}</p>
          </div>
          <StatusStamp :status="a.status === 'enabled' ? 'enabled' : 'disabled'" :map="SKILL_STATUS" />
        </div>
      </template>
      <EmptyState v-else title="项目内还没有自动化任务">
        <RouterLink to="/automations" class="btn-outline">前往自动化创建</RouterLink>
      </EmptyState>
    </div>

    <!-- 成员 -->
    <div v-else-if="tab === 'members'" class="rise mt-5">
      <div class="card">
        <table class="table-base w-full">
          <thead><tr><th>成员</th><th>角色</th><th>邮箱</th><th class="w-20"></th></tr></thead>
          <tbody>
            <tr v-for="m in project.members" :key="m.name">
              <td class="font-medium">{{ m.name }}</td>
              <td><span class="stamp" :class="m.role === '负责人' ? 'primary' : 'muted'"><i></i>{{ m.role }}</span></td>
              <td class="font-mono text-xs text-muted-foreground">{{ m.email || '—' }}</td>
              <td>
                <button v-if="m.role !== '负责人'" class="btn-ghost text-xs" @click="removeMember(m.name)"><Trash2 :size="13" /></button>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
          <input v-model="memberForm.name" class="input w-36" placeholder="姓名" />
          <select v-model="memberForm.role" class="input w-36">
            <option>运维</option>
            <option>成员</option>
            <option>审批人</option>
            <option>观察者</option>
          </select>
          <input v-model="memberForm.email" class="input w-56" placeholder="邮箱（可选）" />
          <button class="btn-outline" :disabled="!memberForm.name.trim()" @click="addMember"><Plus :size="13" /> 添加成员</button>
        </div>
      </div>
    </div>

    <!-- 设置 -->
    <div v-else-if="tab === 'settings'" class="rise mt-5 max-w-3xl">
      <div class="card space-y-4 p-5">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="label">项目名称</label>
            <input v-model="editForm.name" class="input mt-1" />
          </div>
          <div>
            <label class="label">负责人</label>
            <input v-model="editForm.owner" class="input mt-1" />
          </div>
        </div>
        <div>
          <label class="label">项目目标</label>
          <textarea v-model="editForm.goal" class="input mt-1 h-16 resize-none"></textarea>
        </div>
        <div>
          <label class="label">AI 工作指令</label>
          <textarea v-model="editForm.instructions" class="input mt-1 h-28 resize-none font-mono text-xs" placeholder="约束 AI 在本项目内的工作方式…"></textarea>
        </div>
        <div>
          <label class="label">操作边界</label>
          <textarea v-model="editForm.boundaries" class="input mt-1 h-20 resize-none font-mono text-xs" placeholder="AI 不得触碰的红线…"></textarea>
        </div>
        <div>
          <label class="label">项目状态</label>
          <select v-model="editForm.status" class="input mt-1 w-48">
            <option value="active">进行中</option>
            <option value="paused">已暂停</option>
            <option value="archived">已归档</option>
          </select>
        </div>
        <div class="flex justify-end gap-2 border-t border-border pt-4">
          <button class="btn-primary" :disabled="saving" @click="saveSettings">{{ saving ? '保存中…' : '保存设置' }}</button>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="px-6 py-5"><Skeleton kind="rows" :count="5" /></div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Sparkles,
  Plus,
  Trash2,
  Target,
  Check,
  X,
  Siren,
  ShieldCheck,
  Radar,
  MonitorDot,
  SlidersHorizontal,
  LayoutGrid,
  Presentation,
  GraduationCap,
  BookOpen,
  ArrowRight,
} from 'lucide-vue-next'
import { gs, toast, setCurrentProject, refreshProjects } from '../store.js'
import { api } from '../api.js'
import { TASK_STATUS, CONNECTOR_STATUS, SKILL_STATUS, APPROVAL_STATUS, fmtTime, fmtDate, fmtRelative } from '../utils.js'
import StatusStamp from '../components/StatusStamp.vue'
import EmptyState from '../components/EmptyState.vue'
import Skeleton from '../components/Skeleton.vue'
import ApprovalCard from '../components/ApprovalCard.vue'
import AlertsView from './AlertsView.vue'
import DataQualityView from './DataQualityView.vue'

const router = useRouter()

const PROJECT_STATUS = {
  active: { label: '进行中', tone: 'success' },
  paused: { label: '已暂停', tone: 'warning' },
  archived: { label: '已归档', tone: 'muted' },
}

const route = useRoute()
const project = ref(null)
const tasks = ref([])
const docs = ref([])
const automations = ref([])
const connectors = ref([])
const skills = ref([])
const activities = ref([])
const tab = ref('overview')
const saving = ref(false)
const editForm = ref({})
const memberForm = ref({ name: '', role: '运维', email: '' })

/* 当前工作区 */
const isCurrentWs = computed(() => gs.currentProjectId === project.value?.id)
function toggleWorkspace() {
  if (!project.value) return
  setCurrentProject(isCurrentWs.value ? null : project.value.id)
}

/* 能力一键扩展（连接器授权 / 技能挂载） */
const allConnectors = ref([])
const allSkills = ref([])
const pickConnector = ref('')
const pickSkill = ref('')
const capSaving = ref(false)
const availableConnectors = computed(() =>
  allConnectors.value.filter((c) => c.status === 'connected' && !(project.value?.connectorIds || []).includes(c.id)),
)
const availableSkills = computed(() =>
  allSkills.value.filter((s) => s.status === 'enabled' && !(project.value?.skillIds || []).includes(s.id)),
)

async function addCapability(kind) {
  if (!project.value || capSaving.value) return
  capSaving.value = true
  try {
    const body =
      kind === 'connector'
        ? { connectorIds: [...project.value.connectorIds, pickConnector.value] }
        : { skillIds: [...project.value.skillIds, pickSkill.value] }
    await api.patch(`/api/projects/${project.value.id}`, body)
    toast(kind === 'connector' ? '连接器已纳入授权范围，AI 立即可调用' : '技能已挂载，AI 立即可调用')
    pickConnector.value = ''
    pickSkill.value = ''
    await load()
    refreshProjects()
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    capSaving.value = false
  }
}

async function removeCapability(kind, id) {
  if (!project.value) return
  try {
    const body =
      kind === 'connector'
        ? { connectorIds: project.value.connectorIds.filter((x) => x !== id) }
        : { skillIds: project.value.skillIds.filter((x) => x !== id) }
    await api.patch(`/api/projects/${project.value.id}`, body)
    toast('已移出项目授权范围')
    await load()
    refreshProjects()
  } catch (err) {
    toast(err.message, 'error')
  }
}

function skillName(id) {
  return skills.value.find((s) => s.id === id)?.name || id
}

/* ---------------- 智能应用：按项目已授权技能呈现可直接运行的 Agent 应用 ---------------- */
const runningApp = ref('') // '' | 'alerts' | 'dq'

/* 应用目录：key 对应平台技能；mountedSkill 命中（项目已挂载）时即为可用 */
const APP_CATALOG = [
  {
    key: 'alerts',
    name: '显控告警降噪 · 根因分析',
    desc: '关联编解码、拼接、中控、矩阵、录播等多源设备告警，抑制重复噪声，AI 定位真正根因并给处置建议',
    icon: Siren,
    cls: 'bg-chip-orange-bg text-chip-orange-fg',
    mountedSkill: 'sk_alert_rca',
    embed: true,
  },
  {
    key: 'patrol',
    name: '整网设备巡检',
    desc: '巡检编解码节点、拼接处理器、中控、矩阵、录播、触摸屏在线状态与双备份，输出异常与建议',
    icon: Radar,
    cls: 'bg-chip-green-bg text-chip-green-fg',
    mountedSkill: 'sk_device_patrol',
    prompt: '巡检整网显控设备，输出异常设备、风险等级与处理建议。',
  },
  {
    key: 'dq',
    name: '设备资产数据质检',
    desc: '台账重复编号、关键字段缺失、固件过旧、位置标签不规范自动巡检，输出问题清单与治理建议',
    icon: ShieldCheck,
    cls: 'bg-chip-blue-bg text-chip-blue-fg',
    mountedSkill: 'sk_dq_check',
    embed: true,
  },
  {
    key: 'kvm',
    name: '坐席 KVM 调度',
    desc: '一套键鼠跨主机/跨席位，推屏上大屏、抓取回席位；高风险，仅出调度计划，执行需审批',
    icon: MonitorDot,
    cls: 'bg-chip-blue-bg text-chip-blue-fg',
    mountedSkill: 'sk_ecis_kvm',
    prompt: '把 3 号坐席的指挥席信号推上指挥中心 LED 主屏，先出调度计划。',
  },
  {
    key: 'scene',
    name: '中控一键场景联动',
    desc: '开会/散会/应急/观影模式下大屏、矩阵、灯光、窗帘、功放、空调联动与时序上电，先出计划',
    icon: SlidersHorizontal,
    cls: 'bg-chip-cyan-bg text-chip-cyan-fg',
    mountedSkill: 'sk_scene_exec',
    prompt: '3 号会议室进入开会模式，联动大屏、矩阵、灯光、功放，先出场景执行计划。',
  },
  {
    key: 'preset',
    name: '大屏开窗漫游预案',
    desc: '拼接处理器开窗、漫游、叠加、预案切换与多画面布局；高风险，仅出开窗计划待审批',
    icon: LayoutGrid,
    cls: 'bg-chip-purple-bg text-chip-purple-fg',
    mountedSkill: 'sk_signal_preset',
    prompt: '把指挥中心大屏切换为 2×2 监控布局并轮巡应急预案，先出开窗计划。',
  },
  {
    key: 'meeting',
    name: '会务全流程助手',
    desc: '会前预约签到、会中表决发言、会后 AI 转写自动生成会议纪要，覆盖会务全流程',
    icon: Presentation,
    cls: 'bg-chip-orange-bg text-chip-orange-fg',
    mountedSkill: 'sk_meeting_assist',
    prompt: '整理今天上午常务会的签到与表决结果，并根据 AI 转写生成会议纪要。',
  },
  {
    key: 'class',
    name: '教室巡课录播巡检',
    desc: '巡检多间教室录播状态、扩声、中控在线情况，汇总 AI 课堂行为分析，远程发现异常教室',
    icon: GraduationCap,
    cls: 'bg-chip-green-bg text-chip-green-fg',
    mountedSkill: 'sk_class_inspect',
    prompt: '巡一遍教学楼全部智慧教室，输出录播/扩声异常的教室与处理建议。',
  },
  {
    key: 'kb',
    name: '显控 SOP 知识问答',
    desc: '基于项目知识空间回答大屏黑屏、KVM 推屏、中控联动等排障流程与规范，答复附内部文档来源',
    icon: BookOpen,
    cls: 'bg-chip-cyan-bg text-chip-cyan-fg',
    mountedSkill: null,
    prompt: '请结合项目知识空间回答：指挥中心大屏突然无信号应该按什么标准流程排查？',
  },
]

const mountedSkillIds = computed(() => new Set(project.value?.skillIds || []))
const availableApps = computed(() =>
  APP_CATALOG.map((a) => ({ ...a, mounted: !a.mountedSkill || mountedSkillIds.value.has(a.mountedSkill) })),
)

function runApp(a) {
  if (a.embed) {
    runningApp.value = a.key
    return
  }
  router.push(`/tasks/new?projectId=${project.value.id}&prompt=${encodeURIComponent(a.prompt)}`)
}

function goSolutions() {
  router.push({ path: '/solutions', query: { projectId: project.value.id } })
}

const tabs = [
  { key: 'overview', label: '概览' },
  { key: 'apps', label: '智能应用' },
  { key: 'tasks', label: '任务' },
  { key: 'inbox', label: '待办与审批' },
  { key: 'docs', label: '资料' },
  { key: 'automations', label: '自动化' },
  { key: 'members', label: '成员' },
  { key: 'settings', label: '设置' },
]

/* 待办与审批（项目会话相关，按 projectId 过滤） */
const inboxApprovals = ref([])
const inboxTodos = ref([])
const inboxLoading = ref(false)
const inboxLoaded = ref(false)
const actingApprovalId = ref('')
const pendingApprovals = computed(() => inboxApprovals.value.filter((a) => a.status === 'pending'))
const doneApprovals = computed(() => inboxApprovals.value.filter((a) => a.status !== 'pending'))

async function loadInbox() {
  if (!project.value) return
  inboxLoading.value = true
  try {
    const [a, t] = await Promise.all([
      api.get(`/api/approvals?projectId=${project.value.id}`),
      api.get(`/api/todos?projectId=${project.value.id}`),
    ])
    inboxApprovals.value = a.list || []
    inboxTodos.value = t.list || []
    inboxLoaded.value = true
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    inboxLoading.value = false
  }
}

async function decideApproval(a, decision) {
  actingApprovalId.value = a.id
  try {
    await api.post(`/api/approvals/${a.id}/decide`, { decision })
    toast(decision === 'approve' ? '已批准，任务继续执行' : '已拒绝')
    await loadInbox()
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    actingApprovalId.value = ''
  }
}

async function toggleTodo(t) {
  const done = t.status === 'done'
  try {
    const d = await api.post(`/api/todos/${t.id}/${done ? 'reopen' : 'complete'}`, {})
    Object.assign(t, d.todo || {})
    if (!d.todo) t.status = done ? 'pending' : 'done'
  } catch (err) {
    toast(err.message, 'error')
  }
}

watch(tab, (v) => {
  if (v === 'inbox' && !inboxLoaded.value) loadInbox()
})

async function load() {
  const data = await api.get(`/api/projects/${route.params.id}`)
  project.value = data.project
  tasks.value = data.tasks
  docs.value = data.docs
  automations.value = data.automations
  connectors.value = data.connectors
  skills.value = data.skills
  activities.value = data.activities
  /* 能力扩展候选（已接入连接器 / 已安装技能全集） */
  try {
    const [connData, skillData] = await Promise.all([api.get('/api/connectors'), api.get('/api/skills')])
    allConnectors.value = connData.list || []
    allSkills.value = skillData.list || []
  } catch {
    /* 候选加载失败不影响主信息 */
  }
  editForm.value = {
    name: data.project.name,
    owner: data.project.owner,
    goal: data.project.goal,
    instructions: data.project.instructions,
    boundaries: data.project.boundaries,
    status: data.project.status,
  }
}

async function saveSettings() {
  saving.value = true
  try {
    const data = await api.patch(`/api/projects/${project.value.id}`, editForm.value)
    project.value = data.project
    toast('项目设置已保存')
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    saving.value = false
  }
}

async function addMember() {
  if (!memberForm.value.name.trim()) return
  try {
    const data = await api.post(`/api/projects/${project.value.id}/members`, memberForm.value)
    project.value = data.project
    memberForm.value = { name: '', role: '运维', email: '' }
    toast('成员已添加')
  } catch (err) {
    toast(err.message, 'error')
  }
}

async function removeMember(name) {
  try {
    const data = await api.del(`/api/projects/${project.value.id}/members/${encodeURIComponent(name)}`)
    project.value = data.project
    toast('成员已移除')
  } catch (err) {
    toast(err.message, 'error')
  }
}

async function reload() {
  try {
    await load()
  } catch (err) {
    toast(err.message, 'error')
  }
}

onMounted(reload)

watch(
  () => route.params.id,
  async (id) => {
    if (!id) return
    tab.value = 'overview'
    runningApp.value = ''
    await reload()
  },
)
</script>
