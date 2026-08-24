import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'

function parseInitial(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return undefined
  if (raw.trim().startsWith('{')) {
    try {
      return JSON.parse(raw)
    } catch {
      return raw
    }
  }
  return raw
}

function Tool({ editor, isActive, onClick, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onClick(editor)}
      title={title}
      className={`h-8 min-w-7 px-2 rounded-lg text-sm font-semibold ${
        isActive ? 'bg-indigo-200 text-indigo-900' : 'text-neutral-600 hover:bg-neutral-100'
      }`}
    >
      {children}
    </button>
  )
}

function Toolbar({ editor }) {
  if (!editor) return null
  return (
    <div className="flex flex-wrap gap-1 items-center border-b border-neutral-200 bg-white px-3 py-1.5 sticky top-0 z-10">
      <Tool editor={editor} isActive={editor.isActive('bold')} onClick={(e) => e.chain().focus().toggleBold().run()} title="Bold (Ctrl+B)">
        <b>B</b>
      </Tool>
      <Tool editor={editor} isActive={editor.isActive('italic')} onClick={(e) => e.chain().focus().toggleItalic().run()} title="Italic (Ctrl+I)">
        <i>I</i>
      </Tool>
      <Tool editor={editor} isActive={editor.isActive('underline')} onClick={(e) => e.chain().focus().toggleUnderline().run()} title="Underline (Ctrl+U)">
        <u>U</u>
      </Tool>
      <Tool editor={editor} isActive={editor.isActive('strike')} onClick={(e) => e.chain().focus().toggleStrike().run()} title="Strikethrough">
        <s>S</s>
      </Tool>

      <span className="w-px h-6 bg-neutral-200 mx-1" />

      <Tool editor={editor} isActive={editor.isActive('paragraph')} onClick={(e) => e.chain().focus().setParagraph().run()} title="Body text">
        P
      </Tool>
      <Tool editor={editor} isActive={editor.isActive('heading', { level: 1 })} onClick={(e) => e.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1">
        H1
      </Tool>
      <Tool editor={editor} isActive={editor.isActive('heading', { level: 2 })} onClick={(e) => e.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">
        H2
      </Tool>
      <Tool editor={editor} isActive={editor.isActive('heading', { level: 3 })} onClick={(e) => e.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">
        H3
      </Tool>

      <span className="w-px h-6 bg-neutral-200 mx-1" />

      <Tool editor={editor} isActive={editor.isActive('bulletList')} onClick={(e) => e.chain().focus().toggleBulletList().run()} title="Bullet list">
        •≡
      </Tool>
      <Tool editor={editor} isActive={editor.isActive('orderedList')} onClick={(e) => e.chain().focus().toggleOrderedList().run()} title="Numbered list">
        1≡
      </Tool>
      <Tool editor={editor} isActive={editor.isActive('blockquote')} onClick={(e) => e.chain().focus().toggleBlockquote().run()} title="Quote">
        ❝
      </Tool>

      <span className="w-px h-6 bg-neutral-200 mx-1" />

      <Tool editor={editor} isActive={false} onClick={(e) => e.chain().undo().run()} title="Undo">
        ↶
      </Tool>
      <Tool editor={editor} isActive={false} onClick={(e) => e.chain().redo().run()} title="Redo">
        ↷
      </Tool>
    </div>
  )
}

export default function Editor({ initialContent, onContentChange }) {
  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: parseInitial(initialContent),
    onUpdate: ({ editor }) => {
      console.log(
        '%c[EDITOR] content updated',
        'color:#0891b2;font-weight:600',
        `— ${editor.getText().length} chars`,
      )
      onContentChange?.(JSON.stringify(editor.getJSON()))
    },
    onCreate: ({ editor }) => {
      console.log(
        '%c[EDITOR] initialized ✔',
        'color:#0891b2;font-weight:600',
        `${editor.getText().length} chars loaded`,
      )
      editor.commands.focus('start')
    },
    onDestroy: () => console.log('%c[EDITOR] destroyed', 'color:#0891b2'),
  })

  return (
    <div className="bg-white rounded-lg shadow-sm border border-neutral-200 max-w-3xl mx-auto my-6 flex flex-col">
      <Toolbar editor={editor} />
      <div className="px-6 pt-1 pb-8">
        <EditorContent editor={editor} className="min-h-72 outline-none" />
      </div>
    </div>
  )
}