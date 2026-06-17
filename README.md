# pi++

[中文版](./README_zh.md)

<img width="600" height="386" alt="final" src="https://github.com/user-attachments/assets/d66470e5-a324-4fb2-873f-298330cfcfee" />

Pi coding agent desktop workspace — a native macOS app wrapping Pi CLI with a three-panel chat UI.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

## Why pi++

Pi CLI is powerful, but it's terminal-only. pi++ adds a desktop UI with:

- **Standalone chats** — talk without opening a project; conversations live independently from folders
- **Project conversations** — folder-based chats with context files (AGENTS.md, CLAUDE.md)
- **ESC to clear** — press Escape to deselect conversation, collapse project, or close panels
- **Click to deselect** — click empty space in sidebar to clear active selection
- **Three-panel layout**: sidebar (chats + projects), chat panel, inspector
- **Bidirectional state**: app reads/writes Pi's native files (`auth.json`, `settings.json`, sessions `.jsonl`), no separate database
- **OAuth login**: ChatGPT Plus/Pro, Anthropic Claude — click Login, browser opens
- **VPN/proxy aware**: auto-detects proxy settings from shell profile when launched from Finder
- **Key validation**: non-blocking — saves even if network is down, tests on first use
- **Model management**: filter models by auth, toggle enabled/disabled, set default
- **Pi settings editor**: structured toggles/inputs for compaction, retry, trust, telemetry
- **Context files preview**: see which AGENTS.md/CLAUDE.md files Pi loaded
- **Session tree**: navigate conversation branches, fork sessions
- **Session export**: download conversations as HTML
- **Quick Copy**: copy code blocks, terminal commands, or full messages in one click
- **Responsive Sizing**: font-scale settings that dynamically adjust the entire UI typography
- **Electron shell**: native macOS app with menus, dock icon

No separate database. No vendor lock-in. Your data stays in `~/.pi/agent/`.

## Quick Start (user)

**Option A: Download pre-built app (no terminal needed)**

Download the latest `.dmg` from [Releases](../../releases), open it, drag pi++ to Applications.

**Option B: Build from source**

```bash
git clone https://github.com/bengilla/pi-plus-plus.git pi++
cd pi++
npm install
npm run app:build
open release/mac-arm64/pi++.app
```

**Prerequisites:** Node.js 20+, npm 10+, macOS 14+ (Apple Silicon).

Requires Pi CLI (`npm install -g pi-coding-agent`). The app guides you through installation on first launch.

## Loop — Auto-Fix

Loop is a one-click auto-fix mechanism: describe the goal, AI writes code → runs verification → fixes errors → independent review, looping until it passes.

**Location:** Chat / Brief toggle bar → Loop button on the right.

**Usage:**
1. Click Loop → enter your goal (e.g. "fix all type errors") → Enter
2. Loop runs automatically with a progress bar showing the current phase and round
3. A report card appears on completion: strategy, rounds, duration, expandable logs

**Workflow:**

```
Phase 1: Direct Fix (3 rounds)
  ├─ pi analyzes errors → edits code → runs verify command
  ├─ PASS → ✅ report
  └─ FAIL → escalate

Phase 2: Maker + Checker (3 rounds)
  ├─ Maker: write code
  ├─ Checker: independent review (different session, prevents self-review)
  ├─ PASS → ✅ report
  └─ FAIL → next round

Phase 3: Human intervention
  └─ ⛔ Shows detailed logs, manual investigation needed
```

**Verification command:** Loop auto-detects project type and generates `.pi/verify.sh`:

| Project type | Auto-generated |
|-------------|----------------|
| `package.json` with `typecheck` | `npm run typecheck` |
| `package.json` with `build` | `npm run build` |
| `go.mod` | `go build ./...` |
| `Cargo.toml` | `cargo build` |

You can also manually create `.pi/verify.sh` for custom verification logic.

**No extra install needed.** Loop runs entirely on pi++'s built-in API endpoints using your existing pi CLI.

## Development

```bash
npm install
npm run dev          # Web dev server → http://localhost:31508
npm run app:dev      # Electron dev mode (auto-reload)
npm run app:build    # Production .dmg → release/
```

### Stack

| Layer | Tech |
|-------|------|
| UI | Next.js 16 (Turbopack) + React 19 |
| Style | Tailwind CSS 4 + CSS custom properties |
| Desktop | Electron 33 |
| Agent | Pi CLI (spawned as child process) |
| Storage | `~/.pi/agent/` (auth.json, settings.json, .jsonl sessions) |

### Architecture

```
┌──────────────────────────────────────┐
│ Electron App                         │
│  ┌────────────────────────────────┐  │
│  │ Next.js UI (three panels)      │  │
│  │ Sidebar │ Chat │ Right Panel   │  │
│  └──────────┬─────────────────────┘  │
│             │ HTTP APIs (SSE stream) │
│  ┌──────────▼─────────────────────┐  │
│  │ Pi CLI (spawned via spawn())   │  │
│  └──────────┬─────────────────────┘  │
└─────────────┼────────────────────────┘
              │ bidirectional I/O
     ~/.pi/agent/
     ├── auth.json       # API keys
     ├── settings.json   # model config, thinking level
     └── sessions/       # .jsonl conversation files
```

### Project Structure

```
packages/
├── web/                  # Next.js app
│   ├── app/api/          # API routes (pi, agent, files, skills)
│   ├── components/       # ChatPanel, Sidebar, SettingsModal
│   ├── lib/agents/       # Pi agent discovery, registry, spawn adapter
│   ├── lib/skills/       # Skill scanner
│   └── lib/hooks/        # useConversations, useSettings
└── electron/             # Electron shell
    ├── main.js           # App lifecycle, server spawn
    └── preload.js        # IPC bridge
```

### Key APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/pi/auth` | GET/POST | Provider keys (masked), OAuth login, key validation |
| `/api/pi/models` | GET/POST | Filtered model list + default model |
| `/api/pi/settings` | GET/POST | Read/write `~/.pi/agent/settings.json` |
| `/api/pi/context-files` | GET | Scan AGENTS.md/CLAUDE.md (global + project + parents) |
| `/api/pi/sessions` | GET/DELETE/POST | Session CRUD, branch fork |
| `/api/pi/sessions/sync` | POST | Sync Pi sessions → localStorage |
| `/api/pi/session/export` | GET | Export session as HTML via `pi --export` |
| `/api/agent/chat` | POST | SSE stream from Pi CLI |
| `/api/agent/stop` | POST | Stop running agent |
| `/api/loop` | POST | SSE stream: auto-fix loop with maker/checker phases |

### Design Tokens

- Accent: `oklch(72% 0.12 175)` (pi green)
- Buttons: green border + green text + transparent bg + square corners
- Header: 42px unified height

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

Good first issues are tagged `good-first-issue`. Areas where contributions are especially welcome:

- **Cross-platform**: Windows/Linux support (Electron packaging)
- **Themes**: more color schemes beyond light/dark
- **Sidebar filters**: search, date range, tag system
- **Thinking block visualization**: collapsible/expandable reasoning display
- **Tool call UX**: inline tool execution preview, cancel running tools
- **Session reconnection**: resume interrupted Pi sessions
- **Tests**: E2E, integration, visual regression

## License

MIT — see [LICENSE](./LICENSE).
