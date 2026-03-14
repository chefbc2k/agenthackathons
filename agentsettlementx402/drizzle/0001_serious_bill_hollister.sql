ALTER TABLE "agent_cards" ADD COLUMN "raw_json_hash" text NOT NULL;--> statement-breakpoint
CREATE INDEX "agent_cards_raw_json_hash_idx" ON "agent_cards" USING btree ("raw_json_hash");--> statement-breakpoint
CREATE INDEX "agents_display_name_idx" ON "agents" USING btree ("display_name");