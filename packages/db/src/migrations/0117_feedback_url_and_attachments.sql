CREATE TABLE "project_feedback_attachment" (
	"attachment_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"feedback_id" text NOT NULL,
	CONSTRAINT "project_feedback_attachment_pk" PRIMARY KEY("feedback_id","attachment_id")
);
--> statement-breakpoint
ALTER TABLE "project_feedback" ADD COLUMN "url" text;--> statement-breakpoint
ALTER TABLE "project_feedback_attachment" ADD CONSTRAINT "project_feedback_attachment_attachment_id_file_attachment_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."file_attachment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_feedback_attachment" ADD CONSTRAINT "project_feedback_attachment_feedback_id_project_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."project_feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_feedback_attachment_attachment_idx" ON "project_feedback_attachment" USING btree ("attachment_id");--> statement-breakpoint
ALTER TABLE "project_feedback" ADD CONSTRAINT "project_feedback_url_check" CHECK ("project_feedback"."url" is null or length(btrim("project_feedback"."url")) between 1 and 2048);