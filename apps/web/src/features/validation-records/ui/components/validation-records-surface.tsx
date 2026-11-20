import { Button } from "@cantiara/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { executeWrite } from "@/utils/execute-write";
import { client, orpc } from "@/utils/orpc";
import {
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
  async function refresh(key: string) {
    if (pending.current?.key === key) {
      pending.current = null;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: options.queryKey }),
      queryClient.invalidateQueries({
        queryKey: orpc.projectSourceRecords.key(),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.projectSourceRecord.key(),
      }),
    ]);
  }
  function write(key: string, command: () => Promise<unknown>) {
    return executeWrite(queryClient, key, command, async (_, error) => {
      if (
        !error ||
        (error instanceof Error && "code" in error && error.code === "CONFLICT")
      ) {
        await refresh(key);
      }
    });
  }
  async function save(draft: ValidationDraft, record?: ValidationRecord) {
    const fields = {
      ...draft,
      projectId,
      sourceType: "Validation Record" as const,
    };
    const { id, key } = validationCommandIdentity(fields, record);
    await write(key, () =>
      record
        ? client.updateProjectSourceRecord({
            ...fields,
            sourceId: id,
            baseRevision: record.revision,
            clientIdempotencyKey: key,
          })
        : client.createProjectSourceRecord({
            ...fields,
            id,
            baseRevision: 0,
            clientIdempotencyKey: key,
          }),
    );
  }
  async function transition(
    record: ValidationRecord,
    status: ValidationRecord["status"],
  ) {
    const { key } = validationCommandIdentity({ status }, record);
    await write(key, () =>
      client.transitionProjectSourceRecord({
        projectId,
        sourceType: "Validation Record",
        sourceId: record.id,
        status,
        baseRevision: record.revision,
        clientIdempotencyKey: key,
      }),
    );
  }
  function startEditing() {
    pending.current = null;
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
      selectedId={selectedId}
    />
  );
}
