<template>
  <div class="px-6 py-5">
    <p class="text-sm text-muted-foreground">每一次工具调用、审批与配置变更都会留痕：谁发起、访问了什么、结果如何</p>

    <!-- 过滤器 -->
    <div class="mt-4 flex flex-wrap items-center gap-2">
      <input v-model="filters.actor" class="input w-40" placeholder="操作者" @input="debouncedLoad" />
      <select v-model="filters.targetType" class="input w-40" @change="load">
        <option value="">全部对象类型</option>
        <option value="connector">连接器</option>
        <option value="skill">技能</option>
        <option value="task">任务</option>
        <option value="approval">审批</option>
        <option value="automation">自动化</option>
        <option value="project">项目</option>
        <option value="todo">待办</option>
        <option value="knowledge">知识库</option>
      </select>
      <input v-model="filters.action" class="input w-44" placeholder="动作关键词，如 调用" @input="debouncedLoad" />
      <button class="btn-outline btn-sm ml-auto" @click="reset"><RotateCcw :size="12" /> 重置</button>
    </div>

    <Skeleton v-if="loading" kind="rows" :count="8" />
    <template v-else>
      <table class="table-base mt-4 w-full">
        <thead>
          <tr><th>编号</th><th>时间</th><th>操作者</th><th>动作</th><th>对象</th><th>详情</th><th>结果</th></tr>
        </thead>
        <tbody>
          <tr v-for="a in list" :key="a.id">
            <td class="font-mono text-[10px] text-muted-foreground">AU-{{ a.seq }}</td>
            <td class="font-mono text-[10px] whitespace-nowrap">{{ fmtTime(a.createdAt) }}</td>
            <td class="text-xs whitespace-nowrap">{{ a.actor }}</td>
            <td class="text-xs whitespace-nowrap">{{ a.action }}</td>
            <td class="font-mono text-[10px] whitespace-nowrap">{{ targetLabel(a) }}</td>
            <td class="max-w-md"><p class="truncate text-xs text-muted-foreground" :title="a.detail">{{ a.detail }}</p></td>
            <td>
              <span class="stamp" :class="a.result === 'success' ? 'success' : a.result === 'rejected' ? 'muted' : 'danger'">
                <i></i>{{ a.result === 'success' ? '成功' : a.result === 'rejected' ? '已拒绝' : '失败' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-if="!list.length" :icon="ScrollText" title="没有符合条件的审计记录" />
      <p class="mt-3 text-right font-mono text-[10px] text-muted-foreground">共 {{ total }} 条</p>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { RotateCcw, ScrollText } from 'lucide-vue-next'
import { api } from '../api.js'
import { fmtTime } from '../utils.js'
import EmptyState from '../components/EmptyState.vue'
import Skeleton from '../components/Skeleton.vue'

const list = ref([])
const total = ref(0)
const loading = ref(true)
const filters = ref({ actor: '', targetType: '', action: '' })
let timer = null

function targetLabel(a) {
  return a.targetId ? `${a.targetType}:${String(a.targetId).slice(0, 14)}` : a.targetType
}

async function load() {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (filters.value.actor) params.set('actor', filters.value.actor)
    if (filters.value.targetType) params.set('targetType', filters.value.targetType)
    if (filters.value.action) params.set('action', filters.value.action)
    const data = await api.get(`/api/audit?${params.toString()}`)
    list.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

function debouncedLoad() {
  clearTimeout(timer)
  timer = setTimeout(load, 350)
}

function reset() {
  filters.value = { actor: '', targetType: '', action: '' }
  load()
}

onMounted(load)
</script>
