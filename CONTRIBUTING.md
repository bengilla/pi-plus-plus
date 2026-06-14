# Contributing to pi++

Thank you for contributing! Here's how to get started.

## Code of Conduct

Be respectful. Assume good intent. Help others learn.

## Getting Started

1. Fork and clone
2. `npm install`
3. `npm run dev` — verify web app runs
4. Make your changes
5. `npm run app:build` — verify Electron builds

## Development Workflow

```
main ← your-feature-branch
```

- Branch from `main`
- Keep commits small and focused
- Write clear commit messages (English)
- Test manually: web UI + Electron app
- Open PR against `main`

## Code Style

- TypeScript strict mode
- Use `const` not `let` when possible
- Prefer `interface` over `type` for object shapes
- React components: functional + hooks
- No `any` — use `unknown` if truly uncertain
- CSS: Tailwind utilities + CSS custom properties (no inline styles)

### Server/Client Split

- **Server code** (`app/api/`, `lib/agents/`): can use `node:fs`, `node:child_process`, `node:os`
- **Client code** (`components/`, `lib/hooks/`): NO `node:` imports. Import from specific files, not barrel exports that pull in server code
- **Shared types** (`lib/agents/types.ts`): pure interfaces, no runtime deps
- **Never** import `@/lib/agents` from client components — import `@/lib/agents/types` directly

### Components

- Use `React.memo` for expensive renders (thinking blocks, tool calls)
- Lazy state init for `localStorage` values (SSR mismatch)
- `useEffect` for side effects, not render body
- No `useRef` for mutable state that drives UI

## Pi Integration Rules

- **App and CLI share native files**: `auth.json`, `settings.json`, `.jsonl` sessions
- No separate app-only registry or database
- OAuth = pi's interactive flow
- Models = pi's `--list-models` output, filtered by available auth

## Before You PR

- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` succeeds
- [ ] `npm run app:build` succeeds
- [ ] Tested in Electron

## Reporting Bugs

Use the Bug Report template. Include:
- macOS version + chip (Intel/Apple Silicon)
- Pi CLI version (`pi --version`)
- Steps to reproduce
- Expected vs actual behavior

## Questions?

Open a Discussion on GitHub. For real-time chat, join the Pi community.
