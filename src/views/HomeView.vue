<template>
  <div class="rise mx-auto flex min-h-full max-w-4xl flex-col px-6 py-8">
    <!-- 品牌区（居中，参考 deepseek 主区） -->
    <div class="flex flex-1 flex-col items-center justify-center py-8">
      <div class="flex items-center gap-3">
        <span class="chip chip-blue grid size-11 place-items-center rounded-xl">
          <Bot :size="22" />
        </span>
        <h1 class="font-display text-[28px] font-semibold tracking-tight text-foreground">
          探索未至之境
        </h1>
        <span class="rounded-full bg-info/10 px-2.5 py-0.5 text-[11px] font-medium text-info">预览版</span>
      </div>
      <p class="mt-2 text-[13px] text-muted-foreground">天誉创高 · 显控一体化项目研发工作台</p>

      <!-- 大输入框（豆包式：功能 chips 内嵌输入框下沿） -->
      <div class="mt-8 w-full max-w-2xl">
        <div
          class="rounded-2xl border border-border bg-card p-4 shadow-[0_1px_3px_rgba(27,31,39,0.04),0_8px_24px_-12px_rgba(27,31,39,0.1)] transition-all focus-within:border-foreground/30"
        >
          <textarea
            v-model="prompt"
            rows="3"
            class="w-full resize-none bg-transparent text-[14px] leading-relaxed outline-none placeholder:text-muted-foreground/70"
            placeholder="描述你要完成的工作，AI 会自动调用已授权的平台能力…"
            @keydown.meta.enter="launch()"
            @keydown.ctrl.enter="launch()"
          ></textarea>
          <div class="mt-2 flex items-center gap-1.5">
            <!-- 智能应用 chips（豆包式功能按钮，点击直达应用闭环） -->
            <div class="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
              <button
                v-for="c in appChips"
                :key="c.label"
                class="func-chip flex-none !gap-1 !px-2.5 !py-1 !text-[12px]"
                @click="$router.push(c.to)"
              >
                <component :is="c.icon" :size="12" :class="c.cls" />
                {{ c.label }}
              </button>
            </div>
            <button
              class="grid size-9 flex-none place-items-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 active:scale-95 disabled:opacity-40"
              :disabled="!prompt.trim()"
              title="发送（⌘/Ctrl + Enter）"
              @click="launch()"
            >
              <ArrowUp :size="16" />
            </button>
          </div>
        </div>
      </div>

      <!-- 平台域快捷任务 chips（预填指令直接发起） -->
      <div class="mt-4 flex max-w-2xl flex-wrap items-center justify-center gap-2">
        <button
          v-for="c in domainChips"
          :key="c.label"
          class="func-chip"
          @click="launch(c.prompt)"
        >
          <component :is="c.icon" :size="13" :class="c.cls" />
          {{ c.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Bot, ArrowUp, Mic, ScanEye,
  Layers, ServerCog, GitBranch, MonitorPlay, Volume2, GraduationCap,
} from 'lucide-vue-next'
import { gs, refreshProjects } from '../store.js'

const router = useRouter()
const prompt = ref('')

// 智能应用入口 chips（内嵌输入框下沿，豆包式功能按钮；点击直达应用页闭环）
const appChips = [
  { label: '录音转写 · 会议纪要', icon: Mic, cls: 'text-chip-purple-fg', to: '/meetings' },
  { label: '视频识别', icon: ScanEye, cls: 'text-chip-orange-fg', to: '/vision' },
]

// 平台域快捷任务 chips（预填指令直接发起，闭环到任务会话）
const domainChips = [
  { label: '综合运维集控', icon: ServerCog, cls: 'text-chip-blue-fg', prompt: '帮我做告警收敛与根因分析，并生成处置方案' },
  { label: '分布式坐席', icon: Layers, cls: 'text-chip-cyan-fg', prompt: '排查坐席节点网络抖动问题，对比网关丢包日志' },
  { label: '光纤坐席', icon: GitBranch, cls: 'text-chip-green-fg', prompt: '生成光纤坐席链路巡检计划' },
  { label: '矩阵拼接', icon: MonitorPlay, cls: 'text-chip-purple-fg', prompt: '生成 4x4 拼接切换计划，列出高风险步骤' },
  { label: '中央控制', icon: Volume2, cls: 'text-chip-orange-fg', prompt: '诊断报告厅音频断续问题，检查中控主机与功放日志' },
  { label: '智慧教育', icon: GraduationCap, cls: 'text-chip-green-fg', prompt: '汇总智慧教室巡课告警，识别高发教室并给出整改建议' },
]

function launch(preset) {
  const text = preset || prompt.value.trim()
  if (!text) return
  const query = { prompt: text }
  // 当前工作区由侧栏工作区列表/项目详情设定，发起时自动携带
  if (gs.currentProjectId) query.projectId = gs.currentProjectId
  router.push({ path: '/tasks/new', query })
}

onMounted(() => {
  refreshProjects()
})
</script>
