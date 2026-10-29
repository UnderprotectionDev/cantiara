import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import type { ReactNode } from "react";
import { useProjectShellData } from "@/features/project-shell/hooks/use-project-shell-data";
import { ClientShellStatus } from "@/features/web-macos-client/ui/components/client-shell";

import ProjectShellSurface, {
  type ProjectProductionArea,
  type ProjectReleasesArea,
} from "../components/project-shell-surface";

export default function ProjectShellView({
  accountId,
  githubArea,
  productionArea,
  projectHistoryArea,
  projectUpdatesArea,
  linkSharingArea,
  projectId,
  releasesArea,
  releaseEvidenceArea,
  valueChainArea,
  workHistoryArea,
}: {
  accountId?: string;
  githubArea?: ReactNode;
  productionArea?: ProjectProductionArea;
  projectHistoryArea?: ReactNode;
  projectUpdatesArea?: ReactNode;
  linkSharingArea?: ReactNode;
  projectId: string;
  releasesArea?: ProjectReleasesArea;
  releaseEvidenceArea?: (releaseId: string) => ReactNode;
  valueChainArea?: (goalId: string) => ReactNode;
  workHistoryArea?: (workId: string) => ReactNode;
}) {
  const { accountPreferencesQuery, projectQuery, scopeTreeQuery } =
    useProjectShellData(accountId, projectId);
  const formattingPreferences =
    accountPreferencesQuery.data ?? DEFAULT_ACCOUNT_PREFERENCES;

  if (projectQuery.isPending) {
    return (
      <main className="surface-frame max-w-[1440px]">
        <ClientShellStatus
          accountFormattingPreferences={formattingPreferences}
        />
        <div aria-label="Loading…" role="status">
          Loading…
        </div>
      </main>
    );
  }

  if (projectQuery.isError && !projectQuery.data) {
    return (
      <main className="surface-frame max-w-[1440px]">
        <ClientShellStatus
          accountFormattingPreferences={formattingPreferences}
        />
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
        accountFormattingPreferences={formattingPreferences}
        accountId={accountId}
        githubArea={githubArea}
        linkSharingArea={linkSharingArea}
        productionArea={productionArea}
        project={projectQuery.data}
        projectHistoryArea={projectHistoryArea}
        projectId={projectId}
        projectUpdatesArea={projectUpdatesArea}
        releaseEvidenceArea={releaseEvidenceArea}
        releasesArea={releasesArea}
        scopeTreeQuery={scopeTreeQuery}
        valueChainArea={valueChainArea}
        workHistoryArea={workHistoryArea}
      />
    </main>
  );
}
