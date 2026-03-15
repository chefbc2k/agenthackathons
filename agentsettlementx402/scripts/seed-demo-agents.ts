import { createDatabaseClientFromEnvironment } from "../src/db/connection.js";
import {
  createAgentRepository,
  createServiceRepository,
  createPaymentEventRepository,
} from "../src/db/implementations.js";

/**
 * Seed demo agents with A2A x402 receipt-based payment evidence
 *
 * This creates:
 * - 3 demo agents with varied performance profiles
 * - Payment attempts using direct agentId/serviceId FKs (not wallet joins)
 * - CAIP-2 compliant network identifiers
 * - Realistic attempt distributions (retries, failures, success rates)
 */
async function seedDemoAgents() {
  const db = createDatabaseClientFromEnvironment();
  const agentRepo = createAgentRepository(db);
  const serviceRepo = createServiceRepository(db);
  const paymentEventRepo = createPaymentEventRepository(db);

  console.log("🌱 Seeding demo agents with A2A x402 evidence...\n");

  // 1. Create 3 demo agents
  const demoAgents = [
    {
      agentCardUrl: "https://demo-alpha.agentsettlement.example/.well-known/agent-card.json",
      displayName: "AI Assistant Alpha",
      providerOrganization: "Demo Corp",
      providerUrl: "https://demo.agentsettlement.example",
    },
    {
      agentCardUrl: "https://demo-beta.agentsettlement.example/.well-known/agent-card.json",
      displayName: "Data Processor Beta",
      providerOrganization: "Demo Corp",
      providerUrl: "https://demo.agentsettlement.example",
    },
    {
      agentCardUrl: "https://demo-gamma.agentsettlement.example/.well-known/agent-card.json",
      displayName: "Research Agent Gamma",
      providerOrganization: "Demo Corp",
      providerUrl: "https://demo.agentsettlement.example",
    },
  ];

  const agents = [];
  for (const demo of demoAgents) {
    const agent = await agentRepo.upsert(demo);
    agents.push(agent);
    console.log(`✓ Created agent: ${agent.displayName} (${agent.id})`);
  }

  // 2. Get existing services from Bazaar to use as payment targets
  const services = await db.query.services.findMany({
    limit: 5,
    columns: {
      id: true,
      network: true,
      asset: true,
      payToWalletId: true,
    },
  });

  if (services.length === 0) {
    console.log("\n⚠️  No services found. Run Bazaar ingestion first:");
    console.log("   pnpm worker:run");
    return;
  }

  console.log(`\n✓ Found ${services.length} services from Bazaar\n`);

  // 3. Create payment attempts with varied performance profiles
  const now = new Date();
  const network = "eip155:8453"; // CAIP-2 for Base

  // Agent Alpha: High performer (90% success, 1.1 avg retries)
  console.log("Creating payment attempts for AI Assistant Alpha (high performer)...");
  await createAgentAttempts({
    agent: agents[0]!,
    services,
    network,
    baseTime: now,
    taskCount: 10,
    successRate: 0.9,
    avgRetries: 1.1,
    paymentEventRepo,
  });

  // Agent Beta: Medium performer (70% success, 1.8 avg retries)
  console.log("Creating payment attempts for Data Processor Beta (medium performer)...");
  await createAgentAttempts({
    agent: agents[1]!,
    services,
    network,
    baseTime: now,
    taskCount: 10,
    successRate: 0.7,
    avgRetries: 1.8,
    paymentEventRepo,
  });

  // Agent Gamma: Low performer (40% success, 2.5 avg retries)
  console.log("Creating payment attempts for Research Agent Gamma (low performer)...");
  await createAgentAttempts({
    agent: agents[2]!,
    services,
    network,
    baseTime: now,
    taskCount: 10,
    successRate: 0.4,
    avgRetries: 2.5,
    paymentEventRepo,
  });

  console.log("\n✅ Demo agents seeded successfully!");
  console.log("\nNext steps:");
  console.log("1. Run worker to compute metrics: pnpm worker:run");
  console.log("2. View dashboard: http://127.0.0.1:8081/dashboard");
  console.log("3. Check API stats: curl http://127.0.0.1:8081/api/stats");
}

interface CreateAgentAttemptsParams {
  agent: { id: string; displayName: string };
  services: Array<{ id: string; network: string; asset: string | null; payToWalletId: string }>;
  network: string;
  baseTime: Date;
  taskCount: number;
  successRate: number;
  avgRetries: number;
  paymentEventRepo: any;
}

async function createAgentAttempts({
  agent,
  services,
  network,
  baseTime,
  taskCount,
  successRate,
  avgRetries,
  paymentEventRepo,
}: CreateAgentAttemptsParams) {
  let attemptCount = 0;

  for (let taskIndex = 0; taskIndex < taskCount; taskIndex++) {
    const service = services[taskIndex % services.length]!;
    const taskId = `demo-task-${agent.id.slice(0, 8)}-${taskIndex}`;

    // Determine retry count based on avgRetries
    const retries = Math.random() < 0.5
      ? Math.floor(avgRetries)
      : Math.ceil(avgRetries);

    // Create attempts for this task
    for (let attemptIndex = 0; attemptIndex < retries; attemptIndex++) {
      const isLastAttempt = attemptIndex === retries - 1;
      const shouldSucceed = isLastAttempt && Math.random() < successRate;

      const sourceReference = `${taskId}:${attemptIndex}`;
      const observedAt = new Date(baseTime.getTime() - (taskCount - taskIndex) * 3600000); // Spread over hours

      const confidenceTier = shouldSucceed ? "high" : attemptIndex > 0 ? "low" : "medium";
      const confidenceScore = shouldSucceed ? 900 : attemptIndex > 0 ? 300 : 600;

      await paymentEventRepo.create({
        agentId: agent.id,
        serviceId: service.id,
        attemptGroupId: taskId,
        payerWalletId: null, // Partner provides agentId directly, payer wallet is optional
        payToWalletId: service.payToWalletId, // Service's payment wallet from Bazaar
        txHash: shouldSucceed ? `0x${randomHex(64)}` : sourceReference,
        network,
        asset: service.asset || "USDC",
        amount: "100000000", // 100 USDC (6 decimals)
        observedAt,
        blockNumber: null,
        confidenceTier,
        confidenceScore,
        source: "a2a_x402_receipt" as const,
        sourceReference,
      });

      attemptCount++;
    }
  }

  console.log(`  ✓ Created ${attemptCount} payment attempts for ${agent.displayName}`);
}

function randomHex(length: number): string {
  const chars = "0123456789abcdef";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

seedDemoAgents().catch((error) => {
  console.error("❌ Seed failed:", error);
  process.exit(1);
});
