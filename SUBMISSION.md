# Submission

## What is included

A complete, runnable, single-repo collaborative document editor:

- **Server** — Express + Prisma + SQLite. Routes: auth (mock, email-only login), documents
  (list/create/get/patch/share), import (`.txt`/`.md`/`.markdown` via multer + `marked`), health.
- **Client** — React + Vite + Tailwind + Tiptap. Sidebar (Owned by me / Shared with me), top bar
  with rename + autosave pill + Import + Share, Tiptap toolbar (B/I/U/S, H1–H3/P, bullet/numbered
  lists, quote, undo/redo), share modal, import modal, toasts, mobile-drawer responsive layout.
- **Seed** — 3 demo users + a starter doc pre-shared with `reviewer@ajaia.local`.
- **Tests** — 8 integration tests (Vitest + Supertest vs a throwaway SQLite).
- **Docs** — this file, README.md, ARCHITECTURE.md, AI_WORKFLOW.md, walkthrough-video.txt.

## Live URL

**Not deployed yet — action needed before submission.** The app is a single Node process
(`server.js` serves `client/dist`) and deploys to Render's free tier in ~10 minutes; exact settings
are in [README.md → Deploying](./README.md#deploying). No paid dependency is required.
After deploying, paste the URL here and into `walkthrough-video.txt`.

## Screenshots

Five screenshots (login, editor + autosave, share modal, import, reviewer's shared view) are in
[`docs/screenshots/`](./docs/screenshots) and embedded in the README. Setup needs no extra steps,
so no demo GIF is required.

## Test credentials / seeded users

| Email | Name | Notes |
|---|---|---|
| `sawan@ajaia.local` | Sawan Maranker | demo owner; owns "Getting started" |
| `reviewer@ajaia.local` | Celia Reviewer | demo editor; has access to "Getting started" |
| `teammate@ajaia.local` | Dev Dass | demo outsider; no documents pre-shared |

Login = pick a user in the demo chooser, or type any email in the input box. The three users above
are seeded; sharing a document to an unknown email auto-registers that user, who can then sign in
with it (mock token = user id; no passwords).

## What works

- Create, rename, edit, persist, reopen documents (autosave pill, refresh-safe).
- Rich text: bold, italic, underline, strike, H1–H3, body, bullet + numbered lists, quote, undo/redo.
- Import `.txt`, `.md`, `.markdown` as a **new document** with converted HTML (kept as HTML until
  the next editor save).
- Share flow: owner shares via **demo-user chips or any typed email**; unknown emails are
  auto-created and can sign in immediately. The doc moves to that user's "Shared with me";
  editors can edit but cannot rename/share; outsiders get "Document not found".
- Clear owned/shared separation, active-doc highlight, role badge, empty states, toasts,
  mobile drawer, "won't let you rename if you're an editor" guard on the client side.
- API validation and consistent 400/401/403/404 JSON errors.

## What is incomplete

- **No delete.** No `DELETE /api/documents/:id` and no UI trash action. This was intentionally
  scoped to P1+ and explicitly cut.
- **No viewer/read-only role.** All shared users are editors; `role` column exists with the
  `viewer` string supported in the DB but not enforced by routes/UI.
- **No DOCX import** (only `.txt`/`.md`; stated in UI + README as allowed by the assignment).
- **No real-time collaboration, comments, or version history.**
- **Auth is demo.** Tokens are user ids; anyone can impersonate a seeded user from a client that
  knows the id. Fine for evaluation, a hard no in production.
- **Import surface**: plain-text + final-Markdown only (no tables, no images embed).

## What I would build next (2–4 more hours)

1. **Delete support** (`DELETE /api/documents/:id`, owner-only) + a small "…" menu per doc — large
   perceived-value gain for a reviewer.
2. **Viewer role**: add `viewer` to schema, ACL, share modal (owner picks "Can edit / comment /
   viewer"), read-only editor UI. The `role` string is already in the DB; this is mostly wiring.
3. **Activity + presence strip** ("alice@… is viewing" + last-edited) — the cheapest 80% of
   "collaboration" without CRDT complexity.
4. **One-click export**: PDF / Markdown export of the doc (Markdown export is ~30 lines on top of
   ProseMirror JSON).
5. **A Playwright test** to drive the sharing flow in a real browser — replaces the manual walk
   and shuts more doors than the current API test.
6. **.env-based seed-of-docs**: seed a second demo doc owned by `reviewer` so the reviewer sees
   both "Shared with me" seed zero-state and cross-owner lists.

## Notes to the reviewer

- The P0 list from the assignment is 100% done — the automated-test requirement lands on the
  asymmetric ACL tests in `tests/api.test.js` plus the lifecycle test.
- P1 autosave indicator, role badge, validation toasts, empty states, responsive layout are in.
- The whole codebase is ~2k LOC including whitespace, and the server + UI together run on one port,
  which is the whole point of "boring and reliable".