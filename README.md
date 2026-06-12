# pi++

Pi coding agent web workspace — code, explore, and build with your local AI.

## Features

- **File browser** — browse and edit files from any workspace
- **Chat interface** — talk to Pi with SSE streaming
- **Full Pi CLI sync** — sessions, settings, packages, models all in sync with `~/.pi/`
- **Session viewer** — browse, search, branch, and export Pi CLI conversations
- **Settings hub** — manage models, packages, thinking levels, and Pi config
- **Cross-device** — works on Mac, iPad, any browser

## Quick Start

```bash
git clone https://github.com/bengilla/agents-web.git
cd agents-web
npm install
npm run dev
```

Open http://localhost:31508

Set workspace via environment variable:
```bash
PI_PLUS_PLUS_WORKSPACE=/path/to/your/projects npm run dev
```

## Architecture

```
packages/
└── web/            # Next.js frontend (SSE streaming, Pi CLI integration)
```

## License

MIT
