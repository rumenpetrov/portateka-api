ALTER TABLE "users" DROP CONSTRAINT "users_username_unique";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "first_name" varchar(50) DEFAULT 'User' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_name" varchar(50);--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "username";