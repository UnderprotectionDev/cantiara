import type {
  CaptureInboxItem,
  CaptureRecordCreateInput,
  DirectBugCreateInput,
} from "@cantiara/api/capture-triage";
import type {
  WorkCaptureProvenance,
  WorkLifecycleAccess,
} from "@cantiara/api/work-lifecycle";

import {
  CaptureInboxError,
  type CaptureInboxWorkCreate,
} from "./capture-inbox";

const CAPTURE_LINE_BREAK_PATTERN = /\r?\n/u;

function captureTitle(content: string) {
  return (
    content
      .split(CAPTURE_LINE_BREAK_PATTERN)
      .find((line) => line.trim().length > 0)
      ?.trim() ?? "Untitled capture"
  );
}

function captureProvenance(item: CaptureInboxItem): WorkCaptureProvenance {
  return {
    attachment: item.attachment ?? null,
    captureId: item.id,
    capturedAt: item.createdAt,
    content: item.content,
    fields: item.fields,
    link: item.link ?? null,
    origin: item.origin ?? null,
    template: item.template,
  };
}

function requireProjectId(
  projectId: string | null,
  code:
    | "PROJECT_REQUIRED_FOR_CREATE_BUG"
    | "PROJECT_REQUIRED_FOR_WORK_CONVERSION",
  message: string,
) {
  if (!projectId) {
    throw new CaptureInboxError(code, message);
  }
  return projectId;
}

async function createBug(
  workLifecycle: WorkLifecycleAccess,
  input: DirectBugCreateInput & { accountId: string },
) {
  const projectId = requireProjectId(
    input.projectId,
    "PROJECT_REQUIRED_FOR_CREATE_BUG",
    "Create Bug requires a Project.",
  );
  const work = await workLifecycle.create(input.accountId, {
    baseRevision: 0,
    clientIdempotencyKey: input.clientIdempotencyKey ?? crypto.randomUUID(),
    projectId,
    title: captureTitle(input.content),
    type: "Bug",
  });
  return { workId: work.id };
}

async function createWork(
  workLifecycle: WorkLifecycleAccess,
  input: CaptureRecordCreateInput,
) {
  const projectId = requireProjectId(
    input.projectId,
    "PROJECT_REQUIRED_FOR_WORK_CONVERSION",
    "Converting a Capture Inbox item to Work requires a Project.",
  );
  const work = await workLifecycle.create(input.accountId, {
    baseRevision: 0,
    captureProvenance: captureProvenance(input.item),
    clientIdempotencyKey: input.clientIdempotencyKey,
    projectId,
    title: input.title,
    type: "Task",
  });
  return { id: work.id, recordType: "Work" };
}

export function createCaptureInboxWorkCreate(
  workLifecycle: WorkLifecycleAccess,
): CaptureInboxWorkCreate {
  return {
    createBug: (input) => createBug(workLifecycle, input),
    createWork: (input) => createWork(workLifecycle, input),
  };
}
