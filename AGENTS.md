# pi++

pi++ coding agent desktop workspace — code, explore, and build with your local AI.

## Stack

- Next.js 16 (Turbopack) + React 19
- Tailwind CSS 4 + CSS custom properties
- TypeScript strict mode
- npm workspaces
- Electron 33 (desktop shell)
- Pi 0.79+ CLI as agent backend

## Commands

```bash
npm run dev           # Web dev → http://localhost:31508
npm run build         # Production build
npm run app:dev       # Electron dev mode
npm run app:build     # Production .dmg → release/
```

## Architecture

```
packages/
├── web/                  # Next.js app
│   ├── app/api/          # API routes
│   ├── components/       # ChatPanel, Sidebar, SettingsModal
│   ├── lib/agents/       # Pi discovery, spawn adapter
│   ├── lib/auth/         # Provider auth helpers
│   ├── lib/skills/       # Skill scanner
│   └── lib/hooks/        # useConversations, useSettings
└── electron/             # Electron shell
    ├── main.js           # App lifecycle, server spawn
    └── preload.js        # IPC bridge
```

## Design Tokens

- Accent: `oklch(72% 0.12 175)` (pi green)
- Buttons: green border + green text + transparent bg + square corners
- Header: 42px unified height

## Important Patterns

- Chat uses SSE streaming with `TransformStream` and `writer.write()`
- `ref + rAF` bypasses React 18 batching for real-time counters
- Client components must NOT import `@/lib/agents` barrel — it pulls in `node:child_process`. Import from `@/lib/agents/types` or `@/lib/agents/registry` directly
- Conversations stored in `localStorage`, scoped by workspace; messages loaded on-demand
- Auto-create conversations only when `messages.length > 0`
- Scrollable flex layouts need `flex-1 min-h-0`
- Theme & font scale init before paint to avoid flicker
- `useState` lazy init with `localStorage` → hydrate mismatch. SSR-safe default, load in `useEffect`
- CSS `:root` dark, `[data-theme="light"]` overrides. All layers agree on default

## Race Conditions (v0.2.x)

- `stdout.on('data')` → push + resolveWait needs double-check after setting promise
- `handleStop`: capture refs FIRST, then abort — abort triggers finally which clears refs
- `syncPiSessions`: use `setIndexes((prev) => ...)` functional update to avoid stale snapshot

## Environment

- `PI_PLUS_PLUS_WORKSPACE` sets default workspace path
- When launched from Finder/Dock (not terminal), the Electron app doesn't inherit `HTTP_PROXY`/`HTTPS_PROXY`. `readProxyFromShell()` in `main.js` explicitly sources `~/.zshrc` to inject proxy vars into the server process. Whitelist-only: only proxy keys are passed, not `NODE_OPTIONS`.

## Auth Validation

- Key validation is non-blocking — network errors (timeout, connection refused) save silently with `type: "network"`; only API auth rejections (401/403/429) show a warning with `type: "invalid"`
- AuthTab shows warning as yellow notice + green success, not a red error

## Context Files

- API only returns files that actually exist on disk (`exists: true` filter)
- API response uses `name` and `scope` fields (not `displayPath`/`level`) to match the frontend interface

## GitHub TODO

- [ ] GitHub Actions CI — auto `npx tsc --noEmit` + `npm run build` on PR
- [ ] Branch protection — require PR review before merge to main
- [ ] Enable Discussions tab
- [ ] Project board
