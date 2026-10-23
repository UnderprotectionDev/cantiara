import { POSTGRES_MAJOR, SCHEMA_ARTIFACT_LABELS } from "./schema-definition";
import { ALLOWED_EXTENSIONS, type SchemaViolation } from "./schema-invariants";

/** One SQL connection to a database that exists only for this validation. */
export interface DisposableDatabase {
  execute: (sql: string) => Promise<void>;
}

/**
 * Creates a fresh database for one run, calls `work`, then destroys it. The
 * port never receives a user, staging or production target and no credential
 * leaves the adapter; `destroyed` is false when the adapter could not prove
 * the database is gone.
 */
export interface DisposableDatabasePort {
  run: <T>(
    options: { extensions: readonly string[]; postgresMajor: number },
    work: (database: DisposableDatabase) => Promise<T>,
  ) => Promise<{ destroyed: boolean; value: T }>;
}

/** The only outcome labels; none claims the SQL ran anywhere real. */
export const STATIC_VALIDATION_CHECKS = [
  "Structural invariants",
  "Extension matrix",
  "Dependency order",
  "Disposable parse and apply",
] as const;

/** Operator classes of the closed matrix that can appear in the offered SQL. */
const MATRIX_OPS: [RegExp, string][] = [
  [/\b(?:gin|gist)_trgm_ops\b/, "pg_trgm"],
];

/**
 * Extensions the offered SQL itself needs: the disposable run still installs
 * the whole closed matrix so any allowed usage is provable, while the result
 * reports only what the scripts actually reference.
 */
export function extensionsRequiredByScripts(
  scripts: readonly string[],
): string[] {
  const extensions = new Set<string>();
  for (const script of scripts) {
    for (const [pattern, extension] of MATRIX_OPS) {
      if (pattern.test(script)) {
        extensions.add(extension);
      }
    }
  }
  return [...extensions].sort((a, b) => a.localeCompare(b));
}

export type StaticValidation =
  | {
      checks: readonly string[];
      /** The disposable database was created for this run and destroyed. */
      disposableDestroyed: true;
      extensions: readonly string[];
      label: typeof SCHEMA_ARTIFACT_LABELS.validated;
      ok: true;
      postgresMajor: number;
    }
  | {
      detail: string;
      ok: false;
      stage: "Structural invariants" | "Disposable parse and apply";
      violations: SchemaViolation[];
    };

/**
 * `Statically Validated` is minted only here: invariants already passed, then
 * every script applied in order to a new disposable database that is gone
 * afterwards. A failed apply, an unprovable destroy or a missing port blocks
 * the label. `extensions` reports what the offered scripts themselves need;
 * it is not the closed matrix the disposable run installs.
 */
export async function validateStatically(
  port: DisposableDatabasePort | undefined,
  scripts: readonly string[],
  violations: SchemaViolation[] = [],
): Promise<StaticValidation> {
  if (violations.length > 0) {
    return {
      detail: "A structural invariant failed; no SQL is shown or applied.",
      ok: false,
      stage: "Structural invariants",
      violations,
    };
  }
  if (!port) {
    return {
      detail:
        "The disposable validation database is not configured, so the SQL stays unvalidated.",
      ok: false,
      stage: "Disposable parse and apply",
      violations: [],
    };
  }
  try {
    const { destroyed } = await port.run(
      { extensions: ALLOWED_EXTENSIONS, postgresMajor: POSTGRES_MAJOR },
      async (database) => {
        for (const script of scripts) {
          // biome-ignore lint/performance/noAwaitInLoops: Scripts apply in order on one disposable database.
          await database.execute(script);
        }
      },
    );
    if (!destroyed) {
      return {
        detail: "The disposable database could not be proven destroyed.",
        ok: false,
        stage: "Disposable parse and apply",
        violations: [],
      };
    }
  } catch (error) {
    return {
      detail:
        error instanceof Error
          ? error.message
          : "The disposable parse or apply failed.",
      ok: false,
      stage: "Disposable parse and apply",
      violations: [],
    };
  }
  return {
    checks: STATIC_VALIDATION_CHECKS,
    disposableDestroyed: true,
    extensions: extensionsRequiredByScripts(scripts),
    label: SCHEMA_ARTIFACT_LABELS.validated,
    ok: true,
    postgresMajor: POSTGRES_MAJOR,
  };
}
