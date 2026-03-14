import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { createPublicClient, createWalletClient, formatEther, http, parseEther } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const rootDir = process.cwd();
const envLocalPath = resolve(rootDir, ".env.local");
const testWalletsPath = resolve(rootDir, ".env.test-wallets.local");

function readEnvContent(path: string): string {
  if (!existsSync(path)) {
    return "";
  }

  return readFileSync(path, "utf8");
}

function readEnvValue(content: string, key: string): string | undefined {
  const line = content
    .split(/\r?\n/)
    .find((entry) => entry.startsWith(`${key}=`));

  if (!line) {
    return undefined;
  }

  return line.slice(key.length + 1);
}

function requireEnvValue(content: string, key: string): string {
  const value = readEnvValue(content, key);
  if (!value) {
    throw new Error(`Missing ${key} in .env.local`);
  }
  return value;
}

function parseCount(value: string | undefined): number {
  const raw = Number.parseInt(value ?? "2", 10);
  if (!Number.isInteger(raw) || raw <= 0 || raw > 10) {
    throw new Error("COUNT must be an integer between 1 and 10");
  }
  return raw;
}

async function main(): Promise<void> {
  const envContent = readEnvContent(envLocalPath);
  const rpcUrl = requireEnvValue(envContent, "ALCHEMY_BASE_SEPOLIA_RPC_URL");
  const signerPrivateKey = requireEnvValue(envContent, "BASE_SEPOLIA_SERVER_SIGNER_PRIVATE_KEY") as `0x${string}`;
  const count = parseCount(process.env.COUNT);
  const amountPerWallet = parseEther(process.env.AMOUNT_ETH ?? "0.00001");

  const account = privateKeyToAccount(signerPrivateKey);
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  const startingBalance = await publicClient.getBalance({ address: account.address });
  const chainId = await publicClient.getChainId();

  console.log(`Seeder signer: ${account.address}`);
  console.log(`Chain ID: ${chainId}`);
  console.log(`Starting balance: ${formatEther(startingBalance)} ETH`);
  console.log(`Creating ${count} wallet(s) with ${formatEther(amountPerWallet)} ETH each`);
  console.log("Note: PaymentJobRegistry remains owner-only; these wallets are for app-level scenario rehearsal.");

  const generated: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const walletPrivateKey = generatePrivateKey();
    const walletAccount = privateKeyToAccount(walletPrivateKey);
    const hash = await walletClient.sendTransaction({
      account,
      chain: baseSepolia,
      to: walletAccount.address,
      value: amountPerWallet,
    });

    await publicClient.waitForTransactionReceipt({ hash });

    generated.push(`TEST_WALLET_${index + 1}_ADDRESS=${walletAccount.address}`);
    generated.push(`TEST_WALLET_${index + 1}_PRIVATE_KEY=${walletPrivateKey}`);
    generated.push(`TEST_WALLET_${index + 1}_FUNDING_TX=${hash}`);

    console.log(`Funded wallet ${index + 1}: ${walletAccount.address} (${hash})`);
  }

  writeFileSync(testWalletsPath, `${generated.join("\n")}\n`, "utf8");

  const endingBalance = await publicClient.getBalance({ address: account.address });
  console.log(`Remaining signer balance: ${formatEther(endingBalance)} ETH`);
  console.log(`Saved wallet material to ${testWalletsPath}`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
