# pi++

pi++ — Pi coding agent desktop workspace. A native macOS app that wraps Pi CLI with a three-panel chat UI.

## Install

### Option 1: Download the app

Download the latest `pi++-*.dmg` from [Releases](https://github.com/bengilla/pi-plus-plus/releases), open it, and drag `pi++.app` to Applications.

### Option 2: Build from source

```bash
git clone https://github.com/bengilla/pi-plus-plus.git
cd pi-plus-plus

# Install dependencies
npm install

# Build the web app + package the Electron app
npm run app:build

# Open the app
open release/mac-arm64/pi++.app
```

**Prerequisites:**
- Node.js 20+
- npm 10+
- macOS 14+ (Apple Silicon)

### Pi CLI

The app requires [Pi CLI](https://github.com/earendil-works/pi-coding-agent). On first launch, if Pi is not installed, the app will guide you through installation:

```
click [安装 Pi CLI] → npm install -g pi-coding-agent → done
```

Or install manually:

```bash
npm install -g pi-coding-agent
```

## Setup

### 1. Add a Provider API Key

Settings → Auth → Add Provider → pick provider → enter key → Save.

Keys are stored in `~/.pi/agent/auth.json`, shared bidirectionally with Pi CLI.

### 2. Select Models

Settings → Models → toggle models on → click to set default.

### 3. Start Chatting

Type your prompt and press Enter.

## Development

```bash
# Web dev server (http://localhost:31508)
npm run dev

# Electron dev mode (app wrapping dev server)
npm run app:dev

# Safe dev server with health check + auto-recovery
./scripts/dev-safe.sh

# Build production Electron .dmg
npm run app:build
```

## Project Structure

```
pi++/
├── packages/
│   ├── web/             # Next.js 16 + React 19 three-panel UI
│   │   ├── app/api/pi/  # Pi API routes (model, auth, sessions, settings)
│   │   └── components/  # ChatPanel, SettingsModal, ChatInput
│   └── electron/        # Electron shell (main.js, preload.js)
├── scripts/
│   └── dev-safe.sh      # Dev server with health check
└── release/
    ├── pi++-*.dmg       # macOS installer
    └── mac-arm64/pi++.app
```

## Architecture

```
┌────────────────────────────────────┐
│ Electron App                       │
│  ┌──────────────────────────────┐  │
│  │ Next.js UI (three-panel)     │  │
│  │ ┌────────┬──────────┬──────┐ │  │
│  │ │Sidebar │  Chat    │Settings│ │  │
│  │ └────────┴──────────┴──────┘ │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │ Pi CLI (child process)        │  │
│  │ — model binding               │  │
│  │ — session management          │  │
│  │ — tool execution              │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
          ↕ (bidirectional)
     ~/.pi/agent/
     ├── auth.json      # API keys
     ├── settings.json  # default model, provider
     └── sessions/      # conversation history
```

## APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/pi/auth` | GET | List configured providers (keys masked) |
| `/api/pi/auth` | POST | Save/delete provider API key |
| `/api/pi/model` | GET | Get current default model |
| `/api/pi/models` | GET | List all available models from `pi --list-models` |
| `/api/pi/models` | POST | Set default model or toggle scoped models |
| `/api/pi/settings` | GET/POST | Read/write Pi settings.json |
| `/api/pi/version` | GET | Pi CLI version + npm latest |
| `/api/pi/sessions` | GET | List Pi sessions |
| `/api/pi/sessions/sync` | POST | Sync sessions to localStorage |
| `/api/pi/session/tree` | GET | Session branch tree |
| `/api/pi/session/export` | GET | Export session to HTML |
| `/api/pi/packages` | GET/POST | List/install/remove Pi packages |
| `/api/agent/chat` | POST | Stream agent replies over SSE |
| `/api/agent/stop` | POST | Stop active agent process |

## Security

- API keys are stored in `~/.pi/agent/auth.json` (not committed)
- All API responses mask keys (e.g., `sk-1••••5a2`)
- `.pi/`, `*.jsonl`, `*.dmg` are in `.gitignore`
- No hardcoded secrets in source

## License

MIT
