import { useEffect, useRef, useState } from 'react'

const SAVE_LABELS = {
  idle: { text: '', cls: '' },
  saving: { text: 'Saving…', cls: 'text-amber-700 bg-amber-50' },
  saved: { text: 'Saved', cls: 'text-emerald-700 bg-emerald-50' },
  error: { text: 'Save failed', cls: 'text-red-700 bg-red-50' },
}

export default function TopBar({ active, saveStatus, user, onRename, onNew, onImport, onExport, onShare, onMenuToggle, onLogout }) {
  const [title, setTitle] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => setTitle(active?.title || ''), [active?.id])

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function commitTitle() {
    if (onRename) onRename(title)
  }

  const pill = SAVE_LABELS[saveStatus] || SAVE_LABELS.saving

  return (
    <header className="h-14 bg-white border-b border-neutral-200 flex items-center gap-2 px-3">
      <button
        onClick={onMenuToggle}
        className="md:hidden text-neutral-500 px-2 py-1 rounded hover:bg-neutral-100"
        aria-label="Toggle sidebar"
      >
        ☰
      </button>
      <div className="font-semibold text-brand tracking-tight hidden md:flex mr-2">
        Docs<span className="text-neutral-400">Collab</span>
      </div>

      {active && (
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <input
            value={title}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 max-w-md bg-transparent border-none focus:outline-none focus:border-b border-neutral-300 font-medium text-neutral-900"
            aria-label="Document title"
          />
          {saveStatus !== 'idle' && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${pill.cls}`}>{pill.text}</span>
          )}
          {active.role && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                active.role === 'owner'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-sky-100 text-sky-700'
              }`}
            >
              {active.role === 'owner' ? 'Owner' : 'Editor'}
            </span>
          )}
        </div>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        {!active && (
          <button onClick={onNew} className="px-3 py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-indigo-600">
            + New doc
          </button>
        )}
        <button onClick={onImport} className="px-3 py-1.5 rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-100 text-sm">
          Import
        </button>
        <button
          onClick={onExport}
          disabled={!active}
          className={`px-3 py-1.5 rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-100 text-sm ${
            !active ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          Export .md
        </button>
        <button
          onClick={onShare}
          disabled={!active}
          className={`px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 ${
            !active ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          Share
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o) }}
            className="px-2.5 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-sm font-medium text-neutral-700 flex items-center gap-1"
            aria-label="Current user"
          >
            {user.name.split(' ')[0]}
            <svg className={`w-3 h-3 transition-transform ${menuOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 w-64 rounded-xl border border-neutral-200 bg-white shadow-lg p-3 z-40">
              <p className="text-sm font-medium text-neutral-800">{user.name}</p>
              <p className="text-xs text-neutral-500 mb-3">{user.email}</p>
              <button
                onClick={onLogout}
                className="w-full text-left text-sm text-red-600 hover:bg-red-50 rounded-lg px-2 py-1.5 flex items-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd" />
                  <path fillRule="evenodd" d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-.943a.75.75 0 10-1.004-1.114l-2.5 2.25a.75.75 0 000 1.114l2.5 2.25a.75.75 0 101.004-1.114l-1.048-.943h9.546A.75.75 0 0019 10z" clipRule="evenodd" />
                </svg>
                Logout / switch user
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}