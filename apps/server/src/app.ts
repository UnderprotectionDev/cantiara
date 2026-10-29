import type {
  AccountPreferences,
  AccountPreferencesAccess,
} from "@cantiara/api/account-preferences";
import type { AttentionSignalsAccess } from "@cantiara/api/attention-signals";
import type { PublicRoadmapReviewAccess } from "@cantiara/api/attention-signals-public-roadmap";
import type {
  BacklogAccess,
  BacklogMutationContracts,
} from "@cantiara/api/backlog";
import type { CaptureInboxAccess } from "@cantiara/api/capture-triage";
import type {
  CompletionEffectsPreferences,
  CompletionEffectsPreferencesAccess,
} from "@cantiara/api/completion-effects";
import type { ContactsAccess } from "@cantiara/api/contacts";
import {
  type AccountPreferencesCompatibilityAccess,
  CONFIRM_GITHUB_IDENTITY_HANDOFF_EXCHANGE_PATH,
} from "@cantiara/api/context";
import type {
  CustomFieldMutationContracts,
  CustomFieldsAccess,
} from "@cantiara/api/custom-fields";
import type { DailyFocusAccess } from "@cantiara/api/daily-focus";
import {
  DEFAULT_DESKTOP_API_COMPATIBILITY_WINDOW,
  DESKTOP_API_CONTRACT_HEADER,
  DESKTOP_API_UPDATE_REQUIRED_HEADER,
  type DesktopApiCompatibilityWindow,
  evaluateDesktopApiCompatibility,
} from "@cantiara/api/desktop-api-window";
import type { DocumentEvidenceAccess } from "@cantiara/api/document-evidence";
import type {
  DocumentMutationContracts,
  DocumentsAccess,
} from "@cantiara/api/documents";
import type { ExternalExecutionHandoffsAccess } from "@cantiara/api/external-handoffs";
import type { FavoritesAccess } from "@cantiara/api/favorites";
import type { FeedbackAccess } from "@cantiara/api/feedback";
import type { FileAttachmentAccess } from "@cantiara/api/file-attachments";
import {
  FILE_ATTACHMENT_UPLOAD_BODY_LIMIT,
  fileAttachmentAssetInputSchema,
} from "@cantiara/api/file-attachments";
import type { FocusPeriodAccess } from "@cantiara/api/focus-period";
import type { GitHubIntegrationAccess } from "@cantiara/api/github-integration";
import type { MoodboardSnapshotsAccess } from "@cantiara/api/moodboard-snapshot";
import type { PersonalMoodboardViewsAccess } from "@cantiara/api/moodboard-viewport";
import type {
  MoodboardMutationContracts,
  MoodboardsAccess,
} from "@cantiara/api/moodboards";
import type {
  MutationContract,
  MutationPayload,
} from "@cantiara/api/mutation-and-undo";
import type { PersonalRemindersAccess } from "@cantiara/api/personal-reminders";
import type { PlannedTestsAccess } from "@cantiara/api/planned-tests";
import type {
  PrioritizationSessionMutationContracts,
  PrioritizationSessionsAccess,
} from "@cantiara/api/prioritization-sessions";
import type {
  PriorityMetricMutationContracts,
  PriorityMetricsAccess,
} from "@cantiara/api/priority-metrics";
import type { ProductGapsAccess } from "@cantiara/api/product-gaps";
import type { ProductionIncidentsAccess } from "@cantiara/api/production-incidents";
import type { ProjectActivityAccess } from "@cantiara/api/project-activity";
import type { ProjectClosureSummaryAccess } from "@cantiara/api/project-closure-summary";
import type { ProjectGoalsAccess } from "@cantiara/api/project-goals";
import type { ProjectHistoryAccess } from "@cantiara/api/project-history";
import type { ProjectReleasePlanningAccess } from "@cantiara/api/project-release-planning";
import type {
  ProjectShellAccess,
  ProjectShellMutationContracts,
} from "@cantiara/api/project-shell";
import type { ProjectSourceRecordsAccess } from "@cantiara/api/project-source-records";
import type { ProjectUpdatesAccess } from "@cantiara/api/project-updates";
import type { ProjectWallAccess } from "@cantiara/api/project-wall";
import type { RecordActionsAccess } from "@cantiara/api/record-actions";
import type {
  RecordTableAccess,
  UniversalSearchAccess,
} from "@cantiara/api/record-discovery";
import type {
  RelationsAccess,
  UsageLinkMutationContracts,
  UsageLinksAccess,
} from "@cantiara/api/relations";
import type { ReleaseCommunicationAccess } from "@cantiara/api/release-communication";
import type { ReleaseEvidenceAccess } from "@cantiara/api/release-evidence";
import type { ResearchSessionsAccess } from "@cantiara/api/research-sessions";
import type { ReturnToWorkAccess } from "@cantiara/api/return-to-work";
import type { RoadmapHorizonAccess } from "@cantiara/api/roadmap-horizon";
import { appRouter } from "@cantiara/api/routers/index";
import type { SchemaArtifactsAccess } from "@cantiara/api/schema-artifacts";
import type { ScreensAccess } from "@cantiara/api/screens";
import type { SmartCollectionsAccess } from "@cantiara/api/smart-collections";
import type { SmartLinkPreviewAccess } from "@cantiara/api/smart-link-preview";
import type { SourceEvidenceAccess } from "@cantiara/api/source-evidence";
import type { SourceRecheckAccess } from "@cantiara/api/source-recheck";
import type { SourcesAndFreshnessAccess } from "@cantiara/api/sources-and-freshness";
import type { SpecChangeReviewAccess } from "@cantiara/api/spec-change-review";
import type { SpecChangeReviewMutationContracts } from "@cantiara/api/spec-change-review-candidates";
import { SUPPORT_REFERENCE_HEADER } from "@cantiara/api/support-reference";
import type { TagMutationContracts, TagsAccess } from "@cantiara/api/tags";
import type { TechnicalDiagramsAccess } from "@cantiara/api/technical-diagrams";
import type { TestAssessmentsAccess } from "@cantiara/api/test-assessments";
import type { TestGapsAccess } from "@cantiara/api/test-gaps";
import type { TestReportAcceptanceAccess } from "@cantiara/api/test-report";
import type { TestReviewAccess } from "@cantiara/api/test-review";
import type { UserFlowAccess } from "@cantiara/api/user-flow";
import type { ValueChainAccess } from "@cantiara/api/value-chain";
import {
  type WebCaptureAccess,
  webCapturePairingInputSchema,
  webCaptureSendInputSchema,
} from "@cantiara/api/web-capture";
import type { WikiPublishingAccess } from "@cantiara/api/wiki-publishing";
import type { WorkAutomationAccess } from "@cantiara/api/work-automation";
import type { WorkContextAccess } from "@cantiara/api/work-context";
import type { WorkDraftsAccess } from "@cantiara/api/work-drafts";
import type { WorkLifecycleAccess } from "@cantiara/api/work-lifecycle";
import type { WorkTemplatesAccess } from "@cantiara/api/work-templates";
import type { WorkspaceOverviewAccess } from "@cantiara/api/workspace-overview";
import type { Database } from "@cantiara/db";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { experimental_RethrowHandlerPlugin } from "@orpc/server/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import {
  type BetterAuthInstance,
  createAuthMiddleware,
} from "evlog/better-auth";
import { createFsDrain } from "evlog/fs";
import { type EvlogVariables, evlog } from "evlog/hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  type AccountAccessAuth,
  createContext,
  requestClientPlatform,
} from "./context";
import { isRecoverableAuthPath } from "./features/account-access/server/auth-recovery-path";
import { createCsrfProtectionMiddleware } from "./features/account-access/server/csrf-protection";
import { addFreshGitHubConsent } from "./features/account-access/server/fresh-github-consent";
import type { GitHubAvailability } from "./features/account-access/server/github-availability";
import { sanitizeGitHubCallbackResponse } from "./features/account-access/server/github-callback-response";
import {
  CONFIRM_GITHUB_IDENTITY_CALLBACK_PATH,
  CONFIRM_GITHUB_IDENTITY_START_PATH,
  type GitHubIdentityConfirmation,
} from "./features/account-access/server/github-identity-confirmation";
import {
  authorizedPrincipal,
  completeConfirmGitHubIdentity,
  exchangeConfirmGitHubIdentityHandoff,
  startConfirmGitHubIdentity,
} from "./features/account-access/server/github-identity-confirmation-http";
import type { AccountSessionAccessRuntime } from "./features/account-access/server/session-access";
import { sanitizeProductSessionResponse } from "./features/account-access/server/session-response";
import { sanitizeTauriCallbackResponse } from "./features/account-access/server/tauri-callback-response";
import type { TauriSessionAccess } from "./features/account-access/server/tauri-session";
import {
  createTauriSignInStartResponse,
  exchangeTauriCode,
} from "./features/account-access/server/tauri-sign-in-http";
import {
  webCaptureErrorResponse,
  webCaptureToken,
  webCaptureUnauthorizedResponse,
  webCaptureUnavailableResponse,
} from "./features/capture-triage/server/web-capture-http";
import {
  fileAttachmentErrorResponse,
  fileAttachmentUnauthorizedResponse,
  fileAttachmentUnavailableResponse,
  parseFileAttachmentStageForm,
} from "./features/file-attachments/server/file-attachment-http";
import type { GitHubWebhookInbox } from "./features/github-integration/server/github-webhook-inbox";
import {
  GITHUB_WEBHOOK_PATH,
  handleGitHubWebhook,
} from "./features/github-integration/server/github-webhook-route";
import { youtubePlayerRoutes } from "./features/sources-and-freshness/server/youtube-player-page";
import {
  decorateAndRecordSupportFailure,
  errorStatus,
  isClientShellPath,
  requestSupportReferenceId,
} from "./features/web-macos-client/server/support-failure-http";
import {
  createDesktopApiUpdateRequiredResponse,
  createSupportFailureResponse,
  createSupportReferenceFailure,
  recordSupportFailure,
  wrapSupportFailureResponseForRpc,
} from "./features/web-macos-client/server/support-reference";
import { noStoreHeaders } from "./no-store-headers";
export interface AppDependencies {
  accountPreferences: AccountPreferencesAccess;
  accountPreferencesCompatibility?: AccountPreferencesCompatibilityAccess;
  accountPreferencesMutationContract?: MutationContract<AccountPreferences>;
  accountSessionAccess: AccountSessionAccessRuntime;
  attentionSignals?: AttentionSignalsAccess;
  auth: AccountAccessAuth;
  backlog?: BacklogAccess;
  backlogMutationContracts?: BacklogMutationContracts;
  captureInbox?: CaptureInboxAccess;
  completionEffectsPreferences?: CompletionEffectsPreferencesAccess;
  completionEffectsPreferencesMutationContract?: MutationContract<CompletionEffectsPreferences>;
  contacts?: ContactsAccess;
  corsOrigin: string;
  customFieldMutationContracts?: CustomFieldMutationContracts;
  customFields?: CustomFieldsAccess;
  dailyFocus?: DailyFocusAccess;
  database: Database;
  desktopApiNow?: () => Date;
  desktopApiWindow?: DesktopApiCompatibilityWindow;
  desktopOrigins: readonly string[];
  documentEvidence?: DocumentEvidenceAccess;
  documentMutationContracts?: DocumentMutationContracts;
  documents?: DocumentsAccess;
  documentTransfers?: import("@cantiara/api/document-transfer").DocumentTransfersAccess;
  favorites?: FavoritesAccess;
  feedback?: FeedbackAccess;
  fileAttachments?: FileAttachmentAccess;
  focusPeriod?: FocusPeriodAccess;
  gitHubIntegration?: GitHubIntegrationAccess;
  gitHubWebhookInbox?: GitHubWebhookInbox;
  githubAvailability: Pick<
    GitHubAvailability,
    "getStatus" | "requiresFreshConsent"
  >;
  githubIdentityConfirmation?: GitHubIdentityConfirmation;
  moodboardMutationContracts?: MoodboardMutationContracts;
  moodboardPersonalViews?: PersonalMoodboardViewsAccess;
  moodboardSnapshots?: MoodboardSnapshotsAccess;
  moodboards?: MoodboardsAccess;
  mutationContract?: MutationContract<MutationPayload>;
  nodeEnv: string;
  personalReminders?: PersonalRemindersAccess;
  plannedTests?: PlannedTestsAccess;
  prioritizationSessionMutationContracts?: PrioritizationSessionMutationContracts;
  prioritizationSessions?: PrioritizationSessionsAccess;
  priorityMetricMutationContracts?: PriorityMetricMutationContracts;
  priorityMetrics?: PriorityMetricsAccess;
  productGaps?: ProductGapsAccess;
  productionIncidents?: ProductionIncidentsAccess;
  projectActivity?: ProjectActivityAccess;
  projectClosureSummary?: ProjectClosureSummaryAccess;
  projectGoals?: ProjectGoalsAccess;
  projectHistory?: ProjectHistoryAccess;
  projectReleasePlanning?: ProjectReleasePlanningAccess;
  projectShell?: ProjectShellAccess;
  projectShellMutationContracts?: ProjectShellMutationContracts;
  projectSourceRecords?: ProjectSourceRecordsAccess;
  projectUpdates?: ProjectUpdatesAccess;
  projectWall?: ProjectWallAccess;
  publicRoadmapReview?: PublicRoadmapReviewAccess;
  recordActions?: RecordActionsAccess;
  recordTable?: RecordTableAccess;
  redactSecrets: (value: unknown) => unknown;
  relations?: RelationsAccess;
  releaseCommunication?: ReleaseCommunicationAccess;
  releaseEvidence?: ReleaseEvidenceAccess;
  researchSessions?: ResearchSessionsAccess;
  returnToWork?: ReturnToWorkAccess;
  roadmapHorizon?: RoadmapHorizonAccess;
  schemaArtifacts?: SchemaArtifactsAccess;
  screens?: ScreensAccess;
  smartCollections?: SmartCollectionsAccess;
  smartLinkPreview?: SmartLinkPreviewAccess;
  sourceEvidence?: SourceEvidenceAccess;
  sourceRecheck?: SourceRecheckAccess;
  sourcesAndFreshness?: SourcesAndFreshnessAccess;
  specChangeReview?: SpecChangeReviewAccess;
  specChangeReviewMutationContracts?: SpecChangeReviewMutationContracts;
  tagMutationContracts?: TagMutationContracts;
  tags?: TagsAccess;
  tauriSessionAccess?: TauriSessionAccess;
  technicalDiagrams?: TechnicalDiagramsAccess;
  testAssessments?: TestAssessmentsAccess;
  testGaps?: TestGapsAccess;
  testReports?: TestReportAcceptanceAccess;
  testReview?: TestReviewAccess;
  trustedProxyIps: readonly string[];
  universalSearch?: UniversalSearchAccess;
  usageLinkMutationContracts?: UsageLinkMutationContracts;
  usageLinks?: UsageLinksAccess;
  userFlow?: UserFlowAccess;
  valueChain?: ValueChainAccess;
  webCapture?: WebCaptureAccess;
  wikiPublishing?: WikiPublishingAccess;
  workAutomation?: WorkAutomationAccess;
  workContext?: WorkContextAccess;
  workDrafts?: WorkDraftsAccess;
  workHandoffs?: ExternalExecutionHandoffsAccess;
  workLifecycle?: WorkLifecycleAccess;
  workspaceOverview?: WorkspaceOverviewAccess;
  workTemplates?: WorkTemplatesAccess;
}

function isWebCaptureExtensionOrigin(origin: string) {
  return (
    origin.startsWith("chrome-extension://") ||
    origin.startsWith("moz-extension://")
  );
}

function resolveCorsOrigin(origin: string, allowedOrigins: readonly string[]) {
  if (isWebCaptureExtensionOrigin(origin)) {
    return origin;
  }
  if (allowedOrigins.includes(origin)) {
    return origin;
  }
}

export function createApp(dependencies: AppDependencies) {
  const identifyUser = createAuthMiddleware(
    dependencies.auth as unknown as BetterAuthInstance,
    {
      exclude: ["/api/auth/**"],
      maskEmail: true,
    },
  );
  const allowedOrigins = [
    dependencies.corsOrigin,
    ...dependencies.desktopOrigins,
  ];
  const app = new Hono<EvlogVariables>();
  app.route("/smart-link/youtube", youtubePlayerRoutes);

  app.use("*", async (c, next) => {
    c.req.raw.headers.delete("x-request-id");
    await next();
  });
  app.use(
    evlog({
      drain:
        dependencies.nodeEnv === "production" ? undefined : createFsDrain(),
    }),
  );
  app.use("*", async (c, next) => {
    await identifyUser(c.get("log"), c.req.raw.headers, c.req.path);
    await next();
  });
  app.use(
    "/*",
    cors({
      origin: (origin) => resolveCorsOrigin(origin, allowedOrigins),
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "Authorization",
        DESKTOP_API_CONTRACT_HEADER,
        ...(dependencies.nodeEnv === "test" ? ["X-Forwarded-For"] : []),
      ],
      credentials: true,
      exposeHeaders: [
        DESKTOP_API_UPDATE_REQUIRED_HEADER,
        SUPPORT_REFERENCE_HEADER,
      ],
    }),
  );
  app.use("*", createCsrfProtectionMiddleware(allowedOrigins));

  app.post(GITHUB_WEBHOOK_PATH, (c) =>
    handleGitHubWebhook(c.req.raw, dependencies.gitHubWebhookInbox),
  );

  app.get("/api/auth/tauri/start", (c) =>
    createTauriSignInStartResponse(c.req.raw, {
      auth: dependencies.auth,
      tauriSessionAccess: dependencies.tauriSessionAccess,
    }),
  );
  app.post("/api/auth/tauri/exchange", (c) =>
    exchangeTauriCode(c.req.raw, dependencies.tauriSessionAccess),
  );
  app.post(CONFIRM_GITHUB_IDENTITY_START_PATH, (c) =>
    startConfirmGitHubIdentity(c.req.raw, c, dependencies),
  );
  app.post(CONFIRM_GITHUB_IDENTITY_HANDOFF_EXCHANGE_PATH, (c) =>
    exchangeConfirmGitHubIdentityHandoff(c.req.raw, c, dependencies),
  );
  app.get(CONFIRM_GITHUB_IDENTITY_CALLBACK_PATH, (c) =>
    completeConfirmGitHubIdentity(c.req.raw, c, dependencies),
  );

  app.post("/api/web-capture/pair", async (c) => {
    if (!dependencies.webCapture) {
      return webCaptureUnavailableResponse();
    }
    try {
      const input = webCapturePairingInputSchema.parse(await c.req.json());
      return Response.json(await dependencies.webCapture.pair(input), {
        headers: noStoreHeaders(),
      });
    } catch (error) {
      return webCaptureErrorResponse(error);
    }
  });

  app.post("/api/file-attachments/stage", async (c) => {
    if (!dependencies.fileAttachments) {
      return fileAttachmentUnavailableResponse();
    }
    let principal: Awaited<ReturnType<typeof authorizedPrincipal>>;
    try {
      principal = await authorizedPrincipal(c.req.raw, dependencies);
    } catch {
      return webCaptureUnauthorizedResponse();
    }
    if (!principal) {
      return webCaptureUnauthorizedResponse();
    }
    // Reject bodies that cannot pass validation before buffering them.
    const contentLength = Number(c.req.raw.headers.get("content-length"));
    if (
      Number.isFinite(contentLength) &&
      contentLength > FILE_ATTACHMENT_UPLOAD_BODY_LIMIT
    ) {
      return Response.json(
        { code: "FILE_ATTACHMENT_FILE_TOO_LARGE" },
        { headers: noStoreHeaders(), status: 413 },
      );
    }
    try {
      const { bytes, input } = await parseFileAttachmentStageForm(c.req.raw);
      return Response.json(
        await dependencies.fileAttachments.stage(
          principal.accountId,
          input,
          bytes,
        ),
        { headers: noStoreHeaders() },
      );
    } catch (error) {
      return fileAttachmentErrorResponse(error);
    }
  });

  app.get(
    "/api/file-attachments/:attachmentId/versions/:versionId/asset",
    async (c) => {
      if (!dependencies.fileAttachments) {
        return fileAttachmentUnavailableResponse();
      }
      let principal: Awaited<ReturnType<typeof authorizedPrincipal>>;
      try {
        principal = await authorizedPrincipal(c.req.raw, dependencies);
      } catch {
        return fileAttachmentUnauthorizedResponse();
      }
      if (!principal) {
        return fileAttachmentUnauthorizedResponse();
      }
      try {
        const input = fileAttachmentAssetInputSchema.parse({
          attachmentId: c.req.param("attachmentId"),
          variant: c.req.query("variant") ?? "original",
          versionId: c.req.param("versionId"),
        });
        const asset = await dependencies.fileAttachments.readAsset(
          principal.accountId,
          input,
        );
        const safeFileName = asset.fileName.replace(/["\\\r\n]/gu, "_");
        return new Response(asset.bytes, {
          headers: {
            ...noStoreHeaders(),
            "content-disposition": `${asset.disposition}; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(asset.fileName)}`,
            "content-security-policy": "default-src 'none'",
            "content-type": asset.contentType,
            "cross-origin-resource-policy": "same-origin",
          },
        });
      } catch (error) {
        return fileAttachmentErrorResponse(error);
      }
    },
  );

  app.get("/api/web-capture/inboxes", async (c) => {
    if (!dependencies.webCapture) {
      return webCaptureUnavailableResponse();
    }
    const token = webCaptureToken(c.req.raw);
    if (!token) {
      return webCaptureUnauthorizedResponse();
    }
    try {
      const targets = await dependencies.webCapture.listTargets(
        token,
        c.req.query("search") ?? "",
      );
      return Response.json({ targets }, { headers: noStoreHeaders() });
    } catch (error) {
      return webCaptureErrorResponse(error);
    }
  });

  app.post("/api/web-capture/send", async (c) => {
    if (!dependencies.webCapture) {
      return webCaptureUnavailableResponse();
    }
    const token = webCaptureToken(c.req.raw);
    if (!token) {
      return webCaptureUnauthorizedResponse();
    }
    try {
      const input = webCaptureSendInputSchema.parse(await c.req.json());
      return Response.json(await dependencies.webCapture.send(token, input), {
        headers: noStoreHeaders(),
      });
    } catch (error) {
      return webCaptureErrorResponse(error);
    }
  });

  app.on(["POST", "GET"], "/api/auth/*", async (c) => {
    const candidateSession = await dependencies.auth.api.getSession({
      headers: c.req.raw.headers,
      query: { disableRefresh: true },
    });
    if (
      candidateSession &&
      !isRecoverableAuthPath(c.req.path) &&
      !(await dependencies.accountSessionAccess.authorizeWrite({
        accountId: candidateSession.user.id,
        sessionId: candidateSession.session.id,
      }))
    ) {
      if (c.req.path.endsWith("/get-session")) {
        return c.json(null);
      }
      return c.json({ code: "UNAUTHORIZED" }, 401);
    }
    const authRequest = await addFreshGitHubConsent(
      c.req.raw,
      dependencies.githubAvailability,
    );
    const response = await dependencies.auth.handler(authRequest);
    const tauriResponse = dependencies.tauriSessionAccess
      ? await sanitizeTauriCallbackResponse(c.req.raw, response, {
          auth: dependencies.auth,
          tauriSessionAccess: dependencies.tauriSessionAccess,
        })
      : response;
    const sessionResponse = await sanitizeProductSessionResponse(
      c.req.raw,
      tauriResponse,
    );
    const sanitizedResponse =
      tauriResponse === response
        ? sanitizeGitHubCallbackResponse(
            c.req.raw,
            sessionResponse,
            dependencies.corsOrigin,
          )
        : sessionResponse;
    if (c.req.path === "/api/auth/get-session") {
      const supportedResponse = await decorateAndRecordSupportFailure(
        c,
        sanitizedResponse,
        { retryPolicy: "once", writeOutcome: "not-written" },
      );
      return c.newResponse(supportedResponse.body, supportedResponse);
    }
    return sanitizedResponse;
  });

  const apiHandler = new OpenAPIHandler(appRouter, {
    plugins: [
      new OpenAPIReferencePlugin({
        schemaConverters: [new ZodToJsonSchemaConverter()],
      }),
      new experimental_RethrowHandlerPlugin({ filter: () => true }),
    ],
    interceptors: [onError(() => undefined)],
  });
  const rpcHandler = new RPCHandler(appRouter, {
    plugins: [new experimental_RethrowHandlerPlugin({ filter: () => true })],
    interceptors: [onError(() => undefined)],
  });
  const desktopApiWindow =
    dependencies.desktopApiWindow ?? DEFAULT_DESKTOP_API_COMPATIBILITY_WINDOW;
  const desktopApiNow = dependencies.desktopApiNow ?? (() => new Date());

  app.use("/*", async (c, next) => {
    if (
      isClientShellPath(c.req.path) &&
      c.req.method === "POST" &&
      requestClientPlatform(c.req.raw) === "tauri"
    ) {
      const compatibility = evaluateDesktopApiCompatibility(
        c.req.raw.headers.get(DESKTOP_API_CONTRACT_HEADER),
        desktopApiWindow,
        desktopApiNow(),
      );
      if (!compatibility.accepted) {
        const requestId = requestSupportReferenceId(c);
        const response = createDesktopApiUpdateRequiredResponse(requestId);
        const failure = createSupportReferenceFailure({
          error: { data: { reasonCode: "update-required" } },
          reasonCode: "update-required",
          requestId,
          supportReference:
            response.headers.get(SUPPORT_REFERENCE_HEADER) ?? undefined,
          writeOutcome: "not-written",
        });
        recordSupportFailure(c.get("log"), failure);
        const rpcResponse = await wrapSupportFailureResponseForRpc(response);
        return c.newResponse(rpcResponse.body, rpcResponse);
      }
    }

    const context = await createContext({
      accountSessionAccess: dependencies.accountSessionAccess,
      accountPreferences: dependencies.accountPreferences,
      accountPreferencesCompatibility:
        dependencies.accountPreferencesCompatibility,
      accountPreferencesMutationContract:
        dependencies.accountPreferencesMutationContract,
      auth: dependencies.auth,
      backlog: dependencies.backlog,
      backlogMutationContracts: dependencies.backlogMutationContracts,
      dailyFocus: dependencies.dailyFocus,
      favorites: dependencies.favorites,
      returnToWork: dependencies.returnToWork,
      documentMutationContracts: dependencies.documentMutationContracts,
      documents: dependencies.documents,
      documentTransfers: dependencies.documentTransfers,
      smartCollections: dependencies.smartCollections,
      moodboardMutationContracts: dependencies.moodboardMutationContracts,
      moodboardPersonalViews: dependencies.moodboardPersonalViews,
      moodboardSnapshots: dependencies.moodboardSnapshots,
      moodboards: dependencies.moodboards,
      schemaArtifacts: dependencies.schemaArtifacts,
      technicalDiagrams: dependencies.technicalDiagrams,
      projectWall: dependencies.projectWall,
      userFlow: dependencies.userFlow,
      universalSearch: dependencies.universalSearch,
      focusPeriod: dependencies.focusPeriod,
      roadmapHorizon: dependencies.roadmapHorizon,
      captureInbox: dependencies.captureInbox,
      completionEffectsPreferences: dependencies.completionEffectsPreferences,
      completionEffectsPreferencesMutationContract:
        dependencies.completionEffectsPreferencesMutationContract,
      customFields: dependencies.customFields,
      customFieldMutationContracts: dependencies.customFieldMutationContracts,
      context: c,
      database: dependencies.database,
      fileAttachments: dependencies.fileAttachments,
      workHandoffs: dependencies.workHandoffs,
      githubAvailability: dependencies.githubAvailability,
      githubIdentityConfirmation: dependencies.githubIdentityConfirmation,
      mutationContract: dependencies.mutationContract,
      projectShell: dependencies.projectShell,
      projectShellMutationContracts: dependencies.projectShellMutationContracts,
      projectGoals: dependencies.projectGoals,
      projectReleasePlanning: dependencies.projectReleasePlanning,
      productionIncidents: dependencies.productionIncidents,
      projectSourceRecords: dependencies.projectSourceRecords,
      documentEvidence: dependencies.documentEvidence,
      sourceEvidence: dependencies.sourceEvidence,
      sourceRecheck: dependencies.sourceRecheck,
      sourcesAndFreshness: dependencies.sourcesAndFreshness,
      smartLinkPreview: dependencies.smartLinkPreview,
      researchSessions: dependencies.researchSessions,
      recordTable: dependencies.recordTable,
      priorityMetricMutationContracts:
        dependencies.priorityMetricMutationContracts,
      priorityMetrics: dependencies.priorityMetrics,
      prioritizationSessionMutationContracts:
        dependencies.prioritizationSessionMutationContracts,
      prioritizationSessions: dependencies.prioritizationSessions,
      personalReminders: dependencies.personalReminders,
      recordActions: dependencies.recordActions,
      releaseCommunication: dependencies.releaseCommunication,
      workAutomation: dependencies.workAutomation,
      tagMutationContracts: dependencies.tagMutationContracts,
      tags: dependencies.tags,
      contacts: dependencies.contacts,
      feedback: dependencies.feedback,
      screens: dependencies.screens,
      plannedTests: dependencies.plannedTests,
      testGaps: dependencies.testGaps,
      testReview: dependencies.testReview,
      productGaps: dependencies.productGaps,
      testReports: dependencies.testReports,
      testAssessments: dependencies.testAssessments,
      gitHubIntegration: dependencies.gitHubIntegration,
      specChangeReview: dependencies.specChangeReview,
      specChangeReviewMutationContracts:
        dependencies.specChangeReviewMutationContracts,
      relations: dependencies.relations,
      projectActivity: dependencies.projectActivity,
      attentionSignals: dependencies.attentionSignals,
      publicRoadmapReview: dependencies.publicRoadmapReview,
      releaseEvidence: dependencies.releaseEvidence,
      projectHistory: dependencies.projectHistory,
      projectUpdates: dependencies.projectUpdates,
      projectClosureSummary: dependencies.projectClosureSummary,
      valueChain: dependencies.valueChain,
      trustedProxyIps: dependencies.trustedProxyIps,
      usageLinkMutationContracts: dependencies.usageLinkMutationContracts,
      usageLinks: dependencies.usageLinks,
      webCapture: dependencies.webCapture,
      workContext: dependencies.workContext,
      workDrafts: dependencies.workDrafts,
      workTemplates: dependencies.workTemplates,
      workLifecycle: dependencies.workLifecycle,
      wikiPublishing: dependencies.wikiPublishing,
      workspaceOverview: dependencies.workspaceOverview,
    });
    const rpcResult = await rpcHandler.handle(c.req.raw, {
      prefix: "/rpc",
      context,
    });
    if (rpcResult.matched) {
      const response = await decorateAndRecordSupportFailure(
        c,
        rpcResult.response,
      );
      return c.newResponse(response.body, response);
    }
    const apiResult = await apiHandler.handle(c.req.raw, {
      prefix: "/api-reference",
      context,
    });
    if (apiResult.matched) {
      return c.newResponse(apiResult.response.body, apiResult.response);
    }
    await next();
  });

  app.get("/", (c) => c.text("OK"));
  app.notFound(async (c) => {
    if (c.req.path !== "/rpc" && !c.req.path.startsWith("/rpc/")) {
      return c.text("404 Not Found", 404);
    }

    const requestId = requestSupportReferenceId(c);
    const failure = createSupportReferenceFailure({
      error: { code: "NOT_FOUND", message: "Not Found", status: 404 },
      requestId,
      writeOutcome: "not-written",
    });
    recordSupportFailure(c.get("log"), failure);
    const response = createSupportFailureResponse({
      error: failure,
      reasonCode: failure.reasonCode,
      requestId,
      retryPolicy: failure.retryPolicy,
      supportReference: failure.supportReference,
      status: 404,
      writeOutcome: failure.writeOutcome,
    });
    const rpcResponse = await wrapSupportFailureResponseForRpc(response);
    return c.newResponse(rpcResponse.body, rpcResponse);
  });
  app.onError(async (error, c) => {
    const isSessionCheck = c.req.path === "/api/auth/get-session";
    if (!(isClientShellPath(c.req.path) || isSessionCheck)) {
      c.error = undefined;
      return new Response("Internal Server Error", {
        status: errorStatus(error),
      });
    }

    const requestId = requestSupportReferenceId(c);
    const failure = createSupportReferenceFailure({
      error,
      requestId,
      ...(isSessionCheck
        ? { retryPolicy: "once" as const, writeOutcome: "not-written" as const }
        : {}),
    });
    recordSupportFailure(c.get("log"), failure);
    c.error = undefined;
    const response = createSupportFailureResponse({
      error,
      reasonCode: failure.reasonCode,
      requestId,
      retryPolicy: failure.retryPolicy,
      supportReference: failure.supportReference,
      writeOutcome: failure.writeOutcome,
      status: errorStatus(error),
    });
    if (isSessionCheck) {
      return c.newResponse(response.body, response);
    }
    const rpcResponse = await wrapSupportFailureResponseForRpc(response);
    return c.newResponse(rpcResponse.body, rpcResponse);
  });
  return app;
}
