import { useState } from 'react'

const DEMO_USERS = [
  { email: 'sawan@ajaia.local', name: 'Sawan Marre', color: 'bg-indigo-500' },
  { email: 'reviewer@ajaia.local', name: 'Alias Reviewer', color: 'bg-emerald-500' },
  { email: 'teammate@ajaia.local', name: 'Dev Dass', color: 'bg-amber-500' },
]

export default function LoginScreen({ onLogin }) {
  const [busy, setBusy] = useState(null)
  const [email, setEmail] = useState('')

  async function pick(loginEmail) {
    if (!loginEmail || busy) return
    setBusy(loginEmail)
    await onLogin(loginEmail)
    setBusy(null)
  }

  function submit(e) {
    e.preventDefault()
    pick(email.trim().toLowerCase())
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      <div className="flex-1 grid place-items-center px-6 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="text-4xl">📝</div>
            <h1 className="text-3xl font-bold text-neutral-900 mt-2">Docs Collab</h1>
            <p className="text-neutral-500 mt-2">A tiny collaborative document editor for review.</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
            <h2 className="font-semibold text-neutral-800">Sign in (demo — no passwords)</h2>

            <div className="mt-4 grid gap-2">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.email}
                  onClick={() => pick(u.email)}
                  disabled={busy !== null}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-neutral-200 bg-white hover:border-indigo-300 hover:shadow-sm text-left transition disabled:opacity-60"
                >
                  <span className={`h-8 w-8 rounded-full ${u.color} text-white grid place-items-center text-sm`}>
                    {u.name.charAt(0)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium text-neutral-800">{u.name}</span>
                    <span className="block text-sm text-neutral-500 truncate">{u.email}</span>
                  </span>
                  {busy === u.email ? (
                    <span className="text-neutral-400 text-sm">Signing in…</span>
                  ) : (
                    <span className="text-brand">→</span>
                  )}
                </button>
              ))}
            </div>

            <div className="my-4 flex items-center gap-3">
              <span className="flex-1 h-px bg-neutral-200" />
              <span className="text-xs text-neutral-400">or</span>
              <span className="flex-1 h-px bg-neutral-200" />
            </div>

            <form onSubmit={submit} className="flex gap-2">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="any@email.com that was shared a doc"
                type="email"
                className="flex-1 border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-indigo-300"
              />
              <button
                type="submit"
                disabled={!email.trim() || busy !== null}
                className="px-4 py-2 rounded-lg bg-brand text-white text-sm disabled:opacity-50"
              >
                Sign in
              </button>
            </form>

            <p className="text-xs text-neutral-400 mt-4">
              Demo users are listed above. Any other email works only after someone shares a
              document with it.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}