<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Ellipsis,
  ListFilter,
  LogOut,
  Pencil,
  Plus,
  RotateCw,
  Search,
  Trash2,
  X
} from '@lucide/vue'
import { api } from './services/api'

const PAGE_SIZE = 8
const token = ref(localStorage.getItem('task-manager-token') || '')
const storedUser = localStorage.getItem('task-manager-user')
const username = ref(storedUser || '')
const authMode = ref('login')
const authForm = ref({ username: '', password: '', confirmPassword: '' })
const authLoading = ref(false)
const authError = ref('')

const tasks = ref([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const error = ref('')
const filter = ref('all')
const keyword = ref('')
const newTaskTitle = ref('')
const creating = ref(false)
const selectedIds = ref(new Set())
const editingTask = ref(null)
const editTitle = ref('')
const saving = ref(false)
const notice = ref('')

const visibleTasks = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  return tasks.value.filter((task) => {
    const matchesFilter =
      filter.value === 'all' ||
      (filter.value === 'active' && !task.completed) ||
      (filter.value === 'completed' && task.completed)
    return matchesFilter && (!query || task.title.toLowerCase().includes(query))
  })
})

const completedCount = computed(() => tasks.value.filter((task) => task.completed).length)
const activeCount = computed(() => tasks.value.filter((task) => !task.completed).length)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const isAllSelected = computed(
  () => visibleTasks.value.length > 0 && visibleTasks.value.every((task) => selectedIds.value.has(task.id))
)

function showNotice(message) {
  notice.value = message
  window.setTimeout(() => {
    if (notice.value === message) notice.value = ''
  }, 2600)
}

function formatDate(value) {
  if (!value) return '刚刚'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '刚刚'
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

async function loadTasks() {
  loading.value = true
  error.value = ''
  try {
    const result = await api.getTasks(page.value, PAGE_SIZE)
    tasks.value = result.data || []
    total.value = result.total || 0
    selectedIds.value = new Set()
  } catch (requestError) {
    error.value = requestError.message
  } finally {
    loading.value = false
  }
}

async function submitAuth() {
  authError.value = ''
  const form = authForm.value
  if (!form.username.trim() || !form.password) {
    authError.value = '请输入用户名和密码'
    return
  }
  if (authMode.value === 'register' && form.password !== form.confirmPassword) {
    authError.value = '两次输入的密码不一致'
    return
  }

  authLoading.value = true
  try {
    if (authMode.value === 'register') {
      await api.register({ username: form.username.trim(), password: form.password })
      showNotice('账户已创建，请登录')
      authMode.value = 'login'
      authForm.value = { username: form.username.trim(), password: '', confirmPassword: '' }
      return
    }
    const result = await api.login({ username: form.username.trim(), password: form.password })
    token.value = result.data?.token || ''
    username.value = form.username.trim()
    localStorage.setItem('task-manager-token', token.value)
    localStorage.setItem('task-manager-user', username.value)
    await loadTasks()
  } catch (requestError) {
    authError.value = requestError.message
  } finally {
    authLoading.value = false
  }
}

function logout() {
  localStorage.removeItem('task-manager-token')
  localStorage.removeItem('task-manager-user')
  token.value = ''
  username.value = ''
  tasks.value = []
  total.value = 0
  authForm.value = { username: '', password: '', confirmPassword: '' }
}

async function createTask() {
  const title = newTaskTitle.value.trim()
  if (!title || creating.value) return
  creating.value = true
  try {
    await api.createTask(title)
    newTaskTitle.value = ''
    page.value = 1
    await loadTasks()
    showNotice('任务已添加')
  } catch (requestError) {
    error.value = requestError.message
  } finally {
    creating.value = false
  }
}

async function toggleTask(task) {
  const previous = task.completed
  task.completed = !task.completed
  try {
    const result = await api.updateTask(task)
    Object.assign(task, result.data || {})
    showNotice(task.completed ? '任务已完成' : '任务已恢复')
  } catch (requestError) {
    task.completed = previous
    error.value = requestError.message
  }
}

function openEditor(task) {
  editingTask.value = task
  editTitle.value = task.title
}

function closeEditor() {
  editingTask.value = null
  editTitle.value = ''
}

async function saveTask() {
  const title = editTitle.value.trim()
  if (!editingTask.value || !title) return
  saving.value = true
  try {
    const result = await api.updateTask({
      ...editingTask.value,
      title
    })
    const updatedTask = result.data || { ...editingTask.value, title }
    const index = tasks.value.findIndex((task) => task.id === updatedTask.id)
    if (index >= 0) tasks.value[index] = updatedTask
    showNotice('任务已更新')
    closeEditor()
  } catch (requestError) {
    error.value = requestError.message
  } finally {
    saving.value = false
  }
}

function toggleSelection(id) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

function toggleAll() {
  if (isAllSelected.value) {
    selectedIds.value = new Set()
    return
  }
  selectedIds.value = new Set(visibleTasks.value.map((task) => task.id))
}

async function deleteSelected() {
  const ids = [...selectedIds.value]
  if (!ids.length) return
  if (!window.confirm(`确定删除选中的 ${ids.length} 个任务吗？`)) return
  try {
    await api.deleteTasks(ids)
    if (tasks.value.length === ids.length && page.value > 1) page.value -= 1
    await loadTasks()
    showNotice('所选任务已删除')
  } catch (requestError) {
    error.value = requestError.message
  }
}

async function changePage(nextPage) {
  if (nextPage < 1 || nextPage > totalPages.value || nextPage === page.value) return
  page.value = nextPage
  await loadTasks()
}

onMounted(() => {
  if (token.value) loadTasks()
})
</script>

<template>
  <main v-if="!token" class="auth-shell">
    <section class="auth-intro">
      <div class="brand-mark brand-mark-large">
        <CheckCheck :size="25" />
      </div>
      <p class="eyebrow">TASKFLOW</p>
      <h1>让每一件要紧的事，<br />都有清晰的下一步。</h1>
      <p class="intro-copy">一个安静、专注的任务空间，帮你把待办从脑海里放到眼前。</p>
      <div class="intro-stats">
        <div>
          <strong>01</strong>
          <span>记录优先事项</span>
        </div>
        <div>
          <strong>02</strong>
          <span>完成今日计划</span>
        </div>
      </div>
    </section>

    <section class="auth-panel">
      <div class="auth-card">
        <div class="auth-heading">
          <p class="eyebrow">WELCOME</p>
          <h2>{{ authMode === 'login' ? '欢迎回来' : '创建账户' }}</h2>
          <p>{{ authMode === 'login' ? '登录后继续处理你的任务。' : '注册一个账户，开始整理你的工作。' }}</p>
        </div>

        <form class="auth-form" @submit.prevent="submitAuth">
          <label>
            <span>用户名</span>
            <input v-model="authForm.username" autocomplete="username" placeholder="输入用户名" />
          </label>
          <label>
            <span>密码</span>
            <input v-model="authForm.password" type="password" autocomplete="current-password" placeholder="输入密码" />
          </label>
          <label v-if="authMode === 'register'">
            <span>确认密码</span>
            <input v-model="authForm.confirmPassword" type="password" autocomplete="new-password" placeholder="再次输入密码" />
          </label>
          <p v-if="authError" class="form-error">{{ authError }}</p>
          <button class="button button-primary button-full" type="submit" :disabled="authLoading">
            <span>{{ authLoading ? '正在处理...' : authMode === 'login' ? '登录' : '注册账户' }}</span>
            <ArrowRight v-if="!authLoading" :size="17" />
          </button>
        </form>

        <p class="auth-switch">
          {{ authMode === 'login' ? '还没有账户？' : '已经有账户？' }}
          <button type="button" @click="authMode = authMode === 'login' ? 'register' : 'login'; authError = ''">
            {{ authMode === 'login' ? '注册' : '登录' }}
          </button>
        </p>
      </div>
    </section>
  </main>

  <main v-else class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark"><CheckCheck :size="19" /></div>
        <span>taskflow</span>
      </div>

      <nav class="sidebar-nav" aria-label="主导航">
        <a class="nav-item active" href="#tasks">
          <ClipboardList :size="19" />
          <span>我的任务</span>
          <b>{{ total }}</b>
        </a>
      </nav>

      <div class="sidebar-bottom">
        <div class="user-card">
          <span class="avatar">{{ username.charAt(0).toUpperCase() }}</span>
          <div>
            <strong>{{ username }}</strong>
            <small>个人工作区</small>
          </div>
        </div>
        <button class="icon-button logout" type="button" title="退出登录" @click="logout">
          <LogOut :size="18" />
        </button>
      </div>
    </aside>

    <section id="tasks" class="workspace">
      <header class="workspace-header">
        <div>
          <p class="eyebrow">WORKSPACE</p>
          <h1>我的任务</h1>
          <p class="header-subtitle">今天也把注意力留给真正重要的事情。</p>
        </div>
        <button class="icon-button" type="button" title="刷新任务" :class="{ spinning: loading }" @click="loadTasks">
          <RotateCw :size="18" />
        </button>
      </header>

      <section class="stats-grid" aria-label="任务概览">
        <div class="stat-card">
          <span class="stat-icon total"><ClipboardList :size="19" /></span>
          <div><strong>{{ total }}</strong><span>全部任务</span></div>
        </div>
        <div class="stat-card">
          <span class="stat-icon active"><Clock3 :size="19" /></span>
          <div><strong>{{ activeCount }}</strong><span>待完成</span></div>
        </div>
        <div class="stat-card">
          <span class="stat-icon done"><CheckCircle2 :size="19" /></span>
          <div><strong>{{ completedCount }}</strong><span>已完成</span></div>
        </div>
      </section>

      <section class="quick-add">
        <Plus :size="19" />
        <input v-model="newTaskTitle" placeholder="添加一个新的任务..." @keyup.enter="createTask" />
        <button class="button button-primary" type="button" :disabled="!newTaskTitle.trim() || creating" @click="createTask">
          {{ creating ? '添加中' : '添加任务' }}
        </button>
      </section>

      <section class="task-area">
        <div class="task-toolbar">
          <div class="filters" role="tablist" aria-label="任务筛选">
            <button :class="{ selected: filter === 'all' }" type="button" @click="filter = 'all'">全部</button>
            <button :class="{ selected: filter === 'active' }" type="button" @click="filter = 'active'">待完成</button>
            <button :class="{ selected: filter === 'completed' }" type="button" @click="filter = 'completed'">已完成</button>
          </div>
          <label class="search-box">
            <Search :size="17" />
            <input v-model="keyword" placeholder="搜索任务" />
          </label>
        </div>

        <div v-if="selectedIds.size" class="bulk-bar">
          <span>已选择 {{ selectedIds.size }} 项</span>
          <button class="text-button danger" type="button" @click="deleteSelected">
            <Trash2 :size="16" /> 删除所选
          </button>
          <button class="icon-button small" type="button" title="取消选择" @click="selectedIds = new Set()">
            <X :size="16" />
          </button>
        </div>

        <p v-if="error" class="request-error">{{ error }}</p>

        <div class="list-head">
          <button class="check-control" type="button" :class="{ checked: isAllSelected }" title="选择当前页任务" @click="toggleAll">
            <Check v-if="isAllSelected" :size="14" />
          </button>
          <span>任务</span>
          <span>更新时间</span>
          <span>操作</span>
        </div>

        <div v-if="loading" class="empty-state">
          <RotateCw class="spinning" :size="22" />
          <p>正在加载任务...</p>
        </div>
        <div v-else-if="visibleTasks.length === 0" class="empty-state">
          <ListFilter :size="25" />
          <p>{{ tasks.length ? '没有符合当前条件的任务' : '还没有任务，添加第一项吧。' }}</p>
        </div>

        <article v-for="task in visibleTasks" :key="task.id" class="task-row" :class="{ completed: task.completed }">
          <button class="check-control" type="button" :class="{ checked: selectedIds.has(task.id) }" title="选择任务" @click="toggleSelection(task.id)">
            <Check v-if="selectedIds.has(task.id)" :size="14" />
          </button>
          <button class="complete-button" type="button" :class="{ completed: task.completed }" :title="task.completed ? '标记为待完成' : '标记为完成'" @click="toggleTask(task)">
            <Check v-if="task.completed" :size="14" />
          </button>
          <div class="task-title">
            <strong>{{ task.title }}</strong>
            <span>{{ task.completed ? '已完成' : '进行中' }}</span>
          </div>
          <time :datetime="task.updated_at">{{ formatDate(task.updated_at || task.created_at) }}</time>
          <div class="row-actions">
            <button class="icon-button small" type="button" title="编辑任务" @click="openEditor(task)">
              <Pencil :size="16" />
            </button>
            <button class="icon-button small" type="button" title="更多操作">
              <Ellipsis :size="17" />
            </button>
          </div>
        </article>

        <footer class="list-footer">
          <span>共 {{ total }} 个任务</span>
          <div class="pagination">
            <button class="icon-button small" type="button" title="上一页" :disabled="page === 1 || loading" @click="changePage(page - 1)">
              <ArrowLeft :size="16" />
            </button>
            <span>{{ page }} / {{ totalPages }}</span>
            <button class="icon-button small" type="button" title="下一页" :disabled="page === totalPages || loading" @click="changePage(page + 1)">
              <ArrowRight :size="16" />
            </button>
          </div>
        </footer>
      </section>
    </section>

    <Transition name="fade">
      <div v-if="notice" class="toast"><CheckCircle2 :size="17" />{{ notice }}</div>
    </Transition>

    <div v-if="editingTask" class="modal-backdrop" @click.self="closeEditor">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="edit-title">
        <div class="modal-header">
          <div>
            <p class="eyebrow">EDIT TASK</p>
            <h2 id="edit-title">编辑任务</h2>
          </div>
          <button class="icon-button" type="button" title="关闭" @click="closeEditor"><X :size="18" /></button>
        </div>
        <label class="modal-field">
          <span>任务内容</span>
          <input v-model="editTitle" autofocus @keyup.enter="saveTask" />
        </label>
        <div class="modal-actions">
          <button class="button button-secondary" type="button" @click="closeEditor">取消</button>
          <button class="button button-primary" type="button" :disabled="!editTitle.trim() || saving" @click="saveTask">
            {{ saving ? '保存中' : '保存更改' }}
          </button>
        </div>
      </section>
    </div>
  </main>
</template>
