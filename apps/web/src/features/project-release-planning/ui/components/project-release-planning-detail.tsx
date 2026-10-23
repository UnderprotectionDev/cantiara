// biome-ignore-all lint/performance/noJsxPropsBind: Row actions bind to the displayed scope member, reference or audience link.

import {
  type ProjectReleasePlanningDetail as Detail,
  isTerminalProjectReleaseStatus,
  type ProjectReleaseAudienceLink,
  type ProjectReleaseAudienceTarget,
  type ProjectReleaseLink,
  type ProjectReleaseScopeMember,
  type ProjectReleaseStatus,
  projectReleaseScopeCounts,
  projectReleaseScopeGroup,
} from "@cantiara/api/project-release-planning";
import { PROJECT_RELEASE_HYPOTHESIS_FIELDS } from "@cantiara/api/project-source-records";
import { Button } from "@cantiara/ui/components/button";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { workRecordHref } from "@/features/project-shell/lib/project-shell-navigation";
import {
  PROJECT_RELEASE_SCOPE_GROUPS,
  type ProjectReleaseHypothesis,
  projectReleasesHref,
} from "../../lib/project-release-planning-form";
import { ProjectReleaseAudienceForm } from "../forms/project-release-audience-form";
import { ProjectReleaseHypothesisForm } from "../forms/project-release-hypothesis-form";
import {
  ProjectReleaseLinkForm,
  type ProjectReleaseLinkValues,
} from "../forms/project-release-link-form";
import { ProjectReleaseScopeForm } from "../forms/project-release-scope-form";
import { ProjectReleaseStatusControl } from "./project-release-status-control";

export interface ProjectReleasePlanningActions {
  onAddAudience: (target: ProjectReleaseAudienceTarget) => Promise<unknown>;
  onAddLink: (values: ProjectReleaseLinkValues) => Promise<unknown>;
  onAddScope: (workId: string) => Promise<unknown>;
  onChangeStatus: (status: ProjectReleaseStatus) => Promise<unknown>;
  onRemoveAudience: (link: ProjectReleaseAudienceLink) => Promise<unknown>;
  onRemoveLink: (link: ProjectReleaseLink) => Promise<unknown>;
  onRemoveScope: (member: ProjectReleaseScopeMember) => Promise<unknown>;
  onSaveHypothesis: (hypothesis: ProjectReleaseHypothesis) => Promise<unknown>;
}

/** 16.2 Project Release Detail, Planning view: scope, hypothesis and references. */
export function ProjectReleasePlanningDetail({
  actions,
  detail,
  errorMessage,
  projectId,
  savedMessage,
}: {
  actions: ProjectReleasePlanningActions;
  detail: Detail;
  errorMessage?: string;
  projectId: string;
  savedMessage?: string;
}) {
  const { release, readOnly } = detail;
  const attached = detail.scope.filter((member) => member.attached);
  const counts = projectReleaseScopeCounts(attached);
  // Published and Cancelled freeze scope, references and audience links.
  const terminal = isTerminalProjectReleaseStatus(release.status);
  const planningReadOnly = readOnly || terminal;
  return (
    <section aria-label="Project Release" className="space-y-8">
      <header className="surface-header space-y-3">
        <AppLink
          className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
          href={projectReleasesHref(projectId)}
        >
          Releases
        </AppLink>
        <p className="text-muted-foreground text-sm">Project Release</p>
        <h2 className="break-words font-semibold text-2xl tracking-tight">
          {release.name}
        </h2>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Version label</dt>
            <dd>{release.versionLabel || "—"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Status</dt>
            <dd>{release.status}</dd>
          </div>
        </dl>
        {release.description ? (
          <p className="whitespace-pre-wrap break-words text-muted-foreground text-sm">
            {release.description}
          </p>
        ) : null}
        <nav aria-label="Project Release views">
          <span aria-current="page" className="font-medium text-sm">
            Planning
          </span>
        </nav>
      </header>
      {savedMessage ? (
        <p className="text-sm" role="status">
          {savedMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="text-destructive text-sm" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-8">
          <ScopeSection
            actions={actions}
            attached={attached}
            candidates={detail.scopeCandidates}
            counts={counts}
            projectId={projectId}
            readOnly={planningReadOnly}
            terminalStatus={terminal ? release.status : null}
          />
          <HypothesisSection
            actions={actions}
            audience={detail.audience.filter((link) => link.attached)}
            audienceCandidates={detail.audienceCandidates.filter(
              (candidate) =>
                !detail.audience.some(
                  (link) =>
                    link.attached &&
                    link.target.type === candidate.type &&
                    link.target.id === candidate.id,
                ),
            )}
            linksReadOnly={planningReadOnly}
            readOnly={readOnly}
            release={release}
          />
        </div>
        <div className="space-y-8">
          <ProjectReleaseStatusControl
            onChangeStatus={actions.onChangeStatus}
            openScope={counts.open}
            readOnly={readOnly}
            release={release}
            suggestion={detail.suggestion}
          />
          <ReferencesSection
            actions={actions}
            links={detail.links.filter((link) => link.attached)}
            readOnly={planningReadOnly}
            repositories={detail.repositories}
          />
        </div>
      </div>
    </section>
  );
}

function ScopeSection({
  actions,
  attached,
  candidates,
  counts,
  projectId,
  readOnly,
  terminalStatus,
}: {
  actions: ProjectReleasePlanningActions;
  attached: ProjectReleaseScopeMember[];
  candidates: Detail["scopeCandidates"];
  counts: ReturnType<typeof projectReleaseScopeCounts>;
  projectId: string;
  readOnly: boolean;
  terminalStatus: ProjectReleaseStatus | null;
}) {
  return (
    <section aria-label="Scope" className="space-y-4">
      <div className="space-y-1">
        <h3 className="font-medium text-lg">Scope</h3>
        <p className="text-muted-foreground text-sm">
          {counts.completed} completed, {counts.open} open. Scope holds only the
          Work you add; it never changes a Work status.
        </p>
        {terminalStatus ? (
          <p className="text-muted-foreground text-sm">
            {`This Project Release is ${terminalStatus}; its scope is read-only.`}
          </p>
        ) : null}
      </div>
      {attached.length ? null : (
        <p className="text-muted-foreground text-sm">No Work in scope yet.</p>
      )}
      {PROJECT_RELEASE_SCOPE_GROUPS.map(({ group, label }) => {
        const members = attached.filter(
          (member) => projectReleaseScopeGroup(member.work) === group,
        );
        return members.length ? (
          <section aria-label={label} className="space-y-2" key={group}>
            <h4 className="font-medium text-sm">{label}</h4>
            <ul className="divide-y rounded-lg border border-border/70">
              {members.map((member) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
                  key={member.id}
                >
                  {member.work.unavailable ? (
                    <span className="text-muted-foreground">
                      {member.work.key} · Work is unavailable.
                    </span>
                  ) : (
                    <AppLink
                      className="min-w-0 break-words underline-offset-4 hover:underline"
                      href={workRecordHref(projectId, member.work.id)}
                    >
                      {member.work.key} · {member.work.title}
                      <span className="ml-2 text-muted-foreground">
                        {member.work.status}
                      </span>
                    </AppLink>
                  )}
                  {readOnly ? null : (
                    <Button
                      onClick={() => {
                        actions.onRemoveScope(member).catch(() => undefined);
                      }}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Remove from scope
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null;
      })}
      {readOnly ? null : (
        <ProjectReleaseScopeForm
          candidates={candidates}
          onAdd={actions.onAddScope}
        />
      )}
    </section>
  );
}

function HypothesisSection({
  actions,
  audience,
  audienceCandidates,
  linksReadOnly,
  readOnly,
  release,
}: {
  actions: ProjectReleasePlanningActions;
  audience: ProjectReleaseAudienceLink[];
  audienceCandidates: ProjectReleaseAudienceTarget[];
  /** Audience links freeze with a terminal result; the text stays editable. */
  linksReadOnly: boolean;
  readOnly: boolean;
  release: Detail["release"];
}) {
  const [editing, setEditing] = useState(false);
  return (
    <section aria-label="Access and outcome hypothesis" className="space-y-4">
      <div className="space-y-1">
        <h3 className="font-medium text-lg">Access and outcome hypothesis</h3>
        <p className="text-muted-foreground text-sm">
          Optional. These fields never block publishing and nothing is measured
          automatically.
        </p>
      </div>
      {editing && !readOnly ? (
        <ProjectReleaseHypothesisForm
          key={release.revision}
          onCancel={() => setEditing(false)}
          onSave={async (hypothesis) => {
            await actions.onSaveHypothesis(hypothesis);
            setEditing(false);
          }}
          release={release}
        />
      ) : (
        <dl className="space-y-4 rounded-lg border border-border/70 p-4">
          {PROJECT_RELEASE_HYPOTHESIS_FIELDS.map(({ label, name }) => (
            <div key={name}>
              <dt className="font-medium text-sm">{label}</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-muted-foreground text-sm">
                {release[name] || "—"}
              </dd>
              {name === "audience" && audience.length ? (
                <dd className="mt-2">
                  <ul className="flex flex-wrap gap-2 text-sm">
                    {audience.map((link) => (
                      <li
                        className="flex items-center gap-1 rounded-md border border-border/70 px-2 py-1"
                        key={link.id}
                      >
                        <span>
                          {link.target.type}: {link.target.title}
                        </span>
                        {linksReadOnly ? null : (
                          <Button
                            aria-label={`Remove ${link.target.title} from audience`}
                            onClick={() => {
                              actions
                                .onRemoveAudience(link)
                                .catch(() => undefined);
                            }}
                            size="xs"
                            type="button"
                            variant="ghost"
                          >
                            Remove
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </dd>
              ) : null}
            </div>
          ))}
        </dl>
      )}
      {readOnly || editing ? null : (
        <div className="space-y-4">
          <Button
            onClick={() => setEditing(true)}
            type="button"
            variant="outline"
          >
            Edit hypothesis
          </Button>
          {linksReadOnly ? null : (
            <ProjectReleaseAudienceForm
              candidates={audienceCandidates}
              onAdd={actions.onAddAudience}
            />
          )}
        </div>
      )}
    </section>
  );
}

function ReferencesSection({
  actions,
  links,
  readOnly,
  repositories,
}: {
  actions: ProjectReleasePlanningActions;
  links: ProjectReleaseLink[];
  readOnly: boolean;
  repositories: Detail["repositories"];
}) {
  return (
    <aside aria-label="GitHub and environments" className="space-y-4">
      <h3 className="font-medium text-lg">GitHub and environments</h3>
      <p className="text-muted-foreground text-sm">
        References give context only. A GitHub Release never changes this
        Project Release status.
      </p>
      {links.length ? (
        <ul className="divide-y rounded-lg border border-border/70 text-sm">
          {links.map((link) => (
            <li className="space-y-1 p-3" key={link.id}>
              <p>
                <span className="text-muted-foreground">{link.kind}</span>{" "}
                {link.url ? (
                  <a
                    className="break-all underline underline-offset-4"
                    href={link.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {link.label}
                  </a>
                ) : (
                  <span className="break-all">{link.label}</span>
                )}
              </p>
              {link.repository ? (
                <p className="text-muted-foreground">
                  {link.repository.owner}/{link.repository.name}
                </p>
              ) : null}
              {readOnly ? null : (
                <Button
                  onClick={() => {
                    actions.onRemoveLink(link).catch(() => undefined);
                  }}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">No references yet.</p>
      )}
      {readOnly ? null : (
        <ProjectReleaseLinkForm
          onAdd={actions.onAddLink}
          repositories={repositories}
        />
      )}
    </aside>
  );
}
