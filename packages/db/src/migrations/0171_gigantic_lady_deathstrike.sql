CREATE TABLE "release_changelog_snapshot" (
	"approved_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"note_id" text NOT NULL,
	"project_id" text NOT NULL,
	"release_id" text NOT NULL,
	"revision" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "release_changelog_snapshot_revision_check" CHECK ("release_changelog_snapshot"."revision" >= 1)
);
--> statement-breakpoint
CREATE TABLE "release_note" (
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"published_at" timestamp,
	"release_id" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"scope_work_ids" jsonb NOT NULL,
	"status" text DEFAULT 'Draft' NOT NULL,
	"tag_ids" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"why_trail" jsonb NOT NULL,
	CONSTRAINT "release_note_status_check" CHECK ("release_note"."status" in ('Draft', 'Published')),
	CONSTRAINT "release_note_revision_check" CHECK ("release_note"."revision" >= 1),
	CONSTRAINT "release_note_scope_check" CHECK (jsonb_array_length("release_note"."scope_work_ids") >= 1)
);
--> statement-breakpoint
CREATE TABLE "release_observation" (
	"assessment" text NOT NULL,
	"author_id" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"observed_at" timestamp NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"round_id" text NOT NULL,
	"saved_at" timestamp NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	CONSTRAINT "release_observation_kind_check" CHECK ("release_observation"."kind" in ('access', 'outcome')),
	CONSTRAINT "release_observation_assessment_check" CHECK ("release_observation"."assessment" in ('Observed', 'Partially observed', 'Not observed', 'Could not learn')),
	CONSTRAINT "release_observation_revision_check" CHECK ("release_observation"."revision" >= 1)
);
--> statement-breakpoint
CREATE TABLE "release_observation_revision" (
	"assessment" text NOT NULL,
	"author_id" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"observation_id" text NOT NULL,
	"observed_at" timestamp NOT NULL,
	"revision" integer NOT NULL,
	"saved_at" timestamp NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "release_reassessment_round" (
	"close_reason" text,
	"closed_at" timestamp,
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"release_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"started_at" timestamp NOT NULL,
	CONSTRAINT "release_reassessment_round_sequence_check" CHECK ("release_reassessment_round"."sequence" >= 1),
	CONSTRAINT "release_reassessment_round_close_check" CHECK (("release_reassessment_round"."closed_at" is null) = ("release_reassessment_round"."close_reason" is null))
);
--> statement-breakpoint
ALTER TABLE "release_changelog_snapshot" ADD CONSTRAINT "release_changelog_snapshot_note_id_release_note_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."release_note"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_changelog_snapshot" ADD CONSTRAINT "release_changelog_snapshot_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_changelog_snapshot" ADD CONSTRAINT "release_changelog_snapshot_release_id_project_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."project_release"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_note" ADD CONSTRAINT "release_note_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_note" ADD CONSTRAINT "release_note_release_id_project_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."project_release"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_observation" ADD CONSTRAINT "release_observation_round_id_release_reassessment_round_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."release_reassessment_round"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_observation_revision" ADD CONSTRAINT "release_observation_revision_observation_id_release_observation_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."release_observation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_reassessment_round" ADD CONSTRAINT "release_reassessment_round_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_reassessment_round" ADD CONSTRAINT "release_reassessment_round_release_id_project_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."project_release"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "release_changelog_snapshot_note_uidx" ON "release_changelog_snapshot" USING btree ("note_id","revision");--> statement-breakpoint
CREATE INDEX "release_changelog_snapshot_project_idx" ON "release_changelog_snapshot" USING btree ("project_id","approved_at");--> statement-breakpoint
CREATE INDEX "release_note_release_idx" ON "release_note" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "release_note_project_idx" ON "release_note" USING btree ("project_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "release_observation_round_kind_uidx" ON "release_observation" USING btree ("round_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "release_observation_revision_uidx" ON "release_observation_revision" USING btree ("observation_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "release_reassessment_round_sequence_uidx" ON "release_reassessment_round" USING btree ("release_id","sequence");--> statement-breakpoint
CREATE INDEX "release_reassessment_round_project_idx" ON "release_reassessment_round" USING btree ("project_id");