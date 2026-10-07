// biome-ignore-all lint/performance/noJsxPropsBind: Each control binds its explicit membership selection.
import type {
  ProjectGoalDetail,
  ProjectGoalRelation,
  ProjectGoalSource,
} from "@cantiara/api/project-goals";
import { isAllowedRelationEndpoints } from "@cantiara/api/relations";
import { Button } from "@cantiara/ui/components/button";
import { useState } from "react";

export interface GoalRelationChange {
  attached: boolean;
  baseRevision: number;
  kind: "Related" | "Contributes to Goal";
  source: ProjectGoalSource;
}
function selectionKey(source: ProjectGoalSource) {
  return JSON.stringify([source.recordType, source.recordId]);
}
function SourceLink({ source }: { source: ProjectGoalSource }) {
  if (!source.title) {
    return <span>Unavailable source record</span>;
  }
  return source.openPath ? (
    <a
      className="inline-flex min-h-11 items-center underline underline-offset-4"
      href={source.openPath}
    >
      {source.title}
    </a>
  ) : (
    <span>{source.title}</span>
  );
}
export function ProjectGoalMembershipView({
  detail,
  onSetRelation,
}: {
  detail: ProjectGoalDetail;
  onSetRelation: (change: GoalRelationChange) => Promise<unknown>;
}) {
  const [selection, setSelection] = useState("");
  const [kind, setKind] = useState<GoalRelationChange["kind"]>(
    "Contributes to Goal",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  async function change(input: GoalRelationChange) {
    setPending(true);
    setError(undefined);
    setMessage(undefined);
    try {
      await onSetRelation(input);
      setMessage(input.attached ? "Relation added." : "Relation removed.");
      setSelection("");
    } catch {
      setError(
        "Relation could not be saved. Reload to check for changes before trying again.",
      );
    } finally {
      setPending(false);
    }
  }
  const candidates = detail.candidates.filter(
    (source) =>
      isAllowedRelationEndpoints(kind, source.recordType, "Project Goal") &&
      !detail.relations.some(
        (row) =>
          row.attached &&
          row.kind === kind &&
          selectionKey(row.source) === selectionKey(source),
      ),
  );
  const chosen = candidates.find(
    (source) => selectionKey(source) === selection,
  );
  function add() {
    if (!chosen) {
      return;
    }
    const previous = detail.relations.find(
      (row) =>
        row.kind === kind && selectionKey(row.source) === selectionKey(chosen),
    );
    change({
      source: chosen,
      kind,
      attached: true,
      baseRevision: previous?.revision ?? 0,
    }).catch(() => undefined);
  }
  function remove(relation: ProjectGoalRelation) {
    change({
      source: relation.source,
      kind: relation.kind,
      attached: false,
      baseRevision: relation.revision,
    }).catch(() => undefined);
  }
  const addLabel =
    kind === "Contributes to Goal" ? "Add contribution" : "Add relation";
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
                      <SourceLink source={row.source} />
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
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-2 text-sm">
              Relation
              <select
                aria-label="Relation"
                className="min-h-11 rounded-md border bg-background p-2"
                disabled={pending}
                onChange={(event) => {
                  setKind(event.target.value as GoalRelationChange["kind"]);
                  setSelection("");
                }}
                value={kind}
              >
                <option>Contributes to Goal</option>
                <option>Related</option>
              </select>
            </label>
            <label className="grid min-w-0 flex-1 gap-2 text-sm">
              Record
              <select
                aria-label="Record"
                className="min-h-11 w-full rounded-md border bg-background p-2"
                disabled={pending}
                onChange={(event) => setSelection(event.target.value)}
                value={selection}
              >
                <option value="">Select record</option>
                {candidates.map((source) => (
                  <option
                    key={selectionKey(source)}
                    value={selectionKey(source)}
                  >
                    {source.title} · {source.workType ?? source.recordType}
                  </option>
                ))}
              </select>
            </label>
            <Button disabled={pending || !chosen} onClick={add} type="button">
              {pending ? "Saving…" : <span>{addLabel}</span>}
            </Button>
          </div>
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
                          <SourceLink source={relation.source} />
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
                  <SourceLink source={source} />
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
