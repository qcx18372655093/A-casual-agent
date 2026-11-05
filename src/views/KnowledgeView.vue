<template>
  <div class="flex h-full">
    <!-- 空间列表 -->
    <div class="w-64 flex-none overflow-y-auto border-r border-border px-4 py-5">
      <div class="flex items-center">
        <p class="mono-tag text-muted-foreground">知识空间</p>
        <button class="btn-ghost btn-sm ml-auto !px-1.5" title="新建知识空间" @click="openSpaceForm">
          <Plus :size="14" />
        </button>
      </div>
      <div class="mt-3 space-y-1">
        <div
          v-for="s in spaces"
          :key="s.id"
          class="group flex items-center rounded-sm pr-1 transition-colors"
          :class="activeSpace?.id === s.id ? 'bg-accent' : 'hover:bg-accent/60'"
        >
          <button
            class="min-w-0 flex-1 rounded-sm px-3 py-2 text-left text-sm"
            :class="activeSpace?.id === s.id ? 'font-medium' : 'text-muted-foreground'"
            @click="selectSpace(s)"
          >
            <span class="flex items-center gap-2">
              <component :is="s.scope === 'project' ? FolderKanban : Users" :size="14" class="flex-none" />
              <span class="truncate">{{ s.name }}</span>
              <span class="ml-auto flex-none font-mono text-[10px]">{{ s.docCount }}</span>
            </span>
          </button>
          <button
            v-if="!s.builtin"
            class="flex-none rounded-sm p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            title="删除空间"
            @click="removeSpace(s)"
          >
            <Trash2 :size="12" />
          </button>
        </div>
      </div>
      <div class="mt-5 rounded-sm border border-border bg-muted/40 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
        支持上传 PDF / Word / PPT / Excel / TXT / MD，AI 自动识别标题、分类与标签；知识可被「知识库问答」检索引用。
      </div>
    </div>

    <!-- 文档区 -->
    <div class="min-w-0 flex-1 overflow-y-auto px-6 py-5">
      <template v-if="activeSpace">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="font-display text-lg font-bold">{{ activeSpace.name }}</h2>
          <span class="stamp muted"><i></i>{{ activeSpace.scope === 'project' ? '项目空间' : '团队空间' }}</span>
          <div class="ml-auto flex items-center gap-2">
            <div class="relative">
              <Search :size="13" class="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground" />
              <input v-model="q" class="input w-56 pl-7" placeholder="搜索文档标题与内容…" @input="search" />
            </div>
            <button class="btn-outline btn-sm" @click="resetAddForm('manual'); showAdd = true"><FilePlus :size="12" /> 新建文档</button>
            <button class="btn-primary btn-sm" @click="resetAddForm('file'); showAdd = true"><Upload :size="12" /> 上传识别</button>
          </div>
        </div>
        <p class="mt-1 text-xs text-muted-foreground">{{ activeSpace.desc }}</p>

        <!-- 搜索结果 -->
        <div v-if="q.trim()" class="mt-4">
          <p class="mono-tag text-muted-foreground">搜索结果 {{ searchResults.length }}</p>
          <div v-if="!searchResults.length" class="py-8 text-center text-sm text-muted-foreground">未找到匹配内容</div>
          <div v-for="r in searchResults" :key="r.docId" class="mt-2 card px-4 py-3">
            <div class="flex items-center gap-2">
              <FileText :size="13" class="text-muted-foreground" />
              <span class="text-sm font-medium">{{ r.title }}</span>
              <span class="font-mono text-[10px] text-muted-foreground">{{ r.version }}</span>
            </div>
            <p class="mt-1 text-xs leading-relaxed text-muted-foreground">{{ r.excerpt }}</p>
          </div>
        </div>

        <!-- 文档列表 -->
        <table v-else class="table-base mt-4 w-full">
          <thead>
            <tr><th>名称</th><th>分类</th><th>版本</th><th>大小</th><th>更新时间</th><th>标签</th><th class="w-24">操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="d in docs" :key="d.id">
              <td>
                <button class="flex items-center gap-1.5 text-sm font-medium hover:text-primary" @click="openDoc(d)">
                  <FileText :size="13" class="text-muted-foreground" /> {{ d.title }}
                </button>
              </td>
              <td class="text-xs">{{ d.category }}</td>
              <td class="font-mono text-[10px]">{{ d.version }}</td>
              <td class="font-mono text-[10px] text-muted-foreground">{{ d.size }}</td>
              <td class="text-xs text-muted-foreground">{{ fmtRelative(d.updatedAt || d.createdAt) }}</td>
              <td>
                <span v-for="t in d.tags || []" :key="t" class="stamp muted mr-1"><i></i>{{ t }}</span>
              </td>
              <td>
                <button class="btn-ghost btn-sm" @click="openDoc(d)">查看</button>
                <button class="btn-ghost btn-sm text-destructive" @click="removeDoc(d)"><Trash2 :size="12" /></button>
              </td>
            </tr>
          </tbody>
        </table>
        <EmptyState v-if="!docs.length && !q.trim()" :icon="BookOpen" title="空间暂无资料" desc="上传手册、SOP、模板等资料，供 AI 检索引用" />
      </template>
    </div>

    <!-- 上传 / 新建资料 -->
    <Modal :open="showAdd" :title="addMode === 'file' ? '上传文件 · AI 识别' : '新建文档'" @close="showAdd = false">
      <!-- 文件上传模式 -->
      <div v-if="addMode === 'file'" class="space-y-3">
        <input ref="fileInputEl" type="file" class="hidden" accept=".txt,.md,.markdown,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.json" @change="onPickFile" />

        <!-- ① 选择文件 -->
        <button
          v-if="!parsed"
          class="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-10 text-center transition-colors hover:border-primary/40 hover:bg-muted/50"
          :disabled="parsing"
          @click="fileInputEl?.click()"
        >
          <Upload :size="26" class="text-muted-foreground" />
          <span class="text-sm font-medium">{{ parsing ? '正在上传并识别内容…' : '点击选择文件' }}</span>
          <span class="text-[11px] text-muted-foreground">支持 TXT / MD / PDF / Word / PPT / Excel / CSV，单个 ≤ 15MB</span>
        </button>
        <div v-if="parsing" class="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 :size="13" class="animate-spin" /> 正在解析正文并由 AI 识别标题、分类、摘要与标签…
        </div>

        <!-- ② 识别结果确认 -->
        <div v-else-if="parsed" class="space-y-3">
          <div class="flex items-center gap-2 rounded-sm border border-success/30 bg-success/[0.06] px-3 py-2 text-xs text-success">
            <Sparkles :size="13" />
            已识别「{{ addForm.fileName }}」（{{ addForm.sizeKb }} KB · {{ addForm.recognizedBy === 'llm' ? 'AI 识别' : '规则识别' }}），请核对后入库
          </div>
          <div>
            <label class="label">标题 *</label>
            <input v-model="addForm.title" class="input mt-1" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label">分类</label>
              <select v-model="addForm.category" class="input mt-1">
                <option>手册</option><option>SOP</option><option>预案</option><option>模板</option><option>制度</option><option>报告</option>
              </select>
            </div>
            <div>
              <label class="label">标签（逗号分隔）</label>
              <input v-model="addForm.tagsText" class="input mt-1" placeholder="如：ECIS, KVM" />
            </div>
          </div>
          <div v-if="addForm.summary">
            <label class="label">AI 摘要</label>
            <p class="mt-1 rounded-sm border border-border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">{{ addForm.summary }}</p>
          </div>
          <div>
            <label class="label">解析正文（可编辑）*</label>
            <textarea v-model="addForm.content" class="input mt-1 h-40 resize-none font-mono text-xs"></textarea>
          </div>
        </div>
      </div>

      <!-- 手动新建模式 -->
      <div v-else class="space-y-3">
        <div>
          <label class="label">名称 *</label>
          <input v-model="addForm.title" class="input mt-1" placeholder="如：设备巡检 SOP v4" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">分类</label>
            <select v-model="addForm.category" class="input mt-1">
              <option>手册</option><option>SOP</option><option>预案</option><option>模板</option><option>制度</option><option>报告</option>
            </select>
          </div>
          <div>
            <label class="label">标签（逗号分隔）</label>
            <input v-model="addForm.tagsText" class="input mt-1" placeholder="如：巡检, 设备" />
          </div>
        </div>
        <div>
          <label class="label">内容（Markdown）*</label>
          <textarea v-model="addForm.content" class="input mt-1 h-44 resize-none font-mono text-xs" placeholder="粘贴或书写资料内容…"></textarea>
        </div>
      </div>
      <template #footer>
        <button class="btn-outline" @click="showAdd = false">取消</button>
        <button
          v-if="addMode === 'file' && parsed"
          class="btn-outline"
          :disabled="saving"
          @click="resetAddForm('file')"
        >重新选择</button>
        <button class="btn-primary" :disabled="saving || (addMode === 'file' && !parsed)" @click="addDoc">
          {{ saving ? '入库中…' : addMode === 'file' ? '确认入库' : '创建' }}
        </button>
      </template>
    </Modal>

    <!-- 新建知识空间 -->
    <Modal :open="showSpaceForm" title="新建知识空间" @close="showSpaceForm = false">
      <div class="space-y-3">
        <div>
          <label class="label">空间名称 *</label>
          <input v-model="spaceForm.name" class="input mt-1" placeholder="如：指挥中心项目知识库" @keyup.enter="createSpace" />
        </div>
        <div>
          <label class="label">范围</label>
          <select v-model="spaceForm.scope" class="input mt-1">
            <option value="team">团队空间（全员可见）</option>
            <option value="project">项目空间</option>
          </select>
        </div>
        <div>
          <label class="label">说明</label>
          <input v-model="spaceForm.desc" class="input mt-1" placeholder="这个空间沉淀哪些资料…" />
        </div>
      </div>
      <template #footer>
        <button class="btn-outline" @click="showSpaceForm = false">取消</button>
        <button class="btn-primary" :disabled="spaceSaving" @click="createSpace">{{ spaceSaving ? '创建中…' : '创建空间' }}</button>
      </template>
    </Modal>

    <!-- 文档预览 -->
    <Drawer :open="showDoc" :title="currentDoc?.title || ''" width="max-w-2xl" @close="showDoc = false">
      <template v-if="currentDoc">
        <div class="flex flex-wrap items-center gap-2">
          <span class="stamp muted"><i></i>{{ currentDoc.category }}</span>
          <span class="font-mono text-[10px] text-muted-foreground">{{ currentDoc.version }}</span>
          <span v-for="t in currentDoc.tags || []" :key="t" class="stamp info"><i></i>{{ t }}</span>
          <span class="ml-auto font-mono text-[10px] text-muted-foreground">{{ fmtTime(currentDoc.updatedAt || currentDoc.createdAt) }}</span>
        </div>
        <div class="mt-4 border-t border-border pt-4">
          <MarkdownText :text="currentDoc.content" />
        </div>
      </template>
    </Drawer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Search, Plus, FileText, FilePlus, Upload, Trash2, FolderKanban, Users, BookOpen, Loader2, Sparkles } from 'lucide-vue-next'
import { api } from '../api.js'
import { toast } from '../store.js'
import { fmtTime, fmtRelative } from '../utils.js'
import EmptyState from '../components/EmptyState.vue'
import Modal from '../components/Modal.vue'
import Drawer from '../components/Drawer.vue'
import MarkdownText from '../components/MarkdownText.vue'

const spaces = ref([])
const activeSpace = ref(null)
const docs = ref([])
const q = ref('')
const searchResults = ref([])
const showAdd = ref(false)
const showDoc = ref(false)
const currentDoc = ref(null)
const saving = ref(false)
const addMode = ref('file') // file | manual
const parsing = ref(false)
const parsed = ref(false)
const fileInputEl = ref(null)
const showSpaceForm = ref(false)
const spaceSaving = ref(false)
const spaceForm = ref({ name: '', scope: 'team', desc: '' })
const emptyAdd = () => ({ title: '', category: '手册', tagsText: '', content: '', summary: '', fileName: '', sizeKb: '', recognizedBy: '' })
const addForm = ref(emptyAdd())
let searchTimer = null

function resetAddForm(mode) {
  addMode.value = mode
  addForm.value = emptyAdd()
  parsed.value = false
  parsing.value = false
}

function openSpaceForm() {
  spaceForm.value = { name: '', scope: 'team', desc: '' }
  showSpaceForm.value = true
}

async function createSpace() {
  if (!spaceForm.value.name.trim()) return toast('请填写空间名称', 'error')
  spaceSaving.value = true
  try {
    const { space } = await api.post('/api/spaces', spaceForm.value)
    toast('空间已创建')
    showSpaceForm.value = false
    await loadSpaces()
    selectSpace(space)
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    spaceSaving.value = false
  }
}

async function removeSpace(s) {
  if (!window.confirm(`确认删除知识空间「${s.name}」？（预置空间不可删，空间内需无资料）`)) return
  try {
    await api.del(`/api/spaces/${s.id}`)
    toast('空间已删除')
    if (activeSpace.value?.id === s.id) activeSpace.value = null
    await loadSpaces()
  } catch (err) {
    toast(err.message, 'error')
  }
}

/* 文件选择 → base64 → 后端解析 + AI 识别 */
function onPickFile(ev) {
  const file = ev.target.files?.[0]
  if (!file) return
  if (file.size > 15 * 1024 * 1024) {
    toast('文件超过 15MB 上限', 'error')
    ev.target.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = async () => {
    const base64 = String(reader.result || '').split(',')[1] || ''
    parsing.value = true
    parsed.value = false
    try {
      const r = await api.post('/api/knowledge/parse', { file: { fileName: file.name, dataBase64: base64 } })
      addForm.value = {
        title: r.title,
        category: r.category,
        tagsText: (r.tags || []).join(', '),
        content: r.content,
        summary: r.summary || '',
        fileName: r.fileName,
        sizeKb: r.sizeKb,
        recognizedBy: r.recognizedBy,
      }
      parsed.value = true
      toast(r.recognizedBy === 'llm' ? 'AI 已识别标题与标签，请核对' : '已解析（规则识别），请补充信息')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      parsing.value = false
      ev.target.value = ''
    }
  }
  reader.readAsDataURL(file)
}

async function loadSpaces() {
  const data = await api.get('/api/spaces')
  spaces.value = data.list
  if (!activeSpace.value && spaces.value.length) selectSpace(spaces.value[0])
}

async function selectSpace(s) {
  activeSpace.value = s
  q.value = ''
  searchResults.value = []
  const data = await api.get(`/api/spaces/${s.id}/docs`)
  docs.value = data.list
}

function search() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(async () => {
    if (!q.value.trim()) return (searchResults.value = [])
    const data = await api.get(`/api/knowledge/search?q=${encodeURIComponent(q.value)}`)
    searchResults.value = data.list.filter((r) => !activeSpace.value || r.spaceId === activeSpace.value.id)
  }, 300)
}

async function addDoc() {
  const f = addForm.value
  if (!f.title.trim() || !f.content.trim()) return toast('请填写名称与内容', 'error')
  saving.value = true
  try {
    await api.post(`/api/spaces/${activeSpace.value.id}/docs`, {
      title: f.title.trim(),
      category: f.category,
      content: f.content,
      summary: f.summary || '',
      tags: f.tagsText.split(/[,，]/).map((x) => x.trim()).filter(Boolean),
      source: addMode.value === 'file' ? `文件导入：${f.fileName}` : '手动新建',
      fileName: addMode.value === 'file' ? f.fileName : null,
    })
    toast(addMode.value === 'file' ? '资料已识别入库，AI 可检索引用' : '文档已创建')
    showAdd.value = false
    resetAddForm('file')
    await selectSpace(activeSpace.value)
    await loadSpaces()
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    saving.value = false
  }
}

async function removeDoc(d) {
  if (!window.confirm(`确认删除「${d.title}」？`)) return
  await api.del(`/api/docs/${d.id}`)
  toast('已删除')
  await selectSpace(activeSpace.value)
  await loadSpaces()
}

function openDoc(d) {
  currentDoc.value = d
  showDoc.value = true
}

onMounted(loadSpaces)
</script>
