# pi++

Pi coding agent desktop workspace — a native macOS app wrapping Pi CLI with a three-panel chat UI.

## Quick Start

```bash
git clone https://github.com/bengilla/agents-web.git pi++
cd pi++
npm install
npm run app:build
open release/mac-arm64/pi++.app
```

That's it. The app opens, detects Pi CLI, and you're ready to chat.

**Prerequisites:** Node.js 20+, npm 10+, macOS 14+ (Apple Silicon).

## First Launch

If Pi CLI is not installed, the app guides you through installation:

```
click [安装 Pi CLI] → npm install -g pi-coding-agent → done
```

Or install manually:

```bash
npm install -g pi-coding-agent
```

## Setup

**1. Add a provider API key**

Settings → Auth → + Add Provider → pick provider → enter API key → Save

Keys are stored in `~/.pi/agent/auth.json`, shared bidirectionally with Pi CLI.

**2. Select models**

Settings → Models → toggle models on → click to set default

**3. Start chatting**

Type your prompt and press Enter.

## Development

```bash
npm run dev          # Web dev server (http://localhost:31508)
npm run app:dev      # Electron dev mode
npm run app:build    # Build production .dmg
```

## Architecture

```
pi++/
├── packages/
│   ├── web/            # Next.js 16 + React 19 UI
│   │   ├── app/api/pi/ # Pi API routes
│   │   └── components/ # ChatPanel, SettingsModal
│   └── electron/       # Electron shell
├── scripts/
│   └── dev-safe.sh     # Dev server with health check
└── release/
    └── pi++-*.dmg      # macOS installer
```

```
┌──────────────────────────────┐
│ Electron App                 │
│  ┌────────────────────────┐  │
│  │ Next.js UI (三面板)     │  │
│  │ Sidebar | Chat | Right  │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ Pi CLI (child process)  │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
        ↕ bidirectional
   ~/.pi/agent/
   ├── auth.json      # API keys
   ├── settings.json  # model config
   └── sessions/      # conversations
```

## APIs

| Endpoint | Description |
|----------|-------------|
| `/api/pi/auth` | Provider API keys (masked) |
| `/api/pi/model` | Default model |
| `/api/pi/models` | List from `pi --list-models` |
| `/api/pi/settings` | Read/write settings.json |
| `/api/pi/sessions` | Session management |
| `/api/agent/chat` | SSE stream |
| `/api/agent/stop` | Stop agent |

## Security

- Keys stored in `~/.pi/agent/auth.json` (gitignored)
- API responses always mask keys (`sk-1••••5a2`)
- No secrets in source code

## License

MIT
