ALTER TABLE "mutation_history" ADD COLUMN "undo" jsonb;--> statement-breakpoint
ALTER TABLE "mutation_history" ADD COLUMN "undo_of" text;--> statement-breakpoint
ALTER TABLE "mutation_receipt" ADD COLUMN "undo" jsonb;--> statement-breakpoint
ALTER TABLE "mutation_receipt" ADD COLUMN "undo_of" text;--> statement-breakpoint
ALTER TABLE "mutation_staging" ADD COLUMN "undo" jsonb;--> statement-breakpoint
ALTER TABLE "mutation_staging" ADD COLUMN "undo_of" text;