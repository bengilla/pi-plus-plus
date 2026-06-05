# agents-web

Multi-agent web workspace — Claude Code, Codex, Pi in your browser.

## Features

- **File browser** — browse and edit files from any workspace (local, NAS, GitHub)
- **Chat interface** — talk to AI agents with SSE streaming
- **Multi-agent** — switch between Pi, Claude Code, and Codex
- **Skills** — install and manage agent skills
- **Cross-device** — works on Mac, iPad, any browser

## Quick Start

```bash
git clone https://github.com/bengilla/agents-web.git
cd agents-web
npm install
npm run dev
```

Open http://localhost:3005

Set workspace via environment variable:
```bash
AGENTS_WEB_WORKSPACE=/path/to/your/projects npm run dev
```

## Architecture

```
packages/
├── web/            # Next.js frontend
├── agent-bridge/   # Unified agent abstraction (Pi / Claude Code / Codex)
└── filesystem/     # Multi-source file system (local / GitHub / NAS)
```

## License

MIT
