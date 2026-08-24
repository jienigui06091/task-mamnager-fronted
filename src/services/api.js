const API_ROOT = import.meta.env.VITE_API_BASE || '/api'

async function request(path, options = {}) {
  const token = localStorage.getItem('task-manager-token')
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.error || body.errror || '请求未能完成，请稍后再试')
  }

  return body
}

export const api = {
  login: (payload) => request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  register: (payload) => request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  getTasks: (page, pageSize) => request(`/task/page?page=${page}&pageSize=${pageSize}`),
  createTask: (title) => request('/task/create', { method: 'POST', body: JSON.stringify({ title }) }),
  updateTask: (task) =>
    request('/task/update', {
      method: 'POST',
      body: JSON.stringify({ id: task.id, title: task.title, completed: task.completed })
    }),
  deleteTasks: (ids) =>
    request('/task/deleteByList', { method: 'DELETE', body: JSON.stringify({ ids }) })
}
