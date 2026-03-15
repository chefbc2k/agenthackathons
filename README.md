# Accord Pay

Accord Pay is a Telegram-first bill-pay worker that turns a Telegram DM flow into a typed `PaymentJob`, anchors lifecycle checkpoints on Base Sepolia, executes Visa sandbox invoice/payment-link creation, and returns a proof package with explorer links and a final receipt hash.

The confirmation boundary is replay-safe: re-confirming the same job resumes or returns the existing outcome instead of minting a second onchain job or duplicating Visa artifacts.

## Workspace

- `apps/web` — Next.js control plane, Telegram webhook endpoints, admin/status UI
- `packages/core` — canonical schemas, hashing, DM flow helpers
- `packages/execution` — Visa adapter, validation, proof-package formatting
- `packages/contracts` — Foundry contract and tests for `PaymentJobRegistry`

## Commands

```bash
pnpm install
pnpm repo:public-check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Public Repo Prep

Run `pnpm repo:public-check` before publishing or pushing to a public remote. The audit fails if the workspace still contains local `.env*` files or nested `.git` directories that would make the root repository unsafe or misleading to share.

## Environment

Copy `.env.example` to `.env.local` and provide:

- Telegram bot token and webhook secret
- Base Sepolia RPC, signer key, and deployed contract address
- Visa sandbox credentials
- Synthesis registration artifacts

## Live Setup Notes

- `ALCHEMY_BASE_SEPOLIA_RPC_URL`: create a Base Sepolia app in Alchemy and copy the HTTPS RPC URL.
- `BASE_SEPOLIA_SERVER_SIGNER_PRIVATE_KEY`: use a dedicated project wallet, not a personal wallet.
- `PAYMENT_JOB_REGISTRY_OWNER`: use the signer wallet address for MVP unless you want a separate admin.
- `PAYMENT_JOB_REGISTRY_SETTLEMENT_RECEIVER`: use the signer wallet address for MVP unless you want a separate treasury.
- `PAYMENT_JOB_REGISTRY_ADDRESS`: deploy `PaymentJobRegistry` to Base Sepolia and paste the deployed contract address.
- `SYNTHESIS_*`: already captured from the registration response and stored locally.

## Base Sepolia Bootstrap

Run the bootstrap script to create the dedicated Base Sepolia signer, derive the Base Sepolia Alchemy RPC URL from `ALCHEMY_API_KEY` if needed, check signer funding, and deploy `PaymentJobRegistry` once the signer has enough testnet ETH:

```bash
ALCHEMY_API_KEY=your-alchemy-key pnpm chain:bootstrap
```

If the signer is unfunded, the script writes the signer env vars into `.env.local`, prints the address to fund, and exits so you can use a Base Sepolia faucet. After you fund the signer, rerun the same command and the script will deploy the contract and write `PAYMENT_JOB_REGISTRY_ADDRESS` back into `.env.local`.

## Scenario wallets

For local rehearsals you can mint disposable Base Sepolia wallets and fund them from the project signer:

```bash
COUNT=2 AMOUNT_ETH=0.00001 pnpm chain:seed-test-wallets
```

The generated addresses, private keys, and funding transaction hashes are written to `.env.test-wallets.local`. These wallets are useful for testing app-level requester/worker identities. The current onchain registry still uses the project signer as the only contract caller.
