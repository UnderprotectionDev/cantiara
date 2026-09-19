const PROJECT_SHELL_EXPLANATION_STORAGE_PREFIX =
  "cantiara:project-shell:explanation-dismissed:";

function projectShellExplanationStorageKey(projectId: string) {
  return `${PROJECT_SHELL_EXPLANATION_STORAGE_PREFIX}${projectId}`;
}

export function isProjectShellExplanationDismissed(projectId: string) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return (
      window.localStorage.getItem(
        projectShellExplanationStorageKey(projectId),
      ) === "dismissed"
    );
  } catch {
    return false;
  }
}

export function rememberProjectShellExplanationDismissal(projectId: string) {
  try {
    window.localStorage.setItem(
      projectShellExplanationStorageKey(projectId),
      "dismissed",
    );
  } catch {
    // A restricted browser storage context should not block the Project Shell.
  }
}
