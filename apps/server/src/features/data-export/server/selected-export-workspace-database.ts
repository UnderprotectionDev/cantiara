import {
  ExportError,
  type ExportField,
  type ExportRecordType,
  type ExportScope,
} from "@cantiara/api/data-export";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  workspaceCompany,
  workspaceContact,
  workspaceContactCompanyAffiliation,
  workspaceContactEmail,
} from "@cantiara/db/schema/contact";
import { productGap } from "@cantiara/db/schema/product-gap";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import type { ExportSourceReader } from "./selected-export";
import { refuseUnsupportedFilters } from "./selected-export-database-support";
import { readExtraRelations } from "./selected-export-relations-database";

/**
 * Workspace-wide record types of Selected Export: Contact, Company and Product
 * Gap. They live in the founder's Workspace, not in a Project, so the scope is
 * `{ kind: "workspace" }` and the Workspace is always the account's own: a
 * client never names a Workspace id. These tables have no Trash column
 * (Contact and Company are archived, a Gap changes status), so nothing in
 * Trash can leave here; an archived record carries its `archivedAt`. Each type
 * exports an explicit field allowlist; revision, Workspace id and merge
 * bookkeeping never leave. Retired (merged) Contact ids are contentless
 * redirects and are not Contacts, so they are not listed.
 */

const CONTACT_FIELDS: ExportField[] = [
  { key: "displayName", label: "Display name" },
  { key: "emails", label: "Email addresses" },
  { key: "companyId", label: "Company ID" },
  { key: "archivedAt", label: "Archived" },
  { key: "createdAt", label: "Created" },
  { key: "updatedAt", label: "Updated" },
];

const COMPANY_FIELDS: ExportField[] = [
  { key: "name", label: "Name" },
  { key: "archivedAt", label: "Archived" },
  { key: "createdAt", label: "Created" },
  { key: "updatedAt", label: "Updated" },
];

const PRODUCT_GAP_FIELDS: ExportField[] = [
  { key: "title", label: "Title" },
  { key: "unmetNeed", label: "Unmet need" },
  { key: "scope", label: "Scope" },
  { key: "status", label: "Status" },
  { key: "statusChangedAt", label: "Status changed" },
  { key: "createdAt", label: "Created" },
  { key: "updatedAt", label: "Updated" },
];

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

/** The account's own Workspace id, or `null` when the scope is not accessible. */
async function ownWorkspaceId(
  database: Database,
  accountId: string,
  scope: ExportScope,
  recordType: ExportRecordType,
): Promise<string | null> {
  if (scope.kind !== "workspace") {
    throw new ExportError(
      "source_unavailable",
      `${recordType} is exported for the Workspace, not for a Project.`,
    );
  }
  const [owned] = await database
    .select({ id: workspace.id })
    .from(workspace)
    .where(eq(workspace.ownerAccountId, accountId))
    .limit(1);
  return owned?.id ?? null;
}

function createContactReader(database: Database): ExportSourceReader {
  return {
    fields: () => CONTACT_FIELDS,
    async read(input) {
      refuseUnsupportedFilters(input);
      const workspaceId = await ownWorkspaceId(
        database,
        input.accountId,
        input.scope,
        input.recordType,
      );
      if (!workspaceId) {
        return null;
      }
      const { limit, recordIds } = input;
      const rows = await database
        .select()
        .from(workspaceContact)
        .where(
          and(
            eq(workspaceContact.workspaceId, workspaceId),
            recordIds?.length
              ? inArray(workspaceContact.id, [...recordIds])
              : undefined,
          ),
        )
        .orderBy(asc(workspaceContact.id))
        .limit(limit);
      const ids = rows.map((row) => row.id);
      const [emails, affiliations] = ids.length
        ? await Promise.all([
            database
              .select()
              .from(workspaceContactEmail)
              .where(inArray(workspaceContactEmail.contactId, ids))
              .orderBy(asc(workspaceContactEmail.normalizedEmail)),
            database
              .select()
              .from(workspaceContactCompanyAffiliation)
              .where(
                and(
                  inArray(workspaceContactCompanyAffiliation.contactId, ids),
                  isNull(workspaceContactCompanyAffiliation.endedAt),
                ),
              ),
          ])
        : [[], []];
      return {
        records: rows.map((row) => {
          const aliases = emails
            .filter((email) => email.contactId === row.id)
            .map((email) => email.normalizedEmail);
          return {
            id: row.id,
            label: row.displayName ?? aliases[0] ?? row.id,
            values: {
              archivedAt: iso(row.archivedAt),
              companyId:
                affiliations.find((link) => link.contactId === row.id)
                  ?.companyId ?? null,
              createdAt: row.createdAt.toISOString(),
              displayName: row.displayName,
              emails: aliases,
              updatedAt: row.updatedAt.toISOString(),
            },
          };
        }),
        relations: await readExtraRelations(database, "Contact", ids),
      };
    },
  };
}

function createCompanyReader(database: Database): ExportSourceReader {
  return {
    fields: () => COMPANY_FIELDS,
    async read(input) {
      refuseUnsupportedFilters(input);
      const workspaceId = await ownWorkspaceId(
        database,
        input.accountId,
        input.scope,
        input.recordType,
      );
      if (!workspaceId) {
        return null;
      }
      const { limit, recordIds } = input;
      const rows = await database
        .select()
        .from(workspaceCompany)
        .where(
          and(
            eq(workspaceCompany.workspaceId, workspaceId),
            recordIds?.length
              ? inArray(workspaceCompany.id, [...recordIds])
              : undefined,
          ),
        )
        .orderBy(asc(workspaceCompany.id))
        .limit(limit);
      return {
        records: rows.map((row) => ({
          id: row.id,
          label: row.name,
          values: {
            archivedAt: iso(row.archivedAt),
            createdAt: row.createdAt.toISOString(),
            name: row.name,
            updatedAt: row.updatedAt.toISOString(),
          },
        })),
        relations: await readExtraRelations(
          database,
          "Company",
          rows.map((row) => row.id),
        ),
      };
    },
  };
}

function createProductGapReader(database: Database): ExportSourceReader {
  return {
    fields: () => PRODUCT_GAP_FIELDS,
    async read(input) {
      refuseUnsupportedFilters(input);
      const workspaceId = await ownWorkspaceId(
        database,
        input.accountId,
        input.scope,
        input.recordType,
      );
      if (!workspaceId) {
        return null;
      }
      const { limit, recordIds } = input;
      const rows = await database
        .select()
        .from(productGap)
        .where(
          and(
            eq(productGap.workspaceId, workspaceId),
            recordIds?.length
              ? inArray(productGap.id, [...recordIds])
              : undefined,
          ),
        )
        .orderBy(asc(productGap.id))
        .limit(limit);
      return {
        records: rows.map((row) => ({
          id: row.id,
          label: row.title,
          values: {
            createdAt: row.createdAt.toISOString(),
            scope: row.scope,
            status: row.status,
            statusChangedAt: row.statusChangedAt.toISOString(),
            title: row.title,
            unmetNeed: row.unmetNeed,
            updatedAt: row.updatedAt.toISOString(),
          },
        })),
        relations: await readExtraRelations(
          database,
          "Product Gap",
          rows.map((row) => row.id),
        ),
      };
    },
  };
}

/** Read-only readers for the Workspace-scoped types; none ever writes. */
export function createDatabaseWorkspaceExportSources(
  database: Database,
): Partial<Record<ExportRecordType, ExportSourceReader>> {
  return {
    Company: createCompanyReader(database),
    Contact: createContactReader(database),
    "Product Gap": createProductGapReader(database),
  };
}
