// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the selected Research Session and TanStack Form fields.
import type {
  ResearchSessionFields,
  ResearchSessionRecord,
} from "@cantiara/api/research-sessions";
import { Button } from "@cantiara/ui/components/button";
import { useState } from "react";
import { ResearchSessionNotes } from "../components/research-session-notes";
import type { ResearchBindingActions } from "../forms/research-note-binding-form";
import {
  ResearchSessionEditor,
  type Save,
} from "../forms/research-session-form";
import type { SaveResearchNote } from "../forms/research-session-note-form";

export function ResearchSessionsView({
  records,
  timeZone,
  readOnly,
  onSave,
  onStartEditing,
  onSaveNote,
  bindingActions,
}: {
  records: ResearchSessionRecord[];
  timeZone: string;
  readOnly: boolean;
  onSave: Save;
  onStartEditing: () => void;
  onSaveNote: SaveResearchNote;
  bindingActions?: ResearchBindingActions;
}) {
  const [editing, setEditing] = useState<ResearchSessionRecord | "new" | null>(
    null,
  );
  const [saved, setSaved] = useState(false);
  async function save(
    fields: ResearchSessionFields,
    record?: ResearchSessionRecord,
  ) {
    await onSave(fields, record);
    setEditing(null);
    setSaved(true);
  }
  return (
    <section aria-label="Research Sessions" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-lg">Research Sessions</h2>
        <Button
          disabled={readOnly || editing !== null}
          onClick={() => {
            onStartEditing();
            setEditing("new");
            setSaved(false);
          }}
        >
          Create Research Session
        </Button>
      </div>
      {saved ? <p role="status">Research Session saved.</p> : null}
      {readOnly ? (
        <p>This Project is archived. Research Sessions are read-only.</p>
      ) : null}
      {editing ? (
        <ResearchSessionEditor
          key={editing === "new" ? "new" : editing.id}
          onCancel={() => setEditing(null)}
          onSave={save}
          record={editing === "new" ? undefined : editing}
          timeZone={timeZone}
        />
      ) : null}
      {records.length ? (
        <ul className="space-y-3">
          {records.map((record) => (
            <li
              className="rounded-lg border border-border/70 p-4"
              key={record.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium">{record.title}</h3>
                  <p className="text-muted-foreground text-sm">
                    {record.status} · Consent: {record.consent}
                  </p>
                </div>
                <Button
                  disabled={readOnly || editing !== null}
                  onClick={() => {
                    onStartEditing();
                    setEditing(record);
                    setSaved(false);
                  }}
                  variant="outline"
                >
                  Edit
                </Button>
              </div>
              <p className="whitespace-pre-wrap text-sm">{record.purpose}</p>
              <ResearchSessionNotes
                bindingActions={bindingActions}
                onSave={onSaveNote}
                onStartEditing={onStartEditing}
                readOnly={readOnly || editing !== null}
                record={record}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">No Research Sessions yet.</p>
      )}
    </section>
  );
}
