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
- **Phase 7**: Three-column redesign — "Dark Industrial Precision" design system, AgentSwitcher, RightPanel, WelcomeScreen, @mention, keyboard shortcuts, font scale setting ✅

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

### Theme & SSR
- **Prevent white flash on refresh**: CSS `:root` defaults to dark, `[data-theme="light"]` overrides. SSR `<html style="background:#1c1917">` as initial fallback. All three layers (SSR, CSS, script) must agree on the default.
- **Next.js Script component**: `strategy="beforeInteractive"` is queued via `__next_s.push()`, NOT truly synchronous. Don't rely on it for pre-paint execution.
- **Never put `style` prop on `<body>` in SSR** if a script clears it before hydration — causes attribute mismatch.
- **`useState` lazy init with `localStorage`** causes hydration mismatch. Instead: init with SSR-safe default, load from localStorage in `useEffect` after mount.

### Conversations
- Auto-create conversation when sending without active one. **Guard with `messages.length > 0`** — otherwise deleting active conv triggers ChatPanel remount → `useEffect` save → ghost conversation.

### Design System & Layout
- Three-column layout with collapsible panels: use CSS transition on `width` + `min-width`, NOT `display:none`. Overflow hidden on the panel container, inner content at fixed width.
- **CSS variable aliases**: add backward-compatible aliases (`--color-surface: var(--bg)`) when rewriting tokens so existing components don't break during incremental migration.
- `text-[Xpx]` Tailwind arbitrary values use `px`, not `rem` — they don't scale with `html font-size`. For scalable text, use CSS custom properties with `calc()`.
- **Font scale persistence**: apply `--font-scale` in the theme init script (before paint), same as theme — avoids flash of wrong size.

### pi-web Design Patterns
- Message role labels: tiny 9px monospace pills (`fontFamily: "var(--font-mono)"`) with bordered background, not uppercase labels.
- User messages: tinted background (`--user-bg`) + subtle border (`--user-border`), assistant messages transparent.
- Footer text (tokens/time/copy): muted color at ~65% luminance so it doesn't compete with content.

### @lobehub/icons
- `@lobehub/icons` provides SVG React components for AI brands (ClaudeCode, Codex, NousResearch, OpenClaw, etc.)
- Each icon has variants: Mono, Color, Avatar, Text, Combine. Not all brands have all variants.
- Import Color variants directly from `@lobehub/icons/es/<Brand>/components/Color` to avoid TS `CompoundedIcon` type issues.
- Icons are React client components (`'use client'`) — safe in `"use client"` parent.

### Agent UI
- Agent switcher in sidebar (tabs) eliminates need for top-bar dropdown — single source of truth for active agent.
- LobeHub icons give professional brand identity per agent (Claude ⬡, Codex ◈, Hermes ☤, Pi π).
- Agent name "Claude Code" renamed to "Claude" for cleaner display.

### CSS Range Input
- Style `input[type="range"]` thumb with `::-webkit-slider-thumb` + `::-moz-range-thumb` pseudo-elements.
- Gradient track via `background: linear-gradient(...)` on the input itself, calculating fill percentage inline.

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
