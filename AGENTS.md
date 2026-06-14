# pi++

pi++ coding agent web workspace — code, explore, and build with your local AI.

## Stack

- Next.js 16 (Turbopack) + React 19
- Tailwind CSS 4 + CSS custom properties in `packages/web/app/globals.css`
- TypeScript strict mode
- npm workspaces
- Pi 0.79+ CLI as the agent backend

## Structure

```text
packages/web/                  # Next.js app, port 31508
packages/web/lib/agents/       # Pi agent discovery, registry, spawn adapter
packages/web/lib/skills/       # Skill scanner and marketplace
packages/web/components/       # Main UI components
packages/web/app/api/pi/       # Pi-specific APIs (model, sessions, version)
```

## Main APIs

- `GET /api/agents` discovers Pi binary.
- `POST /api/agent/chat` streams agent replies over SSE.
- `POST /api/agent/stop` stops the active agent process.
- `GET /api/files?path=X` reads file trees or file content.
- `GET /api/pi/model` returns current default model.
- `GET /api/pi/models` lists all available models via `pi --list-models`.
- `POST /api/pi/models` sets default model or toggles scoped model.
- `GET /api/pi/sessions` lists Pi CLI sessions for current workspace.
- `GET /api/pi/version` checks Pi version + npm latest.
- `GET /api/skills?agent=pi` lists installed skills.
- `POST /api/skills` toggles or installs skills.

## Design Tokens

Pi green accent: `oklch(72% 0.12 175)`.
All buttons: green border + green text + transparent background + square corners.
Three-panel header height: 42px unified.

## Important Patterns

- Chat uses SSE streaming with `TransformStream` and `writer.write()`.
- `ref + rAF` bypasses React 18 batching for real-time counters.
- Client components must not import the `@/lib/agents` barrel — it pulls in `node:child_process`. Import directly from `@/lib/agents/registry` or `@/lib/agents/types`.
- Conversation history is stored in `localStorage` and scoped by workspace.
- Auto-create conversations only when `messages.length > 0`.
- Scrollable flex layouts need `flex-1 min-h-0` and constrained children.
- Theme and font scale initialize before paint to avoid flicker.
- `useState` lazy init with `localStorage` causes hydration mismatch — init with SSR-safe default, load in `useEffect`.
- CSS `:root` defaults to dark, `[data-theme="light"]` overrides. All layers must agree on the default.
- Text arbitrary values use `px` not `rem` — for scalable text, use CSS custom properties with `calc()`.

## Race Conditions

- `stdout.on('data')` → push + resolveWait pattern needs double-check after setting promise.
- Without the re-check, data between yield and next await gets stuck until next data event.

## Commands

```bash
npm run dev           # http://localhost:31508
npm run build         # Production build
npm run start         # Production server
```

## Persistent Server

- launchd config: `~/Library/LaunchAgents/com.pi-plus-plus.server.plist`
- port: `31508`
- logs: `~/.local/log/pi-plus-plus.log` and `~/.local/log/pi-plus-plus.err.log`
- after production changes: `npm run build`, then restart launchd service.

## Missing Pi CLI Features (TODOs)

Pi CLI has features that agents-web doesn't implement yet. Listed by priority:

### 1. ✅ Session Tree / Branching
Pi's `/tree`, `/fork`, `/clone` let you navigate a tree of conversation branches, fork from any point, and switch between branches — all in a single `.jsonl` file.

**Implemented:**
- `GET /api/pi/session/tree?id=X&workspace=Y` — parses `.jsonl` file by `id`/`parentId`, returns hierarchical tree with summaries
- `POST /api/pi/sessions` (action: `branch`) — calls `pi --fork` to create branched session
- `SessionTreeView` component: collapsible tree with role-colored dots, leaf highlight, Branch button on hover
- Integrated into Settings → 会话 → View button

### 2. ✅ Compaction (Context Compression)
`/compact` summarizes older messages when the context window fills up. Pi also does auto-compaction on overflow.

**Pi events:** `compaction_start` / `compaction_end` with reason (`manual`, `threshold`, `overflow`) and result.
**Implemented:** Manual compact button (messages ≥4, sends `/compact`), auto-trigger token % display (60%+ yellow, 80%+ red), compaction events shown as spinner/toast.

### 3. Message Queue (Steering / Follow-up)
Pi emits `queue_update` with pending `steering[]` and `followUp[]` message queues. agents-web ignores these entirely.

**What's needed:** Listen to `queue_update` events, show pending follow-up actions, let user approve/reject.

### 4. Pi Settings Management
Pi has `~/.pi/agent/settings.json` (global) and `.pi/settings.json` (project-level) for provider, tools, model cycling, trust, telemetry, etc. agents-web's SettingsModal doesn't read or write Pi's settings.json.

**What's needed:** API to read/write settings.json, UI for provider config, tool toggles, default model, trust settings.

### 5. ✅ Context Files (AGENTS.md / CLAUDE.md)
Pi loads `AGENTS.md` / `CLAUDE.md` from `~/.pi/agent/` (global), parent directories, and cwd.

**Implemented:** `GET /api/pi/context-files?workspace=X` scans global + project + parent dirs. `ContextFilesIndicator` component shows collapsible list above chat with file preview modal.

### 6. ✅ Package Management
Pi supports `pi install`, `pi remove`, `pi update`, `pi list` for extensions, themes, prompt templates, and skills.

**Implemented:**
- `GET /api/pi/packages` — lists installed packages with metadata from `settings.json` + `package.json`
- `POST /api/pi/packages` — install/remove/update via `pi install/remove/update` CLI
- Settings → 包 Tab: install form, package list, update/remove buttons, global update

### 7. Session Export
`pi --export <id> [out]` exports a session to HTML. agents-web has no export feature.

**What's needed:** Export button that calls `pi --export` and serves the HTML file.

## Changelog

### 2026-06-14 — `/skill` Command, Skill Install from URL, Project-Level Skills

**Skill install from GitHub URL:**
- Settings → 技能 → 输入 GitHub URL → Install → `git clone --depth=1` to `~/.pi/agent/skills/`
- Only full repo URLs (`github.com/user/repo`) trigger clone; sub-paths and non-URLs reject with clear error

**`/skill` command in chat:**
- Type `/skill` in ChatInput → dropdown of installed skills → select to enable/disable for current project
- Active skills shown as ⚡ tags below input; click × to remove
- Writes full paths to `.pi/settings.json` skills array (bidirectional with pi CLI)

**Settings → 技能 redesign:**
- Removed Pi badge and global toggle switch
- `已安装 | 市场` tabs: installed shows URL install + list with 🔄 update / 🗑 delete (hover), marketplace shows verified installable skills
- Delete: spinner animation, error alert on failure

**Bidirectional fix: project skills paths** — app now writes `~/.pi/agent/skills/<id>` full paths to `.pi/settings.json`, reads both paths and bare IDs. pi CLI recognizes full paths.

**Marketplace cleanup:** removed stub-only items (superpowers/community/subdirectory URLs), kept only standalone repos that actually clone.

**Design principle #6: App ↔ CLI bidirectional** — app reads/writes Pi's native files, never maintains separate registry.

### 2026-06-12 — Sidebar Sort, Pi Block Sync, On-Demand Messages, "No Project" Mapping

**Sidebar sort by time:**
- `useConversations` sorts by `createdAt` (session start time), matches Settings → 会话
- Sidebar card time uses `createdAt`; formatRelativeTime unchanged
- Tracking field `lastActivityAt` kept for future use but no longer drives sort/display

**Pi block sync (complete):**
- `extractConvs` (sync) was discarding `blocks` (thinking, toolCall, tool_result) — only kept plain text
- Root cause: Pi uses `type: "toolCall"` (not Anthropic `tool_use`); field names differ (`arguments` vs `input`, `thinking` vs `content`)
- Fix: refactored into `parseSessionFile`; maps each part to `ContentBlock[]` with type union
  - `thinking` block from `part.thinking`
  - `text` block from `part.text`
  - `tool_use` block from `part.type="toolCall"`, status `"running"`
  - `tool_result` event patches the matching `tool_use` block (via `toolCallId`) and appends a `tool_result` block
- Tool-call status is `running` until the standalone `toolResult` event flips it to `completed` / `error`
- Orphan `toolResult` events (no matching `tool_use`) are dropped silently

**On-demand message loading (data-flow refactor):**
- Problem: Sync returned full messages (15.7 MB for 81 sessions) — exceeded localStorage 5-10 MB cap
- Fix: localStorage stores lightweight index only; messages are loaded on demand
- New `GET /api/pi/sessions/full?id=X&workspace=Y` returns full messages + blocks for a single Pi session
- `useConversations` adds:
  - `messagesCache: Map<id, ChatMessageSnapshot[]>` (in-memory, not persisted)
  - `loadConvMessages(id)` — fetches /full, writes to cache
  - `loadingConvId: string | null` — tracks which conv is loading
- `ChatPanel` receives `loadingMessages` + `onRequestLoadMessages` props:
  - On `conversationId` / `sessionId` change, if `initialMessages` empty + has `sessionId` → trigger load
  - Shows "Loading conversation…" spinner (Q2-2a) instead of WelcomeScreen
- `activeConv` = index + cached messages; sidebar token numbers from cache if loaded, else from `piTotalInputTokens` etc. (Q3-3c)
- Web UI–only conversations also don't persist messages (Q1-1a) — closed browser = messages lost, title kept

**Sync API changes:**
- Workspace parameter now respected: `workspace=""` scans all dirs; `workspace=X` scans only that one
- `summary` flag (default `true`): returns index + token totals only (no `messages` field)
- 81-session sync payload: 15.7 MB → 29 KB
- SessionsTab: passes `summary: true` + `workspace` to sync; catches errors with `console.error` + `alert`

**"No Project" workspace mapping:**
- Pi stores "No Project" sessions under `~/.pi/agent/sessions/--Users-bengilla--/`
- But session event's `cwd` is `/Users/bengilla` (the home dir)
- Sync + full APIs map `cwd === homedir()` → `workspace = ""` so the session surfaces under "No Project" filter in sidebar
- 11 home-dir sessions now correctly appear in `- No Project -` filter (was 0)

**Bug fix — perpetual loading spinner:**
- `loadingMessages={loadingConvId === activeConvId}` returned `true` when both were `null` (`null === null`)
- Sidebar fix: `loadingMessages={loadingConvId !== null && loadingConvId === activeConvId}`
- New users (empty localStorage) no longer see a permanent spinner after reload

**Other:**
- `mtime` is **seconds** on macOS (`stat.mtimeMs` returns seconds, not ms) — must use ISO timestamp from session event for `createdAt` (otherwise 1000x smaller than `Date.now()`, sorted to bottom)
- `extractContentText` helper for `toolResult.content` (array of `{type:"text", text:"..."}` → joined string)

**Communication protocol (added):**
- 1. State what's wrong / what's wanted
- 2. List: file · function · why
- 3. Wait for "可以" before editing
- 4. Report what was changed (1-2 lines per file)
- 5. Do NOT do unrequested "while I'm here" work — even if related

### 2026-06-11 — Pi CLI Sync, Triple-Link Data Flow

**Architecture: Pi CLI is the source of truth.**

**Sync:**
- Settings → 会话 Sync button writes all Pi sessions to localStorage with merge
- Sidebar delete also removes Pi `.jsonl` file via DELETE API
- Settings → 会话 cards click to open in sidebar (auto-switches workspace + syncs)
- Sessions API uses `cwd` from file headers, not lossy directory name decode
- All session endpoints support partial ID matching (startsWith)
- Chat API resolves session ID to full file path across all directories

**UI fixes:**
- Sidebar conversation cards: consistent left/right padding, edit + delete buttons restored
- ChatInput background matches chat area (both `var(--bg)`)
- Model dropdown uses fixed positioning to escape overflow clipping
- Session tree: flat left-aligned layout, scroll position restored on back
- WelcomeScreen description i18n support

**Persistence:**
- Thinking level changes write to Pi `settings.json` (model already did)
- `useConversations` delete propagates to Pi session file

### 2026-06-11 — Workspace-Scoped Conversations, Pi-Only Mode

**Refactoring:**
- Extracted `useConversations` hook — conversations scoped by workspace path
- Extracted `useSettings` hook — theme, language, font scale, resizable panels
- `page.tsx` 584→444 lines; `ChatPanel` 1418→875 lines
- Removed agent switcher — Pi-only mode (`activeAgent = "pi"`)

**New features:**
- Resizable sidebar and right panel
- Pi version check + update modal
- Language support (EN/ZH)
- Conversation rename with manualTitle flag
- Workspace-scoped conversation list

### 2026-06-10 — Token Fix, Stop Preserve, Sidebar Cards, Copy Button

**Bug fixes:**
- Pi-reported token values (`input`/`output`) now read correctly from both Pi and Anthropic formats
- Stopping a stream preserves partial content as assistant message
- `0 || undefined` replaced with `!= null` check for zero token values

**UI:**
- Copy button: border removed, hover glow, press feedback (`scale-90`)
- Sidebar: clickable conversation cards, left accent border on selected
- Token display: `↑input ↓output ⚡cache` breakdown from real Pi values

**Refactoring:**
- Tool call IDs unified across `toolcall_start/delta/end` chain
- `useConversations` tracks `inputTokens`/`outputTokens`/`cacheTokens` per conversation

### 2026-06-10 — IME, Scroll, Layout, Line Breaks, File Tree

**Bug fixes:**
- IME composition (pinyin) no longer sends on Enter during composition
- Agent content fills full width (removed `max-w-[820px]`)
- Auto-scroll pauses when user scrolls up (150px threshold)
- Single `\n` renders as `<br>` via `remark-breaks`
- List numbers restored (`list-style: decimal/disc`)
- File tree auto-refreshes every 5s

### 2026-06-10 — Package Mgmt + Session Tree

**New features:**
- Package management UI (Settings → 包): install, remove, update Pi packages
- Session tree viewer: hierarchical branch view from `.jsonl` files

**Refactoring:**
- `ChatInput` extracted from `ChatPanel` (textarea, attachments, @mentions, input history)
- Shared Prism config for syntax highlight preview

**Bug fixes:**
- Tool execution events no longer dropped — `done` event no longer cuts stream early
- Tool call blocks no longer duplicated (unified IDs)
- Token count no longer double-counted

**Other:**
- E2E tests rewritten for Pi-only
- Removed `@lobehub/icons`, `simple-git` deps
- Agent description i18n (EN/ZH)
- `React.memo` on `ThinkingBlock`/`ToolCallBlock`/`ToolResultBlock`
## Environment

- `PI_PLUS_PLUS_WORKSPACE` sets the default workspace path.

## Electron Roadmap

Once the Pi Workspace UI stabilizes, package as an Electron desktop app.

### Why Electron

- Native window management (menus, dock, title bar, system tray)
- Eliminates browser tab dependency
- Direct `node:` module access without Next.js SSR restrictions
- Tighter Pi CLI integration via child process management
- System notifications, global shortcuts, clipboard monitoring

### Design Principles (apply to all future changes)

1. **Server/client split must persist** — Electron wraps the Next.js production server (`next start`), it doesn't replace it. The UI remains a webapp; Electron is just the shell.
2. **No Electron-specific APIs in the web layer** — All IPC goes through HTTP APIs. If Electron needs a native feature (e.g., file dialog, notification), add an API route, don't call Electron APIs from React components.
3. **Pi discovery stays filesystem-based** — `discovery.ts` finds the Pi binary via `which` / `where`. Electron doesn't change this.
4. **Session storage stays in `localStorage` + Pi `.jsonl` files** — No SQLite, no IndexedDB. Keep the portable file-based approach.
5. **Keep the build portable** — Avoid native Node.js addons. Pi is the only native dependency.
6. **App ↔ CLI bidirectional** — The app and Pi CLI share the same filesystem state. Anything installed, configured, or modified via CLI must be visible in the app, and vice versa. App never maintains its own separate registry. Applies to: skills (`~/.pi/agent/skills/`), packages (`~/.pi/agent/settings.json`), settings (`.pi/settings.json`), sessions (`.jsonl` files), models, themes, prompt templates. The app reads and writes Pi's native files; it does not wrap or abstract them.

### Migration Path

```text
Phase 1  — Electron shell that loads http://localhost:31508
Phase 2  — Bundle Next.js production server inside Electron (single binary)
Phase 3  — Native features: system tray, auto-update, deep links
```

### What to avoid

- Don't replace Next.js with a custom bundler
- Don't add a build step that compiles different code for Electron vs browser
- Don't use Electron-specific modules in shared code

### Checklist for every change

> Will this change make the Electron migration harder or easier?

- ✅ Favor API routes over client-side Node.js imports
- ✅ Keep filesystem operations behind API routes, not in React components
- ❌ Avoid `window.require` or browser-side `node:` imports
- ❌ Don't add desktop-only features until Phase 2

## Pitfalls (v0.2.x)

### Race: syncPiSessions snapshot vs concurrent writes
`syncPiSessions` called `loadConvs()` (snapshot), then `await fetch(...)`, then merge + `saveConvs` + `setIndexes`. During the fetch, user could send a message → `onMessagesChange` writes to localStorage. The merge used the stale snapshot → overwrote the new conversation.
**Fix**: use `setIndexes((prev) => ...)` functional update — `prev` is React's latest committed state.

### Race: handleStop abort clears refs before capture
`handleStop` called `abort()` first, which synchronously triggered `handleSend`'s `finally` clearing all refs, THEN captured `streamContentRef.current` (already empty).
**Fix**: capture refs FIRST, then abort.

### Workspace mismatch: /tmp vs homedir
No Project mode: chat route defaulted to `/tmp` but sync/full APIs mapped empty workspace to `homedir()`. Pi sessions landed in `--tmp--/` but sync looked in `--Users-xxx--/`.
**Fix**: all three routes (chat, files, settings) default to `homedir()`.

### localStorage key migration
Renamed `agents-web-*` to `pi-plus-plus-*`. On first load with new keys, `loadConvs()` returned `[]` → auto-sync populated only Pi sessions → web-only convs lost.
**Fix**: `loadConvs` checks old key if new key is empty, copies data over.
