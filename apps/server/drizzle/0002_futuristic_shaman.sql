-- Backfill any pre-existing NULL roles before tightening the column.
UPDATE "user" SET "role" = 'member' WHERE "role" IS NULL;
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "role" SET NOT NULL;
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'member';