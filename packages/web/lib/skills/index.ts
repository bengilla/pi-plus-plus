export type { SkillInfo, MarketplaceSkill, SkillsResult } from "./types";
export { scanSkills, clearSkillsCache } from "./scanner";

// ── Marketplace ───────────────────────────────────────────
// Curated list of popular skills available to install.
// Later: replace with GitHub API search or a skills registry.

import type { MarketplaceSkill } from "./types";

const MARKETPLACE: MarketplaceSkill[] = [
  {
    id: "frontend-design",
    name: "Frontend Design",
    description: "Design distinctive, production-grade frontend interfaces with high design quality",
    source: "https://github.com/anthropics/skills/frontend-design",
    agents: ["claude-code", "pi"],
  },
  {
    id: "ui-ux-pro-max",
    name: "UI/UX Pro Max",
    description: "Advanced UI/UX design patterns, design systems, and visual quality standards",
    source: "https://github.com/anthropics/skills/ui-ux-pro-max",
    agents: ["claude-code", "pi"],
  },
  {
    id: "brainstorming",
    name: "Brainstorming",
    description: "Use before any creative or planning task — divergent thinking, design exploration",
    source: "superpowers:brainstorming",
    agents: ["claude-code", "pi", "codex"],
  },
  {
    id: "systematic-debugging",
    name: "Systematic Debugging",
    description: "Structured debugging workflow — root cause analysis, hypothesis testing",
    source: "superpowers:systematic-debugging",
    agents: ["claude-code", "pi"],
  },
  {
    id: "test-driven-development",
    name: "Test-Driven Development",
    description: "Write tests first, then implement — TDD workflow with quality gates",
    source: "superpowers:test-driven-development",
    agents: ["claude-code", "pi"],
  },
  {
    id: "code-review",
    name: "Code Review",
    description: "Comprehensive code review — correctness, bugs, simplification, reuse",
    source: "superpowers:requesting-code-review",
    agents: ["claude-code", "pi"],
  },
  {
    id: "writing-plans",
    name: "Writing Plans",
    description: "Design implementation plans before coding — architecture, phases, verification",
    source: "superpowers:writing-plans",
    agents: ["claude-code", "pi"],
  },
  {
    id: "using-git-worktrees",
    name: "Git Worktrees",
    description: "Isolated git worktrees for parallel feature development",
    source: "superpowers:using-git-worktrees",
    agents: ["claude-code", "pi"],
  },
  {
    id: "verification-before-completion",
    name: "Verification Before Completion",
    description: "Verify that code changes actually work before marking tasks complete",
    source: "superpowers:verification-before-completion",
    agents: ["claude-code", "pi"],
  },
  {
    id: "subagent-driven-development",
    name: "Subagent-Driven Development",
    description: "Orchestrate multi-agent workflows for complex development tasks",
    source: "superpowers:subagent-driven-development",
    agents: ["claude-code", "pi"],
  },
  {
    id: "dispatching-parallel-agents",
    name: "Dispatching Parallel Agents",
    description: "Run multiple agents in parallel for independent work streams",
    source: "superpowers:dispatching-parallel-agents",
    agents: ["claude-code", "pi"],
  },
  {
    id: "executing-plans",
    name: "Executing Plans",
    description: "Execute structured implementation plans with phase tracking",
    source: "superpowers:executing-plans",
    agents: ["claude-code", "pi"],
  },
  {
    id: "finishing-a-development-branch",
    name: "Finishing a Development Branch",
    description: "Clean up, review, commit, and PR workflow for branch completion",
    source: "superpowers:finishing-a-development-branch",
    agents: ["claude-code", "pi"],
  },
  {
    id: "django-patterns",
    name: "Django Patterns",
    description: "Django framework patterns — ORM, views, testing, security",
    source: "community",
    agents: ["claude-code", "pi"],
  },
  {
    id: "laravel-patterns",
    name: "Laravel Patterns",
    description: "Laravel framework patterns — Eloquent, controllers, testing",
    source: "community",
    agents: ["claude-code", "pi"],
  },
  {
    id: "golang-patterns",
    name: "Go Patterns",
    description: "Idiomatic Go patterns — concurrency, error handling, testing",
    source: "community",
    agents: ["claude-code", "pi"],
  },
  {
    id: "rust-patterns",
    name: "Rust Patterns",
    description: "Rust patterns — ownership, lifetimes, async, testing",
    source: "community",
    agents: ["claude-code", "pi"],
  },
  {
    id: "python-patterns",
    name: "Python Patterns",
    description: "Python design patterns and best practices",
    source: "community",
    agents: ["claude-code", "pi"],
  },
  {
    id: "swiftui-patterns",
    name: "SwiftUI Patterns",
    description: "SwiftUI design patterns — views, state, navigation",
    source: "community",
    agents: ["claude-code", "pi"],
  },
  {
    id: "kotlin-patterns",
    name: "Kotlin Patterns",
    description: "Kotlin patterns — coroutines, flows, Android patterns",
    source: "community",
    agents: ["claude-code", "pi"],
  },
  {
    id: "hipaa-compliance",
    name: "HIPAA Compliance",
    description: "Healthcare data compliance and PHI protection patterns",
    source: "community",
    agents: ["claude-code", "pi"],
  },
];

export function searchMarketplace(q?: string, agent?: string): MarketplaceSkill[] {
  let results = MARKETPLACE;

  if (q) {
    const lower = q.toLowerCase();
    results = results.filter(
      (s) =>
        s.name.toLowerCase().includes(lower) ||
        s.description.toLowerCase().includes(lower) ||
        s.id.includes(lower),
    );
  }

  if (agent) {
    results = results.filter((s) => s.agents.includes(agent));
  }

  return results;
}
