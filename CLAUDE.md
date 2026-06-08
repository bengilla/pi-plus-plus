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
└── web/            # Next.js frontend (port 31508)

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
- **Markdown rendering**: react-markdown + remark-gfm + syntax highlighting (PrismLight)
- **Thinking blocks**: collapsible panels with duration, auto-dedup for DeepSeek models
- **Tool call blocks**: expandable JSON input, status indicators (running/done/error)
- **Per-message footer**: in/out/cache tokens, cost estimate, Copy button, timestamp
- **Stop button**: aborts SSE stream + kills server-side agent process
- **Thinking level**: per-agent dropdown (Claude: full range; others: hidden)

## Phases

- **Phase 1-2**: Project setup, UI shell ✅
- **Phase 3**: Dynamic agent discovery + real CLI spawn ✅
- **Phase 4**: Skills marketplace + settings modal + E2E tests ✅
- **Phase 5**: pi-web style UI (markdown, thinking/tool blocks, usage row) ✅
- **Phase 6**: Thinking level control (agent-specific) ✅

## Lessons Learned

### SSE & Streaming
- `TransformStream` + `writer.write()` flushes more reliably than `ReadableStream.controller.enqueue()`
- `--output-format stream-json --verbose` is needed for Claude Code streaming; `--include-partial-messages` causes text duplication
- `claude -p` without stream flags outputs everything at once (no incremental streaming)
- DeepSeek models include the response text in the thinking block → need client-side dedup
- `done` events must be `yield`ed (not just `return`ed) or the client never receives token counts

### React & Layout
- Use `ref + rAF` to bypass React 18 batching for real-time counters
- `h-full` doesn't work in flex containers → use `flex-1 min-h-0` for height constraint chains
- Flex children need `min-h-0` + `overflow-hidden` to properly constrain scrollable content

### Client/Server Bundling
- Never import `@/lib/agents` barrel in client components — it pulls in `node:child_process`
- Import directly from `@/lib/agents/registry` or `@/lib/agents/types` for client-safe code

### Race Conditions
- `stdout.on('data')` → `push` + `resolveWait` pattern needs double-check after setting promise
- Without the re-check, data arriving between `yield` and next `await` gets stuck until next data event

## Scripts

```bash
npm run dev           # Next.js dev server on :31508
npm run build         # Production build
npm run start         # Production server on :31508
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
Server must be running on :31508.
