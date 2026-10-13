import {
  type Document,
  type DocumentConflictDraft,
  documentConflictDraftSchema,
  type UpdateDocumentInput,
} from "@cantiara/api/documents";
import { createStore } from "@tanstack/react-store";

import type { ClientShell } from "../../web-macos-client/store/client-shell";

export type DocumentEditBuffer = Pick<Document, "body" | "title" | "type">;

interface DocumentEditState {
  baseRevision: number;
  buffer: DocumentEditBuffer;
  conflictDraft: DocumentConflictDraft | null;
  dirty: boolean;
  editable: boolean;
  error: string | null;
  lastSavedAt: string;
  offline: boolean;
  pending: boolean;
}

interface DocumentEditSessionOptions {
  record: Document;
  shell: ClientShell;
  write: (
    input: UpdateDocumentInput & {
      baseRevision: number;
      clientIdempotencyKey: string;
    },
  ) => Promise<Document>;
}

function rejectedDraft(error: unknown) {
  if (!(error && typeof error === "object" && "data" in error)) {
    return null;
  }
  const { data } = error;
  if (!(data && typeof data === "object" && "conflictDraft" in data)) {
    return null;
  }
  const result = documentConflictDraftSchema.safeParse(data.conflictDraft);
  return result.success ? result.data : null;
}

function sameBuffer(left: DocumentEditBuffer, right: DocumentEditBuffer) {
  return (
    left.body === right.body &&
    left.title === right.title &&
    left.type === right.type
  );
}

export function createDocumentEditSession({
  record,
  shell,
  write,
}: DocumentEditSessionOptions) {
  let saved: DocumentEditBuffer = {
    body: record.body,
    title: record.title,
    type: record.type,
  };
  let pendingKey: string | null = null;
  const store = createStore<DocumentEditState>({
    buffer: saved,
    baseRevision: record.revision,
    conflictDraft: null,
    dirty: false,
    editable:
      shell.get().connection === "online" && !shell.get().updateRequired,
    error: null,
    lastSavedAt: record.updatedAt,
    offline: shell.get().connection === "offline",
    pending: false,
  });

  function update(change: Partial<DocumentEditState>) {
    store.setState((state) => {
      const next = { ...state, ...change };
      return {
        ...next,
        editable: !(
          next.offline ||
          next.pending ||
          next.conflictDraft ||
          shell.get().updateRequired
        ),
      };
    });
  }

  function edit(buffer: DocumentEditBuffer) {
    if (!store.state.editable) {
      return false;
    }
    if (!sameBuffer(buffer, store.state.buffer)) {
      pendingKey = null;
      update({ buffer: { ...buffer }, dirty: !sameBuffer(buffer, saved) });
    }
    return true;
  }

  function accept(document: Document) {
    saved = { body: document.body, title: document.title, type: document.type };
    pendingKey = null;
    update({
      buffer: saved,
      baseRevision: document.revision,
      conflictDraft: null,
      dirty: false,
      error: null,
      lastSavedAt: document.updatedAt,
      pending: false,
    });
  }

  async function save() {
    shell.assertOnline();
    if (store.state.pending || store.state.conflictDraft) {
      throw new Error("Resolve the Conflict Draft before saving.");
    }
    pendingKey ??= crypto.randomUUID();
    const command = {
      ...store.state.buffer,
      documentId: record.id,
      baseRevision: store.state.baseRevision,
      clientIdempotencyKey: pendingKey,
    };
    update({ pending: true, error: null });
    try {
      const document = await shell.runOnlineOnly(() => write(command));
      accept(document);
      return document;
    } catch (error) {
      update({
        conflictDraft: rejectedDraft(error),
        error:
          error instanceof Error
            ? error.message
            : "Document could not be saved.",
        pending: false,
      });
      throw error;
    }
  }

  return {
    accept,
    edit,
    get: () => store.state,
    save,
    subscribe: (listener: () => void) => {
      const subscription = store.subscribe(listener);
      return () => subscription.unsubscribe();
    },
    connect: () => {
      update({ offline: shell.get().connection === "offline" });
      const subscription = shell.subscribe((state) => {
        const reconnect = store.state.offline && state.connection === "online";
        update({ offline: state.connection === "offline" });
        if (
          reconnect &&
          store.state.dirty &&
          !store.state.pending &&
          !store.state.conflictDraft &&
          !state.updateRequired
        ) {
          save().catch(() => undefined);
        }
      });
      return () => subscription.unsubscribe();
    },
  };
}
