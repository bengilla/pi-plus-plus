# Pi Workspace

Pi coding agent web workspace — code, explore, and build with your local AI.

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

- launchd config: `~/Library/LaunchAgents/com.agents-web.server.plist`
- port: `31508`
- logs: `~/.local/log/agents-web.log` and `~/.local/log/agents-web.err.log`
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

### 2. Compaction (Context Compression)
`/compact` summarizes older messages when the context window fills up. Pi also does auto-compaction on overflow. agents-web has no compaction — long conversations hit token limits.

**Pi events:** `compaction_start` / `compaction_end` with reason (`manual`, `threshold`, `overflow`) and result.
**What's needed:** Manual compact button + auto-trigger based on token budget.

### 3. Message Queue (Steering / Follow-up)
Pi emits `queue_update` with pending `steering[]` and `followUp[]` message queues. agents-web ignores these entirely.

**What's needed:** Listen to `queue_update` events, show pending follow-up actions, let user approve/reject.

### 4. Pi Settings Management
Pi has `~/.pi/agent/settings.json` (global) and `.pi/settings.json` (project-level) for provider, tools, model cycling, trust, telemetry, etc. agents-web's SettingsModal doesn't read or write Pi's settings.json.

**What's needed:** API to read/write settings.json, UI for provider config, tool toggles, default model, trust settings.

### 5. Context Files (AGENTS.md / CLAUDE.md)
Pi loads `AGENTS.md` / `CLAUDE.md` from `~/.pi/agent/` (global), parent directories, and cwd. agents-web has no way to preview or edit these.

**What's needed:** File tree integration for context files, preview/edit panel, indicator showing which files are loaded.

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

- `AGENTS_WEB_WORKSPACE` sets the default workspace path.

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
