# Architecture

## Purpose

Cross-Agent Reputation/Audit Graph service for A2A discovery, x402/Bazaar discovery, observable payment evidence, graph linking, metrics, scoring, and read-only APIs.

## Layering Order

The system is built and maintained in this order:

1. Schemas, types, and interfaces
2. Protocol parsers and normalization
3. Ingestion modules
4. Persistence adapters and repositories
5. Linking and graph-edge creation
6. Observable metrics
7. Inference-based scoring
8. Read-only API
9. Background orchestration and scheduling

No layer should bypass an earlier source of truth.

## Runtime Boundaries

- `src/core`
  - Canonical protocol subsets and normalized internal types
- `src/ingest`
  - External payload ingestion and normalization
- `src/db`
  - Postgres schema and repository adapters
- `src/linking`
  - Deterministic graph-link creation with confidence tiers
- `src/metrics`
  - Strictly observable metrics only
- `src/scoring`
  - Inference-only reputation scoring on top of metrics
- `src/api`
  - Read-only public and debug-gated HTTP responses
- `src/worker`
  - Manual and scheduled orchestration
- `src/scheduler`
  - QStash cron schedule management

## External Services

- Neon
  - Primary Postgres database
  - Use documented Neon connection pooling patterns where appropriate
- Upstash Redis
  - Cache and idempotency/state coordination
- Upstash QStash
  - Cron-based recurring orchestration

No other external infrastructure is part of the supported architecture.

## Protocol Commitments

- A2A
  - Respect well-known agent-card discovery conventions
  - Model only justified subsets but keep the discovery contract intact
- x402
  - Respect normalized `PaymentRequired` and settlement evidence structures
  - Treat Bazaar as the official discovery layer
  - Preserve payTo-style payment requirement semantics in normalized records

## Quality Bar

- Coverage for lines, branches, functions, and statements is continuously enforced.
- Hard floor is `95%`; working target is `100%`.
- This repo currently maintains `100%` as the baseline.
