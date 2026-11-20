import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { orpc } from "@/utils/orpc";
import {
  isConflictError,
  isValidationContextRecord,
  type ValidationDraft,
  type ValidationRecord,
} from "../../lib/validation-record";
import { ValidationRecordsView } from "../views/validation-records-view";

export default function ValidationRecordsSurface({
  projectId,
  selectedId,
}: {
  projectId: string;
  selectedId?: string;
}) {
  const queryClient = useQueryClient();
  const options = orpc.projectValidationRecords.queryOptions({
    input: { projectId },
  });
  const records = useQuery(options);
  const sources = useQuery(
    orpc.projectSourceRecords.queryOptions({ input: { projectId } }),
  );
  const pending = useRef<{
    fingerprint: string;
    key: string;
    id: string;
  } | null>(null);
  function validationCommandIdentity(
    payload: unknown,
    record?: ValidationRecord,
  ) {
    const fingerprint = JSON.stringify({
      payload,
      id: record?.id,
      revision: record?.revision,
    });
    if (pending.current?.fingerprint !== fingerprint) {
      pending.current = {
        fingerprint,
        key: crypto.randomUUID(),
        id: record?.id ?? pending.current?.id ?? crypto.randomUUID(),
      };
    }
    return pending.current;
  }
  async function refresh(
    error: unknown,
    {
      clientIdempotencyKey,
      projectId: targetProject,
    }: { clientIdempotencyKey: string; projectId: string },
    sourceId: string,
  ) {
    if (error && !isConflictError(error)) {
      return;
    }
    if (!error && pending.current?.key === clientIdempotencyKey) {
      pending.current = null;
    }
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: orpc.projectValidationRecords.key({
          input: { projectId: targetProject },
        }),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.projectSourceRecords.key({
          input: { projectId: targetProject },
        }),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.projectSourceRecord.key({
          input: { sourceId, sourceType: "Validation Record" },
        }),
      }),
    ]);
  }
  const create = useMutation(
    orpc.createProjectSourceRecord.mutationOptions({
      meta: { onlineWrite: true },
      onSettled: (_, error, input) => refresh(error, input, input.id),
    }),
  );
  const update = useMutation(
    orpc.updateProjectSourceRecord.mutationOptions({
      meta: { onlineWrite: true },
      onSettled: (_, error, input) => refresh(error, input, input.sourceId),
    }),
  );
  const changeStatus = useMutation(
    orpc.transitionProjectSourceRecord.mutationOptions({
      meta: { onlineWrite: true },
      onSettled: (_, error, input) => refresh(error, input, input.sourceId),
    }),
  );
  async function save(draft: ValidationDraft, record?: ValidationRecord) {
    const fields = {
      ...draft,
      projectId,
      sourceType: "Validation Record" as const,
    };
    const { id, key } = validationCommandIdentity(fields, record);
    if (record) {
      await update.mutateAsync({
        ...fields,
        sourceId: id,
        baseRevision: record.revision,
        clientIdempotencyKey: key,
      });
    } else {
      await create.mutateAsync({
        ...fields,
        id,
        baseRevision: 0,
        clientIdempotencyKey: key,
      });
    }
  }
  async function transition(
    record: ValidationRecord,
    status: ValidationRecord["status"],
  ) {
    const { key } = validationCommandIdentity({ status }, record);
    await changeStatus.mutateAsync({
      projectId,
      sourceType: "Validation Record",
      sourceId: record.id,
      status,
      baseRevision: record.revision,
      clientIdempotencyKey: key,
    });
  }
  function startEditing() {
    pending.current = null;
    create.reset();
    update.reset();
    changeStatus.reset();
  }
  function retry() {
    sources.refetch().catch(() => undefined);
    records.refetch().catch(() => undefined);
  }
  if (records.status === "pending" || sources.isPending) {
    return <p role="status">Loading Validation Records…</p>;
  }
  if (!(records.data && sources.data)) {
    return (
      <div className="space-y-3">
        <p role="alert">Validation Records are unavailable.</p>
        <Button onClick={retry}>Retry</Button>
      </div>
    );
  }
  return (
    <ValidationRecordsView
      counterparts={sources.data.filter(isValidationContextRecord)}
      onSave={save}
      onStartEditing={startEditing}
      onTransition={transition}
      readOnly={records.data.readOnly}
      records={records.data.records}
      saved={create.isSuccess || update.isSuccess || changeStatus.isSuccess}
      saveError={create.error ?? update.error}
      savePending={create.isPending || update.isPending}
      selectedId={selectedId}
      transitionFailed={changeStatus.isError}
      transitionPending={changeStatus.isPending}
    />
  );
}
