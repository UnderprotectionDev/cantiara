import type { StaticValidation } from "@cantiara/api/schema-static-validation";

/**
 * `Statically Validated` is the only success label. It means a disposable
 * parse and apply passed; it never claims the SQL ran on a real database.
 */
export function StaticValidationStatus({
  validation,
}: {
  validation: StaticValidation;
}) {
  if (validation.ok) {
    return (
      <p role="status">
        <strong>{validation.label}</strong>
        {` · PostgreSQL ${validation.postgresMajor} · ${validation.extensions.join(", ")} · disposable database destroyed`}
        <span className="block text-muted-foreground text-sm">
          The product never runs this SQL on your, staging or production
          database.
        </span>
      </p>
    );
  }
  return (
    <p role="alert">
      <strong>Not validated</strong>
      {` · ${validation.stage}: ${validation.detail}`}
    </p>
  );
}
