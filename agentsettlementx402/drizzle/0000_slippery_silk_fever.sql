CREATE TYPE "public"."confidence_tier" AS ENUM('low', 'medium', 'high', 'verified');--> statement-breakpoint
CREATE TYPE "public"."link_edge_kind" AS ENUM('agent_to_agent_card', 'agent_to_service', 'service_to_wallet', 'payment_event_to_attempt_group', 'wallet_to_payment_event');--> statement-breakpoint
CREATE TYPE "public"."link_edge_node_kind" AS ENUM('agent', 'agent_card', 'service', 'wallet', 'payment_event', 'attempt_group');--> statement-breakpoint
CREATE TYPE "public"."payment_event_source" AS ENUM('bazaar', 'payment_required', 'settlement_receipt', 'manual');--> statement-breakpoint
CREATE TYPE "public"."signature_verification_status" AS ENUM('unverified', 'verified', 'failed', 'unsupported');--> statement-breakpoint
CREATE TABLE "agent_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"raw_json" jsonb NOT NULL,
	"normalized_json" jsonb NOT NULL,
	"documentation_url" text,
	"description" text,
	"signature_verification_status" "signature_verification_status" DEFAULT 'unverified' NOT NULL,
	"signature_verified_at" timestamp with time zone,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_card_url" text NOT NULL,
	"provider_organization" text,
	"provider_url" text,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agents_agent_card_url_provider_identity_unique" UNIQUE("agent_card_url","provider_organization","provider_url")
);
--> statement-breakpoint
CREATE TABLE "attempt_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_identifier" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "link_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "link_edge_kind" NOT NULL,
	"source_node_kind" "link_edge_node_kind" NOT NULL,
	"source_node_id" uuid NOT NULL,
	"target_node_kind" "link_edge_node_kind" NOT NULL,
	"target_node_id" uuid NOT NULL,
	"confidence_tier" "confidence_tier" DEFAULT 'medium' NOT NULL,
	"confidence_score" integer DEFAULT 500 NOT NULL,
	"evidence_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "link_edges_confidence_score_range_check" CHECK ("link_edges"."confidence_score" >= 0 AND "link_edges"."confidence_score" <= 1000)
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_group_id" uuid,
	"payer_wallet_id" uuid,
	"pay_to_wallet_id" uuid NOT NULL,
	"tx_hash" text NOT NULL,
	"network" text NOT NULL,
	"asset" text NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"block_number" bigint,
	"confidence_tier" "confidence_tier" DEFAULT 'medium' NOT NULL,
	"confidence_score" integer DEFAULT 500 NOT NULL,
	"source" "payment_event_source" NOT NULL,
	"source_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_events_confidence_score_range_check" CHECK ("payment_events"."confidence_score" >= 0 AND "payment_events"."confidence_score" <= 1000)
);
--> statement-breakpoint
CREATE TABLE "service_agents" (
	"service_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_agents_pk" PRIMARY KEY("service_id","agent_id")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_url" text NOT NULL,
	"pay_to_wallet_id" uuid NOT NULL,
	"network" text NOT NULL,
	"scheme" text NOT NULL,
	"asset" text,
	"amount" text,
	"mime_type" text,
	"description" text,
	"input_schema_url" text,
	"output_schema_url" text,
	"schema_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address" text NOT NULL,
	"network" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_cards" ADD CONSTRAINT "agent_cards_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_attempt_group_id_attempt_groups_id_fk" FOREIGN KEY ("attempt_group_id") REFERENCES "public"."attempt_groups"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payer_wallet_id_wallets_id_fk" FOREIGN KEY ("payer_wallet_id") REFERENCES "public"."wallets"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_pay_to_wallet_id_wallets_id_fk" FOREIGN KEY ("pay_to_wallet_id") REFERENCES "public"."wallets"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "service_agents" ADD CONSTRAINT "service_agents_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "service_agents" ADD CONSTRAINT "service_agents_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_pay_to_wallet_id_wallets_id_fk" FOREIGN KEY ("pay_to_wallet_id") REFERENCES "public"."wallets"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_cards_agent_id_unique" ON "agent_cards" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_cards_signature_status_idx" ON "agent_cards" USING btree ("signature_verification_status");--> statement-breakpoint
CREATE UNIQUE INDEX "agents_agent_card_url_unique" ON "agents" USING btree ("agent_card_url");--> statement-breakpoint
CREATE INDEX "agents_provider_lookup_idx" ON "agents" USING btree ("provider_organization","provider_url");--> statement-breakpoint
CREATE UNIQUE INDEX "attempt_groups_payment_identifier_unique" ON "attempt_groups" USING btree ("payment_identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "link_edges_unique_path" ON "link_edges" USING btree ("kind","source_node_kind","source_node_id","target_node_kind","target_node_id");--> statement-breakpoint
CREATE INDEX "link_edges_source_idx" ON "link_edges" USING btree ("source_node_kind","source_node_id");--> statement-breakpoint
CREATE INDEX "link_edges_target_idx" ON "link_edges" USING btree ("target_node_kind","target_node_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_events_tx_hash_network_unique" ON "payment_events" USING btree ("tx_hash","network");--> statement-breakpoint
CREATE INDEX "payment_events_attempt_group_idx" ON "payment_events" USING btree ("attempt_group_id");--> statement-breakpoint
CREATE INDEX "payment_events_payto_idx" ON "payment_events" USING btree ("pay_to_wallet_id","network");--> statement-breakpoint
CREATE UNIQUE INDEX "services_resource_url_unique" ON "services" USING btree ("resource_url");--> statement-breakpoint
CREATE INDEX "services_wallet_network_idx" ON "services" USING btree ("pay_to_wallet_id","network");--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_address_network_unique" ON "wallets" USING btree ("address","network");