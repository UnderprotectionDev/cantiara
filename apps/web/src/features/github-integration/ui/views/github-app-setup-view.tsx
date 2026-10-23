import { GITHUB_APP_LABEL } from "@cantiara/api/github-integration";
import { buttonVariants } from "@cantiara/ui/components/button";
import { Link } from "@tanstack/react-router";

import { useCompleteGitHubInstall } from "../../hooks/use-complete-github-install";
import type { GitHubAppSetup } from "../../lib/github-app-setup-search";

/** Where GitHub returns after the App install; finishes it, then opens the Project. */
export function GitHubAppSetupView({ setup }: { setup: GitHubAppSetup }) {
  const completion = useCompleteGitHubInstall(setup);
  if (setup.installationId === undefined) {
    return (
      <main className="space-y-3 p-6">
        <p role="alert">{`This is not a completed ${GITHUB_APP_LABEL} install. Start from a Project's GitHub area.`}</p>
        <Link className={buttonVariants()} to="/projects">
          Projects
        </Link>
      </main>
    );
  }
  if (completion.isPending) {
    return (
      <main className="p-6">
        <p role="status">{`Finishing the ${GITHUB_APP_LABEL} install…`}</p>
      </main>
    );
  }
  if (completion.isError || !completion.data) {
    return (
      <main className="space-y-3 p-6">
        <p role="alert">
          {completion.error instanceof Error && completion.error.message
            ? completion.error.message
            : `The ${GITHUB_APP_LABEL} install could not be finished.`}
        </p>
        <Link className={buttonVariants()} to="/projects">
          Projects
        </Link>
      </main>
    );
  }
  return (
    <main className="space-y-3 p-6">
      <p role="status">{`${GITHUB_APP_LABEL} installed on ${completion.data.installation.accountLogin}.`}</p>
      <Link
        className={buttonVariants()}
        hash="project-area-github"
        params={{ projectId: completion.data.projectId }}
        to="/projects/$projectId"
      >
        Open GitHub
      </Link>
    </main>
  );
}
