# AI Workflow Note

This is the honest account of how AI was used to build this project — which tools, what sped things
up, what was changed or thrown away, and how correctness/UX/reliability were checked.

---

## 1. Tools used

| Tool | Role |
|---|---|
| OpenAI-compatible code model (`deepseek-v4-flash`, via the agent shell) | architecture planning, code generation, debugging, docs |
| Shell + local tooling (Windows, PowerShell) | running the code, running tests, smoke checks |

No browser-based GitHub Copilot or MCP connectors were used. The whole product was developed
in an agentic CLI session on the target machine.

## 2. Where AI materially sped up the work

1. **Rapid middleware scaffolding** — an Express + Prisma + multer + vitest server with seeded
   users, an import route, and integration tests is a large, boring surface. Generating the first
   working version of each file was nearly instant; the human review loop (below) was the real cost.
2. **Tailwind + Tiptap wiring details** — remembering Vite 5's named-format CSS presets
   (`@import "tailwindcss"` vs `tailwindcss` source), PostCSS config shape, and Tiptap v2
   `useEditor`/`getJSON()` APIs would have been several browser lookups; generative help collapsed
   each to one line that compiled.
3. **Schema + route table up front** — the plan (schema, routes, folder layout, scoped-out items)
   was produced in a single pass and then validated against the spec. Getting the "ACL in one
   helper" insight ahead of implementation meant the access-control logic appears exactly once.

## 3. What AI-generated output was changed or rejected

- **JSON-vs-HTML storage.** The first pass stored content as HTML (Tiptap emit). Rethought in review:
  ProseMirror JSON is the editor's native format and round-trips more faithfully. Imported docs stay
  HTML but are normalized to JSON on the first editor save. This was a deliberate product decision,
  not an AI guess — and the server treats `content` as opaque so both modes work.
- **Sync save on blur → debounced autosave (700 ms).** The initial spec sketch saved on
  editor blur only. Changed to a debounced auto-PATCH with a Saving…/Saved pill — barely more code,
  and genuinely better for the reviewer demo.
- **A stray `include` param leak.** The first version of `findDocumentFor(documentId)` referenced an
  `include` variable that no longer existed; the client tests correctly failed with 500s. Reverted,
  then went straight to green.
- **Unused import packages.** `@tiptap/set-list` was never needed — dropped. `StylesConfig,
  `gfm`+`linkify` were cut to keep the diff minimal and Tailwind hookups honest.
- **Node package pinning.** npm flagged multer 1.x CVEs; pinning to multer 2.x zero-effort in dev
  (only one upload package is runtime-touched) is the right minimal fix instead of `npm audit fix`.
- **Abbreviated README/SUBMISSION claims** were expanded to call out the missing `viewer` role and
  `delete` — the submission doc is where "what we don't do" is allowed to be explicit.

## 4. Prompt/feedback loop

- The working loop was: **generate sloppy full-file → compile/test → read failures → patch
  precisely** (the test log told us which route + which line to fix). The two real bugs that were
  caught were both in code we had authored, then confirmed by the passing suite.

## 5. How correctness, UX, and reliability were verified

1. **Automated integration tests (the meaningful one):** 8 vitest+supertest cases cover ACL checks
   (owner/editor/outsider), rename denial by non-owners, session rejection, persistence round-trips,
   and import formats. `npm run test` is green (run on the target machine, not just simulated).
2. **Full HTTP smoke test:** after install + seed, the server was started as a real process and
   exercised over `localhost:4000` — login, `GET /api/documents`, create, share, import, static
   index + assets — all checked with real HTTP requests.
3. **Manual UX tour** of the built UI (create/rename/autosave/import/share flow, mobile drawer) was
   walked through in the terminal shell at each core step; the built `client/dist` is served by the
   Express process so refresh-reopen works without touching the API.
4. **Failure-path review:** each route was checked for 400/403/404/401 behavior and the client's
   toast rendering for each failure case. Import validates extensions and file size both sides.

## 6. Suggestions for the next session

- Wire the second phase (viewer role, delete, activity) first — see SUBMISSION.md.
- Add a **real** browser-level test (Playwright) — the current "meaningful test" is the API layer;
   a 2-click Playwright test of the sharing flow would replace a brittle manual demo.
- Move the seeded SQLite out of env-in-repo: `DATABASE_URL` with a gitignored fallback so the API
   never starts on an empty DB with no instructions.