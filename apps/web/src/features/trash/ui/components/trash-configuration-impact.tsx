import {
  TRASH_AFFECTED_VALUES_LABEL,
  TRASH_DEPENDENTS_LABEL,
  type TrashConfigurationImpact,
} from "@cantiara/api/trash-configuration";

/**
 * What a Configuration Trash move affects: the stored values the definition
 * owns and the living views, rules and references that depend on it. Counts
 * only; no stored value is shown.
 */
export function TrashConfigurationImpactList({
  impact,
}: {
  impact: TrashConfigurationImpact;
}) {
  return (
    <div className="space-y-2">
      <section aria-labelledby="trash-affected-values" className="space-y-1">
        <h5 className="font-medium text-sm" id="trash-affected-values">
          {TRASH_AFFECTED_VALUES_LABEL}
        </h5>
        {impact.storedValues.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No stored values are affected.
          </p>
        ) : (
          <ul aria-label={TRASH_AFFECTED_VALUES_LABEL}>
            {impact.storedValues.map((value) => (
              <li className="text-sm" key={value.label}>
                {value.label}: {value.count}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="trash-dependents" className="space-y-1">
        <h5 className="font-medium text-sm" id="trash-dependents">
          {TRASH_DEPENDENTS_LABEL}
        </h5>
        {impact.dependents.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No view, rule or reference depends on it.
          </p>
        ) : (
          <ul aria-label={TRASH_DEPENDENTS_LABEL}>
            {impact.dependents.map((dependent) => (
              <li className="text-sm" key={`${dependent.kind}:${dependent.id}`}>
                {dependent.kind}: {dependent.label}
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-muted-foreground text-sm">
        A definition in Trash does not run. Restore brings back the same
        definition and stored values.
      </p>
    </div>
  );
}
