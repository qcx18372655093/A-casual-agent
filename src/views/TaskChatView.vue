<template>
  <div class="flex h-full">
    <!-- 主列：头部 + 对话流 + 输入区 -->
    <div class="flex min-w-0 flex-1 flex-col">
      <!-- 头部 -->
      <div class="flex flex-none flex-wrap items-center gap-2 border-b border-border px-6 py-3">
        <template v-if="task">
          <span class="font-mono text-xs text-muted-foreground">TASK-{{ task.no }}</span>
          <h2 class="max-w-md truncate text-sm font-semibold">{{ task.title }}</h2>
          <StatusStamp :status="task.status" :map="TASK_STATUS" />
          <span v-if="task.demo" class="stamp warning" title="本任务使用了演示连接器数据"><i></i>演示数据</span>
        </template>
        <template v-else>
          <h2 class="text-sm font-semibold">发起新任务</h2>
          <span class="stamp info"><i></i>new</span>
        </template>
        <RouterLink v-if="project" :to="`/projects/${project.id}`" class="ml-auto font-mono text-[11px] text-primary hover:underline">
          {{ project.name }} →
        </RouterLink>
        <span v-else-if="task && !task.projectId" class="ml-auto font-mono text-[11px] text-muted-foreground">独立任务空间</span>
      </div>

      <!-- 对话流 -->
      <div ref="scrollEl" class="min-h-0 flex-1 overflow-y-auto">
        <div class="mx-auto max-w-3xl px-6 py-6">
          <!-- 新任务引导 -->
          <div v-if="isNew && messages.length === 0 && phase === 'idle'" class="py-10 text-center">
            <p class="font-display text-2xl font-bold">描述你的目标，剩下的交给 AI</p>
            <p class="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
              AI 会按所选模式工作：调用已授权的技能与 MCP 连接器、生成计划或直接执行；全程步骤可见，高风险操作须经人工审批。
            </p>
          </div>

          <!-- 消息 -->
          <div v-for="(m, i) in messages" :key="i" class="mb-5">
            <!-- 用户 -->
            <div v-if="m.role === 'user'" class="flex justify-end">
              <div class="max-w-[85%]">
                <p class="mono-tag mb-1 text-right text-muted-foreground">
                  {{ m.kind === 'action' ? '操作' : gs.user?.name }} · {{ fmtTime(m.ts) }}
                </p>
                <div
                  class="rounded-md border px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
                  :class="m.kind === 'action' ? 'border-primary/40 bg-primary/[0.06] text-primary' : 'border-border bg-accent'"
                >
                  {{ m.content }}
                </div>
              </div>
            </div>
            <!-- AI -->
            <div v-else>
              <p class="mono-tag mb-1 text-muted-foreground">creator ai · {{ fmtTime(m.ts) }}</p>
              <MarkdownText :text="m.content" />
            </div>
          </div>

          <!-- 流式输出 -->
          <div v-if="liveText" class="mb-5">
            <p class="mono-tag mb-1 text-primary">creator ai · 正在生成</p>
            <MarkdownText :text="liveText" typing />
          </div>
          <div v-else-if="phase === 'streaming'" class="mb-5">
            <p class="mono-tag animate-pulse text-primary">creator ai · 思考中…</p>
          </div>

          <!-- 计划卡片 -->
          <PlanCard
            v-if="showPlan"
            class="mb-5"
            :plan="task.plan"
            :pending="task.status === 'waiting_confirm'"
            :acting="acting"
            @confirm="resume('confirm_plan')"
            @cancel="cancelPlan"
          />

          <!-- 审批卡片 -->
          <ApprovalCard
            v-if="pendingApproval"
            class="mb-5"
            :approval="pendingApproval"
            :acting="acting"
            @decide="(d) => resume(d === 'approve' ? 'approve' : 'reject')"
          />

          <!-- 错误 -->
          <div v-if="errorMsg" class="mb-5 rounded-md border border-destructive/50 bg-destructive/[0.05] px-4 py-3 text-sm text-destructive">
            {{ errorMsg }}
          </div>
        </div>
      </div>

      <!-- 输入区 -->
      <div class="flex-none border-t border-border bg-card px-6 py-3">
        <div class="mx-auto max-w-3xl">
          <div v-if="lockReason" class="mb-2 flex items-center gap-2 text-xs text-warning">
            <Lock :size="12" /> {{ lockReason }}
          </div>
          <textarea
            v-model="input"
            class="input h-20 resize-none"
            :placeholder="composerPlaceholder"
            :disabled="!!lockReason"
            @keydown.meta.enter="send"
            @keydown.ctrl.enter="send"
          ></textarea>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <template v-if="isNew">
              <select v-model="newProjectId" class="input w-52">
                <option value="">独立任务空间</option>
                <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
              <select v-model="newModel" class="input w-56">
                <option v-for="m in gs.models" :key="m.id" :value="m.id">{{ m.name }}</option>
              </select>
            </template>
            <template v-else>
              <span class="font-mono text-[10px] text-muted-foreground">{{ modelName(task?.model) }}</span>
            </template>
            <button class="btn-primary ml-auto" :disabled="!canSend" @click="send">
              <SendHorizontal :size="14" /> {{ phase === 'streaming' ? '生成中…' : '发送' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧栏：步骤时间线 + 上下文 -->
    <aside class="hidden w-80 flex-none overflow-y-auto border-l border-border bg-sidebar px-4 py-4 lg:block">
      <div>
        <p class="mono-tag text-muted-foreground">执行步骤</p>
        <div class="mt-3">
          <StepTimeline :steps="steps" />
        </div>
      </div>

      <div class="mt-6 border-t border-border pt-4">
        <p class="mono-tag text-muted-foreground">上下文</p>
        <dl class="mt-2 space-y-1.5 text-xs">
          <div class="flex justify-between gap-2"><dt class="text-muted-foreground">项目</dt><dd class="truncate font-medium">{{ project?.name || '独立任务' }}</dd></div>
          <div class="flex justify-between gap-2"><dt class="text-muted-foreground">模型</dt><dd class="font-mono text-[10px]">{{ modelName(task?.model || newModel) }}</dd></div>
          <div class="flex justify-between gap-2"><dt class="text-muted-foreground">数据来源</dt><dd><span v-if="task?.demo" class="stamp warning"><i></i>演示数据</span><span v-else class="text-muted-foreground">平台数据</span></dd></div>
        </dl>
      </div>

      <div v-if="approvals.length" class="mt-6 border-t border-border pt-4">
        <p class="mono-tag text-muted-foreground">本任务审批记录</p>
        <div class="mt-2 space-y-2">
          <div v-for="a in approvals" :key="a.id" class="text-xs">
            <div class="flex items-center gap-1.5">
              <StatusStamp :status="a.status" :map="APPROVAL_STATUS" />
              <span class="font-mono text-[10px] text-muted-foreground">{{ fmtRelative(a.createdAt) }}</span>
            </div>
            <p class="mt-1 leading-relaxed text-muted-foreground">{{ a.title }}</p>
          </div>
        </div>
      </div>

      <div class="mt-6 border-t border-border pt-4">
        <p class="mono-tag text-muted-foreground">说明</p>
        <p class="mt-2 text-[11px] leading-relaxed text-muted-foreground">AI 会自动决策调用平台能力，高风险写操作将进入审批闸门，由审批人确认后执行。</p>
        <p class="mt-2 text-[11px] leading-relaxed text-muted-foreground">所有工具调用、审批与结果均写入审计日志，可在「审计日志」中回看。</p>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SendHorizontal, Lock } from 'lucide-vue-next'
import { gs, toast, refreshUnread } from '../store.js'
import { api, streamPost } from '../api.js'
import { TASK_STATUS, APPROVAL_STATUS, fmtTime, fmtRelative } from '../utils.js'
import StatusStamp from '../components/StatusStamp.vue'
import MarkdownText from '../components/MarkdownText.vue'
import PlanCard from '../components/PlanCard.vue'
import ApprovalCard from '../components/ApprovalCard.vue'
import StepTimeline from '../components/StepTimeline.vue'

const route = useRoute()
const router = useRouter()

const isNew = computed(() => route.params.id === 'new')
const task = ref(null)
const project = ref(null)
const approvals = ref([])
const steps = ref([])
const messages = ref([])
const liveText = ref('')
const phase = ref('idle') // idle | streaming | waiting_confirm | waiting_approval | done | error
const acting = ref(false)
const errorMsg = ref('')
const input = ref('')
const projects = ref([])
const scrollEl = ref(null)

// 新任务参数
const newMode = ref('craft')
const newProjectId = ref('')
const newModel = ref('doubao-seed-2-0-pro-260215')

const showPlan = computed(() => task.value?.plan || null)
const pendingApproval = computed(() => {
  if (!task.value || task.value.status !== 'waiting_approval') return null
  return approvals.value.find((a) => a.status === 'pending') || null
})

const lockReason = computed(() => {
  if (phase.value === 'streaming') return 'AI 正在生成，请稍候…'
  if (task.value?.status === 'waiting_confirm') return '任务等待计划确认：请在上方计划卡片中确认或取消'
  if (task.value?.status === 'waiting_approval') return '任务等待高风险审批：请在上方审批卡片中裁决'
  if (task.value?.status === 'cancelled') return '任务已取消'
  return ''
})

const composerPlaceholder = computed(() => {
  if (isNew.value) return '描述你要完成的任务…'
  if (task.value?.status === 'completed') return '继续追问，或提出新的目标…'
  return '输入消息…'
})

const canSend = computed(() => input.value.trim() && phase.value !== 'streaming' && !lockReason.value)

function modelName(id) {
  return gs.models.find((m) => m.id === id)?.name || id || '—'
}

async function scrollBottom() {
  await nextTick()
  if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight
}

watch([liveText, () => messages.value.length], scrollBottom)

function phaseFromStatus(status) {
  if (status === 'waiting_confirm') return 'waiting_confirm'
  if (status === 'waiting_approval') return 'waiting_approval'
  if (status === 'running') return 'streaming'
  return 'done'
}

function applyTask(t) {
  task.value = t
  steps.value = t.steps || []
  messages.value = (t.messages || []).map((m) => ({ ...m }))
  phase.value = phaseFromStatus(t.status)
}

async function loadTask(id) {
  const data = await api.get(`/api/tasks/${id}`)
  applyTask(data.task)
  project.value = data.project
  approvals.value = data.approvals || []
  liveText.value = ''
  errorMsg.value = ''
  scrollBottom()
}

function handleEvent(event, data) {
  if (event === 'meta') {
    if (isNew.value && data.taskId) {
      router.replace(`/tasks/${data.taskId}`)
      task.value = { id: data.taskId, no: data.no, mode: data.mode, model: data.model, status: 'running', messages: messages.value, steps: [], title: input.value.slice(0, 30) }
    }
  } else if (event === 'delta') {
    liveText.value += data.text
  } else if (event === 'step') {
    const idx = steps.value.findIndex((s) => s.id === data.id)
    if (idx >= 0) steps.value[idx] = data
    else steps.value.push(data)
  } else if (event === 'plan') {
    if (task.value) task.value.plan = data.plan
  } else if (event === 'approval') {
    const i = approvals.value.findIndex((a) => a.id === data.approval.id)
    if (i >= 0) approvals.value[i] = data.approval
    else approvals.value.push(data.approval)
    refreshUnread()
  } else if (event === 'status') {
    if (task.value) task.value.status = data.status
    phase.value = phaseFromStatus(data.status)
  } else if (event === 'error') {
    errorMsg.value = data.message
    phase.value = 'error'
  } else if (event === 'done') {
    applyTask(data.task)
    liveText.value = ''
    acting.value = false
    loadApprovals(data.task.id)
  }
}

async function loadApprovals(taskId) {
  try {
    const data = await api.get(`/api/tasks/${taskId}`)
    approvals.value = data.approvals || []
  } catch {
    /* 静默 */
  }
}

async function startStream(body) {
  phase.value = 'streaming'
  liveText.value = ''
  errorMsg.value = ''
  try {
    await streamPost('/api/chat/stream', body, { onEvent: handleEvent })
  } catch (err) {
    errorMsg.value = err.message
    phase.value = 'error'
  }
}

async function send() {
  if (!canSend.value) return
  const content = input.value.trim()
  input.value = ''
  if (isNew.value) {
    messages.value.push({ role: 'user', content, ts: new Date().toISOString() })
    await startStream({ projectId: newProjectId.value || undefined, mode: newMode.value, model: newModel.value, input: content })
  } else {
    messages.value.push({ role: 'user', content, ts: new Date().toISOString() })
    await startStream({ taskId: task.value.id, input: content })
  }
  scrollBottom()
}

async function resume(action) {
  if (!task.value) return
  acting.value = true
  errorMsg.value = ''
  phase.value = 'streaming'
  liveText.value = ''
  try {
    await streamPost(`/api/tasks/${task.value.id}/resume`, { action }, { onEvent: handleEvent })
  } catch (err) {
    errorMsg.value = err.message
    phase.value = 'error'
  } finally {
    acting.value = false
  }
}

async function cancelPlan() {
  if (!task.value) return
  acting.value = true
  try {
    const data = await api.post(`/api/tasks/${task.value.id}/resume`, { action: 'cancel_plan' })
    applyTask(data.task)
    toast('计划已取消')
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    acting.value = false
  }
}

// 同一组件内切换任务（如从审批页跳转其他任务）时重新加载
watch(
  () => route.params.id,
  async (id, prev) => {
    if (!id || id === 'new' || id === prev || phase.value === 'streaming') return
    try {
      await loadTask(id)
    } catch (err) {
      errorMsg.value = err.message
      phase.value = 'error'
    }
  },
)

onMounted(async () => {
  try {
    if (isNew.value) {
      // 模式不再对用户暴露，统一以 craft（做一做）发起，由审批闸门兜底高风险操作
      newProjectId.value = route.query.projectId || gs.currentProjectId || ''
      if (route.query.model) newModel.value = String(route.query.model)
      const data = await api.get('/api/projects')
      projects.value = data.list
      const prompt = route.query.prompt
      if (prompt) {
        messages.value.push({ role: 'user', content: String(prompt), ts: new Date().toISOString() })
        await startStream({ projectId: newProjectId.value || undefined, mode: newMode.value, model: newModel.value, input: String(prompt) })
      }
    } else {
      await loadTask(route.params.id)
    }
  } catch (err) {
    errorMsg.value = err.message
    phase.value = 'error'
  }
})
</script>
