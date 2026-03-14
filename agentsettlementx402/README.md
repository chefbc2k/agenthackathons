# Cross-Agent Reputation Graph

Read-only intelligence layer for A2A agent discovery, x402 Bazaar resource discovery, observable payment evidence, graph linking, metrics, and inference-based reputation scoring.

## Architecture Overview

The service is split into a few clear layers:

- `src/core`
  - Protocol subsets and canonical normalized types for A2A, x402, and x402-over-HTTP.
- `src/ingest`
  - Pure ingestion/parsing for A2A agent cards, Bazaar resources, and optional A2A x402 receipts.
- `src/db`
  - Drizzle schema plus repository ports/adapters for Neon Postgres.
- `src/linking`
  - Deterministic agent-to-service edge creation with confidence tiers and public-safe evidence.
- `src/metrics`
  - Strictly observable metrics only: usage, unique payers, success/failure, retry intensity, recency windows.
- `src/scoring`
  - Inference-only reputation scoring derived from observable metrics.
- `src/api`
  - Read-only JSON API with typed responses, pagination, short-TTL list caching, and debug-only inspection routes.
- `src/worker`
  - One-pass orchestration for ingest -> persist -> link -> metrics -> scoring.
- `src/scheduler`
  - Upstash QStash schedule management for recurring worker execution.
- `src/observability`
  - Structured JSON logging with redaction and debug-mode guardrails.

## Stack

- Database: Neon Postgres
- Cache: Upstash Redis REST
- Scheduler/Webhooks: Upstash QStash
- ORM/Migrations: Drizzle ORM + Drizzle Kit
- Runtime validation: Zod
- Runtime: TypeScript + `tsx`
- Tests/Coverage: Vitest with hard 100% repo thresholds

## Quickstart

### 1. Install

This repo includes a local [pnpm-workspace.yaml](/Volumes/machdext/speakplatform/Final/agenthackathons/agentsettlementx402/pnpm-workspace.yaml) so `pnpm install` works from this directory even when it lives inside a larger mono-repo.

```bash
pnpm install
```

### 2. Configure environment

Create a local `.env` file or export variables in your shell.

Minimal local API + worker example:

```bash
DATABASE_URL="postgresql://user:password@ep-example.us-east-1.aws.neon.tech/app?sslmode=require"

UPSTASH_REDIS_REST_URL="https://example-12345.upstash.io"
UPSTASH_REDIS_REST_TOKEN="redis-rest-token"

A2A_AGENT_DOMAINS="example.com,another.example"
X402_BAZAAR_FACILITATOR_URL="https://facilitator.example.com"

DEBUG_MODE="false"
PORT="8080"
WORKER_RECEIVER_PORT="8787"
```

With QStash scheduling enabled:

```bash
QSTASH_TOKEN="qstash-token"
QSTASH_CURRENT_SIGNING_KEY="current-signing-key"
QSTASH_NEXT_SIGNING_KEY="next-signing-key"
QSTASH_SCHEDULE_DESTINATION="https://your-host.example.com/internal/worker"
QSTASH_SCHEDULE_CRON="*/5 * * * *"
```

You can also use `WORKER_SCHEDULE_MINUTES="5"` as a cron helper when creating schedules.

### 3. Verify the baseline

```bash
pnpm test
pnpm lint
pnpm typecheck
```

### 4. Start the API

```bash
pnpm dev
```

Default endpoint:

- `GET /health`

### 5. Run one worker pass manually

```bash
pnpm worker:run
```

This is the local-only mode. It does not require QStash and is the fastest way to run one ingestion + recompute pass during development.

## Environment Variables

Required:

- `DATABASE_URL`
- One Redis credential pair:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
  - or `KV_REST_API_URL`
  - `KV_REST_API_TOKEN`

Core optional:

- `A2A_AGENT_DOMAINS`
  - Comma-separated base domains to crawl at `https://{domain}/.well-known/agent-card.json`
- `X402_BAZAAR_FACILITATOR_URL`
  - Bazaar discovery base URL
- `DEBUG_MODE`
  - `true` enables internal debug endpoints and debug log events
- `PORT`
  - API port, defaults to `8080`
- `WORKER_RECEIVER_PORT`
  - QStash receiver port, defaults to `8787`

QStash optional:

- `QSTASH_TOKEN`
- `QSTASH_CURRENT_SIGNING_KEY`
- `QSTASH_NEXT_SIGNING_KEY`
- `QSTASH_SCHEDULE_DESTINATION`
- `QSTASH_SCHEDULE_CRON`
- `WORKER_SCHEDULE_MINUTES`

RPC optional:

- `RPC_URL_BASE`
- `RPC_URL_ETHEREUM`
- `RPC_URL_OPTIMISM`

See [docs/ENVIRONMENT.md](/Volumes/machdext/speakplatform/Final/agenthackathons/agentsettlementx402/docs/ENVIRONMENT.md) for the full environment reference.

## Sample Ingestion Config

Small A2A domain list:

```bash
A2A_AGENT_DOMAINS="example.com,docs.example.ai,agents.example.org"
```

Sample Bazaar facilitator:

```bash
X402_BAZAAR_FACILITATOR_URL="https://facilitator.example.com"
```

## Commands

Development:

```bash
pnpm dev
pnpm worker:run
pnpm worker:serve
pnpm scheduler:ensure
```

Quality gates:

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Database:

```bash
pnpm db:generate
pnpm migrate
```

Formatting:

```bash
pnpm format
pnpm format:write
```

## Local-Only Mode

Use this mode when you want to develop without QStash:

1. Set `DATABASE_URL`, Redis credentials, `A2A_AGENT_DOMAINS`, and `X402_BAZAAR_FACILITATOR_URL`.
2. Leave all `QSTASH_*` variables unset.
3. Start the API with `pnpm dev`.
4. Run one orchestration pass manually with `pnpm worker:run`.

This gives you:

- the read-only API
- manual ingestion/recompute
- no scheduled webhooks
- no receiver signing requirements

## Privacy Guardrails

- Public endpoints do not return raw stored payloads.
- Public metrics expose aggregate payer counts only.
- Structured logs redact payer identities, secrets, and raw payload fields.
- Debug inspection routes exist only when `DEBUG_MODE=true`.

## Related Docs

- [docs/ARCHITECTURE.md](/Volumes/machdext/speakplatform/Final/agenthackathons/agentsettlementx402/docs/ARCHITECTURE.md)
- [docs/ENVIRONMENT.md](/Volumes/machdext/speakplatform/Final/agenthackathons/agentsettlementx402/docs/ENVIRONMENT.md)
- [docs/QSTASH.md](/Volumes/machdext/speakplatform/Final/agenthackathons/agentsettlementx402/docs/QSTASH.md)
- [docs/DEPENDENCIES.md](/Volumes/machdext/speakplatform/Final/agenthackathons/agentsettlementx402/docs/DEPENDENCIES.md)
- [docs/DEFINITION_OF_DONE.md](/Volumes/machdext/speakplatform/Final/agenthackathons/agentsettlementx402/docs/DEFINITION_OF_DONE.md)
