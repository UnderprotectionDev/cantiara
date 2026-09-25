ALTER TABLE "project_backlog_reappear_attention_signal" DROP CONSTRAINT "backlog_reappear_signal_presentation_check";--> statement-breakpoint
UPDATE "project_backlog_reappear_attention_signal" SET "presentation" = 'Action Required' WHERE "presentation" = 'Action needed';--> statement-breakpoint
ALTER TABLE "project_backlog_reappear_attention_signal" ALTER COLUMN "presentation" SET DEFAULT 'Action Required';--> statement-breakpoint
ALTER TABLE "project_backlog_reappear_attention_signal" ADD CONSTRAINT "backlog_reappear_signal_presentation_check" CHECK ("project_backlog_reappear_attention_signal"."presentation" = 'Action Required');
