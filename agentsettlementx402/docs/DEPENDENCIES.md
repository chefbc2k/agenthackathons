# Dependency Policy

## Allowed Dependencies

Runtime and development dependencies are restricted to:

- `typescript`
- `tsx`
- `vitest`
- `@vitest/coverage-v8`
- `eslint`
- `@typescript-eslint/parser`
- `@typescript-eslint/eslint-plugin`
- `prettier`
- `zod`
- `drizzle-orm`
- `drizzle-kit`
- `@neondatabase/serverless`
- `@upstash/redis`
- `@upstash/qstash`
- `undici` only if built-in `fetch` is insufficient
- `pino` optionally

## Current Policy

- Prefer built-in Node APIs before adding dependencies.
- Restrict external services to Neon and Upstash only.
- Prefer Neon for Postgres connectivity and documented Neon platform features such as connection pooling.
- Prefer Upstash Redis and QStash for cache, coordination, and cron-based scheduling.
- Use QStash schedules rather than building a custom scheduler.
- Do not add a new dependency unless it is on the approved whitelist.
- Do not introduce UI frameworks or business-layer SDKs in the foundation phase.

## Protocol Alignment

- Respect A2A discovery conventions for well-known agent-card retrieval and normalized identity metadata.
- Respect x402 structures for payment requirements and settlement evidence.
- Treat Bazaar as the official x402 discovery layer in this project.
- Preserve payTo-style payment requirement semantics in normalized and persisted records.
