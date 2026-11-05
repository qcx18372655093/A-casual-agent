import { createRouter, createWebHistory } from 'vue-router'
import { getToken } from './api.js'

const routes = [
  { path: '/login', name: 'login', component: () => import('./views/LoginView.vue'), meta: { title: '登录', public: true } },
  { path: '/', name: 'home', component: () => import('./views/HomeView.vue'), meta: { title: '工作台' } },
  { path: '/projects', name: 'projects', component: () => import('./views/ProjectsView.vue'), meta: { title: '公司项目' } },
  { path: '/projects/:id', name: 'project-detail', component: () => import('./views/ProjectDetailView.vue'), meta: { title: '项目详情' } },
  { path: '/tasks', name: 'tasks', component: () => import('./views/TasksView.vue'), meta: { title: 'AI 任务' } },
  { path: '/tasks/:id', name: 'task-chat', component: () => import('./views/TaskChatView.vue'), meta: { title: '任务对话' } },
  { path: '/automations', name: 'automations', component: () => import('./views/AutomationsView.vue'), meta: { title: '自动化' } },
  { path: '/connectors', name: 'connectors', component: () => import('./views/ConnectorsView.vue'), meta: { title: '连接器中心' } },
  { path: '/skills', name: 'skills', component: () => import('./views/SkillsView.vue'), meta: { title: 'Skill 中心' } },
  { path: '/knowledge', name: 'knowledge', component: () => import('./views/KnowledgeView.vue'), meta: { title: '知识空间' } },
  { path: '/approvals', name: 'approvals', component: () => import('./views/ApprovalsView.vue'), meta: { title: '待办与审批' } },
  { path: '/audit', name: 'audit', component: () => import('./views/AuditView.vue'), meta: { title: '审计日志' } },
  { path: '/alerts', name: 'alerts', component: () => import('./views/AlertsView.vue'), meta: { title: '告警中心' } },
  { path: '/data-quality', name: 'data-quality', component: () => import('./views/DataQualityView.vue'), meta: { title: '数据质量' } },
  { path: '/solutions', name: 'solutions', component: () => import('./views/SolutionsView.vue'), meta: { title: '能力拓展' } },
  { path: '/cases', name: 'cases', component: () => import('./views/ExploreView.vue'), meta: { title: '案例库' } },
  { path: '/smart-control', name: 'smart-control', component: () => import('./views/SmartControlView.vue'), meta: { title: 'SMART6000 集控台' } },
  { path: '/meetings', name: 'meetings', component: () => import('./views/MeetingsView.vue'), meta: { title: '会议助手' } },
  { path: '/vision', name: 'vision', component: () => import('./views/VisionView.vue'), meta: { title: 'SSLX 视频识别' } },
  { path: '/explore', redirect: '/solutions' },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

/** 登录守卫：未登录一律回登录页；已登录访问 /login 则回首页 */
router.beforeEach((to) => {
  const authed = !!getToken()
  if (to.meta.public) {
    return authed ? { path: '/' } : true
  }
  if (!authed) {
    return { path: '/login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} }
  }
  return true
})

router.afterEach((to) => {
  document.title = `${to.meta.title || '工作台'} · Creator AI 工作台`
})
