DROP INDEX "properties_user_preferred_idx";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferred_property_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_preferred_property_id_properties_id_fk" FOREIGN KEY ("preferred_property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" DROP COLUMN "preferred";