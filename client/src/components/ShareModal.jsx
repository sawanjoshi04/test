import { useEffect, useState } from 'react'
import { api } from '../api.js'

export default function ShareModal({ doc, onShare, onClose }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [users, setUsers] = useState([])
  const isOwner = doc.role === 'owner'

  useEffect(() => {
    if (!isOwner) return
    api
      .listUsers()
      .then((res) => setUsers(res.users.filter((u) => u.id !== doc.owner?.id)))
      .catch(() => setUsers([]))
  }, [isOwner, doc.owner?.id])

  async function share(target) {
    const val = (target ?? email).trim().toLowerCase()
    if (!val || busy) return
    setBusy(true)
    setError('')
    const result = await onShare(val)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setEmail('')
  }

  function submit(e) {
    e.preventDefault()
    share()
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-neutral-200 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-neutral-900">Share “{doc.title}”</h2>
        <p className="text-sm text-neutral-500 mt-1">
          Owners can add demo users as editors. Editors can edit content but cannot rename or share.
        </p>

        {isOwner ? (
          <>
            <form onSubmit={submit} className="mt-3 flex gap-2">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="reviewer@ajaia.local"
                className="flex-1 border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-indigo-300"
              />
              <button
                type="submit"
                disabled={busy || !email.trim()}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm disabled:opacity-50"
              >
                {busy ? 'Adding…' : 'Share'}
              </button>
            </form>

            {users.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-neutral-400 uppercase mb-1.5">
                  Demo users — click to share
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {users.map((u) => {
                    const already = (doc.shares || []).some((s) => s.user.id === u.id)
                    return (
                      <button
                        key={u.id}
                        type="button"
                        disabled={busy || already}
                        onClick={() => share(u.email)}
                        title={already ? 'Already has access' : u.email}
                        className={`px-2.5 py-1 rounded-full text-xs border ${
                          already
                            ? 'border-neutral-200 bg-neutral-100 text-neutral-400 cursor-default'
                            : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                        }`}
                      >
                        {already ? '✓ ' : '+ '}
                        {u.email}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm text-neutral-600">
            You are an <b>editor</b> here. Only <b>{doc.owner?.name}</b> can add new people.
          </p>
        )}

        {error && (
          <p className="mt-3 text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="mt-4">
          <p className="text-xs font-medium text-neutral-400 uppercase mb-1.5">People with access</p>
          <ul className="space-y-1.5">
            <li className="flex items-center gap-2 text-sm">
              <span className="h-6 w-6 rounded-full bg-indigo-200 text-indigo-700 grid place-items-center text-xs">
                {doc.owner?.name?.charAt(0) || 'O'}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium text-neutral-700">
                {doc.owner?.name} <span className="text-neutral-400 font-normal">({doc.owner?.email})</span>
              </span>
              <span className="text-neutral-400 text-sm">Owner</span>
            </li>
            {(doc.shares || []).map((s) => (
              <li key={s.user.id} className="flex items-center gap-2 text-sm">
                <span className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-600 grid place-items-center text-xs">
                  {s.user.name?.charAt(0) || '?'}
                </span>
                <span className="min-w-0 flex-1 truncate">{s.user.name}</span>
                <span className="text-neutral-500 text-xs">Editor</span>
              </li>
            ))}
            {(doc.shares || []).length === 0 && (
              <li className="text-sm text-neutral-400">No one yet — it is private to you.</li>
            )}
          </ul>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-600 text-sm hover:bg-neutral-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}