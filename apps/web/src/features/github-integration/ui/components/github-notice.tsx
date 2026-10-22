export type GitHubNoticeState =
  | { kind: "alert" | "status"; text: string }
  | undefined;

/** The polite status line and the alert line for the last GitHub action. */
export function GitHubNotice({
  alertClassName = "text-destructive",
  notice,
}: {
  alertClassName?: string;
  notice: GitHubNoticeState;
}) {
  return (
    <>
      <div aria-live="polite" role="status">
        {notice?.kind === "status" ? notice.text : null}
      </div>
      {notice?.kind === "alert" ? (
        <p className={alertClassName} role="alert">
          {notice.text}
        </p>
      ) : null}
    </>
  );
}
