# agents-web

Multi-agent web workspace for Claude, Codex, Pi, and other local CLI agents.

## Stack

- Next.js 16 App Router + React 19
- Tailwind CSS 4 + CSS custom properties in `packages/web/app/globals.css`
- TypeScript strict mode
- npm workspaces
- Playwright E2E tests
- Local Node.js APIs for filesystem and agent process access

## Structure

```text
packages/web/                 # Next.js app, port 31508
packages/web/lib/agents/      # Agent discovery, registry, spawn adapters
packages/web/lib/skills/      # Skill scanner and marketplace
packages/web/components/      # Main UI components
```

## Main APIs

- `GET /api/agents` discovers local agent binaries.
- `POST /api/agent/chat` streams agent replies over SSE.
- `POST /api/agent/stop` stops the active agent process.
- `GET /api/files?path=X` reads file trees or file content.
- `GET /api/skills?agent=X` lists installed skills.
- `GET /api/skills?q=X` searches marketplace skills.
- `POST /api/skills` toggles or installs skills.
- `GET /api/settings` reads app settings.

## Important Patterns

- Chat uses SSE streaming with `TransformStream` and `writer.write()`.
- Agent adapters spawn local CLIs with `child_process.spawn`, parse line events, and emit `AgentEvent`.
- Client components must not import the `@/lib/agents` barrel because it pulls in Node-only modules. Import from `@/lib/agents/registry` or `@/lib/agents/types` instead.
- Rich chat messages use `ContentBlock` entries for text, thinking, tool calls, and tool results.
- Conversation history is stored in `localStorage` and scoped by workspace.
- Auto-create conversations only when `messages.length > 0`, otherwise deleting an active conversation can create a ghost conversation.
- Scrollable flex layouts need `flex-1 min-h-0` and constrained children.
- Theme and font scale should initialize before paint to avoid flicker and hydration mismatch.

## Agent Notes

- Add agents in `packages/web/lib/agents/registry.ts`.
- If the output format is new, add parsing in `packages/web/lib/agents/spawn.ts`.
- Map adapters in `packages/web/lib/agents/adapters/factory.ts`.
- Discovery scans `PATH` plus each agent's `fallbackPaths`.
- Thinking levels are configured per agent in the registry.

## UI Notes

- Left sidebar owns agent switching, explorer, and project conversations.
- Center panel owns chat, composer, thinking control, and action timeline.
- Right panel owns selected file or agent details.
- Agent names in the sidebar should be lowercase.
- Agent icons should render inside a consistent fixed-size box.
- Tool/thinking/action details should be visible in the UI, but avoid sending full logs back to agents unless needed.

## Commands

```bash
npm run dev
npm run build
npm run start
npm run test:e2e
```

## Persistent Server

- launchd config: `~/Library/LaunchAgents/com.agents-web.server.plist`
- port: `31508`
- logs: `~/.local/log/agents-web.log` and `~/.local/log/agents-web.err.log`
- after production changes: run `npm run build`, then restart the launchd service.

## Environment

- `AGENTS_WEB_WORKSPACE` sets the default workspace path.

## Tests

- E2E tests live in `e2e/smoke.spec.ts`.
- Config lives in `e2e/playwright.config.ts`.
- The server must be running on `:31508` for E2E tests.
