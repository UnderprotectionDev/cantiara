ALTER TABLE "workspace_contact_audit_event" RENAME COLUMN "actor_account_id" TO "actor_alias";--> statement-breakpoint
-- Existing rows held raw account ids; replace them with the same digest
-- accountActorAlias() computes: "account:" + lowercase hex SHA-256 of the UTF-8 id.
UPDATE "workspace_contact_audit_event" SET "actor_alias" = 'account:' || encode(sha256(convert_to("actor_alias", 'UTF8')), 'hex');
