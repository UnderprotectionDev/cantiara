import type { FileAttachmentAccess } from "@cantiara/api/file-attachments";
import { createAuthOptions } from "@cantiara/auth";
import { createDb } from "@cantiara/db";
import { account, session, user } from "@cantiara/db/schema/auth";
import { workRelation } from "@cantiara/db/schema/relation";
import { createSecurityEventDb } from "@cantiara/db/security-events";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { serve } from "bun";
import { eq } from "drizzle-orm";
import { initLogger } from "evlog";

import { createApp } from "../src/app";
import { createDatabaseAccountAdmission } from "../src/features/account-access/server/account-admission";
import { createGitHubAvailability } from "../src/features/account-access/server/github-availability";
import { CONFIRM_GITHUB_IDENTITY_CALLBACK_PATH } from "../src/features/account-access/server/github-identity-confirmation";
import { createDatabaseGitHubIdentityConfirmation } from "../src/features/account-access/server/github-identity-confirmation-database";
import { createDatabaseAccountSessionAccess } from "../src/features/account-access/server/session-access-database";
import {
  accountPreferencesMutationTarget,
  createDatabaseAccountPreferences,
} from "../src/features/account-preferences/server/account-preferences-database";
import {
  captureInboxMutationTarget,
  createDatabaseCaptureInbox,
} from "../src/features/capture-triage/server/capture-inbox-database";
import { createDevelopmentCaptureInboxTriageAdapter } from "../src/features/capture-triage/server/capture-inbox-development-adapter";
import { createCaptureInboxWorkCreate } from "../src/features/capture-triage/server/capture-work-create";
import { createDatabaseCustomFields } from "../src/features/custom-fields/server/custom-fields-database";
import {
  createDatabaseCustomFieldFinalizationWriter,
  createDatabaseCustomFieldMutationContracts,
} from "../src/features/custom-fields/server/custom-fields-mutation-database";
import { createDatabaseMutationContract } from "../src/features/mutation-and-undo/server/mutation-contract-database";
import { createDatabaseProjectShell } from "../src/features/project-shell/server/project-shell-database";
import { createDatabaseProjectShellMutationContracts } from "../src/features/project-shell/server/project-shell-mutation-database";
import { createDatabaseRelations } from "../src/features/relations/server/relations";
import {
  createDatabaseTagMutationContracts,
  createDatabaseTags,
} from "../src/features/tags/server/tags-database";
import { createWorkContextAccess } from "../src/features/work-context/server/work-context";
import { createDatabaseWorkDrafts } from "../src/features/work-drafts/server/work-drafts-database";
import { createDatabaseWorkLifecycle } from "../src/features/work-lifecycle/server/work-lifecycle-database";
import { createDatabaseWorkTemplates } from "../src/features/work-templates/server/work-templates-database";

const serverPort = Number(process.env.E2E_SERVER_PORT ?? "3100");
const serverOrigin = `http://127.0.0.1:${serverPort}`;
const webOrigin = process.env.E2E_WEB_ORIGIN ?? "http://127.0.0.1:4173";
const E2E_FIXTURE_KEY_PATTERN = /^[a-z-]+$/;
const databaseUrl = process.env.DATABASE_URL;
const securityEventDatabaseUrl = process.env.SECURITY_EVENT_DATABASE_URL;
const secret = process.env.BETTER_AUTH_SECRET;

if (!(databaseUrl && securityEventDatabaseUrl && secret)) {
  throw new Error(
    "DATABASE_URL, SECURITY_EVENT_DATABASE_URL, and BETTER_AUTH_SECRET are required",
  );
}

const database = createDb({ DATABASE_URL: databaseUrl });
const securityEventDatabase = createSecurityEventDb({
  DATABASE_URL: securityEventDatabaseUrl,
});
const accountAdmission = createDatabaseAccountAdmission(database);
const accountPreferences = createDatabaseAccountPreferences(database);
const accountPreferencesMutationContract = createDatabaseMutationContract(
  database,
  { target: accountPreferencesMutationTarget },
);
const captureInboxMutationContract = createDatabaseMutationContract(database, {
  target: captureInboxMutationTarget,
});
const projectShell = createDatabaseProjectShell(database);
const projectShellMutationContracts =
  createDatabaseProjectShellMutationContracts(database);
const tags = createDatabaseTags(database);
const tagMutationContracts = createDatabaseTagMutationContracts(database);
const customFields = createDatabaseCustomFields(database);
const customFieldMutationContracts =
  createDatabaseCustomFieldMutationContracts(database);
const workLifecycle = createDatabaseWorkLifecycle(database, {
  customFieldValueWriter: createDatabaseCustomFieldFinalizationWriter(),
});
const workTemplates = createDatabaseWorkTemplates(database, { workLifecycle });
const relations = createDatabaseRelations(database);
const workContext = createWorkContextAccess(workLifecycle, relations);
const captureInbox = createDatabaseCaptureInbox(
  database,
  createCaptureInboxWorkCreate(workLifecycle),
  captureInboxMutationContract,
  createDevelopmentCaptureInboxTriageAdapter(),
);
const workDrafts = createDatabaseWorkDrafts(
  database,
  workLifecycle,
  projectShell,
);
const unavailableFileAttachmentOperation = (): never => {
  throw new Error("File Attachment operation is unavailable in this fixture.");
};
const fileAttachments = {
  canSelectIntoExternalSurface: async () => ({
    allowed: true,
    reason: null,
  }),
  cleanupVersionDerivatives: async () => undefined,
  createMarking: unavailableFileAttachmentOperation,
  finalize: unavailableFileAttachmentOperation,
  getQuota: unavailableFileAttachmentOperation,
  list: async () => [],
  listMarkings: unavailableFileAttachmentOperation,
  previewLocationBind: unavailableFileAttachmentOperation,
  preview: unavailableFileAttachmentOperation,
  readAsset: unavailableFileAttachmentOperation,
  stage: unavailableFileAttachmentOperation,
  undoMarking: unavailableFileAttachmentOperation,
  bindLocation: unavailableFileAttachmentOperation,
} satisfies FileAttachmentAccess;
const githubAvailability = createGitHubAvailability();
const authOptions = createAuthOptions(
  {
    BETTER_AUTH_SECRET: secret,
    BETTER_AUTH_URL: serverOrigin,
    CORS_ORIGIN: webOrigin,
    GITHUB_CLIENT_ID: "e2e-github-client",
    GITHUB_CLIENT_SECRET: "e2e-github-secret",
    TRUSTED_PROXY_IPS: [],
  },
  database,
  accountAdmission,
  [],
  githubAvailability,
);
const auth = betterAuth({
  ...authOptions,
  rateLimit: {
    ...authOptions.rateLimit,
    customRules: {
      ...authOptions.rateLimit?.customRules,
      "/get-session": false,
    },
  },
  plugins: [testUtils()],
});
const accountSessionAccess = createDatabaseAccountSessionAccess(
  database,
  securityEventDatabase,
  { onGitHubLoginOAuthRevoked: githubAvailability.requireFreshConsent },
);
const githubIdentityConfirmation = createDatabaseGitHubIdentityConfirmation(
  database,
  {
    authorizeSession: (principal) =>
      accountSessionAccess.authorizeWrite(principal),
    callbackURL: new URL(CONFIRM_GITHUB_IDENTITY_CALLBACK_PATH, serverOrigin)
      .href,
    clientId: "e2e-github-client",
    clientSecret: "e2e-github-secret",
    githubAvailability,
  },
);
await accountSessionAccess.replaySessionRevocations();

initLogger({ env: { service: "cantiara-e2e-server" } });

const app = createApp({
  accountSessionAccess,
  accountPreferences,
  accountPreferencesCompatibility: accountPreferences,
  accountPreferencesMutationContract,
  auth,
  captureInbox,
  customFields,
  customFieldMutationContracts,
  corsOrigin: webOrigin,
  database,
  desktopOrigins: [],
  fileAttachments,
  githubAvailability,
  githubIdentityConfirmation,
  nodeEnv: "test",
  projectShell,
  projectShellMutationContracts,
  relations,
  tags,
  tagMutationContracts,
  workLifecycle,
  workTemplates,
  workContext,
  workDrafts,
  redactSecrets: () => new Error("Redacted E2E server error"),
  trustedProxyIps: [],
});

const authContext = await auth.$context;
async function createE2EFixture(fixtureKey: string) {
  const fixtureEmail = `account-access-e2e-${fixtureKey}@example.invalid`;
  await database.delete(user).where(eq(user.email, fixtureEmail));
  const founder = authContext.test.createUser({
    email: fixtureEmail,
    emailVerified: true,
    name: "Founder",
  });
  await authContext.test.saveUser(founder);
  await database.insert(account).values({
    accountId: `e2e-github-${crypto.randomUUID()}`,
    id: crypto.randomUUID(),
    providerId: "github",
    userId: founder.id,
  });
  const currentLogin = await authContext.test.login({ userId: founder.id });
  const otherLogin = await authContext.test.login({ userId: founder.id });
  await database
    .update(session)
    .set({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:155.0) Gecko/20100101 Firefox/155.0",
    })
    .where(eq(session.id, currentLogin.session.id));
  await database
    .update(session)
    .set({
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64; rv:142.0) Gecko/20100101 Firefox/142.0",
    })
    .where(eq(session.id, otherLogin.session.id));

  const [currentCookie] = currentLogin.cookies;
  const [otherCookie] = otherLogin.cookies;
  if (!(currentCookie && otherCookie)) {
    throw new Error("Better Auth did not create an E2E session cookie");
  }

  const captureProject =
    fixtureKey === "capture-inbox"
      ? await projectShell.create(founder.id, {
          name: "Capture Project",
          starterConfiguration: "Blank Project",
        })
      : null;

  const scopeTreeProject =
    fixtureKey === "scope-tree"
      ? await projectShell.create(founder.id, {
          name: "Scope Tree Project",
          shortCode: "SCOPE",
          starterConfiguration: "Blank Project",
        })
      : null;
  if (scopeTreeProject) {
    const feature = await workLifecycle.create(founder.id, {
      baseRevision: 0,
      clientIdempotencyKey: "scope-tree-feature",
      projectId: scopeTreeProject.id,
      title: "Checkout Feature",
      type: "Feature",
    });
    const includedWork = await workLifecycle.create(founder.id, {
      baseRevision: 0,
      clientIdempotencyKey: "scope-tree-included-work",
      projectId: scopeTreeProject.id,
      title: "Verify provider callback",
      type: "Task",
    });
    const blocker = await workLifecycle.create(founder.id, {
      baseRevision: 0,
      clientIdempotencyKey: "scope-tree-blocker",
      projectId: scopeTreeProject.id,
      title: "Wait for provider access",
      type: "Research",
    });
    const included = await workLifecycle.includeWork(founder.id, {
      baseRevision: includedWork.revision,
      clientIdempotencyKey: "scope-tree-include-work",
      featureId: feature.id,
      workId: includedWork.id,
    });
    await database.insert(workRelation).values([
      {
        id: `scope-tree-block-${crypto.randomUUID()}`,
        kind: "Blocks",
        sourceWorkId: blocker.id,
        targetLabel: included.key,
        targetProjectId: scopeTreeProject.id,
        targetRecordId: included.id,
      },
      {
        id: `scope-tree-milestone-${crypto.randomUUID()}`,
        kind: "Contributes to Milestone",
        sourceWorkId: included.id,
        targetLabel: "Private beta",
        targetProjectId: scopeTreeProject.id,
        targetRecordId: "milestone-1",
      },
    ]);
  }

  const tagsProject =
    fixtureKey === "tags"
      ? await projectShell.create(founder.id, {
          name: "Tags Project",
          shortCode: "TAGS",
          starterConfiguration: "Blank Project",
        })
      : null;
  if (tagsProject) {
    await workLifecycle.create(founder.id, {
      baseRevision: 0,
      clientIdempotencyKey: "tags-work-prepare",
      projectId: tagsProject.id,
      title: "Prepare launch",
      type: "Task",
    });
    await workLifecycle.create(founder.id, {
      baseRevision: 0,
      clientIdempotencyKey: "tags-work-review",
      projectId: tagsProject.id,
      title: "Review launch",
      type: "Task",
    });
  }

  let usedInSourceProjectId: string | null = null;
  let usedInSourceWorkId: string | null = null;
  const usedInTargetProject =
    fixtureKey === "used-in"
      ? await projectShell.create(founder.id, {
          name: "Used In Target Project",
          shortCode: "USED",
          starterConfiguration: "Blank Project",
        })
      : null;
  const usedInSourceProject =
    fixtureKey === "used-in"
      ? await projectShell.create(founder.id, {
          name: "Used In Source Project",
          shortCode: "SRC",
          starterConfiguration: "Blank Project",
        })
      : null;
  if (usedInTargetProject && usedInSourceProject) {
    const target = await workLifecycle.create(founder.id, {
      baseRevision: 0,
      clientIdempotencyKey: "used-in-target-work",
      projectId: usedInTargetProject.id,
      title: "Target record",
      type: "Task",
    });
    const source = await workLifecycle.create(founder.id, {
      baseRevision: 0,
      clientIdempotencyKey: "used-in-source-work",
      projectId: usedInSourceProject.id,
      title: "Source record",
      type: "Task",
    });
    const relationPreview = await relations.previewCreate(founder.id, {
      kind: "Related",
      source: { recordId: source.id, recordType: "Work" },
      target: { recordId: target.id, recordType: "Work" },
    });
    await relations.create(founder.id, {
      baseRevision: relationPreview.baseRevision,
      clientIdempotencyKey: "used-in-relation",
      kind: relationPreview.kind,
      previewId: relationPreview.previewId,
      source: {
        recordId: relationPreview.source.recordId,
        recordType: relationPreview.source.recordType,
      },
      target: {
        recordId: relationPreview.target.recordId,
        recordType: relationPreview.target.recordType,
      },
    });
    await relations.createUsageLink(founder.id, {
      kind: "Live block",
      source: { recordId: target.id, recordType: "Work" },
      surface: {
        context: "used-in-e2e-source",
        recordId: source.id,
        recordType: "Work",
      },
    });
    usedInSourceProjectId = usedInSourceProject.id;
    usedInSourceWorkId = source.id;
  }

  const projectId =
    usedInTargetProject?.id ??
    captureProject?.id ??
    scopeTreeProject?.id ??
    tagsProject?.id;

  return {
    currentCookie,
    otherCookie,
    ...(projectId ? { projectId } : {}),
    ...(usedInSourceProjectId && usedInSourceWorkId
      ? { usedInSourceProjectId, usedInSourceWorkId }
      : {}),
  };
}

serve({
  hostname: "127.0.0.1",
  port: serverPort,
  async fetch(request, server) {
    const url = new URL(request.url);
    if (url.pathname === "/__e2e/setup") {
      const fixtureKey = url.searchParams.get("fixture");
      if (!(fixtureKey && E2E_FIXTURE_KEY_PATTERN.test(fixtureKey))) {
        return Response.json(
          { error: "A lowercase fixture key is required" },
          { status: 400 },
        );
      }

      const {
        currentCookie,
        otherCookie,
        projectId,
        usedInSourceProjectId,
        usedInSourceWorkId,
      } = await createE2EFixture(fixtureKey);
      return Response.json({
        cookie: currentCookie,
        otherCookie,
        ...(projectId ? { projectId } : {}),
        ...(usedInSourceProjectId && usedInSourceWorkId
          ? { usedInSourceProjectId, usedInSourceWorkId }
          : {}),
      });
    }
    return app.fetch(request, server);
  },
});
