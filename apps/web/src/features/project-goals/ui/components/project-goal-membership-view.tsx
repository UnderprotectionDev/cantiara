// biome-ignore-all lint/performance/noJsxPropsBind: Each control binds its explicit membership selection.
import type {
  ProjectGoalDetail,
  ProjectGoalRelation,
  ProjectGoalSource,
} from "@cantiara/api/project-goals";
import { Button } from "@cantiara/ui/components/button";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  type GoalRelationChange,
  selectionKey,
} from "../../lib/goal-relation-selection";
import { ProjectGoalRelationForm } from "../forms/project-goal-relation-form";

function SourceLink({
  source,
  projectId,
}: {
  source: ProjectGoalSource;
  projectId: string;
}) {
  if (!source.title) {
    return <span>Unavailable source record</span>;
  }
  return source.openPath ? (
    <Link
      className="inline-flex min-h-11 items-center underline underline-offset-4"
      hash={source.openPath.split("#")[1] ?? ""}
      params={{ projectId }}
      to="/projects/$projectId"
    >
      {source.title}
    </Link>
  ) : (
    <span>{source.title}</span>
  );
}
export function ProjectGoalMembershipView({
  detail,
  projectId,
  onSetRelation,
}: {
  detail: ProjectGoalDetail;
  projectId: string;
  onSetRelation: (change: GoalRelationChange) => Promise<unknown>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [settledChanges, setSettledChanges] = useState(0);
  async function change(input: GoalRelationChange) {
    setPending(true);
    setError(undefined);
    setMessage(undefined);
    try {
      await onSetRelation(input);
      setMessage(input.attached ? "Relation added." : "Relation removed.");
      setSettledChanges((count) => count + 1);
    } catch {
      setError(
        "Relation could not be saved. Reload to check for changes before trying again.",
      );
    } finally {
      setPending(false);
    }
  }
  function remove(relation: ProjectGoalRelation) {
    change({
      source: relation.source,
      kind: relation.kind,
      attached: false,
      baseRevision: relation.revision,
    }).catch(() => undefined);
  }
  return (
    <div className="space-y-6">
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      <section
        aria-label="Contributes to Goal"
        className="space-y-3 rounded-lg border border-border/70 p-5"
      >
        <h3 className="font-semibold">Contributes to Goal</h3>
        {(["Contributes to Goal", "Related"] as const).map((relationKind) => (
          <div className="space-y-2" key={relationKind}>
            {relationKind === "Related" ? (
              <h4 className="font-medium">Related</h4>
            ) : null}
            <ul className="space-y-2">
              {detail.relations
                .filter((row) => row.attached && row.kind === relationKind)
                .map((row) => (
                  <li
                    className="flex flex-wrap items-center justify-between gap-3"
                    key={row.id}
                  >
                    <div className="min-w-0 break-words">
                      <SourceLink projectId={projectId} source={row.source} />
                      <span className="pl-2 text-muted-foreground text-sm">
                        {row.source.workType ?? row.source.recordType}
                        {row.source.status ? ` · ${row.source.status}` : ""}
                      </span>
                    </div>
                    {detail.readOnly ? null : (
                      <Button
                        disabled={pending}
                        onClick={() => remove(row)}
                        type="button"
                        variant="outline"
                      >
                        {row.kind === "Contributes to Goal"
                          ? "Remove contribution"
                          : "Remove relation"}
                      </Button>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        ))}
        {detail.relations.some(
          (row) => row.attached && row.kind === "Contributes to Goal",
        ) ? null : (
          <p>No contributors yet.</p>
        )}
        {detail.readOnly ? null : (
          <ProjectGoalRelationForm
            detail={detail}
            onAdd={change}
            pending={pending}
            settledChanges={settledChanges}
          />
        )}
      </section>
      <section
        aria-label="Live summary"
        className="space-y-4 rounded-lg border border-border/70 p-5"
      >
        <h3 className="font-semibold">Live summary</h3>
        <div>
          <h4 className="font-medium">Status distribution</h4>
          {detail.statusMix.length ? (
            <ul>
              {detail.statusMix.map((row) => (
                <li key={`${row.recordType}:${row.status}`}>
                  <span>
                    {row.recordType} · {row.status}: {row.count}
                  </span>
                  <ul className="pl-4">
                    {detail.relations
                      .filter(
                        (relation) =>
                          relation.attached &&
                          relation.kind === "Contributes to Goal" &&
                          !relation.source.unavailable &&
                          (relation.source.workType ??
                            relation.source.recordType) === row.recordType &&
                          relation.source.status === row.status,
                      )
                      .map((relation) => (
                        <li key={relation.id}>
                          <SourceLink
                            projectId={projectId}
                            source={relation.source}
                          />
                        </li>
                      ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p>No contributing Research, Feature, or Milestone records.</p>
          )}
        </div>
        <div>
          <h4 className="font-medium">Open Risks and Open Questions</h4>
          {detail.openQuestionsAndRisks.length ? (
            <ul>
              {detail.openQuestionsAndRisks.map((source) => (
                <li key={selectionKey(source)}>
                  <SourceLink projectId={projectId} source={source} />
                  <span className="pl-2 text-sm">
                    {source.recordType} · {source.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No related open Risks or Open Questions.</p>
          )}
        </div>
      </section>
    </div>
  );
}
