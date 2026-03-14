import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { createPublicClient, formatEther, http } from "viem";
import { baseSepolia } from "viem/chains";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import { deriveBaseSepoliaRpcUrl, extractDeployedAddress, upsertEnvValue } from "./base-sepolia-bootstrap-lib.js";

const rootDir = process.cwd();
const envLocalPath = resolve(rootDir, ".env.local");
const contractsDir = resolve(rootDir, "packages/contracts");

function readEnvFile(): string {
  if (!existsSync(envLocalPath)) {
    return "";
  }

  return readFileSync(envLocalPath, "utf8");
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

function writeEnvUpdates(updates: Record<string, string>): void {
  let content = readEnvFile();
  for (const [key, value] of Object.entries(updates)) {
    content = upsertEnvValue(content, key, value);
  }
  writeFileSync(envLocalPath, content, "utf8");
}

function readOrCreatePrivateKey(content: string): `0x${string}` {
  const existingPrivateKey = readEnvValue(content, "BASE_SEPOLIA_SERVER_SIGNER_PRIVATE_KEY");
  if (!existingPrivateKey) {
    return generatePrivateKey();
  }

  if (!/^0x[a-fA-F0-9]{64}$/.test(existingPrivateKey)) {
    throw new Error("BASE_SEPOLIA_SERVER_SIGNER_PRIVATE_KEY must be a 32-byte hex string");
  }

  return existingPrivateKey as `0x${string}`;
}

async function main(): Promise<void> {
  const envContent = readEnvFile();
  const signerPrivateKey = readOrCreatePrivateKey(envContent);
  const signerAccount = privateKeyToAccount(signerPrivateKey);

  const fallbackRpcUrl = process.env.ALCHEMY_BASE_MAINNET_RPC_URL ?? process.env.ALCHEMY_RPC_URL;
  const rpcUrl =
    readEnvValue(envContent, "ALCHEMY_BASE_SEPOLIA_RPC_URL")
    ?? deriveBaseSepoliaRpcUrl({
      ...(process.env.ALCHEMY_API_KEY ? { alchemyApiKey: process.env.ALCHEMY_API_KEY } : {}),
      ...(fallbackRpcUrl ? { rpcUrl: fallbackRpcUrl } : {}),
    });

  const ownerAddress = readEnvValue(envContent, "PAYMENT_JOB_REGISTRY_OWNER") ?? signerAccount.address;
  const settlementReceiver =
    readEnvValue(envContent, "PAYMENT_JOB_REGISTRY_SETTLEMENT_RECEIVER") ?? signerAccount.address;

  const baseEnvUpdates: Record<string, string> = {
    BASE_SEPOLIA_SERVER_SIGNER_PRIVATE_KEY: signerPrivateKey,
    PAYMENT_JOB_REGISTRY_OWNER: ownerAddress,
    PAYMENT_JOB_REGISTRY_SETTLEMENT_RECEIVER: settlementReceiver,
  };

  if (rpcUrl) {
    baseEnvUpdates.ALCHEMY_BASE_SEPOLIA_RPC_URL = rpcUrl;
  }

  writeEnvUpdates(baseEnvUpdates);

  console.log(`Base Sepolia signer address: ${signerAccount.address}`);
  console.log(`Signer env written to ${envLocalPath}`);

  if (!rpcUrl) {
    console.error("Missing Base Sepolia RPC URL. Set ALCHEMY_BASE_SEPOLIA_RPC_URL or ALCHEMY_API_KEY and rerun.");
    process.exitCode = 1;
    return;
  }

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  const balance = await publicClient.getBalance({ address: signerAccount.address });
  console.log(`Current signer balance: ${formatEther(balance)} ETH on Base Sepolia`);

  if (balance === 0n) {
    console.log("Signer needs testnet funds before deployment.");
    console.log(`Fund this address on Base Sepolia and rerun: ${signerAccount.address}`);
    console.log("Suggested funding sources:");
    console.log("- https://www.alchemy.com/faucets/base-sepolia");
    console.log("- https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet");
    process.exitCode = 1;
    return;
  }

  console.log("Attempting deployment with current balance.");

  const deploy = spawnSync(
    "forge",
    [
      "script",
      "script/DeployPaymentJobRegistry.s.sol:DeployPaymentJobRegistry",
      "--rpc-url",
      rpcUrl,
      "--private-key",
      signerPrivateKey,
      "--broadcast",
    ],
    {
      cwd: contractsDir,
      encoding: "utf8",
      env: {
        ...process.env,
        PAYMENT_JOB_REGISTRY_OWNER: ownerAddress,
        PAYMENT_JOB_REGISTRY_SETTLEMENT_RECEIVER: settlementReceiver,
      },
    },
  );

  const combinedOutput = `${deploy.stdout}\n${deploy.stderr}`;
  process.stdout.write(deploy.stdout);
  process.stderr.write(deploy.stderr);

  if (deploy.status !== 0) {
    throw new Error("Foundry deployment failed");
  }

  const registryAddress = extractDeployedAddress(combinedOutput);
  if (!registryAddress) {
    throw new Error("Deployment succeeded but the contract address was not found in forge output");
  }

  writeEnvUpdates({
    ...baseEnvUpdates,
    ALCHEMY_BASE_SEPOLIA_RPC_URL: rpcUrl,
    PAYMENT_JOB_REGISTRY_ADDRESS: registryAddress,
  });

  console.log(`PaymentJobRegistry address written to ${envLocalPath}: ${registryAddress}`);
  console.log(`Basescan: https://sepolia.basescan.org/address/${registryAddress}`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
