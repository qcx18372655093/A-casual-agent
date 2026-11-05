<template>
  <Modal :open="open" title="工具试运行" :subtitle="toolName" width="640px" @close="close">
    <div class="space-y-3">
      <div class="rounded-md border border-border bg-muted/40 px-3 py-2 text-2xs leading-relaxed text-muted-foreground">
        以当前登录身份直接执行一次该工具并返回真实结果；高风险写工具请通过 AI 任务对话发起、经审批后执行。
      </div>
      <div>
        <label class="label">调用参数（JSON）</label>
        <textarea
          v-model="argsText"
          class="input mt-1 h-28 resize-none font-mono text-xs"
          placeholder='{"query":"大屏无信号"}'
          spellcheck="false"
        ></textarea>
        <p v-if="argsError" class="mt-1 text-2xs text-danger">{{ argsError }}</p>
      </div>
      <div v-if="ran" class="rounded-md border p-3" :class="result?.ok ? 'border-success/40 bg-success/5' : 'border-danger/40 bg-danger/5'">
        <div class="flex items-center gap-2">
          <component :is="result?.ok ? CheckCircle2 : XCircle" :size="14" :class="result?.ok ? 'text-success' : 'text-danger'" />
          <span class="text-xs font-medium">{{ result?.ok ? '执行成功' : '执行失败' }}</span>
          <span class="ml-auto font-mono text-2xs text-muted-foreground">{{ ms }}ms</span>
          <span v-if="result?.demo" class="stamp warning"><i></i>演示数据</span>
        </div>
        <pre class="mt-2 max-h-56 overflow-auto rounded bg-background/70 p-2 font-mono text-2xs leading-relaxed">{{ prettyResult }}</pre>
      </div>
    </div>
    <template #footer>
      <button class="btn-outline" @click="close">关闭</button>
      <button class="btn-primary" :disabled="running" @click="run">
        <Loader2 v-if="running" :size="12" class="animate-spin" /> {{ running ? '执行中…' : '执行' }}
      </button>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-vue-next'
import { api } from '../api.js'
import { toast } from '../store.js'
import Modal from './Modal.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  toolName: { type: String, default: '' },
})
const emit = defineEmits(['close'])

const argsText = ref('{}')
const argsError = ref('')
const running = ref(false)
const ran = ref(false)
const result = ref(null)
const ms = ref(0)

watch(() => props.open, (v) => {
  if (v) {
    argsText.value = '{}'
    argsError.value = ''
    ran.value = false
    result.value = null
  }
})

const prettyResult = computed(() => {
  if (!result.value) return ''
  const payload = result.value.ok ? result.value.data : { error: result.value.error }
  try { return JSON.stringify(payload, null, 2) } catch { return String(payload) }
})

async function run() {
  argsError.value = ''
  let args = {}
  try {
    args = argsText.value.trim() ? JSON.parse(argsText.value) : {}
    if (typeof args !== 'object' || Array.isArray(args)) throw new Error('bad')
  } catch {
    argsError.value = '参数必须是合法的 JSON 对象'
    return
  }
  running.value = true
  try {
    const d = await api.post('/api/tools/test', { name: props.toolName, args })
    result.value = d.result
    ms.value = d.ms
    ran.value = true
  } catch (err) {
    result.value = { ok: false, error: err.message }
    ran.value = true
  } finally {
    running.value = false
  }
}

function close() {
  emit('close')
}
</script>
