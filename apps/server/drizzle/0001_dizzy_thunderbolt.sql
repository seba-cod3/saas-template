CREATE TABLE "asset" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"user_id" text NOT NULL,
	"content_type" text NOT NULL,
	"extension" text NOT NULL,
	"size" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "asset_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_userId_idx" ON "asset" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "asset_key_idx" ON "asset" USING btree ("key");