ALTER TABLE "payment_events" ADD COLUMN "agent_id" uuid;--> statement-breakpoint
ALTER TABLE "payment_events" ADD COLUMN "service_id" uuid;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "payment_events_agent_service_idx" ON "payment_events" USING btree ("agent_id","service_id");--> statement-breakpoint
CREATE INDEX "payment_events_agent_idx" ON "payment_events" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "payment_events_service_idx" ON "payment_events" USING btree ("service_id");