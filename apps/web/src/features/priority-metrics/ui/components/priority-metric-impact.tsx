export function PriorityMetricTrashImpact({
  effect,
  mode,
  projectName,
}: {
  effect: {
    attachedExternalSurfaceCount: number;
    dependentRuleCount: number;
    dependentViewCount: number;
    storedWorkValueCount: number;
  };
  mode: "move-to-trash" | "permanent-delete";
  projectName: string;
}) {
  const count = effect.storedWorkValueCount;
  const valueLabel = `saved Work ${count === 1 ? "value" : "values"}`;
  return (
    <div className="mt-1 space-y-1 text-muted-foreground text-sm">
      {mode === "move-to-trash" ? (
        <p>
          {count} {valueLabel} {count === 1 ? "remains" : "remain"} recoverable
          for 30 days in {projectName}.
        </p>
      ) : (
        <p>
          This permanently deletes the criterion and {count} {valueLabel} in{" "}
          {projectName}.
        </p>
      )}
      <p>
        Dependent views: {effect.dependentViewCount}. Dependent rules:{" "}
        {effect.dependentRuleCount}. Attached External Surfaces:{" "}
        {effect.attachedExternalSurfaceCount}.
      </p>
    </div>
  );
}

export interface PriorityMetricTrashEffect {
  attachedExternalSurfaceCount: number;
  dependentRuleCount: number;
  dependentViewCount: number;
  storedWorkValueCount: number;
}

export function PriorityMetricImpactStatus({
  effect,
  error,
  loading,
  mode,
  projectName,
}: {
  effect: PriorityMetricTrashEffect | undefined;
  error: boolean;
  loading: boolean;
  mode: "move-to-trash" | "permanent-delete";
  projectName: string;
}) {
  let message: string;
  if (loading) {
    message =
      mode === "move-to-trash"
        ? "Loading the Trash effect…"
        : "Loading the permanent deletion effect…";
  } else {
    message =
      mode === "move-to-trash"
        ? "The Trash effect could not be loaded. Try again before moving this criterion."
        : "The deletion effect could not be loaded. Try again before deleting.";
  }
  if (effect) {
    return (
      <PriorityMetricTrashImpact
        effect={effect}
        mode={mode}
        projectName={projectName}
      />
    );
  }
  return (
    <p
      className={
        error
          ? "mt-1 text-destructive text-sm"
          : "mt-1 text-muted-foreground text-sm"
      }
      role={error ? "alert" : "status"}
    >
      {message}
    </p>
  );
}
