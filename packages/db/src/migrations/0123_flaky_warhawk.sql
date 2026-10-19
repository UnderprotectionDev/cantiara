CREATE TABLE "user_flow_viewport" (
	"account_id" text NOT NULL,
	"user_flow_id" text NOT NULL,
	"viewport" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_flow_viewport_pk" PRIMARY KEY("account_id","user_flow_id")
);
--> statement-breakpoint
ALTER TABLE "user_flow_viewport" ADD CONSTRAINT "user_flow_viewport_user_flow_id_user_flow_id_fk" FOREIGN KEY ("user_flow_id") REFERENCES "public"."user_flow"("id") ON DELETE cascade ON UPDATE no action;