import type { SchemaViolation } from "@cantiara/api/schema-invariants";

/** Every named invariant violation of one report, each with its element path. */
export function ViolationList({
  violations,
}: {
  violations: SchemaViolation[];
}) {
  return (
    <section aria-label="Invariant report" className="space-y-2">
      <p role="alert">
        {`${violations.length} invariant ${violations.length === 1 ? "violation blocks" : "violations block"} the SQL. No partial SQL is shown.`}
      </p>
      <ul className="space-y-1 text-sm">
        {violations.map((violation) => (
          <li
            key={`${violation.invariant}:${violation.path}:${violation.requirement}`}
          >
            <strong>{violation.invariant}</strong>
            {` · ${violation.path} — ${violation.requirement}`}
          </li>
        ))}
      </ul>
    </section>
  );
}
