/** 轻量 API 客户端 + SSE 流式读取（携带登录令牌，401 自动回登录页） */

const TOKEN_KEY = 'creator_token'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* 隐私模式等场景忽略 */
  }
}

function authHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** 401 统一处理：清令牌并跳转登录页（避免在登录页循环跳转） */
function handleUnauthorized() {
  setToken(null)
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search)
    window.location.href = `/login?redirect=${redirect}`
  }
}

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { ...authHeaders(), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && !url.startsWith('/api/auth/login')) {
    handleUnauthorized()
    throw new Error(data.error || '登录已失效')
  }
  if (!res.ok) throw new Error(data.error || `请求失败（${res.status}）`)
  return data
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body ?? {}),
  patch: (url, body) => request('PATCH', url, body ?? {}),
  del: (url) => request('DELETE', url),
}

/**
 * POST + SSE 流式读取
 * handlers: { onEvent(event, data), onError(err) }
 * 返回 Promise（流结束时 resolve）
 */
export async function streamPost(url, body, handlers) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  if (res.status === 401) {
    handleUnauthorized()
    throw new Error('登录已失效，请重新登录')
  }
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `流式请求失败（${res.status}）`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let idx
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const raw = buf.slice(0, idx)
      buf = buf.slice(idx + 2)
      let event = 'message'
      let data = ''
      for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data += line.slice(5).trim()
      }
      if (data) {
        try {
          handlers.onEvent(event, JSON.parse(data))
        } catch (err) {
          console.error('[sse] 事件处理失败', event, err)
        }
      }
    }
  }
}
