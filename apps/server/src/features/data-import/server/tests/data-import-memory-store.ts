import { randomBytes } from "node:crypto";

import type {
  DataImportPorts,
  ImportOriginState,
  StagedImport,
} from "../data-import";
import {
  createImportSealer,
  type ImportKeyRing,
} from "../data-import-envelope";

/** Everything a preview must leave untouched. */
export interface PrimaryFacts {
  records: string[];
  relations: string[];
  searchIndex: string[];
}

function scopeLabel(kind: "project" | "wiki" | "workspace") {
  if (kind === "project") {
    return "Project Atlas";
  }
  return kind === "wiki" ? "Wiki" : "Workspace";
}

export function createMemoryDataImport(options: {
  accountId: string;
  customFieldNames?: readonly string[];
  origins?: Record<string, ImportOriginState>;
  primary?: PrimaryFacts;
}) {
  const staged = new Map<string, StagedImport>();
  const primary: PrimaryFacts = options.primary ?? {
    records: ["Risk:r1"],
    relations: ["r1->w1"],
    searchIndex: ["r1"],
  };
  const frozen = JSON.stringify(primary);
  const ring: ImportKeyRing = {
    currentVersion: 1,
    keys: new Map([[1, randomBytes(32)]]),
  };
  let counter = 0;
  const ports: DataImportPorts = {
    newId: () => {
      counter += 1;
      return `staging-${counter}`;
    },
    origins: (_accountId, _scope, query) =>
      Promise.resolve(
        new Map(
          query.keys.flatMap((key) => {
            const state = options.origins?.[key];
            return state ? [[key, state] as const] : [];
          }),
        ),
      ),
    scopes: (accountId, scope) => {
      if (accountId !== options.accountId) {
        return Promise.resolve(null);
      }
      if (scope.kind === "project" && scope.projectId !== "project-1") {
        return Promise.resolve(null);
      }
      return Promise.resolve({
        customFieldNames:
          scope.kind === "project" ? (options.customFieldNames ?? []) : [],
        label: scopeLabel(scope.kind),
      });
    },
    sealer: createImportSealer(ring),
    staging: {
      get: (accountId, id) => {
        const row = staged.get(id);
        return Promise.resolve(row?.accountId === accountId ? row : null);
      },
      purgeExpired: (now) => {
        let removed = 0;
        for (const [id, row] of staged) {
          if (row.expiresAt.getTime() <= now.getTime()) {
            staged.delete(id);
            removed += 1;
          }
        }
        return Promise.resolve(removed);
      },
      put: (row) => {
        staged.set(row.id, row);
        return Promise.resolve();
      },
    },
  };
  return {
    ports,
    primaryUnchanged: () => JSON.stringify(primary) === frozen,
    staged,
  };
}
