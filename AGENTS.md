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

### 2026-06-10 — Token Fix, Stop Preserve, Sidebar Cards, Copy Button

**Bug fixes:**
- Pi-reported token values (`input_tokens`/`output_tokens`) not being read: `spawn.ts` used wrong field names (camelCase vs snake_case). Now correctly reads both Pi's `input`/`output` format and Anthropic's `input_tokens`/`output_tokens`.
- Stopping a streaming response lost partial content: `handleStop` now captures partial text/blocks/tokens before clearing refs and saves them as a partial assistant message.
- `0 || undefined` swallowed valid zero token values: replaced with `!= null ? val : undefined`.

**UI improvements:**
- Copy button: removed border, added hover glow (`box-shadow`) and active press feedback (`scale-90` + border flash).
- Sidebar conversation list: redesigned as clickable cards with rounded corners. Selected state shows left accent border + colored title. Hover/selected states are now visually distinct.
- Sidebar token display: shows `↑input ↓output ⚡cache` breakdown using Pi's reported values instead of `content.length / 4` estimation.

**Refactoring:**
- Tool call event IDs: `toolcall_start`/`toolcall_delta` now extract real tool name/ID from `partial.content`; `toolcall_end` uses real `toolCall.id`. All events in the chain share the same ID, fixing `Action {}` stuck-running issue.
- `useConversations` now separately tracks `inputTokens`, `outputTokens`, `cacheTokens` per conversation.
- `Sidebar.ConvInfo` interface extended with `inputTokens`, `outputTokens`, `cacheTokens`.

### 2026-06-10 — IME, Scroll, Layout, Line Breaks, File Tree

**Bug fixes:**
- Tool call `Action {}` stuck running: `toolcall_start` now extracts real tool name/ID from `partial.content`; `toolcall_end` uses real `toolCall.id` instead of fabricated `call_{contentIndex}`. All events in the chain now share the same ID.
- IME composition (Chinese pinyin) Enter sent message prematurely: added `composingRef` + `onCompositionStart/End` to skip send during composition.
- Agent content didn't fill right side of container: removed `max-w-[820px]` from agent message wrapper.
- Couldn't scroll up during streaming: auto-scroll only fires when user is within 150px of bottom.
- Line breaks in user messages collapsed: added `remark-breaks` plugin so single `\n` renders as `<br>`.
- Markdown ordered/unordered list numbers hidden by Tailwind preflight: added `list-style: decimal` / `disc` on `.md-body ol` / `.md-body ul`.
- File tree didn't refresh after agent created files: added 5s auto-polling interval.

### 2026-06-10 — Package Mgmt + Session Tree + Major Refactor

**New features:**
- Package management UI (Settings → 包) — install/remove/update Pi packages
- Session tree viewer — hierarchical view of Pi session branches

**Refactoring:**
- `ChatPanel` 1418→875 lines — extracted `ChatInput` component (textarea, attachments, brief mode, @mentions, input history)
- Extracted `useConversations` and `useSettings` hooks from `page.tsx` (584→444 lines)
- Shared Prism config (`lib/utils/prism.ts`) — Editor now has syntax highlight preview

**Bug fixes:**
- Tool execution events were silently dropped: `done` event in `factory.ts` + `route.ts` both cut the stream before `tool_execution_*` events arrived
- Tool call blocks duplicated: `toolcall_end` and `tool_execution_start` used different IDs
- Token count double-counted: every message counted as both input AND output

**Other:**
- E2E tests rewritten for Pi-only
- Removed `@lobehub/icons`, `simple-git` deps; cleaned dead code
- Agent description i18n (EN/ZH)
- React.memo on ThinkingBlock/ToolCallBlock/ToolResultBlock

## Environment

- `AGENTS_WEB_WORKSPACE` sets the default workspace path.
