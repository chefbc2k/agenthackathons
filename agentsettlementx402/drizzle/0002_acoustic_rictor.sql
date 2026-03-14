DROP INDEX "services_resource_url_unique";--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "raw_source_json" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "source_fingerprint" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "services_resource_locator_unique" ON "services" USING btree ("resource_url","network","scheme");--> statement-breakpoint
CREATE INDEX "services_source_fingerprint_idx" ON "services" USING btree ("source_fingerprint");