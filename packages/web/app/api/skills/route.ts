import { NextResponse } from "next/server";

// GET /api/skills — list available skills
export async function GET() {
  // Stub — will be replaced in Phase 4
  return NextResponse.json({
    skills: [
      { id: "frontend-design", name: "Frontend Design", installed: false },
      { id: "ui-ux-pro-max", name: "UI/UX Pro Max", installed: false },
      { id: "brainstorming", name: "Brainstorming", installed: false },
      { id: "systematic-debugging", name: "Systematic Debugging", installed: false },
    ],
  });
}
