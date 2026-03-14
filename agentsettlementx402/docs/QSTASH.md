# QStash Setup

## Purpose

Use Upstash QStash schedules to trigger the background sync worker on a cron cadence. Do not run an in-process scheduler for this service.

## Required Environment

- `QSTASH_TOKEN`
- `QSTASH_SCHEDULE_DESTINATION`
- One of:
  - `QSTASH_SCHEDULE_CRON`
  - `WORKER_SCHEDULE_MINUTES`

For signed webhook verification on the receiver:

- `QSTASH_CURRENT_SIGNING_KEY`
- `QSTASH_NEXT_SIGNING_KEY`

## Local Commands

Create or update the schedule:

```bash
pnpm scheduler:ensure
```

Run the worker once manually:

```bash
pnpm worker:run
```

Start the local receiver endpoint:

```bash
pnpm worker:serve
```

## Receiver Contract

- Receiver expects `POST`
- Payload is a JSON worker job envelope
- Repeated QStash deliveries are handled idempotently using the message id or job key

## Schedule Behavior

- Schedule creation is idempotent
- If the existing schedule already matches destination, cron, method, and body, the scheduler returns `noop`
- If the existing schedule differs, it is replaced deterministically
