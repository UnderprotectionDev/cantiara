// biome-ignore-all lint/performance/noJsxPropsBind: Document controls close over the selected record and current editor state.
import type { AccountPreferences } from "@cantiara/api/account-preferences";
import { Button } from "@cantiara/ui/components/button";
import { formatAccountDateTime } from "@/features/account-preferences/lib/account-preferences-format";
import { writeTextToClipboard } from "@/lib/clipboard";
import type { createDocumentEditSession } from "../../store/document-edit-session";

export default function DocumentRecoveryNotice({
  editing,
  accountFormattingPreferences,
  recoveryPayload,
  setError,
}: {
  editing: ReturnType<ReturnType<typeof createDocumentEditSession>["get"]>;
  accountFormattingPreferences: AccountPreferences;
  recoveryPayload: string;
  setError: import("react").Dispatch<
    import("react").SetStateAction<string | null>
  >;
}) {
  let recoveryStatus = editing.error;
  if (editing.offline) {
    recoveryStatus = "Offline";
  } else if (editing.conflictDraft) {
    recoveryStatus = "Conflict Draft";
  }

  return editing.offline || editing.conflictDraft || editing.error ? (
    <div
      className="mb-5 space-y-3 rounded-lg border border-destructive p-4"
      role="alert"
    >
      <p>{recoveryStatus}</p>
      <p>
        Last successful save:{" "}
        <time dateTime={editing.lastSavedAt}>
          {formatAccountDateTime(
            editing.lastSavedAt,
            accountFormattingPreferences,
          )}
        </time>
      </p>
      {editing.dirty ? (
        <>
          <p>Unsaved changes may be lost</p>
          <p>
            This memory buffer is not retained if you close the app or change
            Documents.
          </p>
        </>
      ) : (
        <p>The Document has no unwritten changes.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() =>
            writeTextToClipboard(recoveryPayload).catch((failure: unknown) =>
              setError(
                failure instanceof Error ? failure.message : "Copy failed.",
              ),
            )
          }
          type="button"
          variant="outline"
        >
          Copy
        </Button>
        <Button
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([recoveryPayload], {
                type: "application/json;charset=utf-8",
              }),
            );
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "document-recovery.json";
            anchor.click();
            setTimeout(() => URL.revokeObjectURL(url), 0);
          }}
          type="button"
          variant="outline"
        >
          Download
        </Button>
      </div>
    </div>
  ) : null;
}
