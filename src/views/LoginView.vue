<template>
  <div class="flex min-h-full items-center justify-center bg-background px-4 py-10">
    <div class="w-full max-w-92">
      <!-- 品牌标识 -->
      <div class="mb-6 flex flex-col items-center text-center">
        <span class="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lift">
          <Sparkles :size="22" :stroke-width="1.8" />
        </span>
        <h1 class="font-display text-[22px] font-bold tracking-tight">Creator AI 项目工作台</h1>
        <p class="mono-tag mt-1.5 text-muted-foreground">AV INTEGRATION · AGENT PLATFORM</p>
      </div>

      <!-- 登录卡片 -->
      <div class="card rise p-6 shadow-[var(--shadow-lift)]">
        <p class="text-[15px] font-semibold">登录工作台</p>
        <p class="mt-0.5 text-xs text-muted-foreground">登录后可发起 AI 任务、审批与项目协作</p>

        <form class="mt-5 space-y-3.5" @submit.prevent="submit">
          <div>
            <label class="mb-1.5 block text-xs font-medium text-muted-foreground">用户名</label>
            <div class="relative">
              <User :size="15" class="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground/60" />
              <input
                v-model.trim="form.username"
                class="input w-full !pl-9"
                placeholder="请输入用户名"
                autocomplete="username"
                :disabled="loading"
              />
            </div>
          </div>
          <div>
            <label class="mb-1.5 block text-xs font-medium text-muted-foreground">密码</label>
            <div class="relative">
              <Lock :size="15" class="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground/60" />
              <input
                v-model="form.password"
                :type="showPwd ? 'text' : 'password'"
                class="input w-full !pr-9 !pl-9"
                placeholder="请输入密码"
                autocomplete="current-password"
                :disabled="loading"
                @keyup.enter="submit"
              />
              <button
                type="button"
                class="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer text-muted-foreground/60 transition-colors hover:text-foreground"
                :title="showPwd ? '隐藏密码' : '显示密码'"
                @click="showPwd = !showPwd"
              >
                <EyeOff v-if="showPwd" :size="15" />
                <Eye v-else :size="15" />
              </button>
            </div>
          </div>

          <p v-if="error" class="flex items-center gap-1.5 rounded-md bg-destructive/8 px-3 py-2 text-xs text-destructive">
            <CircleAlert :size="13" class="flex-none" />
            {{ error }}
          </p>

          <button type="submit" class="btn-primary flex w-full items-center justify-center gap-2 !py-2.5" :disabled="loading">
            <Loader2 v-if="loading" :size="15" class="animate-spin" />
            <LogIn v-else :size="15" />
            {{ loading ? '正在登录…' : '登 录' }}
          </button>
        </form>
      </div>

      <!-- 演示账号（演示平台便民提示） -->
      <div class="card mt-4 border-dashed px-4 py-3">
        <p class="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <KeyRound :size="12" />
          演示账号（点击填充）
        </p>
        <div class="space-y-1.5">
          <button
            v-for="a in demoAccounts"
            :key="a.username"
            type="button"
            class="flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
            @click="fill(a)"
          >
            <span class="text-xs font-medium">{{ a.name }} · {{ a.roleName }}</span>
            <span class="font-mono text-[11px] text-muted-foreground">{{ a.username }} / {{ a.password }}</span>
          </button>
        </div>
      </div>

      <p class="mt-5 text-center text-[11px] text-muted-foreground/70">演示环境：连接器与设备数据均为演示数据</p>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Sparkles, User, Lock, Eye, EyeOff, LogIn, Loader2, CircleAlert, KeyRound } from 'lucide-vue-next'
import { login } from '../store.js'

const route = useRoute()
const router = useRouter()

const form = reactive({ username: '', password: '' })
const loading = ref(false)
const error = ref('')
const showPwd = ref(false)

const demoAccounts = [
  { username: 'admin', password: 'admin123', name: '陈志远', roleName: '管理员' },
  { username: 'approver', password: 'approver123', name: '李晓梅', roleName: '审批人' },
  { username: 'member', password: 'member123', name: '王一帆', roleName: '项目成员' },
]

function fill(a) {
  form.username = a.username
  form.password = a.password
  error.value = ''
}

async function submit() {
  if (loading.value) return
  error.value = ''
  if (!form.username || !form.password) {
    error.value = '请输入用户名和密码'
    return
  }
  loading.value = true
  try {
    await login(form.username, form.password)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    router.push(redirect.startsWith('/') ? redirect : '/')
  } catch (err) {
    error.value = err.message || '登录失败，请稍后重试'
  } finally {
    loading.value = false
  }
}
</script>
