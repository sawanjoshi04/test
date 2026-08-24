import { useEffect, useRef, useState } from 'react'
import { api, getToken, setToken } from './api.js'
import Toasts from './components/Toasts.jsx'
import LoginScreen from './components/LoginScreen.jsx'
import Sidebar from './components/Sidebar.jsx'
import TopBar from './components/TopBar.jsx'
import Editor from './components/Editor.jsx'
import ShareModal from './components/ShareModal.jsx'
import ImportModal from './components/ImportModal.jsx'

const appLog = (...args) => console.log('%c[APP]', 'color:#7c3aed;font-weight:bold', ...args)
const appWarn = (...args) => console.warn('%c[APP]', 'color:#d97706;font-weight:bold', ...args)
const appErr = (...args) => console.error('%c[APP]', 'color:#dc2626;font-weight:bold', ...args)

export default function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [owned, setOwned] = useState([])
  const [shared, setShared] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [active, setActive] = useState(null)
  const [initialContent, setInitialContent] = useState('')
  const [saveStatus, setSaveStatus] = useState('idle')
  const [toasts, setToasts] = useState([])
  const [showShare, setShowShare] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const saveTimer = useRef(null)
  const pending = useRef(null)
  const skipFirstUpdate = useRef(false)

  const toast = (message, tone = 'error') => {
    if (tone === 'success') appLog(`toast ✔ ${message}`)
    else appErr(`toast ✖ ${message}`)
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, tone }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200)
  }

  async function refresh() {
    appLog('refreshing document list…')
    const data = await api.listDocuments().catch((err) => {
      appErr('document list load failed:', err.message)
      toast('Could not load your documents.')
      return null
    })
    if (!data) return
    appLog(
      `documents loaded — owned: ${data.owned.length}, shared with me: ${data.shared.length}`,
      data.owned.map((d) => d.title),
      '| shared:', data.shared.map((d) => `${d.title} (by ${d.owner?.name})`),
    )
    setOwned(data.owned)
    setShared(data.shared)
  }

  useEffect(() => {
    if (!getToken()) {
      appLog('no saved session found → showing login screen')
      setAuthLoading(false)
      return
    }
    appLog('saved session found → verifying token with /auth/me…')
    api
      .me()
      .then((res) => {
        appLog(`session valid — welcome back, ${res.user.name} (${res.user.email})`)
        setUser(res.user)
        refresh()
      })
      .catch((err) => {
        appWarn('saved session is invalid — clearing it. reason:', err.message)
        setToken(null)
      })
      .finally(() => setAuthLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (user) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function login(email) {
    appLog(`sign-in attempt as "${email}"…`)
    try {
      const res = await api.login(email)
      setToken(res.token)
      setUser(res.user)
      appLog(`sign-in success — user: ${res.user.name} (${res.user.email}), id: ${res.user.id}`)
      await refresh()
    } catch (err) {
      appErr(`sign-in failed for "${email}":`, err.message)
      toast(err.message)
    }
  }

  function logout() {
    if (user) appLog(`user "${user.email}" signed out`)
    else appLog('signed out')
    setToken(null)
    setUser(null)
    setOwned([])
    setShared([])
    setActiveId(null)
    setActive(null)
    if (saveTimer.current) clearTimeout(saveTimer.current)
  }

  async function selectDoc(id) {
    appLog(`opening document ${id}…`)
    setActiveId(id)
    try {
      const doc = await api.getDocument(id)
      appLog(
        `document opened — title: "${doc.title}", role: ${doc.role}, owner: ${doc.owner?.email}, content: ${doc.content.length} chars`,
      )
      setInitialContent(doc.content)
      setActive(doc)
      setSaveStatus('idle')
      pending.current = null
      if (saveTimer.current) clearTimeout(saveTimer.current)
      skipFirstUpdate.current = true
    } catch (err) {
      appErr(`could not open document ${id}:`, err.message)
      toast(err.message)
      setActiveId((prev) => (prev === id ? null : prev))
      setActive(null)
    }
  }

  async function newDoc() {
    appLog('creating new document…')
    try {
      const { document } = await api.createDocument('Untitled document')
      appLog(`document created — id: ${document.id}, title: "${document.title}"`)
      await refresh()
      selectDoc(document.id)
    } catch (err) {
      appErr('create document failed:', err.message)
      toast(err.message)
    }
  }

  function queueAutosave(content) {
    if (!active) return
    pending.current = { id: active.id, content }
    setSaveStatus('saving')
    appLog(`autosave queued (${content.length} chars) for doc ${active.id} — saving in 700ms`)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(flushAutosave, 700)
  }

  async function flushAutosave() {
    const job = pending.current
    if (!job) return
    pending.current = null
    saveTimer.current = null
    appLog(`autosaving doc ${job.id} (${job.content.length} chars)…`)
    try {
      await api.updateDocument(job.id, { content: job.content })
      setSaveStatus('saved')
      appLog(`autosave complete ✔ doc ${job.id} saved`)
    } catch (err) {
      setSaveStatus('error')
      appErr(`autosave FAILED for doc ${job.id}:`, err.message)
      toast(err.message)
    }
  }

  function onContentChange(serialized) {
    if (skipFirstUpdate.current) {
      skipFirstUpdate.current = false
      appLog('editor initial content rendered (autosave skipped)')
      return
    }
    queueAutosave(serialized)
  }

  async function rename(title) {
    if (!active || title.trim() === active.title) return
    if (active.role !== 'owner') {
      appWarn(`rename blocked — role is "${active.role}", only owner can rename`)
      toast('Only the owner can rename this document.')
      return
    }
    appLog(`renaming doc ${active.id}: "${active.title}" → "${title.trim()}"`)
    try {
      const { document } = await api.updateDocument(active.id, { title })
      appLog(`rename complete ✔ now titled "${document.title}"`)
      setActive((prev) => ({ ...prev, title: document.title }))
      setOwned((prev) => prev.map((d) => (d.id === document.id ? { ...d, title: document.title } : d)))
      setShared((prev) => prev.map((d) => (d.id === document.id ? { ...d, title: document.title } : d)))
    } catch (err) {
      appErr('rename failed:', err.message)
      toast(err.message)
    }
  }

  async function share(email) {
    if (!active) return { ok: false, error: 'No document is open.' }
    appLog(`sharing doc "${active.title}" (${active.id}) with "${email}"…`)
    try {
      const res = await api.shareDocument(active.id, email)
      appLog(
        `share complete ✔ ${res.sharedWith.name} (${res.sharedWith.email}) is now an editor` +
          (res.createdNewUser ? ' — NEW user auto-created' : '') +
          (res.alreadyShared ? ' — was already shared' : ''),
      )
      setActive((prev) => ({
        ...prev,
        shares: [...(prev?.shares || []), { role: 'editor', user: res.sharedWith }],
      }))
      setShowShare(false)
      toast(`Shared with ${res.sharedWith.email}`, 'success')
      await refresh()
      return { ok: true }
    } catch (err) {
      appErr(`share FAILED for "${email}":`, err.message)
      if (err.status === 404 && String(err.message).includes('No user')) {
        return { ok: false, error: err.message }
      }
      toast(err.message)
      return { ok: false, error: err.message }
    }
  }

  async function importFile(file) {
    appLog(`importing file — name: "${file.name}", size: ${file.size}B, type: ${file.type || '?'}`)
    try {
      const { document } = await api.importFile(file)
      appLog(`import complete ✔ created doc "${document.title}" (id: ${document.id})`)
      toast('File imported', 'success')
      await refresh()
      selectDoc(document.id)
    } catch (err) {
      appErr(`import of "${file.name}" FAILED:`, err.message)
      toast(err.message)
    }
  }

  async function exportDoc() {
    if (!active) return
    appLog(`exporting "${active.title}" to markdown…`)
    try {
      const { markdown } = await api.exportDocument(active.id)
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(active.title || 'document').replace(/[^\w\d-]+/g, '_')}.md`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      appLog(`export complete ✔ ${a.download} (${markdown.length} chars)`)
      toast('Markdown exported', 'success')
    } catch (err) {
      appErr('export failed:', err.message)
      toast(err.message)
    }
  }

  if (authLoading) {
    appLog('checking session…')
    return (
      <div className="min-h-screen grid place-items-center bg-neutral-50">
        <p className="text-neutral-500">Checking your session…</p>
      </div>
    )
  }

  if (!user) {
    return <LoginScreen onLogin={login} />
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopBar
        active={active}
        saveStatus={saveStatus}
        user={user}
        onRename={rename}
        onNew={newDoc}
        onImport={() => {
          appLog('import dialog opened')
          setShowImport(true)
        }}
        onExport={exportDoc}
        onShare={() => {
          appLog(`share dialog opened for "${active?.title}"`)
          setShowShare(true)
        }}
        onMenuToggle={() => setSidebarOpen((o) => !o)}
        onLogout={logout}
      />

      <div className="flex-1 min-h-0 flex md:flex-row">
        <Sidebar
          open={sidebarOpen}
          owned={owned}
          shared={shared}
          activeId={activeId}
          onSelect={selectDoc}
          onNew={newDoc}
          onCloseSidebar={() => setSidebarOpen(false)}
        />

        <main className="flex-1 min-w-0 min-h-0 bg-neutral-50 overflow-y-auto">
          {active ? (
            <Editor
              key={active.id}
              initialContent={initialContent}
              role={active.role}
              onContentChange={onContentChange}
            />
          ) : (
            <EmptyState onNew={newDoc} />
          )}
        </main>
      </div>

      {showShare && active && (
        <ShareModal doc={active} user={user} onShare={share} onClose={() => setShowShare(false)} />
      )}
      {showImport && <ImportModal onImport={importFile} onClose={() => setShowImport(false)} />}
      <Toasts toasts={toasts} />
    </div>
  )
}

function EmptyState({ onNew }) {
  return (
    <div className="h-full grid place-items-center px-6">
      <div className="max-w-md text-center">
        <div className="text-5xl mb-3">📄</div>
        <h2 className="text-xl font-semibold text-neutral-800">No document selected</h2>
        <p className="mt-2 text-neutral-500">
          Pick a document from the sidebar, or start something fresh.
        </p>
        <button
          onClick={onNew}
          className="mt-6 px-4 py-2 bg-brand text-white rounded-lg hover:bg-indigo-600 font-medium"
        >
          + New document
        </button>
      </div>
    </div>
  )
}