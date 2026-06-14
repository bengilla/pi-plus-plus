# pi++

Pi coding agent desktop workspace — a native macOS app wrapping Pi CLI with a three-panel chat UI.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

## Why pi++

Pi CLI is powerful, but it's terminal-only. pi++ adds a desktop UI with:

- **Three-panel layout**: sidebar (conversations), chat, settings/context panel
- **Bidirectional state**: app reads/writes Pi's native files (`auth.json`, `settings.json`, sessions `.jsonl`)
- **OAuth login**: ChatGPT Plus/Pro, Anthropic Claude, GitHub Copilot — click Login, browser opens
- **Model management**: filter models by auth, toggle enabled/disabled, set default
- **Session tree**: navigate conversation branches from `.jsonl` files
- **Electron shell**: native macOS app with menus, dock icon, system tray

No separate database. No vendor lock-in. Your data stays in `~/.pi/agent/`.

## Quick Start (user)

```bash
git clone https://github.com/bengilla/pi-plus-plus.git pi++
cd pi++
npm install
npm run app:build
open release/mac-arm64/pi++.app
```

**Prerequisites:** Node.js 20+, npm 10+, macOS 14+ (Apple Silicon).

Requires Pi CLI (`npm install -g pi-coding-agent`). The app guides you through installation on first launch.

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
| `/api/pi/auth` | GET/POST | Provider keys (masked), OAuth login |
| `/api/pi/models` | GET | Filtered model list |
| `/api/pi/sessions` | GET/DELETE/POST | Session CRUD, branch fork |
| `/api/pi/sessions/sync` | POST | Sync Pi sessions → localStorage |
| `/api/agent/chat` | POST | SSE stream from Pi CLI |
| `/api/agent/stop` | POST | Stop running agent |

### Design Tokens

- Accent: `oklch(72% 0.12 175)` (pi green)
- Buttons: green border + green text + transparent bg + square corners
- Header: 42px unified height

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

Good first issues are tagged `good-first-issue`. Areas where contributions are especially welcome:

- **Cross-platform**: Windows/Linux support (Electron packaging)
- **Compaction UI**: expose Pi's `/compact` feature in the app
- **Queue display**: show pending steering/follow-up messages
- **Session export**: HTML export via Pi's `--export`
- **Sidebar filters**: search, date range, tag system
- **Themes**: more color schemes beyond light/dark

## License

MIT — see [LICENSE](./LICENSE).
