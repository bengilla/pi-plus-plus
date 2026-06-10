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

### 1. Session Tree / Branching
Pi's `/tree`, `/fork`, `/clone` let you navigate a tree of conversation branches, fork from any point, and switch between branches — all in a single `.jsonl` file. agents-web only lists sessions flat, can't visualize or navigate the tree.

**Pi events:** `turn_start`/`turn_end` structure the conversation turns; `/tree` is an interactive TUI.
**What's needed:** Parse `parentId` from session files, render a tree view, support branching.

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

## Environment

- `AGENTS_WEB_WORKSPACE` sets the default workspace path.
