// biome-ignore-all lint/performance/noJsxPropsBind: The draft binds its own edit and reset handlers.
import type { SchemaChangePreview } from "@cantiara/api/schema-artifacts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

import { ConfirmArtifactForm } from "../forms/confirm-artifact-form";
import { UpEditForm } from "../forms/up-edit-form";
import { SqlOutput } from "./sql-output";
import { StaticValidationStatus } from "./static-validation-status";
import { ViolationList } from "./violation-list";

type Ready = Extract<SchemaChangePreview, { status: "Ready" }>;

function OperationList({ draft }: { draft: Ready }) {
  return (
    <ol aria-label="Schema operations" className="space-y-2">
      {draft.operations.map((operation) => {
        const destructive = draft.destructiveOperationIds.includes(
          operation.id,
        );
        return (
          <li
            className={
              destructive ? "rounded-md border border-destructive p-2" : "p-2"
            }
            key={operation.id}
          >
            <p>
              <strong>{operation.operation}</strong>
              {` · ${operation.class} · ${operation.path}`}
            </p>
            {operation.warnings.length > 0 ? (
              <ul className="text-sm">
                {operation.warnings.map((warning) => (
                  <li key={`${warning.code}:${warning.message}`}>
                    {warning.message}
                  </li>
                ))}
              </ul>
            ) : null}
            <pre className="overflow-auto text-xs">
              {operation.sql.join("\n")}
            </pre>
          </li>
        );
      })}
    </ol>
  );
}

const DIFF_STYLE = {
  added: { className: "bg-green-500/20", prefix: "+ " },
  removed: { className: "bg-red-500/20 line-through", prefix: "- " },
  same: { className: "", prefix: "  " },
} as const;

function EditDiff({ draft }: { draft: Ready }) {
  if (!draft.edit.diff.changed) {
    return null;
  }
  return (
    <section aria-label="Generator output and your edit" className="space-y-1">
      <h5 className="font-medium">Generator output vs your edit</h5>
      <pre className="overflow-auto rounded-md border p-2 text-xs">
        {draft.edit.diff.parts.map((part, index) => (
          <span
            className={DIFF_STYLE[part.kind].className}
            // biome-ignore lint/suspicious/noArrayIndexKey: Diff parts have no identity and never reorder.
            key={`${index}:${part.kind}`}
          >
            {`${DIFF_STYLE[part.kind].prefix}${part.text}`}
          </span>
        ))}
      </pre>
      {draft.edit.issues.length > 0 ? (
        <ul role="alert">
          {draft.edit.issues.map((issue) => (
            <li key={`${issue.statement}:${issue.reason}`}>
              {`${issue.reason} (${issue.statement})`}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** Schema Change Draft between two exact Diagram Versions of one Data Model. */
export function ChangeDraft({
  artifacts,
  sourceVersionId,
  targetVersionId,
}: {
  artifacts: { id: string; label: string }[];
  sourceVersionId: string;
  targetVersionId: string;
}) {
  const queryClient = useQueryClient();
  const confirmKey = useRef<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const confirm = useMutation({
    mutationFn: (input: {
      confirmedDestructiveOperationIds: string[];
      supersedes: string | null;
      upSql: string;
      generated: string;
    }) => {
      confirmKey.current ??= crypto.randomUUID();
      return runOnlineOnlyWrite(() =>
        client.confirmMigrationArtifact({
          clientIdempotencyKey: confirmKey.current as string,
          confirmedDestructiveOperationIds:
            input.confirmedDestructiveOperationIds,
          editedUpSql: input.upSql === input.generated ? null : input.upSql,
          sourceVersionId,
          supersedes: input.supersedes,
          targetVersionId,
        }),
      );
    },
    onError: (failure) =>
      setConfirmError(
        failure instanceof Error
          ? failure.message
          : "Migration Artifact could not be confirmed.",
      ),
    onSuccess: async () => {
      confirmKey.current = null;
      setConfirmError(null);
      await queryClient.invalidateQueries();
    },
  });
  const [edited, setEdited] = useState<string | null>(null);
  const preview = useQuery(
    orpc.schemaChangePreview.queryOptions({
      input: { editedUpSql: edited, sourceVersionId, targetVersionId },
    }),
  );
  const { data } = preview;
  if (preview.isPending) {
    return <p>Building the Schema Change Draft…</p>;
  }
  if (preview.isError || !data) {
    return <p role="alert">The Schema Change Draft could not be built.</p>;
  }
  if (data.status === "Blocked") {
    return (
      <section aria-label="Schema Change Draft" className="space-y-2">
        <h4 className="font-medium">Schema Change Draft</h4>
        {data.violations.length > 0 ? (
          <ViolationList violations={data.violations} />
        ) : null}
        {data.blockers.length > 0 ? (
          <ul aria-label="Unsupported differences" role="alert">
            {data.blockers.map((blocker) => (
              <li key={`${blocker.operation}:${blocker.path}`}>
                <strong>{blocker.operation}</strong>
                {` · ${blocker.path} — ${blocker.reason}`}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    );
  }
  return (
    <section aria-label="Schema Change Draft" className="space-y-3">
      <h4 className="font-medium">Schema Change Draft</h4>
      <p className="text-muted-foreground text-sm">
        {`${data.source.name} (version ${data.source.number}) → ${data.target.name} (version ${data.target.number}) · ${data.generatorVersion}`}
      </p>
      {data.operations.length === 0 ? (
        <p>The two Diagram Versions have no schema difference.</p>
      ) : (
        <OperationList draft={data} />
      )}
      {data.requiresDestructiveConfirmation ? (
        <p role="alert">
          This draft contains potentially destructive operations. They need
          extra confirmation before a Migration Artifact exists.
        </p>
      ) : null}
      {data.validation ? (
        <StaticValidationStatus validation={data.validation} />
      ) : null}
      <EditDiff draft={data} />
      {data.upSql ? (
        <>
          <SqlOutput exported={null} label="Up SQL" sql={data.upSql} />
          <UpEditForm
            generated={data.generatedUpSql}
            key={data.generatedUpSql}
            onEdit={setEdited}
            onReset={() => setEdited(null)}
            pending={preview.isFetching}
            upSql={data.upSql}
          />
        </>
      ) : null}
      <section aria-label="Safe Down" className="space-y-1">
        <h5 className="font-medium">Down</h5>
        {data.down.status === "Produced" ? (
          <SqlOutput exported={null} label="Down SQL" sql={data.down.sql} />
        ) : (
          <div role="note">
            <p className="font-medium">{data.down.label}</p>
            <ul className="text-sm">
              {data.down.blockers.map((blocker) => (
                <li key={`${blocker.operation}:${blocker.path}`}>
                  {`${blocker.operation} · ${blocker.path} — ${blocker.criterion}`}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      {data.confirmable ? (
        <ConfirmArtifactForm
          destructive={data.operations
            .filter(({ id }) => data.destructiveOperationIds.includes(id))
            .map(({ id, operation, path }) => ({
              id,
              label: `${operation} ${path}`,
            }))}
          disabled={confirm.isPending}
          onConfirm={(input) =>
            confirm.mutate({
              ...input,
              generated: data.generatedUpSql,
              upSql: data.upSql,
            })
          }
          supersedable={artifacts}
        />
      ) : null}
      {confirmError ? <p role="alert">{confirmError}</p> : null}
      {data.confirmBlockedBy ? (
        <p className="text-muted-foreground text-sm">{data.confirmBlockedBy}</p>
      ) : null}
    </section>
  );
}
