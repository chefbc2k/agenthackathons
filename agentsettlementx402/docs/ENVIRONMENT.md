# Environment

## Required

- `DATABASE_URL`
  - Neon Postgres connection string.
  - Pooled or direct Postgres URL is accepted.
- One Redis credential pair:
  - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
  - or `KV_REST_API_URL` and `KV_REST_API_TOKEN`

## Optional

- `QSTASH_TOKEN`
  - Enables QStash integration when present.
- `QSTASH_CURRENT_SIGNING_KEY`
- `QSTASH_NEXT_SIGNING_KEY`
- `QSTASH_SCHEDULE_CRON`
- `QSTASH_SCHEDULE_DESTINATION`
  - If either scheduling field is set, both are required.
- `A2A_AGENT_DOMAINS`
  - Comma-separated base domains for A2A agent-card discovery.
- `X402_BAZAAR_FACILITATOR_URL`
  - x402 Bazaar facilitator base URL.
- `WORKER_SCHEDULE_MINUTES`
  - Optional cron helper. If `QSTASH_SCHEDULE_CRON` is omitted, this generates `*/N * * * *`.
- `WORKER_RECEIVER_PORT`
  - Port used by the local QStash receiver process. Defaults to `8787`.
- `DEBUG_MODE`
  - Enables internal debug endpoints and debug-level structured logs when set to `true`.
  - Defaults to `false`.
- `RPC_URL_BASE`
- `RPC_URL_ETHEREUM`
- `RPC_URL_OPTIMISM`
  - Default to empty strings when omitted.

## Example

```bash
DATABASE_URL="postgresql://user:password@ep-example.us-east-1.aws.neon.tech/dbname?sslmode=require"

UPSTASH_REDIS_REST_URL="https://example-12345.upstash.io"
UPSTASH_REDIS_REST_TOKEN="redis-rest-token"

QSTASH_TOKEN="qstash-token"
QSTASH_CURRENT_SIGNING_KEY="current-signing-key"
QSTASH_NEXT_SIGNING_KEY="next-signing-key"
QSTASH_SCHEDULE_CRON="*/5 * * * *"
QSTASH_SCHEDULE_DESTINATION="https://example.com/internal/jobs/probe"
A2A_AGENT_DOMAINS="example.com,another.example"
X402_BAZAAR_FACILITATOR_URL="https://facilitator.example.com"
WORKER_SCHEDULE_MINUTES="5"
WORKER_RECEIVER_PORT="8787"
DEBUG_MODE="false"

RPC_URL_BASE=""
RPC_URL_ETHEREUM=""
RPC_URL_OPTIMISM=""
```

## Safety Rules

- Config validation must fail fast before any runtime work begins.
- Secret values must never appear in logs or thrown error messages.
- Debug output must use the redaction-safe serializer.
- Public API responses must not expose raw payload storage or payer identities.
- Internal debug endpoints are disabled unless `DEBUG_MODE=true`.
