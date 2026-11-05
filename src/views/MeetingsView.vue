<template>
  <div class="px-6 py-5">
    <!-- 头部 -->
    <div class="flex flex-wrap items-center gap-3">
      <div>
        <h1 class="font-display text-xl font-bold">会议助手</h1>
        <p class="mt-1 text-xs text-muted-foreground">上传会议录音 → 豆包 ASR 语音转写 → AI 流式生成结构化会议纪要（议题 / 决议 / 待办）</p>
      </div>
      <button class="btn-primary ml-auto" @click="createOpen = true"><Plus :size="14" /> 新建会议</button>
    </div>

    <!-- 豆包式命令栏：录音转写 / 生成纪要 快捷入口（功能闭环） -->
    <div class="mt-4">
      <AppCommandBar
        placeholder="发消息，如「整理本周会议纪要要点」「对比两次周会的决议差异」；或点击下方功能直接开始…"
        :chips="cmdChips"
        :busy="transcribing || generating"
        hint="录音转写走豆包 ASR，纪要由 AI 流式生成"
        @chip="onChip"
        @submit="onSubmit"
        @plus="createOpen = true"
      />
      <!-- 隐藏文件选择器（chip 触发） -->
      <input ref="chipAudioInput" type="file" class="hidden" accept=".wav,.mp3,.m4a,.ogg,.aac,.flac,.opus" @change="onAudioPick" />
    </div>

    <div class="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-5">
      <!-- 会议列表 -->
      <section class="xl:col-span-2">
        <div class="space-y-3">
          <div
            v-for="m in meetings" :key="m.id"
            class="card cursor-pointer p-4 transition-shadow hover:shadow-lg"
            :class="selected?.id === m.id && 'ring-2 ring-primary/20'"
            @click="selectMeeting(m)"
          >
            <div class="flex items-center gap-2">
              <span class="stamp" :class="statusTone(m.status)"><i></i>{{ statusText(m.status) }}</span>
              <span v-if="m.demo" class="stamp warning"><i></i>演示</span>
              <span class="ml-auto text-xs text-muted-foreground">{{ fmtDate(m.meetingAt || m.createdAt) }}</span>
            </div>
            <h3 class="mt-2 text-sm font-bold">{{ m.title }}</h3>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ m.location || '未设置地点' }}
              <template v-if="m.durationMin"> · 约 {{ m.durationMin }} 分钟</template>
              <template v-else-if="m.transcript?.duration"> · {{ Math.round(m.transcript.duration) }}s</template>
            </p>
            <div class="mt-2 flex gap-1.5">
              <span v-if="m.transcript" class="mono-tag">已转写 {{ m.transcript.utterances?.length || 0 }} 句</span>
              <span v-if="m.minutes" class="mono-tag">已生成纪要</span>
            </div>
          </div>
          <div v-if="meetings.length === 0" class="card p-8 text-center text-sm text-muted-foreground">
            <Mic :size="26" class="mx-auto text-muted-foreground/50" />
            <p class="mt-3">暂无会议，点击「新建会议」开始</p>
          </div>
        </div>
      </section>

      <!-- 会议详情 -->
      <section class="xl:col-span-3">
        <div v-if="!selected" class="card p-10 text-center text-sm text-muted-foreground">
          <FileAudio :size="28" class="mx-auto text-muted-foreground/50" />
          <p class="mt-3">选择左侧会议，上传音频开始转写</p>
        </div>

        <template v-else>
          <!-- 会议信息 + 上传 -->
          <div class="card p-4">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-sm font-bold">{{ selected.title }}</h3>
              <span class="stamp" :class="statusTone(selected.status)"><i></i>{{ statusText(selected.status) }}</span>
            </div>
            <p class="mt-1 text-xs text-muted-foreground">{{ selected.location || '未设置地点' }} · {{ fmtDate(selected.meetingAt || selected.createdAt) }}</p>

            <!-- 上传转写 -->
            <div class="mt-3 rounded-lg border border-dashed border-border bg-muted/30 p-4">
              <div class="flex flex-wrap items-center gap-3">
                <FileAudio :size="20" class="text-primary" />
                <div class="min-w-0 flex-1">
                  <p class="text-xs font-medium">{{ selected.transcript ? '重新上传音频转写' : '上传会议录音进行转写' }}</p>
                  <p class="text-xs text-muted-foreground">支持 WAV / MP3 / M4A / OGG，≤15MB</p>
                </div>
                <label class="btn-outline btn-sm cursor-pointer" :class="transcribing && 'pointer-events-none opacity-60'">
                  <Upload :size="12" /> {{ transcribing ? '转写中…' : '选择音频' }}
                  <input type="file" class="hidden" accept=".wav,.mp3,.m4a,.ogg,.aac,.flac,.opus" @change="onAudioPick" />
                </label>
              </div>
              <div v-if="transcribing" class="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 :size="14" class="animate-spin" /> 豆包 ASR 识别中，请稍候…
              </div>
            </div>
          </div>

          <!-- 转写文本 -->
          <div v-if="selected.transcript" class="card mt-4 p-4">
            <div class="flex items-center gap-2">
              <Mic :size="14" class="text-primary" />
              <h3 class="text-sm font-bold">转写稿</h3>
              <span class="mono-tag ml-auto">{{ selected.transcript.utterances?.length || 0 }} 句 · {{ selected.transcript.engine }}</span>
            </div>
            <div class="mt-3 max-h-[240px] space-y-2 overflow-y-auto">
              <div v-for="(u, i) in selected.transcript.utterances || []" :key="i" class="flex gap-2 text-xs">
                <span class="shrink-0 font-mono text-muted-foreground">[{{ fmtTs(u.start) }}]</span>
                <p class="leading-relaxed">{{ u.text }}</p>
              </div>
            </div>
          </div>

          <!-- 会议纪要 -->
          <div class="card mt-4 p-4">
            <div class="flex items-center gap-2">
              <Sparkles :size="14" class="text-primary" />
              <h3 class="text-sm font-bold">会议纪要</h3>
              <button
                v-if="selected.transcript && !generating"
                class="btn-primary btn-sm ml-auto"
                @click="generateMinutes"
              >
                <Wand2 :size="12" /> {{ selected.minutes ? '重新生成' : '生成纪要' }}
              </button>
              <span v-if="generating" class="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 :size="12" class="animate-spin" /> 流式生成中…
              </span>
            </div>
            <div v-if="generating || streamText" class="mt-3">
              <MarkdownText :text="streamText" :typing="generating" class="max-h-[50vh] overflow-y-auto" />
            </div>
            <div v-else-if="selected.minutes" class="mt-3">
              <MarkdownText :text="typeof selected.minutes === 'string' ? selected.minutes : selected.minutes.markdown" class="max-h-[50vh] overflow-y-auto" />
            </div>
            <p v-else class="mt-3 text-xs text-muted-foreground">{{ selected.transcript ? '点击「生成纪要」由 AI 整理结构化会议纪要' : '完成语音转写后可生成纪要' }}</p>
          </div>
        </template>
      </section>
    </div>

    <!-- 新建会议 Modal -->
    <Modal :open="createOpen" title="新建会议" width="440px" @close="createOpen = false">
      <div class="space-y-3">
        <div>
          <label class="mb-1 block text-xs font-medium">会议标题 *</label>
          <input v-model="newTitle" class="input" placeholder="如：智慧教室二期建设周会" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium">地点</label>
          <input v-model="newLocation" class="input" placeholder="如：综合楼 3F · 会议室 2" />
        </div>
        <div class="flex gap-2 pt-1">
          <button class="btn-primary" :disabled="!newTitle.trim()" @click="createMeeting">创建</button>
          <button class="btn-outline" @click="createOpen = false">取消</button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Mic, FileAudio, Upload, Loader2, Sparkles, Wand2, FileText } from 'lucide-vue-next'
import { api, streamPost } from '../api.js'
import { toast } from '../store.js'
import Modal from '../components/Modal.vue'
import MarkdownText from '../components/MarkdownText.vue'
import AppCommandBar from '../components/AppCommandBar.vue'

const router = useRouter()
const chipAudioInput = ref(null)

const meetings = ref([])
const selected = ref(null)
const createOpen = ref(false)
const newTitle = ref('')
const newLocation = ref('')
const transcribing = ref(false)
const generating = ref(false)
const streamText = ref('')

async function load() {
  const d = await api.get('/api/meetings')
  meetings.value = d.list || []
  if (selected.value) {
    const cur = meetings.value.find((m) => m.id === selected.value.id)
    if (cur) selected.value = cur
  }
}

function selectMeeting(m) { selected.value = m; streamText.value = '' }

// 命令栏 chips：录音转写 / 生成纪要 / 新建会议（点击即闭环）
const cmdChips = computed(() => [
  { key: 'transcribe', label: '录音转写', icon: Mic, cls: 'text-chip-purple-fg' },
  { key: 'minutes', label: '生成会议纪要', icon: FileText, cls: 'text-chip-blue-fg' },
  { key: 'create', label: '新建会议', icon: Plus, cls: 'text-chip-green-fg' },
])

function onChip(key) {
  if (key === 'create') { createOpen.value = true; return }
  if (key === 'transcribe') {
    if (!selected.value) { toast('请先在左侧选择一个会议', 'error'); return }
    chipAudioInput.value?.click()
    return
  }
  if (key === 'minutes') {
    if (!selected.value) { toast('请先选择一个会议', 'error'); return }
    if (!selected.value.transcript) { toast('该会议还没有转写稿，请先「录音转写」', 'error'); return }
    if (!generating.value) generateMinutes()
  }
}

// 自然语言闭环：交给 AI 任务编排
function onSubmit(text) {
  router.push({
    path: '/tasks/new',
    query: { prompt: `【会议助手】${text}`, projectId: 'p_classroom' },
  })
}

function statusTone(s) { return { done: 'success', minutes_ready: 'success', transcribed: 'info', pending: 'muted', scheduled: 'muted' }[s] || 'muted' }
function statusText(s) { return { done: '已完成', minutes_ready: '纪要就绪', transcribed: '已转写', pending: '待录制', scheduled: '已预约' }[s] || s }
function fmtDate(iso) { if (!iso) return '—'; const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
function fmtTs(s) { const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` }

async function createMeeting() {
  const d = await api.post('/api/meetings', { title: newTitle.value.trim(), location: newLocation.value.trim() })
  toast('会议已创建')
  createOpen.value = false
  newTitle.value = ''; newLocation.value = ''
  await load()
  selected.value = meetings.value.find((m) => m.id === d.meeting?.id) || null
}

function onAudioPick(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  if (file.size > 15 * 1024 * 1024) { toast('音频文件超过 15MB 限制', 'error'); return }
  const reader = new FileReader()
  reader.onload = async () => {
    const base64 = String(reader.result || '').split(',')[1] || ''
    transcribing.value = true
    try {
      const d = await api.post(`/api/meetings/${selected.value.id}/transcribe`, { audioBase64: base64, fileName: file.name })
      toast(`转写完成：${d.transcript?.utterances?.length || 0} 句`)
      await load()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      transcribing.value = false
    }
  }
  reader.readAsDataURL(file)
}

async function generateMinutes() {
  generating.value = true
  streamText.value = ''
  try {
    await streamPost(`/api/meetings/${selected.value.id}/minutes/stream`, {}, {
      onEvent(event, data) {
        if (event === 'delta' && data.text) streamText.value += data.text
      },
    })
    await load()
    toast('会议纪要已生成')
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    generating.value = false
  }
}

onMounted(load)
</script>
