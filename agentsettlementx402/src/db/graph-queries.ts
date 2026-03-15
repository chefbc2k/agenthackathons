import { eq, desc, and, gte, sql } from "drizzle-orm";
import type { DatabaseClient } from "./connection.js";
import * as schema from "./schema.js";
import { scoreReputation } from "../scoring/reputation.js";
import type { ObservableMetrics } from "../metrics/observable.js";

export interface GraphNode {
  id: string;
  type: "agent" | "service";
  label: string;
  score?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  confidence: string;
  weight: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface DashboardStats {
  totalAgents: number;
  totalServices: number;
  totalLinks: number;
  avgReputationScore: number;
  recentActivity: {
    events7d: number;
    events30d: number;
  };
  confidenceDistribution: {
    low: number;
    medium: number;
    high: number;
    verified: number;
  };
}

export interface TimelineDataPoint {
  date: string;
  eventCount: number;
  avgSuccessRate: number;
}

export interface TopAgent {
  agentId: string;
  displayName: string;
  score: number;
  serviceCount: number;
}

export const fetchGraphData = async (db: DatabaseClient): Promise<GraphData> => {
  // Fetch all link edges between agents and services
  const edges = await db
    .select({
      sourceId: schema.linkEdges.sourceNodeId,
      targetId: schema.linkEdges.targetNodeId,
      confidence: schema.linkEdges.confidenceTier,
      weight: schema.linkEdges.confidenceScore,
    })
    .from(schema.linkEdges)
    .where(eq(schema.linkEdges.kind, "agent_to_service"));

  // Fetch all agents
  const agents = await db.select().from(schema.agents);

  // Fetch all services
  const services = await db.select().from(schema.services);

  // Fetch all metrics to compute scores
  const metrics = await db.select().from(schema.observableMetrics);

  // Build a map of agent scores
  const agentScores = new Map<string, number>();
  for (const metric of metrics) {
    const metricsObj: ObservableMetrics = {
      agentId: metric.agentId,
      serviceId: metric.serviceId,
      asOf: metric.asOf,
      usage: metric.usage as ObservableMetrics["usage"],
      success: metric.success as ObservableMetrics["success"],
      recency: metric.recency as ObservableMetrics["recency"],
      derivedProxies: metric.derivedProxies as ObservableMetrics["derivedProxies"],
    };

    const reputation = scoreReputation({
      agentId: metric.agentId,
      serviceId: metric.serviceId,
      metrics: metricsObj,
      evidenceTypes: ["bazaar_declaration"],
    });

    agentScores.set(metric.agentId, reputation.score);
  }

  // Build nodes
  const nodes: GraphNode[] = [
    ...agents.map((a) => {
      const score = agentScores.get(a.id);
      return score !== undefined
        ? { id: a.id, type: "agent" as const, label: a.displayName, score }
        : { id: a.id, type: "agent" as const, label: a.displayName };
    }),
    ...services.map((s) => ({
      id: s.id,
      type: "service" as const,
      label: s.resourceUrl,
    })),
  ];

  // Build edges
  const graphEdges: GraphEdge[] = edges.map((e) => ({
    source: e.sourceId,
    target: e.targetId,
    confidence: e.confidence,
    weight: e.weight,
  }));

  return {
    nodes,
    edges: graphEdges,
  };
};

export const fetchDashboardStats = async (
  db: DatabaseClient,
): Promise<DashboardStats> => {
  // Count totals
  const [agentCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.agents);

  const [serviceCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.services);

  const [linkCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.linkEdges)
    .where(eq(schema.linkEdges.kind, "agent_to_service"));

  // Calculate average reputation score
  const metrics = await db.select().from(schema.observableMetrics);

  let totalScore = 0;
  let scoreCount = 0;

  for (const metric of metrics) {
    const metricsObj: ObservableMetrics = {
      agentId: metric.agentId,
      serviceId: metric.serviceId,
      asOf: metric.asOf,
      usage: metric.usage as ObservableMetrics["usage"],
      success: metric.success as ObservableMetrics["success"],
      recency: metric.recency as ObservableMetrics["recency"],
      derivedProxies: metric.derivedProxies as ObservableMetrics["derivedProxies"],
    };

    const reputation = scoreReputation({
      agentId: metric.agentId,
      serviceId: metric.serviceId,
      metrics: metricsObj,
      evidenceTypes: ["bazaar_declaration"],
    });

    totalScore += reputation.score;
    scoreCount++;
  }

  const avgReputationScore = scoreCount > 0 ? totalScore / scoreCount : 0;

  // Recent activity (7d and 30d)
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [events7d] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.paymentEvents)
    .where(gte(schema.paymentEvents.observedAt, sevenDaysAgo));

  const [events30d] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.paymentEvents)
    .where(gte(schema.paymentEvents.observedAt, thirtyDaysAgo));

  // Confidence tier distribution
  const [lowCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.linkEdges)
    .where(eq(schema.linkEdges.confidenceTier, "low"));

  const [mediumCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.linkEdges)
    .where(eq(schema.linkEdges.confidenceTier, "medium"));

  const [highCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.linkEdges)
    .where(eq(schema.linkEdges.confidenceTier, "high"));

  const [verifiedCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.linkEdges)
    .where(eq(schema.linkEdges.confidenceTier, "verified"));

  return {
    totalAgents: agentCount?.count ?? 0,
    totalServices: serviceCount?.count ?? 0,
    totalLinks: linkCount?.count ?? 0,
    avgReputationScore,
    recentActivity: {
      events7d: events7d?.count ?? 0,
      events30d: events30d?.count ?? 0,
    },
    confidenceDistribution: {
      low: lowCount?.count ?? 0,
      medium: mediumCount?.count ?? 0,
      high: highCount?.count ?? 0,
      verified: verifiedCount?.count ?? 0,
    },
  };
};

export const fetchTimelineData = async (
  db: DatabaseClient,
  days: number,
): Promise<TimelineDataPoint[]> => {
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // Group payment events by day
  const events = await db
    .select({
      date: sql<string>`date_trunc('day', ${schema.paymentEvents.observedAt})::text`,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.paymentEvents)
    .where(gte(schema.paymentEvents.observedAt, startDate))
    .groupBy(sql`date_trunc('day', ${schema.paymentEvents.observedAt})`)
    .orderBy(sql`date_trunc('day', ${schema.paymentEvents.observedAt})`);

  // For now, set avgSuccessRate to 0.85 as placeholder
  // In a full implementation, we'd track success/failure per event
  return events.map((e) => ({
    date: e.date,
    eventCount: e.count,
    avgSuccessRate: 0.85,
  }));
};

export const fetchTopAgents = async (
  db: DatabaseClient,
  limit: number,
): Promise<TopAgent[]> => {
  // Fetch all metrics
  const metrics = await db.select().from(schema.observableMetrics);

  // Compute scores
  const agentScores = new Map<string, number>();
  for (const metric of metrics) {
    const metricsObj: ObservableMetrics = {
      agentId: metric.agentId,
      serviceId: metric.serviceId,
      asOf: metric.asOf,
      usage: metric.usage as ObservableMetrics["usage"],
      success: metric.success as ObservableMetrics["success"],
      recency: metric.recency as ObservableMetrics["recency"],
      derivedProxies: metric.derivedProxies as ObservableMetrics["derivedProxies"],
    };

    const reputation = scoreReputation({
      agentId: metric.agentId,
      serviceId: metric.serviceId,
      metrics: metricsObj,
      evidenceTypes: ["bazaar_declaration"],
    });

    // Keep the highest score for each agent
    const currentScore = agentScores.get(metric.agentId) ?? 0;
    if (reputation.score > currentScore) {
      agentScores.set(metric.agentId, reputation.score);
    }
  }

  // Fetch agent details
  const agents = await db.select().from(schema.agents);

  // Count services per agent from link_edges
  const linkCounts = await db
    .select({
      agentId: schema.linkEdges.sourceNodeId,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.linkEdges)
    .where(
      and(
        eq(schema.linkEdges.kind, "agent_to_service"),
        eq(schema.linkEdges.sourceNodeKind, "agent"),
      ),
    )
    .groupBy(schema.linkEdges.sourceNodeId);

  const serviceCountMap = new Map(
    linkCounts.map((lc) => [lc.agentId, lc.count]),
  );

  // Build top agents list
  const topAgents: TopAgent[] = agents
    .filter((a) => agentScores.has(a.id))
    .map((a) => ({
      agentId: a.id,
      displayName: a.displayName,
      score: agentScores.get(a.id)!,
      serviceCount: serviceCountMap.get(a.id) ?? 0,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return topAgents;
};
