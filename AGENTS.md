# AGENTS.md

## Project
This repo is an admin panel for The Humor Project built with Next.js 14, TypeScript, and Supabase.

## Core rule
Preserve the existing admin dashboard UI and extend it incrementally.
Do not replace working pages with generic CRUD scaffolds or full-page table dumps.

## Stack
- Next.js 14
- TypeScript
- Supabase
- Google OAuth
- superadmin-only access

## Auth and security
- Middleware-based protection already exists.
- Unauthenticated users go to /login.
- Authenticated users must have profiles.is_superadmin = true.
- Do not weaken or bypass auth checks.
- Do not expose service keys in client code.

## UI rules
- Keep the current homepage/dashboard layout intact.
- Extend via section cards, tabs, nested panels, or subcomponents.
- Avoid broad visual redesigns.
- Prefer card-based admin UI over raw giant tables.
- Keep stats visible at the top.

## Data rules
- Do not guess schema columns.
- Inspect existing code/types/schema first.
- If uncertain, add TODOs instead of hallucinating.
- Read-only tables must stay read-only.
- CRUD only where assignment requires CRUD.

## Workflow
- Inspect before editing.
- Make focused changes.
- Avoid unrelated refactors.
- After editing, run lint/build and fix issues.
- Summarize changed files and assumptions after each iteration.
