<template>
  <div class="px-6 py-5">
    <!-- 头部 -->
    <div class="flex flex-wrap items-center gap-3">
      <div>
        <h1 class="font-display text-xl font-bold">SSLX 视频识别</h1>
        <p class="mt-1 text-xs text-muted-foreground">基于现成多模态大模型（Doubao Seed 2.0 Pro）的视觉识别：课堂行为 / 设备状态 / 板书提取 / 安全巡检，无需模型训练</p>
      </div>
      <span class="mono-tag ml-auto">现成模型 · 零训练</span>
    </div>

    <!-- 豆包式命令栏：识别场景快捷入口（功能闭环） -->
    <div class="mt-4">
      <AppCommandBar
        placeholder="发消息，如「分析这段课堂录像的学生参与度」；或点击下方识别场景直接上传媒体…"
        :chips="cmdChips"
        :busy="recognizing"
        hint="现成多模态大模型直接理解画面，识别结果需人工复核"
        @chip="onChip"
        @submit="onSubmit"
        @plus="pickFile"
      />
      <!-- 隐藏文件选择器（chip 触发） -->
      <input ref="chipFileInput" type="file" class="hidden" accept="image/jpeg,image/png,image/webp,video/mp4" @change="onFilePick" />
    </div>

    <div class="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-5">
      <!-- 左侧：识别操作 -->
      <section class="xl:col-span-2">
        <!-- 场景选择 -->
        <div class="card p-4">
          <div class="flex items-center gap-2">
            <ScanEye :size="14" class="text-primary" />
            <h3 class="text-sm font-bold">识别场景</h3>
          </div>
          <div class="mt-3 grid grid-cols-2 gap-2">
            <button
              v-for="s in scenes" :key="s.key"
              class="rounded-lg border p-3 text-left transition-colors"
              :class="scene === s.key ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'"
              @click="scene = s.key"
            >
              <p class="text-xs font-semibold">{{ s.name }}</p>
              <p class="mt-0.5 text-xs text-muted-foreground">{{ s.desc }}</p>
            </button>
          </div>
        </div>

        <!-- 上传 -->
        <div class="card mt-4 p-4">
          <div class="flex items-center gap-2">
            <Upload :size="14" class="text-primary" />
            <h3 class="text-sm font-bold">上传媒体</h3>
          </div>
          <div class="mt-3 rounded-lg border border-dashed border-border bg-muted/30 p-5 text-center">
            <component :is="mediaType === 'video' ? FileVideo : ImageIcon" :size="26" class="mx-auto text-muted-foreground/50" />
            <p class="mt-2 text-xs text-muted-foreground">图片（JPG/PNG/WebP）或视频（MP4），≤10MB</p>
            <label class="btn-outline btn-sm mt-3 inline-flex cursor-pointer" :class="recognizing && 'pointer-events-none opacity-60'">
              <Upload :size="12" /> 选择文件
              <input type="file" class="hidden" accept="image/jpeg,image/png,image/webp,video/mp4" @change="onFilePick" />
            </label>
          </div>

          <!-- 预览 -->
          <div v-if="preview" class="mt-3 overflow-hidden rounded-lg border border-border">
            <img v-if="mediaType === 'image'" :src="preview" class="max-h-[200px] w-full object-cover" alt="预览" />
            <video v-else :src="preview" class="max-h-[200px] w-full" controls muted></video>
            <div class="flex items-center gap-2 bg-muted/40 px-3 py-2">
              <p class="min-w-0 flex-1 truncate text-xs">{{ fileName }}</p>
              <button class="btn-ghost btn-sm" @click="clearFile">移除</button>
            </div>
          </div>

          <!-- 补充说明 -->
          <textarea v-model="note" class="input mt-3 h-16 resize-none text-xs" placeholder="补充说明（可选）：如「这是 A101 第三节课的课堂画面」"></textarea>

          <button class="btn-primary mt-3 w-full justify-center" :disabled="!fileBase64 || recognizing" @click="recognize">
            <Loader2 v-if="recognizing" :size="14" class="animate-spin" />
            <ScanEye v-else :size="14" />
            {{ recognizing ? '识别中…' : '开始识别' }}
          </button>
        </div>

        <!-- 历史 -->
        <div v-if="history.length" class="card mt-4 p-4">
          <div class="flex items-center gap-2">
            <History :size="14" class="text-primary" />
            <h3 class="text-sm font-bold">历史识别</h3>
            <span class="mono-tag ml-auto">{{ history.length }}</span>
          </div>
          <div class="mt-3 max-h-[240px] space-y-2 overflow-y-auto">
            <div v-for="t in history" :key="t.id" class="flex cursor-pointer items-center gap-2 rounded-md bg-muted/40 px-3 py-2 hover:bg-muted/60" @click="loadHistory(t)">
              <span class="h-2 w-2 shrink-0 rounded-full" :class="t.status === 'done' ? 'bg-success' : t.status === 'failed' ? 'bg-danger' : 'bg-warning'"></span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-medium">{{ t.sceneName }}</p>
                <p class="truncate text-xs text-muted-foreground">{{ t.fileName }} · {{ fmtDate(t.createdAt) }}</p>
              </div>
              <span class="stamp muted shrink-0"><i></i>{{ t.mediaType === 'video' ? '视频' : '图片' }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 右侧：识别结果 -->
      <section class="xl:col-span-3">
        <div class="card p-4">
          <div class="flex items-center gap-2">
            <Sparkles :size="14" class="text-primary" />
            <h3 class="text-sm font-bold">识别结果</h3>
            <span v-if="currentScene" class="stamp info"><i></i>{{ currentScene }}</span>
            <span v-if="recognizing" class="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 :size="12" class="animate-spin" /> 流式识别中…
            </span>
          </div>

          <div v-if="!resultText && !recognizing" class="py-16 text-center text-sm text-muted-foreground">
            <ScanEye :size="28" class="mx-auto text-muted-foreground/50" />
            <p class="mt-3">选择场景并上传图片/视频，点击「开始识别」</p>
            <p class="mt-1 text-xs">由现成多模态大模型直接理解画面内容，无需训练</p>
          </div>

          <MarkdownText v-else :text="resultText" :typing="recognizing" class="mt-3 max-h-[65vh] overflow-y-auto" />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ScanEye, Upload, FileVideo, Image as ImageIcon, History, Sparkles, Loader2 } from 'lucide-vue-next'
import { api, streamPost } from '../api.js'
import { toast } from '../store.js'
import MarkdownText from '../components/MarkdownText.vue'
import AppCommandBar from '../components/AppCommandBar.vue'

const router = useRouter()
const chipFileInput = ref(null)

const scenes = ref([])
const scene = ref('classroom_behavior')
const fileBase64 = ref('')
const fileName = ref('')
const preview = ref('')
const mediaType = ref('image')
const note = ref('')
const recognizing = ref(false)
const resultText = ref('')
const currentScene = ref('')
const history = ref([])

async function load() {
  const d = await api.get('/api/vision/tasks')
  history.value = d.list || []
  scenes.value = d.scenes || []
}

function onFilePick(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  if (file.size > 10 * 1024 * 1024) { toast('文件超过 10MB 限制', 'error'); return }
  mediaType.value = file.type.startsWith('video/') ? 'video' : 'image'
  fileName.value = file.name
  const reader = new FileReader()
  reader.onload = () => {
    const dataUri = String(reader.result || '')
    preview.value = dataUri
    fileBase64.value = dataUri.split(',')[1] || ''
  }
  reader.readAsDataURL(file)
}

function clearFile() { fileBase64.value = ''; preview.value = ''; fileName.value = '' }

// 命令栏 chips：四个识别场景（点击选中场景并直接打开文件选择，闭环到识别）
const cmdChips = computed(() =>
  (scenes.value || []).map((s) => ({ key: s.key, label: s.name, icon: ScanEye, cls: 'text-chip-orange-fg' })),
)

function pickFile() { chipFileInput.value?.click() }

function onChip(key) {
  scene.value = key
  pickFile()
}

// 自然语言闭环：交给 AI 任务编排
function onSubmit(text) {
  router.push({
    path: '/tasks/new',
    query: { prompt: `【视频识别】${text}`, projectId: 'p_classroom' },
  })
}

async function recognize() {
  if (!fileBase64.value) return
  recognizing.value = true
  resultText.value = ''
  currentScene.value = scenes.value.find((s) => s.key === scene.value)?.name || scene.value
  try {
    await streamPost('/api/vision/recognize', {
      scene: scene.value,
      mediaType: mediaType.value,
      dataBase64: fileBase64.value,
      fileName: fileName.value,
      note: note.value,
    }, {
      onEvent(event, data) {
        if (event === 'delta' && data.text) resultText.value += data.text
      },
    })
    toast('识别完成')
    await load()
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    recognizing.value = false
  }
}

function loadHistory(t) {
  if (t.result) {
    resultText.value = t.result
    currentScene.value = t.sceneName
  }
}

function fmtDate(iso) { if (!iso) return '—'; const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

onMounted(load)
</script>
