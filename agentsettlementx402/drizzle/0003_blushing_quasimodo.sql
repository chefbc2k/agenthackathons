CREATE TABLE "observable_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"as_of" timestamp with time zone NOT NULL,
	"usage" jsonb NOT NULL,
	"success" jsonb NOT NULL,
	"recency" jsonb NOT NULL,
	"derived_proxies" jsonb NOT NULL,
	"metrics_fingerprint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "observable_metrics" ADD CONSTRAINT "observable_metrics_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "observable_metrics" ADD CONSTRAINT "observable_metrics_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "observable_metrics_agent_service_unique" ON "observable_metrics" USING btree ("agent_id","service_id");--> statement-breakpoint
CREATE INDEX "observable_metrics_asof_idx" ON "observable_metrics" USING btree ("as_of");--> statement-breakpoint
CREATE INDEX "observable_metrics_fingerprint_idx" ON "observable_metrics" USING btree ("metrics_fingerprint");