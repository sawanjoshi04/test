# Architecture

## 1. Overview

Docs Collab is a small, boring, dependency-light document editor. A single Express process owns:

- the JSON API (`/api/*`),
- SQLite persistence (via Prisma),
- the built React UI (`client/dist`) in production.

There is no separate auth service, no message bus, no websockets. The whole product fits in one
repo and one process, which makes it easy to run, review, and deploy.

```
Browser
  │  HTTPS  ──►  Express (server.js)
  │                │
  │                ├── API routes (/api/auth, /api/documents, /api/import)
  │                │     └── auth middleware (Bearer token)
  │                │                └── Prisma  ──►  SQLite (dev.db)
  │                └── static client build (client/dist)   [prod only]
```

At dev time the frontend runs on Vite's own server (`:5173`) and proxies `/api/*` to `:4000` so the
same API code is exercised by both dev and prod.

---

## 2. Data model (Prisma)

```prisma
model User {           // seeded demo users; id doubles as an auth token (mock)
  id    String @id
  email String @unique
  name  String
  documents  Document[]
  access     DocumentAccess[]
}

model Document {       // a rich-text document
  id        String @id
  title     String @default("Untitled document")
  content   String @default("")   // ProseMirror JSON, or HTML after import
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  ownerId   String               // userId FK
  access    DocumentAccess[]
}

model DocumentAccess { // "shares" / grants
  id         String @id
  role       String @default("editor")   // only "owner"|"editor" used today
  documentId String
  userId     String
  @@unique([documentId, userId])
}
```

The `DocumentAccess` row is the ACL: it is the single place where "who can see/edit this document"
is decided. Owners are implicit (the `ownerId` column); editors come from `access` rows.

### Content format

- The editor persists **ProseMirror JSON** (Tiptap's `getJSON()`), stored in `Document.content`.
- The server treats `content` as an opaque string. This keeps the API tiny and lets the client
  change document formats without a migration.
- Import creates documents with **HTML** content (Markdown → HTML via `marked`). On the next save
  from the editor, Tiptap normalizes it to JSON. The UI already supports both.

Why JSON instead of HTML? Round-tripping rich text through Tiptap is more faithful with its native
format, and JSON avoids HTML-attribute serialization grime.

---

## 3. Auth model (mock, on purpose)

- Login takes only an **email** of a seeded user and returns `{ token: <userId> }`.
- Every protected request sends `Authorization: Bearer <userId>`.
- `requireAuth` looks the user up. There are no passwords, sessions, or refresh tokens.
- This is a deliberate product decision for a demo milestone, not a security prototype. Swapping in
  real auth later is a boundary change (login endpoint + token verification), not a re-write of the
  data layer.

Rationale: the assignment explicitly lists "seeded users, mocked auth, or very simple login" as
acceptable. It lets the reviewer test ownership + sharing in under a minute.

---

## 4. API summary

| Method | Path        | Who | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/login` | any | email → `{token, user}` |
| `GET`  | `/api/auth/me` | auth | current user |
| `GET`  | `/api/documents` | auth | `{owned:[], shared:[]}` split for the viewer |
| `POST` | `/api/documents` | auth | create (sets `ownerId`) |
| `GET`  | `/api/documents/:id` | auth+access | doc + `role` + `shares` for the share modal |
| `PATCH`| `/api/documents/:id` | auth+access | rename (owner), set `content` (owner or editor) |
| `POST` | `/api/documents/:id/share` | owner | grant an editor via email |
| `POST` | `/api/import` | auth | multipart `.txt`/`.md` → new doc (HTML) |

### Access control, one place

```
role = owner  if doc.ownerId === user.id
     = row.role of the DocumentAccess row for (doc, user) if present
     = null     otherwise
```

- `null`  → the endpoint answers `404` (same as "doesn't exist" — deliberately not `403`, so doc
  existence is not leaked).
- `editor` → content edits allowed; renames/sharing rejected with `403`.
- `owner`  → everything (rename + share + content).

This lives in `server/src/routes/documents.js` (`findDocumentFor` + `roleFor`) and is covered by the
integration tests in `tests/api.test.js`.

---

## 5. Frontend

A single `App.jsx` holds auth state, document list, active document, save status, toasts, and modal
visibility. Components:

- `LoginScreen` — demo user chooser (real login is a select, on purpose)
- `Sidebar` — Owned by me / Shared with me, active-doc highlight, mobile drawer
- `TopBar` — rename input, Import / Share actions, autosave pill, role badge, user switcher
- `Editor` — Tiptap instance + toolbar (B/I/U/S, H1–H3, P, •≡/1≡ lists, quote, undo/redo)
- `ShareModal`, `ImportModal` — owner flow + upload flow
- `Toasts` — error/success messages
- `api.js` — thin fetch wrapper; Bearer token from `localStorage`

### Autosave

Every keystroke produces an `onUpdate` → JSON string. The change is **debounced 700 ms** into a
`PATCH /api/documents/:id`, with a `Saving… → Saved` pill in the top bar. A failed save flips the
pill to red and fires a toast. The first editor `onUpdate` (document load) is suppressed so opening
a document does not touch the database.

#### Earlier, the original plan used a synchronous save on blur. Change: debounce + status pill.
Rationale: with only ~50 lines of extra code we get the "autosave indicator" P1 that reviewers often
probe, and it's less brittle on mobile.

## 5. Import

- Mutler uploads to memory (2 MB cap).
- A whitelist checks the extension: `.txt`, `.md`, `.markdown`.
- `.txt` → escaped `<p>` per line. `.md` → `marked.parse()` → HTML.
- New document row created with `ownerId = uploader`, and the client selects it immediately.

---

## 6. Tests

Vitest + Supertest, hitting `createApp()` (no network), with a throwaway SQLite
(`tests/setup.js` creates `server/test.db`, `afterAll` cleans it up).

8 tests:

1. login a seeded user + `/auth/me`
2. reject unknown emails + missing tokens → `401`
3. create → rename → edit content → reopen with content intact (`role=owner`)
4. empty title → `400`
5. sharing: share to reviewer → reviewer sees it under `shared` (and not `owned`), can
   read/edit content, cannot rename (`403`)
6. outsider (teammate) sees `404`
7. owner's share list contains the new grant
8. non-owner sharing → `403`

The access-control tests are the "meaningful automated test" required by the assignment; the
lifecycle test covers persistence.

---

## 7. Deployment

1. `cd client && npm install && npm run build` → produces `client/dist`
2. Start server with `DATABASE_URL` + `PORT` + client build present
3. On first boot: `prisma db push` + `npm run seed`

`server.js` serves `client/dist` as static assets and falls back to `index.html` for non-`/api`
GETs (required for browser refresh on any path). No reverse proxy, no environment secrets stored
in the repo.

### Exporting to a live host (sketch, used if provisioning)

- **Render (Free):** app `server.js` with `npm start`, DB `server/prisma/schema.prisma` pushes on
  boot, or a startup `npm run prisma:push && npm run seed`.
- **VPS:** `npm run prisma:push`, `npm run seed`, `npm run dev` behind nginx or the Express
  process directly.

---

## 8. Cut scope (and why)

| Cut | Reasoning |
|---|---|
| Real-time collaboration / websockets | out of scope explicitly; would need CRDT/OT merge |
| Comments, version history | explicitly out of scope |
| DOCX import | `mammoth` drags the bundle-size budget; only `.txt`/`.md` in milestone |
| Delete doc | the API has no `DELETE`; one route + one button would be the next 20 minutes |
| Viewer (read-only) role | barely more code, but shifts auth surface; leave for next round |
| Enterprise auth (OAuth/JWT sessions, passwords) | mock auth is a documented milestone call |
| ORM → raw SQL | Prisma type safety is worth it; SQLite keeps setup zero-config |

The next slice is scoped in SUBMISSION.md.

## 9. Traceability to spec

- P0 → P0 everything implemented + integration test
- P1 → autosave pill, role badge, validation toasts, empty states, responsive drawer
  all present in the shipped build.
- Out of scope → called out in README/SUBMISSION.

---

## 10. File map (short)

```
server/src/routes/documents.js   API: list/create/get/patch/share + ACL helper
server/src/routes/import.js      multer + md→html
server/src/middleware.js         Bearer token → req.user
server/tests/api.test.js         8 integration tests
client/src/App.jsx               shell: auth, lists, active doc, autosave, modals
client/src/components/Editor.jsx Tiptap editor + toolbar
client/src/components/Sidebar.jsx owned/shared lists
client/src/components/ShareModal.jsx  owner self-service sharing
```