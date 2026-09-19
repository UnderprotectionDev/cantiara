import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import { useProjectShellData } from "@/features/project-shell/hooks/use-project-shell-data";

import ProjectShellSurface from "../components/project-shell-surface";

export default function ProjectShellView({
  accountId,
  projectId,
}: {
  accountId?: string;
  projectId: string;
}) {
  const { accountPreferencesQuery, projectQuery, scopeTreeQuery } =
    useProjectShellData(accountId, projectId);

  if (projectQuery.isPending) {
    return (
      <main className="surface-frame max-w-[1440px]">
        <div aria-label="Loading…" role="status">
          Loading…
        </div>
      </main>
    );
  }

  if (projectQuery.isError) {
    return (
      <main className="surface-frame max-w-[1440px]">
        <div className="border-y py-8 text-sm" role="alert">
          <p className="font-medium">Project is unavailable.</p>
          <p className="mt-1 text-muted-foreground">
            Try loading this page again.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="surface-frame max-w-[1440px]">
      <ProjectShellSurface
        accountFormattingPreferences={
          accountPreferencesQuery.data ?? DEFAULT_ACCOUNT_PREFERENCES
        }
        project={projectQuery.data}
        projectId={projectId}
        scopeTreeQuery={scopeTreeQuery}
      />
    </main>
  );
}
