<template>
  <div class="rounded-md border border-destructive/50 bg-destructive/[0.04]">
    <div class="flex items-center gap-2 border-b border-destructive/30 px-4 py-2.5">
      <ShieldAlert :size="15" class="text-destructive" />
      <span class="text-sm font-semibold">高风险操作已被拦下，等待人工裁决</span>
      <span class="stamp danger ml-auto"><i></i>approval</span>
    </div>
    <!-- 来源上下文：项目 × 会话绑定（仅在列表场景展示） -->
    <div v-if="linkContext && (approval.projectName || approval.taskTitle)" class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-destructive/30 bg-card/60 px-4 py-2 text-[11px] text-muted-foreground">
      <RouterLink
        v-if="approval.projectId && approval.projectName"
        :to="`/projects/${approval.projectId}`"
        class="inline-flex items-center gap-1 transition-colors hover:text-foreground"
      >
        <FolderKanban :size="12" /> {{ approval.projectName }}
      </RouterLink>
      <span v-else-if="approval.projectName" class="inline-flex items-center gap-1"><FolderKanban :size="12" /> {{ approval.projectName }}</span>
      <RouterLink
        v-if="approval.taskId && approval.taskTitle"
        :to="`/tasks/${approval.taskId}`"
        class="inline-flex items-center gap-1 transition-colors hover:text-foreground"
      >
        <MessagesSquare :size="12" /> 来源会话：{{ approval.taskTitle }}
      </RouterLink>
    </div>
    <div class="px-4 py-3">
      <div class="grid grid-cols-[88px_1fr] gap-y-2 text-[13px]">
        <span class="mono-tag pt-0.5 text-muted-foreground">操作</span>
        <span class="font-medium">{{ approval.title }}</span>
        <span class="mono-tag pt-0.5 text-muted-foreground">操作对象</span>
        <span class="font-mono text-xs">{{ approval.object || '—' }}</span>
        <span class="mono-tag pt-0.5 text-muted-foreground">变更内容</span>
        <span class="font-mono text-xs break-all">{{ approval.change || '—' }}</span>
        <span class="mono-tag pt-0.5 text-muted-foreground">影响范围</span>
        <span>{{ approval.impact || '—' }}</span>
        <span class="mono-tag pt-0.5 text-muted-foreground">回滚建议</span>
        <span>{{ approval.rollback || '—' }}</span>
        <span class="mono-tag pt-0.5 text-muted-foreground">申请人</span>
        <span>{{ approval.applicant }}</span>
        <span class="mono-tag pt-0.5 text-muted-foreground">审批人</span>
        <span>{{ approval.approver }}<span v-if="approval.expireAt" class="ml-2 text-muted-foreground">· {{ fmtRelative(approval.expireAt) }}过期</span></span>
      </div>

      <div v-if="approval.status === 'pending'" class="mt-3 flex items-center gap-2 border-t border-destructive/30 pt-3">
        <button class="btn-danger" :disabled="acting" @click="$emit('decide', 'approve')">
          <Check :size="14" /> {{ acting ? '提交中…' : '批准执行' }}
        </button>
        <button class="btn-outline" :disabled="acting" @click="$emit('decide', 'reject')">
          <X :size="14" /> 拒绝
        </button>
        <span class="ml-auto text-[11px] text-muted-foreground">批准后 AI 将立即执行该操作并继续任务</span>
      </div>
      <div v-else class="mt-3 border-t border-destructive/30 pt-3">
        <StatusStamp :status="approval.status" :map="APPROVAL_STATUS" />
        <span v-if="approval.comment" class="ml-2 text-xs text-muted-foreground">{{ approval.comment }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ShieldAlert, Check, X, FolderKanban, MessagesSquare } from 'lucide-vue-next'
import { APPROVAL_STATUS, fmtRelative } from '../utils.js'
import StatusStamp from './StatusStamp.vue'

defineProps({
  approval: { type: Object, required: true },
  acting: { type: Boolean, default: false },
  /* 列表场景下展示「项目 / 来源会话」上下文条；会话内使用时不展示 */
  linkContext: { type: Boolean, default: false },
})
defineEmits(['decide'])
</script>
