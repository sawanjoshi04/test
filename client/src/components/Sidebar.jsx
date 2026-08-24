function timeAgo(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function DocItem({ doc, active, onClick }) {
  return (
    <button
      onClick={onClick}
      title={`${doc.title} · updated ${timeAgo(doc.updatedAt)}`}
      className={`w-full text-left px-3 py-1.5 rounded-lg text-sm truncate ${
        active ? 'bg-indigo-100 text-indigo-900 font-medium' : 'text-neutral-700 hover:bg-neutral-100'
      }`}
    >
      <span className="truncate">{doc.title || 'Untitled document'}</span>
      {doc.owner && (
        <span className="ml-1 text-neutral-400 text-xs">· by {doc.owner.name}</span>
      )}
    </button>
  )
}

export default function Sidebar({ open, owned, shared, activeId, onSelect, onNew, onCloseSidebar }) {
  return (
    <>
      <aside className={`w-64 ${open ? 'translate-x-0' : '-translate-x-full'} h-full overflow-y-auto bg-white border-r border-neutral-200 md:translate-x-0 md:static`}>
        <div className="px-3 py-3 flex items-center justify-between">
          <button
            onClick={onNew}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-indigo-600"
          >
            <span className="text-lg leading-none">+</span> New doc
          </button>
          <button
            onClick={onCloseSidebar}
            className="md:hidden text-neutral-400 text-xs px-2 py-1 rounded hover:bg-neutral-100"
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>
        <p className="px-3 text-xs font-medium text-neutral-400 uppercase tracking-wide pt-1">Owned by me</p>
        <div className="px-1.5 py-1">
          {owned.length === 0 ? (
            <p className="px-3 py-2 text-sm text-neutral-400">Nothing yet. Create one.</p>
          ) : (
            owned.map((d) => (
              <DocItem key={d.id} doc={d} active={d.id === activeId} onClick={() => onSelect(d.id)} />
            ))
          )}
        </div>
        <p className="px-3 text-xs font-semibold text-neutral-400 uppercase tracking pt-2 mt-2">Shared with me</p>
        <div className="px-1 space-y-2">
          {shared.length === 0 ? (
            <p className="px-3 py-2 text-sm text-neutral-400 pt-1">Nothing shared with you yet.</p>
          ) : (
            shared.map((d) => (
              <DocItem key={d.id} doc={d} active={d.id === activeId} onClick={() => onSelect(d.id)} />
            ))
          )}
        </div>
      </aside>
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-30 md:hidden"
          onClick={onCloseSidebar}
          aria-label="Close sidebar overlay"
        />
      )}
    </>
  )
}