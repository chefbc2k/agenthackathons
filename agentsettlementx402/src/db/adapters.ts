import type {
  AgentCardRecord,
  AgentRecord,
  AgentRepository,
  AttemptGroupRecord,
  AttemptGroupRepository,
  CreateAgentInput,
  CreateAttemptGroupInput,
  CreatePaymentEventInput,
  CreateWalletInput,
  LinkEdgeRecord,
  LinkEdgeRepository,
  ObservableMetricsRecord,
  ObservableMetricsRepository,
  UpsertObservableMetricsInput,
  PaymentEventRecord,
  PaymentEventRepository,
  ServiceRecord,
  ServiceRepository,
  ServiceLocator,
  UpsertAgentCardInput,
  UpsertLinkEdgeInput,
  UpsertServiceInput,
  WalletRecord,
  WalletRepository,
  AgentCardRepository,
} from "./repositories.js";

export interface AgentStore {
  insert(input: CreateAgentInput): Promise<AgentRecord>;
  selectByAgentCardUrl(agentCardUrl: string): Promise<AgentRecord | null>;
  updateByAgentCardUrl(
    agentCardUrl: string,
    input: CreateAgentInput,
  ): Promise<AgentRecord>;
}

export interface AgentCardStore {
  selectByAgentId(agentId: string): Promise<AgentCardRecord | null>;
  insert(input: UpsertAgentCardInput): Promise<AgentCardRecord>;
  updateByAgentId(
    agentId: string,
    input: UpsertAgentCardInput,
  ): Promise<AgentCardRecord>;
}

export interface WalletStore {
  selectByAddressAndNetwork(
    address: string,
    network: string,
  ): Promise<WalletRecord | null>;
  insert(input: CreateWalletInput): Promise<WalletRecord>;
}

export interface ServiceStore {
  selectByResourceUrl(resourceUrl: string): Promise<ServiceRecord | null>;
  selectByLocator(locator: ServiceLocator): Promise<ServiceRecord | null>;
  insert(input: UpsertServiceInput): Promise<ServiceRecord>;
  updateByLocator(
    locator: ServiceLocator,
    input: UpsertServiceInput,
  ): Promise<ServiceRecord>;
}

export interface AttemptGroupStore {
  selectByPaymentIdentifier(
    paymentIdentifier: string,
  ): Promise<AttemptGroupRecord | null>;
  insert(input: CreateAttemptGroupInput): Promise<AttemptGroupRecord>;
}

export interface PaymentEventStore {
  insert(input: CreatePaymentEventInput): Promise<PaymentEventRecord>;
  selectByTransaction(
    txHash: string,
    network: string,
  ): Promise<PaymentEventRecord | null>;
}

export interface LinkEdgeStore {
  selectByPath(
    input: Pick<
      UpsertLinkEdgeInput,
      "kind" | "sourceNodeKind" | "sourceNodeId" | "targetNodeKind" | "targetNodeId"
    >,
  ): Promise<LinkEdgeRecord | null>;
  insert(input: UpsertLinkEdgeInput): Promise<LinkEdgeRecord>;
  updateByPath(input: UpsertLinkEdgeInput): Promise<LinkEdgeRecord>;
}

export interface ObservableMetricsStore {
  insert(input: UpsertObservableMetricsInput): Promise<ObservableMetricsRecord>;
  selectByAgentAndService(
    agentId: string,
    serviceId: string,
  ): Promise<ObservableMetricsRecord | null>;
  updateByAgentAndService(
    agentId: string,
    serviceId: string,
    input: UpsertObservableMetricsInput,
  ): Promise<ObservableMetricsRecord>;
}

export class DrizzleAgentRepository implements AgentRepository {
  public constructor(private readonly store: AgentStore) {}

  public create(input: CreateAgentInput): Promise<AgentRecord> {
    return this.store.insert(input);
  }

  public findByAgentCardUrl(agentCardUrl: string): Promise<AgentRecord | null> {
    return this.store.selectByAgentCardUrl(agentCardUrl);
  }

  public async upsert(input: CreateAgentInput): Promise<AgentRecord> {
    const existing = await this.store.selectByAgentCardUrl(input.agentCardUrl);

    if (existing) {
      return this.store.updateByAgentCardUrl(input.agentCardUrl, input);
    }

    return this.store.insert(input);
  }
}

export class DrizzleAgentCardRepository implements AgentCardRepository {
  public constructor(private readonly store: AgentCardStore) {}

  public findByAgentId(agentId: string): Promise<AgentCardRecord | null> {
    return this.store.selectByAgentId(agentId);
  }

  public async upsert(input: UpsertAgentCardInput): Promise<AgentCardRecord> {
    const existing = await this.store.selectByAgentId(input.agentId);

    if (existing) {
      return this.store.updateByAgentId(input.agentId, input);
    }

    return this.store.insert(input);
  }
}

export class DrizzleWalletRepository implements WalletRepository {
  public constructor(private readonly store: WalletStore) {}

  public findByAddressAndNetwork(
    address: string,
    network: string,
  ): Promise<WalletRecord | null> {
    return this.store.selectByAddressAndNetwork(address, network);
  }

  public async upsert(input: CreateWalletInput): Promise<WalletRecord> {
    const existing = await this.store.selectByAddressAndNetwork(
      input.address,
      input.network,
    );

    if (existing) {
      return existing;
    }

    return this.store.insert(input);
  }
}

export class DrizzleServiceRepository implements ServiceRepository {
  public constructor(private readonly store: ServiceStore) {}

  public findByResourceUrl(resourceUrl: string): Promise<ServiceRecord | null> {
    return this.store.selectByResourceUrl(resourceUrl);
  }

  public findByLocator(locator: ServiceLocator): Promise<ServiceRecord | null> {
    return this.store.selectByLocator(locator);
  }

  public async upsert(input: UpsertServiceInput): Promise<ServiceRecord> {
    const locator = {
      network: input.network,
      resourceUrl: input.resourceUrl,
      scheme: input.scheme,
    } satisfies ServiceLocator;
    const existing = await this.store.selectByLocator(locator);

    if (existing) {
      return this.store.updateByLocator(locator, input);
    }

    return this.store.insert(input);
  }
}

export class DrizzleAttemptGroupRepository implements AttemptGroupRepository {
  public constructor(private readonly store: AttemptGroupStore) {}

  public findByPaymentIdentifier(
    paymentIdentifier: string,
  ): Promise<AttemptGroupRecord | null> {
    return this.store.selectByPaymentIdentifier(paymentIdentifier);
  }

  public async upsert(
    input: CreateAttemptGroupInput,
  ): Promise<AttemptGroupRecord> {
    const existing = await this.store.selectByPaymentIdentifier(
      input.paymentIdentifier,
    );

    if (existing) {
      return existing;
    }

    return this.store.insert(input);
  }
}

export class DrizzlePaymentEventRepository implements PaymentEventRepository {
  public constructor(private readonly store: PaymentEventStore) {}

  public findByTransaction(
    txHash: string,
    network: string,
  ): Promise<PaymentEventRecord | null> {
    return this.store.selectByTransaction(txHash, network);
  }

  public create(input: CreatePaymentEventInput): Promise<PaymentEventRecord> {
    return this.store.insert(input);
  }
}

export class DrizzleLinkEdgeRepository implements LinkEdgeRepository {
  public constructor(private readonly store: LinkEdgeStore) {}

  public findByPath(
    input: Pick<
      UpsertLinkEdgeInput,
      "kind" | "sourceNodeKind" | "sourceNodeId" | "targetNodeKind" | "targetNodeId"
    >,
  ): Promise<LinkEdgeRecord | null> {
    return this.store.selectByPath(input);
  }

  public async upsert(input: UpsertLinkEdgeInput): Promise<LinkEdgeRecord> {
    const existing = await this.store.selectByPath(input);

    if (existing) {
      return this.store.updateByPath(input);
    }

    return this.store.insert(input);
  }
}

export class DrizzleObservableMetricsRepository
  implements ObservableMetricsRepository
{
  public constructor(private readonly store: ObservableMetricsStore) {}

  public findByAgentAndService(
    agentId: string,
    serviceId: string,
  ): Promise<ObservableMetricsRecord | null> {
    return this.store.selectByAgentAndService(agentId, serviceId);
  }

  public async upsert(
    input: UpsertObservableMetricsInput,
  ): Promise<ObservableMetricsRecord> {
    const existing = await this.store.selectByAgentAndService(
      input.agentId,
      input.serviceId,
    );

    if (existing) {
      return this.store.updateByAgentAndService(
        input.agentId,
        input.serviceId,
        input,
      );
    }

    return this.store.insert(input);
  }
}
