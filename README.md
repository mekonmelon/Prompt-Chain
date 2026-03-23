# Prompt Chain Studio

Prompt Chain Studio is a Next.js 14 + TypeScript + Supabase admin tool for managing Humor Project prompt chains (humor flavors), their ordered steps, and a REST-driven flavor testing workflow.

## Environment

Create `.env.local` with the existing class Supabase project values:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Optional runtime variable for the Assignment 5-compatible test endpoint:

```bash
HUMOR_PROJECT_REST_API_URL=https://your-api.example.com/path-to-caption-test-endpoint
```

## Auth and authorization

- Google OAuth only.
- Unauthenticated users are redirected to `/login`.
- Authenticated users must have either `public.profiles.is_superadmin = true` or `public.profiles.is_matrix_admin = true`.
- Authenticated users without one of those flags are redirected to `/unauthorized`.

## Studio sections

- **Overview** — humor flavor summary, counts, recently updated flavor, quick actions.
- **Flavors** — create, edit, duplicate, and delete humor flavors in a master/detail layout.
- **Steps** — add, edit, delete, and reorder `humor_flavor_steps` for the selected flavor.
- **Test Runner** — send a selected flavor + image source through the Humor Project REST API.
- **Results / Captions** — read recent captions associated with the selected flavor when flavor keys are present on caption rows.
- **Audit Trail** — read-only inspection of `llm_prompt_chains` and `llm_model_responses`.

## Schema-aware guardrails

This repo intentionally avoids inventing unsupported columns:

- Structured editing inputs are only shown for columns detected in currently loaded rows.
- Flavor and step writes include `created_by_user_id` / `modified_by_user_id` for audit compatibility.
- DB-managed datetime columns are not sent manually in the new flavor/step write flows.
- If the REST endpoint is not configured, the test runner returns a clear debugging error instead of silently failing.

## Development

```bash
npm test
npm run dev
```

## Notes

- The test runner currently assumes `HUMOR_PROJECT_REST_API_URL` points directly to the Assignment 5-compatible endpoint that accepts a JSON payload containing the selected flavor and image source.
- If your deployed backend expects a different payload or route shape, update the internal proxy route in `app/api/prompt-chain-test/route.ts`.
