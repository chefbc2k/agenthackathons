# Definition of Done

The project is done only when all of the following are true:

- All modules are layered in the correct order:
  - schemas, types, and interfaces before adapters
  - ingestion before persistence
  - persistence before API
  - scoring only after observable metrics exist
- `pnpm typecheck` passes.
- `pnpm lint` passes.
- `pnpm test` passes.
- Coverage is reported and enforced for lines, branches, functions, and statements.
- Hard floor is `95%` for all four metrics.
- Working target is `100%` for all four metrics.
- The current baseline remains at `100%` for all four metrics.
- Coverage gates are enforced by configuration supported by Jest/Vitest threshold capabilities, not by convention.
- External services are restricted to:
  - Neon for Postgres
  - Upstash Redis for cache/coordination
  - Upstash QStash for cron-based scheduling
- Neon and Upstash usage must rely on documented platform features such as:
  - Neon connection pooling where appropriate
  - QStash cron schedules for recurring orchestration
- Protocol adherence is respected for:
  - A2A discovery conventions
  - x402 structures
  - Bazaar as the x402 discovery layer
  - payTo-style payment requirements and related normalized evidence
- Documentation exists for architecture, dependencies, environment, and this definition of done.
- No deferred coverage, layering, or infrastructure-policy setup remains.

## Root-Cause Rule

If a quality gate fails, fix the source of the failure. Do not weaken the gate to make the pipeline pass.
