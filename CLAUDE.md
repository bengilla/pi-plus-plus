# agents-web

Multi-agent web workspace — Claude Code, Codex, Pi in your browser.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19
- **Styling**: Tailwind CSS 4 + CSS custom properties (design tokens)
- **Language**: TypeScript 5 (strict)
- **Package manager**: npm workspaces
- **Testing**: Playwright (E2E)
- **Runtime**: Node.js (local filesystem access via `fs`)

## Architecture

```
packages/
└── web/            # Next.js frontend (port 3005)

packages/web/lib/
├── agents/         # Agent discovery + CLI spawn adapters
└── skills/         # Skill scanner + marketplace
```

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/agents` | Discovered agents on this device |
| `POST /api/agent/chat` | SSE streaming chat with an agent |
| `GET /api/skills?agent=X` | Installed skills for an agent |
| `GET /api/skills?q=X` | Marketplace search |
| `POST /api/skills` | Toggle or install skills |
| `GET /api/files?path=X` | File tree / file content |
| `GET /api/settings` | App settings |

### Key Patterns
- SSE streaming for agent chat
- Agent discovery: scans PATH for CLI binaries
- Agent adapters: `child_process.spawn` → line parsing → AgentEvent
- Skill scanner: reads SKILL.md YAML frontmatter from agent skill directories
- Design tokens in `globals.css` via CSS custom properties (light + dark)

## UI Features

- **Explorer**: file tree + New File/Folder, inline rename/delete, COPY path button
- **Conversations**: NEW button, localStorage persistence, click to resume
- **Theme**: dark/light toggle (top-right), persisted, no flash
- **Token counter**: animated status bar during streaming (Generating… 12s · ↓543 tokens · thinking)

## Phases

- **Phase 1-2**: Project setup, UI shell ✅
- **Phase 3**: Dynamic agent discovery + real CLI spawn ✅
- **Phase 4**: Skills marketplace + settings modal + E2E tests ✅

## Scripts

```bash
npm run dev           # Next.js dev server on :3005
npm run build         # Production build
npm run start         # Production server on :3005
npm run test:e2e      # Playwright E2E tests
```

## Environment

- `AGENTS_WEB_WORKSPACE` — default workspace path

## Adding a New Agent

1. Add entry to `KNOWN_AGENTS` in `lib/agents/registry.ts`
2. If output format differs, add parser to `lib/agents/spawn.ts`
3. Map parser in `lib/agents/adapters/factory.ts`
4. Discovery is automatic

## E2E Tests

Located in `e2e/smoke.spec.ts`. Config: `e2e/playwright.config.ts`.
Server must be running on :3005.
