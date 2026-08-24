const TOKEN_KEY = 'docs-collab-token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (token) => {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function describeBody(body, opts) {
  if (opts.form) {
    try {
      const f = body.get('file')
      return f ? `file="${f.name}" size=${f.size}B type=${f.type || '?'}` : '(empty form)'
    } catch {
      return '(form-data)'
    }
  }
  if (body === undefined) return '(no body)'
  const s = JSON.stringify(body)
  return s.length > 200 ? `${s.slice(0, 200)}…` : s
}

async function request(method, path, body, opts = {}) {
  const label = `${method} /api${path}`
  console.log(
    `%c[API] ➜ ${label}`,
    'color:#2563eb;font-weight:600',
    describeBody(body, opts),
  )

  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let payload
  if (opts.form) {
    payload = body
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  const started = performance.now()
  let res
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload })
  } catch (err) {
    const ms = Math.round(performance.now() - started)
    console.error(
      `%c[API] ✖ NETWORK FAIL ${label} after ${ms}ms — ${err.message}. Is the server running?`,
      'color:#dc2626;font-weight:bold',
    )
    throw new ApiError(0, `Network error — could not reach the server (${err.message})`)
  }

  const data = await res.json().catch(() => ({}))
  const ms = Math.round(performance.now() - started)

  if (!res.ok) {
    console.error(
      `%c[API] ✖ ${res.status} ${label} (${ms}ms) — ${data.error || 'request failed'}`,
      'color:#dc2626;font-weight:bold',
    )
    throw new ApiError(res.status, data.error || `Request failed (${res.status})`)
  }

  console.log(`%c[API] ✔ ${res.status} ${label} (${ms}ms)`, 'color:#16a34a;font-weight:600')
  return data
}

export const api = {
  login: (email) => request('POST', '/auth/login', { email }),
  me: () => request('GET', '/auth/me'),
  listUsers: () => request('GET', '/users'),
  listDocuments: () => request('GET', '/documents'),
  createDocument: (title) => request('POST', '/documents', { title }),
  getDocument: (id) => request('GET', `/documents/${id}`),
  updateDocument: (id, patch) => request('PATCH', `/documents/${id}`, patch),
  shareDocument: (id, email) => request('POST', `/documents/${id}/share`, { email }),
  exportDocument: (id) => request('GET', `/documents/${id}/export`),
  importFile: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return request('POST', '/import', fd, { form: true })
  },
}