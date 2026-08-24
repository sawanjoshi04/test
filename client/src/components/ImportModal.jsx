import { useRef, useState } from 'react'

const ACCEPTED = ['.txt', '.md', '.markdown']

export default function ImportModal({ onImport, onClose }) {
  const inputRef = useRef(null)
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    const file = inputRef.current?.files?.[0]
    if (!file) return
    setBusy(true)
    await onImport(file)
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onClose}>
      <form
        className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-neutral-200 p-5"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h2 className="text-lg font-semibold text-neutral-900">Import a document</h2>
        <p className="text-sm text-neutral-500 mt-1">
          Convert a plain-text or Markdown file into a new document. Supported types:{' '}
          <span className="font-mono">.txt</span>, <span className="font-mono">.md</span>,{' '}
          <span className="font-mono">.markdown</span> — max 2 MB.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          onChange={(e) => setFileName(e.target.files?.[0]?.name || '')}
          className="mt-4 block w-full text-sm text-neutral-500"
        />
        <p className="mt-1 text-xs text-neutral-400 truncate">
          {fileName || 'Choose a file to import'}
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-600 text-sm hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !fileName}
            className="px-4 py-2 rounded-lg bg-brand text-white text-sm disabled:opacity-50"
          >
            {busy ? 'Importing…' : 'Import & open'}
          </button>
        </div>
      </form>
    </div>
  )
}