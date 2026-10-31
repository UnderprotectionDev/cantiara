import { ORPCError, type RouterClient } from "@orpc/server";
import { z } from "zod";
import {
  type AccountPreferences,
  type AccountPreferencesSnapshot,
  accountPreferencesSchema,
  appearanceSchema,
} from "../account-preferences";
import {
  attentionFollowUpPreviewSchema,
  attentionFollowUpResultSchema,
  attentionSignalSchema,
  attentionSignalTargetSchema,
  createAttentionFollowUpInputSchema,
  markAttentionSignalInputSchema,
  notificationCenterSchema,
  openAttentionSignalOutputSchema,
  previewAttentionFollowUpInputSchema,
} from "../attention-signals";
import {
  publicRoadmapReviewIntervalSchema,
  publicRoadmapReviewTargetSchema,
  refreshPublicRoadmapReviewOutputSchema,
  setPublicRoadmapReviewIntervalInputSchema,
} from "../attention-signals-public-roadmap";
import {
  projectBacklogInputSchema,
  saveBacklogPresentationInputSchema,
  saveBacklogPresentationMutationInputSchema,
  updateBacklogOrderInputSchema,
  updateBacklogOrderMutationInputSchema,
} from "../backlog";
import {
  approveBuildInPublicInputSchema,
  type BuildInPublicAccess,
  buildInPublicPreviewInputSchema,
  buildInPublicProjectInputSchema,
  setBuildInPublicEnabledInputSchema,
  setBuildInPublicStatusMapInputSchema,
  setBuildInPublicWorkCopyInputSchema,
} from "../build-in-public";
import {
  buildInPublicSlugPreviewInputSchema,
  setBuildInPublicIndexingInputSchema,
  setBuildInPublicSlugInputSchema,
  unpublishBuildInPublicInputSchema,
} from "../build-in-public-publication";
import {
  type CaptureInboxAccess,
  type CaptureInboxTriageAccess,
  captureAttachInputSchema,
  captureAttachPreviewInputSchema,
  captureBulkSenseMakingInputSchema,
  captureConvertInputSchema,
  captureConvertPreviewInputSchema,
  captureDeleteInputSchema,
  captureInputSchema,
  captureSuggestionsInputSchema,
  captureUndoMergeInputSchema,
  captureUndoMergePreviewInputSchema,
} from "../capture-triage";
import {
  type CompletionEffectsPreferences,
  type CompletionEffectsPreferencesSnapshot,
  completionEffectsPreferencesSchema,
} from "../completion-effects";
import {
  contactIdentityInputSchema,
  contactPersonaInputSchema,
  createCompanyInputSchema,
  createContactInputSchema,
  mergeContactsInputSchema,
  mergePreviewInputSchema,
  mergeUndoPreviewInputSchema,
  setContactCompanyInputSchema,
  undoMergeInputSchema,
  updateContactInputSchema,
} from "../contacts";
import {
  CONFIRM_GITHUB_IDENTITY_OPERATION_IDS,
  type Context,
} from "../context";
import {
  type CustomFieldMutationValue,
  type CustomFieldValueMutationValue,
  clearCustomFieldValueInputSchema,
  clearCustomFieldValueMutationInputSchema,
  copyCustomFieldDefinitionsInputSchema,
  createCustomFieldInputSchema,
  createCustomFieldMutationInputSchema,
  customFieldProjectValuesInputSchema,
  customFieldSearchFieldsInputSchema,
  customFieldValuesInputSchema,
  deleteCustomFieldMutationInputSchema,
  previewCustomFieldOptionDeletionInputSchema,
  restoreCustomFieldMutationInputSchema,
  setCustomFieldValueInputSchema,
  setCustomFieldValueMutationInputSchema,
  trashCustomFieldMutationInputSchema,
  updateCustomFieldInputSchema,
  updateCustomFieldMutationInputSchema,
} from "../custom-fields";
import {
  DailyFocusWorkUnavailableError,
  dailyFocusDayInputSchema,
  dailyFocusMembershipInputSchema,
} from "../daily-focus";
import {
  exportCatalogInputSchema,
  exportProduceInputSchema,
  exportRequestSchema,
} from "../data-export";
import {
  exportCatalogHandler,
  exportPreviewHandler,
  exportProduceHandler,
} from "../data-export-handlers";
import {
  applyImportInputSchema,
  cancelImportInputSchema,
  ImportConflictError,
  ImportReceiptNotFoundError,
  ImportRefusedError,
  ImportScopeNotFoundError,
  ImportStagingExpiredError,
  previewImportInputSchema,
  reopenImportPreviewInputSchema,
  reopenImportReceiptInputSchema,
} from "../data-import";
import {
  decisionSupersessionCommandSchema,
  decisionSupersessionSelectionSchema,
} from "../decision-supersession";
import {
  confirmDocumentEvidenceInputSchema,
  documentEvidenceHistoryInputSchema,
  documentEvidenceTargetSchema,
  documentSelectionSchema,
  evidenceFlowInputSchema,
  previewDocumentEvidenceInputSchema,
  setDocumentEvidenceRoleInputSchema,
} from "../document-evidence";
import {
  createDocumentFromTemplateInputSchema,
  createDocumentTemplateInputSchema,
  documentTemplateDefinitionSchema,
  documentTemplateSchema,
  documentTemplateScopeSchema,
  documentTemplateSkeleton,
  personalReviewTemplate,
  renderDocumentTemplate,
  updateDocumentTemplateInputSchema,
} from "../document-templates";
import {
  DocumentTransferError,
  documentTransferInputSchema,
  documentTransferMutationInputSchema,
} from "../document-transfer";
import {
  transferDocumentMutationInputSchema,
  type DocumentTransferInput as WikiDocumentTransferInput,
  documentTransferInputSchema as wikiDocumentTransferInputSchema,
} from "../document-transfers";
import {
  createDocumentInputSchema,
  createDocumentMutationInputSchema,
  DocumentConflictDraftError,
  DocumentHierarchyError,
  type DocumentMutationValue,
  DocumentSectionCycleError,
  DocumentUnavailableError,
  discardDocumentConflictDraftInputSchema,
  documentBodySchema,
  documentCreationFields,
  documentCreationInputSchema,
  documentIdSchema,
  documentLiveDirectives,
  documentLiveWorkIds,
  documentOrganizationInputSchema,
  documentSchema,
  documentVersionInputSchema,
  organizeDocumentMutationInputSchema,
  documentRecordReferences as parseDocumentRecordReferences,
  pinDocumentEvidenceInputSchema,
  projectIdSchema,
  restoreDocumentVersionInputSchema,
  updateDocumentInputSchema,
  updateDocumentMutationInputSchema,
} from "../documents";
import {
  cancelExternalExecutionHandoffInputSchema,
  confirmExternalExecutionHandoffReconcileInputSchema,
  listExternalExecutionHandoffHistoryInputSchema,
  listExternalExecutionHandoffRelatedWorksInputSchema,
  listExternalExecutionHandoffsInputSchema,
  previewExternalExecutionHandoffReconcileInputSchema,
  recordExternalExecutionHandoffPackageExportInputSchema,
  recordExternalExecutionHandoffReturnInputSchema,
  startExternalExecutionHandoffMutationInputSchema,
} from "../external-handoffs";
import {
  ExternalSurfaceManagementStateError,
  externalSurfaceManagementUnavailable,
  listExternalSurfacesInputSchema,
  removeExternalSurfaceInputSchema,
} from "../external-surface-management";
import {
  FavoriteSourceUnavailableError,
  favoriteSourceSchema,
} from "../favorites";
import {
  convertFeedbackToWorkInputSchema,
  createFeedbackInputSchema,
  feedbackProjectInputSchema,
  previewFeedbackWorkInputSchema,
  setFeedbackEvidenceInputSchema,
  setFeedbackIdentityInputSchema,
  setFeedbackStatusInputSchema,
} from "../feedback";
import { feedInputSchema } from "../feedback-feed";
import {
  fileAttachmentFinalizeInputSchema,
  fileAttachmentListInputSchema,
  fileAttachmentLocationBindInputSchema,
  fileAttachmentLocationBindPreviewInputSchema,
  fileAttachmentMarkingInputSchema,
  fileAttachmentMarkingsInputSchema,
  fileAttachmentPreviewInputSchema,
  fileAttachmentUndoMarkingInputSchema,
} from "../file-attachments";
import {
  createFocusPeriodInputSchema,
  FOCUS_PERIOD_ACTIVE_MEMBERSHIP_CONFLICT_MESSAGE,
  FOCUS_PERIOD_OVERLAPPING_MEMBERSHIP_CONFLICT_MESSAGE,
  FocusPeriodConflictError,
  FocusPeriodUnavailableError,
  focusPeriodDecisionInputSchema,
  focusPeriodEvaluationInputSchema,
  focusPeriodFollowUpWorkInputSchema,
  focusPeriodIdInputSchema,
  focusPeriodMembershipInputSchema,
} from "../focus-period";
import {
  gitHubChecksInputSchema,
  gitHubChecksOutputSchema,
} from "../github-checks";
import {
  gitHubAvailableRepositoriesInputSchema,
  gitHubAvailableRepositoriesOutputSchema,
  gitHubDisconnectOutputSchema,
  gitHubInstallCompleteInputSchema,
  gitHubInstallCompleteOutputSchema,
  gitHubInstallStartInputSchema,
  gitHubInstallStartOutputSchema,
  gitHubLinkInputSchema,
  gitHubLinkPreviewSchema,
  gitHubLinkRepositoryInputSchema,
  gitHubOverviewSchema,
  gitHubProjectInputSchema,
  gitHubRepositoryLinkSchema,
  gitHubSearchRecordsInputSchema,
  gitHubSearchRecordsOutputSchema,
  gitHubSyncNowOutputSchema,
  gitHubTriagePreviewSchema,
} from "../github-integration";
import {
  gitHubPrContextInputSchema,
  gitHubPrContextOutputSchema,
} from "../github-pr-context";
import {
  gitHubAttentionSignalSchema,
  gitHubCreateWorkInputSchema,
  gitHubCreateWorkOutputSchema,
  gitHubCreateWorkPreviewInputSchema,
  gitHubCreateWorkPreviewSchema,
  gitHubDismissSignalInputSchema,
  gitHubLinkWorkInputSchema,
  gitHubUnlinkWorkInputSchema,
  gitHubWorkLinkSchema,
  gitHubWorkLinksInputSchema,
  gitHubWorkLinksOutputSchema,
} from "../github-work-links";
import { protectedProcedure, publicProcedure } from "../index";
import {
  approveShareScopeInputSchema,
  linkSharingWrite,
  previewShareScopeInputSchema,
  reopenExpiredLinkInputSchema,
  reshareExpiredLinkInputSchema,
  revokeShareInputSchema,
  rotateShareTokenInputSchema,
  setLinkPasswordInputSchema,
  setShareExpiryInputSchema,
  shareRootsInputSchema,
} from "../link-sharing";
import {
  MoodboardSnapshotError,
  moodboardSnapshotExportInputSchema,
  moodboardSnapshotPreviewInputSchema,
} from "../moodboard-snapshot";
import {
  personalMoodboardViewInputSchema,
  savePersonalMoodboardViewInputSchema,
} from "../moodboard-viewport";
import {
  addColorSwatchInputSchema,
  addColorSwatchMutationInputSchema,
  addMoodboardVisualInputSchema,
  addMoodboardVisualMutationInputSchema,
  addPaletteGroupInputSchema,
  addPaletteGroupMutationInputSchema,
  assignColorSwatchPaletteGroupInputSchema,
  assignColorSwatchPaletteGroupMutationInputSchema,
  createMoodboardInputSchema,
  createMoodboardMutationInputSchema,
  moodboardsProjectInputSchema,
  newMoodboard,
  reorderMoodboardItemsInputSchema,
  reorderMoodboardItemsMutationInputSchema,
  setMoodboardFocusOrderInputSchema,
  setMoodboardFocusOrderMutationInputSchema,
  setMoodboardVisualViewInputSchema,
  setMoodboardVisualViewMutationInputSchema,
  updateMoodboardVisualCaptionInputSchema,
  updateMoodboardVisualCaptionMutationInputSchema,
  withAddedColorSwatch,
  withAddedPaletteGroup,
  withAddedVisual,
  withColorSwatchPaletteGroup,
  withFocusOrder,
  withReorderedItems,
  withVisualCaption,
  withVisualView,
} from "../moodboards";
import {
  humanMutationEnvelopeSchema,
  MUTATION_UI_LABELS,
  type MutationApply,
  type MutationCommand,
  type MutationPayload,
  type MutationReceipt,
} from "../mutation-and-undo";
import {
  erasePersonalDataInputSchema,
  personalDataErasePreviewInputSchema,
  personalDataPreviewInputSchema,
  personalDataProduceInputSchema,
} from "../personal-data-rights";
import {
  personalDataEraseHandler,
  personalDataErasePreviewHandler,
  personalDataPreviewHandler,
  personalDataProduceHandler,
} from "../personal-data-rights-handlers";
import {
  cancelPersonalReminderInputSchema,
  cancelWorkReviewLaterInputSchema,
  createPersonalReminderInputSchema,
  createWorkReviewLaterInputSchema,
  personalReminderSignalInputSchema,
  personalRemindersInputSchema,
  reschedulePersonalReminderSignalInputSchema,
  workReviewLaterInputSchema,
} from "../personal-reminders";
import {
  createPlannedTestCaseInputSchema,
  createPlannedTestCaseVersionInputSchema,
  createTestHandoffInputSchema,
  linkSessionTestInputSchema,
  linkTestHandoffSessionTestInputSchema,
  plannedTestCaseProjectInputSchema,
  plannedTestCaseVersionInputSchema,
  plannedTestRelationTargetsInputSchema,
  produceTestHandoffPackageInputSchema,
  recordSessionTestInputSchema,
  sessionTestProjectInputSchema,
  testHandoffContextTargetsInputSchema,
  testHandoffPackageInputSchema,
  testHandoffProjectInputSchema,
  transitionTestHandoffInputSchema,
  updateTestHandoffInputSchema,
} from "../planned-tests";
import {
  closePrioritizationSessionInputSchema,
  closePrioritizationSessionMutationInputSchema,
  createPrioritizationSessionInputSchema,
  createPrioritizationSessionMutationInputSchema,
  type PrioritizationSessionMutationValue,
  prioritizationSessionsProjectInputSchema,
  restorePrioritizationSessionInputSchema,
  restorePrioritizationSessionMutationInputSchema,
  trashPrioritizationSessionInputSchema,
  trashPrioritizationSessionMutationInputSchema,
  updatePrioritizationSessionOrderInputSchema,
  updatePrioritizationSessionOrderMutationInputSchema,
} from "../prioritization-sessions";
import {
  clearPriorityMetricValueInputSchema,
  clearPriorityMetricValueMutationInputSchema,
  copyPriorityMetricDefinitionsInputSchema,
  createPriorityMetricInputSchema,
  createPriorityMetricMutationInputSchema,
  deletePriorityMetricMutationInputSchema,
  type PriorityMetricDefinitionsCopyMutationValue,
  type PriorityMetricMutationContracts,
  type PriorityMetricMutationValue,
  type PriorityMetricsAccess,
  type PriorityMetricValueMutationValue,
  priorityMetricProjectValuesInputSchema,
  priorityMetricTrashImpactPreviewInputSchema,
  priorityMetricValuesInputSchema,
  restorePriorityMetricMutationInputSchema,
  setPriorityMetricValueInputSchema,
  setPriorityMetricValueMutationInputSchema,
  trashPriorityMetricMutationInputSchema,
  updatePriorityMetricInputSchema,
  updatePriorityMetricMutationInputSchema,
} from "../priority-metrics";
import {
  closeToolEscapeInputSchema,
  confirmProductGapFollowUpInputSchema,
  listToolEscapesInputSchema,
  previewProductGapFollowUpInputSchema,
  productGapFollowUpPlanSchema,
  productGapFollowUpResultSchema,
  productGapLinkTargetSchema,
  productGapLinkTargetsInputSchema,
  productGapListInputSchema,
  productGapListSchema,
  productGapRecordSchema,
  recordProductGapInputSchema,
  recordToolEscapeInputSchema,
  recordToolEscapeResultSchema,
  setProductGapStatusInputSchema,
  toolEscapeListSchema,
  toolEscapeRecordSchema,
} from "../product-gaps";
import {
  createProductionIncidentFollowUpInputSchema,
  ProductionIncidentConflictError,
  ProductionIncidentFollowUpStaleError,
  previewProductionIncidentFollowUpInputSchema,
  productionIncidentInputSchema,
  productionIncidentsInputSchema,
  setProductionIncidentLinkInputSchema,
} from "../production-incidents";
import {
  projectActivityInputSchema,
  projectActivitySchema,
} from "../project-activity";
import {
  CLOSURE_SUMMARY_DOCUMENT_TYPE,
  closureSummaryDateComparisonInputSchema,
  closureSummaryDateComparisonSchema,
  closureSummaryDraftInputSchema,
  closureSummaryDraftSchema,
  closureSummarySourcesInputSchema,
  closureSummarySourcesSchema,
  saveClosureSummaryInputSchema,
  saveClosureSummaryResultSchema,
} from "../project-closure-summary";
import {
  createProjectGoalInputSchema,
  ProjectGoalConflictError,
  projectGoalInputSchema,
  projectGoalRelationInputSchema,
  projectGoalsProjectInputSchema,
  updateProjectGoalInputSchema,
} from "../project-goals";
import {
  storyTimelineInputSchema,
  storyTimelineSchema,
} from "../project-history";
import {
  ProjectReleasePlanningConflictError,
  projectReleasePlanningInputSchema,
  projectReleasePlanningProjectInputSchema,
  setProjectReleaseAudienceInputSchema,
  setProjectReleaseLinkInputSchema,
  setProjectReleaseScopeInputSchema,
} from "../project-release-planning";
import {
  applyProjectShellConfigurationChange,
  createProjectInputSchema,
  createProjectMutationInputSchema,
  enableProjectArea,
  enableProjectAreaInputSchema,
  getProjectShellConfiguration,
  type ProjectShellMutationValue,
  previewWorkContextLayoutInputSchema,
  shortCodeSchema,
  suggestProjectShortCode,
  undoWorkContextLayoutInputSchema,
  updateProjectConfigurationInputSchema,
  updateProjectShortCodeInputSchema,
  type WorkContextLayoutMutationResult,
} from "../project-shell";
import {
  createProjectSourceRecordInputSchema,
  ProjectSourceRecordConflictError,
  type ProjectSourceType,
  projectSourceRecordInputSchema,
  projectSourceRecordsProjectInputSchema,
  transitionProjectSourceRecordInputSchema,
  updateProjectSourceRecordInputSchema,
} from "../project-source-records";
import {
  configureProjectUpdateReminderInputSchema,
  createProjectUpdateInputSchema,
  ProjectUpdateConflictError,
  ProjectUpdateLinkError,
  ProjectUpdateReadOnlyError,
  projectUpdatesInputSchema,
} from "../project-updates";
import {
  addProjectWallCardInputSchema,
  createProjectWallFromSkeletonInputSchema,
  createProjectWallGroupInputSchema,
  createProjectWallInputSchema,
  createProjectWallPersistentRelationInputSchema,
  drawProjectWallLinkInputSchema,
  moveProjectWallCardsInputSchema,
  PROJECT_WALL_SOURCE_TYPES,
  previewProjectWallPersistentRelationInputSchema,
  projectWallGroupInputSchema,
  projectWallInputSchema,
  projectWallProjectInputSchema,
  removeProjectWallCardInputSchema,
  renameProjectWallInputSchema,
  reorderProjectWallCardsInputSchema,
  setProjectWallCardDensityInputSchema,
  setProjectWallCardDiagramPinInputSchema,
  setProjectWallCardGroupInputSchema,
  setProjectWallCardHighlightInputSchema,
  setProjectWallCardLockInputSchema,
  unbindProjectWallLinkInputSchema,
} from "../project-wall";
import {
  exportProjectWallSnapshotInputSchema,
  previewProjectWallSnapshotInputSchema,
  setProjectWallFocusOrderInputSchema,
} from "../project-wall-presentation";
import {
  projectWallViewportInputSchema,
  saveProjectWallViewportInputSchema,
} from "../project-wall-viewport";
import type { RecordActionsAccess } from "../record-actions";
import {
  applyRecordActionInputSchema,
  createRecordActionInputSchema,
  createRecordActionMutationInputSchema,
  previewRecordActionInputSchema,
  recordActionsInputSchema,
  trashRecordActionMutationInputSchema,
  undoRecordActionInputSchema,
  updateRecordActionInputSchema,
  updateRecordActionMutationInputSchema,
} from "../record-actions";
import {
  documentDiscoveryInputSchema,
  recordTableCellUpdateInputSchema,
  recordTableInputSchema,
  recordTablePasteInputSchema,
  universalSearchInputSchema,
} from "../record-discovery";
import {
  createUsageLinkMutationInputSchema,
  listUsageLinksInputSchema,
  reactivateBlockerInputSchema,
  relationCreateInputSchema,
  relationCreatePreviewInputSchema,
  relationsInputSchema,
  removeRelationInputSchema,
  resolveBlockerInputSchema,
  type UsageLinkMutationValue,
  undoRelationInputSchema,
  unlinkUsageLinkInputSchema,
  usageLinkPayloadSchema,
  usageLinkSchema,
} from "../relations";
import {
  changelogInputSchema,
  closeAssessmentInputSchema,
  publishReleaseNoteInputSchema,
  type ReleaseCommunicationAccess,
  reassessmentInputSchema,
  recordObservationInputSchema,
  releaseNotePreviewInputSchema,
  releaseNotesInputSchema,
  saveReleaseNoteDraftMutationInputSchema,
  setLookAgainInputSchema,
  startReassessmentInputSchema,
} from "../release-communication";
import {
  addReleaseChecklistItemInputSchema,
  closeReleaseOpenScopeSignalInputSchema,
  releaseChecklistItemOutputSchema,
  releaseEvidencePackInputSchema,
  releaseEvidencePackSchema,
  releaseOpenScopeSignalOutputSchema,
  removeReleaseChecklistItemInputSchema,
  setReleaseChecklistItemInputSchema,
} from "../release-evidence";
import {
  confirmResearchSessionBindingInputSchema,
  previewResearchSessionBindingInputSchema,
} from "../research-session-bindings";
import {
  captureResearchSessionInputSchema,
  ResearchSessionConsentError,
  researchSessionConvertPreview,
  researchSessionConvertPreviewInputSchema,
  researchSessionProjectInputSchema,
  researchSessionSnapshotPreview,
  researchSessionSnapshotPreviewInputSchema,
  saveResearchSessionInputSchema,
  saveResearchSessionNoteInputSchema,
} from "../research-sessions";
import {
  returnContextInputSchema,
  saveNextConcreteStepInputSchema,
} from "../return-to-work";
import { riskContextRelationInputSchema } from "../risk-signals";
import {
  createMilestoneInputSchema,
  projectRoadmapInputSchema,
  saveRoadmapViewInputSchema,
  updateMilestoneInputSchema,
  updateMilestoneStatusInputSchema,
  updateResearchDirectionInputSchema,
  updateWorkHorizonInputSchema,
} from "../roadmap-horizon";
import {
  SchemaArtifactError,
  schemaChangePreviewInputSchema,
  schemaDdlPreviewInputSchema,
} from "../schema-artifacts";
import {
  confirmMigrationArtifactInputSchema,
  migrationArtifactInputSchema,
  migrationArtifactListInputSchema,
} from "../schema-migration-artifact";
import {
  confirmConvertAndBindInputSchema,
  confirmRebindInputSchema,
  createScreenFromTemplateInputSchema,
  previewConvertAndBindInputSchema,
  previewRebindInputSchema,
  saveScreenTemplateInputSchema,
  screenTemplateListInputSchema,
} from "../screen-origins";
import {
  saveScreenViewportInputSchema,
  screenViewportInputSchema,
} from "../screen-viewport";
import {
  createLinkedBlockInputSchema,
  createScreenInputSchema,
  linkedBlockChangeInputSchema,
  resolveScreenInputSchema,
  saveScreenWireframeInputSchema,
  saveScreenWireframeVersionInputSchema,
  screenProjectInputSchema,
  screenWireframeInputSchema,
  setScreenLifecycleInputSchema,
} from "../screens";
import {
  applySecurityRedactionInputSchema,
  SECURITY_REDACTION_OPERATION_ID,
  SecurityRedactionGrantRejectedError,
  SecurityRedactionSpreadIncompleteError,
  SecurityRedactionTypedNameMismatchError,
  securityRedactionPreviewInputSchema,
} from "../security-redaction";
import {
  createSmartCollectionInputSchema,
  SmartCollectionConflictError,
  SmartCollectionUnavailableError,
  setSmartCollectionSubscriptionInputSchema,
} from "../smart-collections";
import {
  smartLinkPreviewInputSchema,
  smartLinkPreviewSchema,
} from "../smart-link-preview";
import {
  bindSourceEvidenceInputSchema,
  reviewSourceEvidenceInputSchema,
  sourceEvidencePreviewInputSchema,
} from "../source-evidence";
import {
  recheckSourceInputSchema,
  sourceCheckDecisionInputSchema,
} from "../source-recheck";
import {
  createSourceInputSchema,
  SourceConflictError,
  saveSourceVersionInputSchema,
  sourceProjectInputSchema,
  sourceSelectionSchema,
} from "../sources-and-freshness";
import {
  specChangeReviewInputSchema,
  specChangeReviewProjectInputSchema,
} from "../spec-change-review";
import {
  markSpecChangeReviewCandidateInputSchema,
  type SpecChangeReviewMark,
  type SpecChangeReviewMarkValue,
  specCandidateKey,
  specChangeReviewMarkId,
  specChangeReviewMarkPayloadSchema,
} from "../spec-change-review-candidates";
import {
  createSpecChangeReviewFollowUpInputSchema,
  previewSpecChangeReviewFollowUpInputSchema,
  type SpecChangeReviewFollowUp,
  type SpecChangeReviewFollowUpValue,
  specChangeReviewFollowUpId,
  specChangeReviewFollowUpPayloadSchema,
} from "../spec-change-review-follow-up";
import {
  applyTagInputSchema,
  createTagInputSchema,
  removeTagInputSchema,
  renameTagCommandSchema,
  renameTagMutationInputSchema,
  type TagMutationValue,
  tagRecordsInputSchema,
  tagsInputSchema,
  undoTagRenameInputSchema,
} from "../tags";
import {
  authorityConversionInputSchema,
  confirmAuthorityConversionInputSchema,
  createTechnicalDiagramInputSchema,
  DiagramAuthorityError,
} from "../technical-diagram-authority";
import {
  confirmConvertToRecordInputSchema,
  DiagramConversionError,
  moveDiagramRecordCardInputSchema,
  pinDiagramToVersion,
  placeDiagramRecordCardInputSchema,
  previewConvertToRecordInputSchema,
  removeDiagramRecordCardInputSchema,
} from "../technical-diagram-card";
import { StructuralModelError } from "../technical-diagram-structure";
import {
  createDiagramVersionInputSchema,
  restoreDiagramVersionInputSchema,
} from "../technical-diagram-version";
import {
  saveTechnicalDiagramViewportInputSchema,
  technicalDiagramViewportInputSchema,
} from "../technical-diagram-viewport";
import {
  confirmMermaidConversionInputSchema,
  createDiagramViewInputSchema,
  mermaidConversionInputSchema,
  saveDiagramLayoutInputSchema,
  saveTechnicalDiagramModelInputSchema,
} from "../technical-diagrams";
import {
  recordTestAssessmentInputSchema,
  testAssessmentContextTargetsInputSchema,
  testAssessmentContextTargetsOutputSchema,
  testAssessmentListOutputSchema,
  testAssessmentProjectInputSchema,
  testAssessmentRecordSchema,
} from "../test-assessments";
import {
  closeTestGapInputSchema,
  createTestGapInputSchema,
  testGapCaseBindInputSchema,
  testGapDecisionTargetsInputSchema,
  testGapHandoffBindInputSchema,
  testGapProjectInputSchema,
  testGapRelationTargetsInputSchema,
} from "../test-gaps";
import {
  applicationTestReportInputSchema,
  TestReportRejectedError,
  testSessionProjectInputSchema,
} from "../test-report";
import {
  bindValidResultInputSchema,
  bindValidResultReceiptSchema,
  commitBulkReviewInputSchema,
  commitFollowUpInputSchema,
  previewBulkReviewInputSchema,
  previewFollowUpInputSchema,
  previewSessionCloseInputSchema,
  recordCorrectionInputSchema,
  recordRedactionInputSchema,
  recordWithdrawalInputSchema,
  setItemReviewStateInputSchema,
  setSessionReviewStateInputSchema,
  supersedeInputSchema,
  supersedeReceiptSchema,
  testResultEventReceiptSchema,
  testReviewBulkPreviewSchema,
  testReviewBulkReceiptSchema,
  testReviewClosePreviewSchema,
  testReviewListOutputSchema,
  testReviewProjectInputSchema,
  testReviewReceiptSchema,
} from "../test-review";
import {
  followUpPreviewSchema,
  followUpReceiptSchema,
} from "../test-review-signals";
import {
  testSummaryInputSchema,
  testSummarySchema,
} from "../test-review-summary";
import {
  moveToTrashInputSchema,
  moveToTrashPreviewInputSchema,
  restoreFromTrashInputSchema,
  TrashAlreadyTrashedError,
  TrashChildRecordError,
  TrashKeepSurfaceNotAllowedError,
  TrashSurfaceNotRevokedError,
  trashOverviewInputSchema,
} from "../trash";
import {
  TrashRestoreConflictError,
  trashRestorePreviewInputSchema,
} from "../trash-configuration";
import {
  permanentlyDeleteFromTrashInputSchema,
  TrashDeleteBlockedError,
  TrashGrantRejectedError,
  TrashTypedNameMismatchError,
  trashEarlyDeletePreviewInputSchema,
} from "../trash-early-delete";
import {
  convertUserFlowNodeInputSchema,
  createUserFlowFromTemplateInputSchema,
  createUserFlowInputSchema,
  placeUserFlowCardInputSchema,
  placeUserFlowNodeInputSchema,
  previewConvertUserFlowNodeInputSchema,
  previewRebindUserFlowBindInputSchema,
  promoteUserFlowNodeInputSchema,
  rebindUserFlowBindInputSchema,
  saveUserFlowTemplateInputSchema,
  saveUserFlowVersionInputSchema,
  saveUserFlowViewportInputSchema,
  userFlowInputSchema,
  userFlowProjectInputSchema,
} from "../user-flow";
import { valueChainInputSchema } from "../value-chain";
import type { WebCaptureAccess } from "../web-capture";
import {
  publishWikiDocumentInputSchema,
  setWikiIndexingInputSchema,
  unpublishWikiDocumentInputSchema,
  type WikiPublishingAccess,
  wikiPublicationInputSchema,
  wikiPublishPreviewInputSchema,
} from "../wiki-publishing";
import { WireframeDocumentError } from "../wireframe-document";
import {
  createRequiredPrMergeRuleInputSchema,
  createWorkAutomationRuleMutationInputSchema,
  restoreWorkAutomationRuleVersionInputSchema,
  setWorkAutomationRuleEnabledInputSchema,
  trashWorkAutomationRuleInputSchema,
  updateWorkAutomationRuleInputSchema,
  updateWorkAutomationRuleMutationInputSchema,
  type WorkAutomationAccess,
  workAutomationDryRunInputSchema,
  workAutomationRulesInputSchema,
  workAutomationRuleVersionsInputSchema,
  workAutomationUndoInputSchema,
} from "../work-automation";
import {
  previewWorkContextLayout,
  type WorkContextAccess,
  workContextInputSchema,
} from "../work-context";
import {
  deleteWorkDraftInputSchema,
  finalizeWorkDraftInputSchema,
  saveWorkDraftInputSchema,
  type WorkDraftsAccess,
  workDraftInputSchema,
  workDraftsInputSchema,
} from "../work-drafts";
import {
  closeWorkInputSchema,
  convertWorkChecklistItemInputSchema,
  createDocumentWorkBatchInputSchema,
  createWorkRpcMutationInputSchema,
  detachFeatureHealthHistoryInputSchema,
  detachIncludedWorkInputSchema,
  includeWorkInputSchema,
  mergeWorkInputSchema,
  recordFeatureHealthInputSchema,
  recreateWorkInputSchema,
  reopenWorkInputSchema,
  undoWorkDateInputSchema,
  undoWorkMergeInputSchema,
  undoWorkStatusInputSchema,
  updateFeaturePrimarySpecInputSchema,
  updateWorkChecklistInputSchema,
  updateWorkDateInputSchema,
  updateWorkPlannedDateInputSchema,
  updateWorkReappearDateInputSchema,
  updateWorkStatusInputSchema,
  updateWorkTypeInputSchema,
  workArchiveMutationInputSchema,
  workChecklistConversionPreviewInputSchema,
  workClosePreviewInputSchema,
  workIdentityInputSchema,
  workMergePreviewInputSchema,
  workRecreatePreviewInputSchema,
  workTypeChangePreviewInputSchema,
  workTypeSchema,
} from "../work-lifecycle";
import {
  reconsiderWorkNotNowInputSchema,
  recordWorkNotNowInputSchema,
  workNotNowHistoryInputSchema,
} from "../work-not-now";
import {
  createWorkTemplateInputSchema,
  createWorkTemplateMutationInputSchema,
  duplicateWorkMutationInputSchema,
  instantiateWorkTemplateMutationInputSchema,
  previewDuplicateWorkInputSchema,
  trashWorkTemplateMutationInputSchema,
  updateWorkTemplateInputSchema,
  updateWorkTemplateMutationInputSchema,
  workTemplatesInputSchema,
} from "../work-templates";
import {
  type WorkspaceOverviewAccess,
  workspaceOverviewPresentationSchema,
} from "../workspace-overview";

async function readOwnedResearchSession(
  context: Context,
  input: { id: string; projectId: string },
) {
  if (!context.session) {
    throw new ORPCError("UNAUTHORIZED");
  }
  if (!context.researchSessions) {
    throw new ORPCError("NOT_IMPLEMENTED");
  }
  const sessions = await context.researchSessions.list(
    context.session.user.id,
    input.projectId,
  );
  const session = sessions?.records.find((record) => record.id === input.id);
  if (!session) {
    throw new ORPCError("NOT_FOUND");
  }
  return session;
}

function rethrowResearchSessionError(error: unknown): never {
  if (error instanceof ResearchSessionConsentError) {
    throw new ORPCError("FORBIDDEN", { message: error.message, cause: error });
  }
  if (error instanceof Error && "code" in error) {
    if (error.code === "CONFLICT" || error.code === "STALE_BASE_REVISION") {
      throw new ORPCError("CONFLICT", {
        message: "Research Session changed. Reload before saving.",
        cause: error,
      });
    }
    if (error.code === "TARGET_NOT_FOUND") {
      throw new ORPCError("NOT_FOUND", { cause: error });
    }
  }
  throw error;
}

function sessionPrincipal(session: NonNullable<Context["session"]>) {
  return {
    accountId: session.user.id,
    sessionId: session.session.id,
  };
}

const WORK_CONTEXT_LAYOUT_UNDO_SCOPE_PREFIX =
  "project.configuration.workContextLayouts.";

function workContextLayoutTypeFromUndoScope(scope: string | undefined) {
  if (!scope?.startsWith(WORK_CONTEXT_LAYOUT_UNDO_SCOPE_PREFIX)) {
    return null;
  }
  const parsed = workTypeSchema.safeParse(
    scope.slice(WORK_CONTEXT_LAYOUT_UNDO_SCOPE_PREFIX.length),
  );
  return parsed.success ? parsed.data : null;
}

const saveAccountPreferencesInputSchema = humanMutationEnvelopeSchema.extend({
  preferences: accountPreferencesSchema,
});
const legacySaveAccountPreferencesInputSchema = accountPreferencesSchema;
const saveAccountPreferencesProcedureInputSchema = z.union([
  saveAccountPreferencesInputSchema,
  legacySaveAccountPreferencesInputSchema,
]);

const saveAccountAppearanceInputSchema = humanMutationEnvelopeSchema.extend({
  appearance: appearanceSchema,
});
const legacySaveAccountAppearanceInputSchema = z
  .object({ appearance: appearanceSchema })
  .strict();
const saveAccountAppearanceProcedureInputSchema = z.union([
  saveAccountAppearanceInputSchema,
  legacySaveAccountAppearanceInputSchema,
]);

const saveCompletionEffectsPreferencesInputSchema =
  humanMutationEnvelopeSchema.extend({
    preferences: completionEffectsPreferencesSchema,
  });

const revokeWebCaptureLinkInputSchema = z
  .object({ linkId: z.string().trim().min(1).max(255) })
  .strict();

function requireAccountPreferencesMutationContract(context: Context) {
  if (!context.accountPreferencesMutationContract) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.accountPreferencesMutationContract;
}

function requireCompletionEffectsPreferencesAccess(context: Context) {
  if (!context.completionEffectsPreferences) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.completionEffectsPreferences;
}

function requireCompletionEffectsPreferencesMutationContract(context: Context) {
  if (!context.completionEffectsPreferencesMutationContract) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.completionEffectsPreferencesMutationContract;
}

function requireAccountPreferencesCompatibility(context: Context) {
  if (
    context.clientPlatform !== "tauri" ||
    !context.desktopApiContract ||
    !context.accountPreferencesCompatibility
  ) {
    throw new ORPCError("BAD_REQUEST");
  }
  return context.accountPreferencesCompatibility;
}

function requireProjectShell(context: Context) {
  if (!context.projectShell) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.projectShell;
}

function requireWorkspaceOverview(context: Context): WorkspaceOverviewAccess {
  if (!context.workspaceOverview) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.workspaceOverview;
}

function requireWorkspaceOverviewWriter(context: Context) {
  const overview = requireWorkspaceOverview(context);
  if (!overview.savePresentation) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return overview.savePresentation.bind(overview);
}

function requireUsageLinks(context: Context) {
  if (!context.usageLinks) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.usageLinks;
}

function requireUsageLinkMutationContracts(context: Context) {
  if (!context.usageLinkMutationContracts) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.usageLinkMutationContracts;
}

function requireDocumentMutationContracts(context: Context) {
  if (!context.documentMutationContracts) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.documentMutationContracts;
}

function requireBacklog(context: Context) {
  if (!context.backlog) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.backlog;
}

function requireReturnToWork(context: Context) {
  if (!context.returnToWork) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.returnToWork;
}

function requireFavorites(context: Context) {
  if (!context.favorites) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.favorites;
}

function requireDailyFocus(context: Context) {
  if (!context.dailyFocus) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.dailyFocus;
}

function requireFocusPeriod(context: Context) {
  if (!context.focusPeriod) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.focusPeriod;
}

function rethrowFocusPeriodError(error: unknown): never {
  if (error instanceof FocusPeriodUnavailableError) {
    throw new ORPCError("NOT_FOUND", { cause: error });
  }
  if (error instanceof FocusPeriodConflictError) {
    if (
      error.message === FOCUS_PERIOD_ACTIVE_MEMBERSHIP_CONFLICT_MESSAGE ||
      error.message === FOCUS_PERIOD_OVERLAPPING_MEMBERSHIP_CONFLICT_MESSAGE
    ) {
      throw new ORPCError("CONFLICT", {
        cause: error,
        message: error.message,
      });
    }
    throw new ORPCError("CONFLICT", { cause: error });
  }
  throw error;
}

function requireProjectSourceRecords(context: Context) {
  if (!context.projectSourceRecords) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.projectSourceRecords;
}

function requireSourcesAndFreshness(context: Context) {
  if (!context.sourcesAndFreshness) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.sourcesAndFreshness;
}

async function sourceSaveResult<T>(
  operation: () => Promise<T | null>,
): Promise<T> {
  try {
    const record = await operation();
    if (!record) {
      throw new ORPCError("NOT_FOUND");
    }
    return record;
  } catch (error) {
    if (error instanceof SourceConflictError) {
      throw new ORPCError("CONFLICT", {
        cause: error,
        data: {
          code: error.code,
          label: MUTATION_UI_LABELS.conflict,
          targetId: error.targetId,
        },
      });
    }
    throw error;
  }
}

function rethrowProjectSourceRecordError(error: unknown): never {
  if (error instanceof ProjectSourceRecordConflictError) {
    throw new ORPCError("CONFLICT", {
      cause: error,
      data: {
        code: error.code,
        label: MUTATION_UI_LABELS.conflict,
        targetId: error.targetId,
      },
      defined: true,
      message: MUTATION_UI_LABELS.conflict,
    });
  }
  throw error;
}

function requireRoadmapHorizon(context: Context) {
  if (!context.roadmapHorizon) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.roadmapHorizon;
}

function requirePersonalReminders(context: Context) {
  if (!context.personalReminders) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.personalReminders;
}

function requireBacklogMutationContracts(context: Context) {
  if (!context.backlogMutationContracts) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.backlogMutationContracts;
}

function requireCustomFields(context: Context) {
  if (!context.customFields) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.customFields;
}

function requirePriorityMetrics(context: Context): PriorityMetricsAccess {
  if (!context.priorityMetrics) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.priorityMetrics;
}

function requirePriorityMetricMutationContracts(
  context: Context,
): PriorityMetricMutationContracts {
  if (!context.priorityMetricMutationContracts) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.priorityMetricMutationContracts;
}

function requirePrioritizationSessions(context: Context) {
  if (!context.prioritizationSessions) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.prioritizationSessions;
}

function requirePrioritizationSessionMutationContracts(context: Context) {
  if (!context.prioritizationSessionMutationContracts) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.prioritizationSessionMutationContracts;
}

function requireWorkTemplates(context: Context) {
  if (!context.workTemplates) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.workTemplates;
}

function requireExternalExecutionHandoffs(context: Context) {
  if (!context.workHandoffs) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.workHandoffs;
}

function rethrowExternalExecutionHandoffError(error: unknown): never {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "EXTERNAL_HANDOFF_STALE_WORK" ||
      error.code === "EXTERNAL_HANDOFF_IDEMPOTENCY_CONFLICT" ||
      error.code === "EXTERNAL_HANDOFF_TERMINAL" ||
      error.code === "EXTERNAL_HANDOFF_RETURN_UNAVAILABLE" ||
      error.code === "EXTERNAL_HANDOFF_RECONCILE_PREVIEW_REQUIRED" ||
      error.code === "EXTERNAL_HANDOFF_RECONCILE_UNAVAILABLE")
  ) {
    throw new ORPCError("CONFLICT", {
      defined: true,
      message: "This handoff could not be written.",
    });
  }
  throw error;
}

function requireRecordActions(context: Context): RecordActionsAccess {
  if (!context.recordActions) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.recordActions;
}

function requireWorkAutomation(context: Context): WorkAutomationAccess {
  if (!context.workAutomation) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.workAutomation;
}

function requireReleaseCommunication(
  context: Context,
): ReleaseCommunicationAccess {
  if (!context.releaseCommunication) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.releaseCommunication;
}

function requireBuildInPublic(context: Context): BuildInPublicAccess {
  if (!context.buildInPublic) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.buildInPublic;
}

function buildInPublicUnavailable(): never {
  throw new ORPCError("NOT_FOUND", {
    defined: true,
    message: "Build in Public is unavailable for this Project.",
  });
}

function rethrowBuildInPublicError(error: unknown): never {
  if (!isRecord(error) || typeof error.code !== "string") {
    throw error;
  }
  const status = {
    BUILD_IN_PUBLIC_DISABLED: "PRECONDITION_FAILED",
    BUILD_IN_PUBLIC_FEATURED_INVALID: "BAD_REQUEST",
    BUILD_IN_PUBLIC_INDEXING_UNACKNOWLEDGED: "PRECONDITION_FAILED",
    BUILD_IN_PUBLIC_LABEL_REQUIRED: "CONFLICT",
    BUILD_IN_PUBLIC_NOT_PUBLISHED: "NOT_FOUND",
    BUILD_IN_PUBLIC_NOTHING_APPROVED: "BAD_REQUEST",
    BUILD_IN_PUBLIC_PLACEHOLDERS_UNRESOLVED: "CONFLICT",
    BUILD_IN_PUBLIC_PREVIEW_STALE: "PRECONDITION_FAILED",
    BUILD_IN_PUBLIC_REDIRECT_UNCONFIRMED: "PRECONDITION_FAILED",
    BUILD_IN_PUBLIC_SLUG_TAKEN: "CONFLICT",
    BUILD_IN_PUBLIC_WORK_UNAVAILABLE: "NOT_FOUND",
  }[error.code] as
    | "BAD_REQUEST"
    | "CONFLICT"
    | "NOT_FOUND"
    | "PRECONDITION_FAILED"
    | undefined;
  if (!status) {
    throw error;
  }
  throw new ORPCError(status, {
    data: { code: error.code },
    defined: true,
    message: error instanceof Error ? error.message : "Build in Public failed.",
  });
}

function requireWikiPublishing(context: Context): WikiPublishingAccess {
  if (!context.wikiPublishing) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.wikiPublishing;
}

function wikiDocumentUnavailable(): never {
  throw new ORPCError("NOT_FOUND", {
    defined: true,
    message: "Wiki Document is unavailable.",
  });
}

function rethrowWikiPublishingError(error: unknown): never {
  if (!isRecord(error) || typeof error.code !== "string") {
    throw error;
  }
  const status = {
    WIKI_PUBLISHING_INDEXING_UNACKNOWLEDGED: "PRECONDITION_FAILED",
    WIKI_PUBLISHING_NOT_PUBLISHED: "CONFLICT",
    WIKI_PUBLISHING_PLACEHOLDERS_UNRESOLVED: "CONFLICT",
    WIKI_PUBLISHING_PREVIEW_STALE: "PRECONDITION_FAILED",
  }[error.code] as "CONFLICT" | "PRECONDITION_FAILED" | undefined;
  if (!status) {
    throw error;
  }
  throw new ORPCError(status, {
    data: { code: error.code },
    defined: true,
    message: error instanceof Error ? error.message : "Wiki publish failed.",
  });
}

function releaseUnavailable(): never {
  throw new ORPCError("NOT_FOUND", {
    defined: true,
    message: "Release is unavailable.",
  });
}

function projectUnavailable(): never {
  throw new ORPCError("NOT_FOUND", {
    defined: true,
    message: "Project is unavailable.",
  });
}

function rethrowReleaseCommunicationError(error: unknown): never {
  if (!isRecord(error) || typeof error.code !== "string") {
    throw error;
  }
  const status = {
    RELEASE_COMMUNICATION_ALREADY_PUBLISHED: "CONFLICT",
    RELEASE_COMMUNICATION_EVIDENCE_INVALID: "BAD_REQUEST",
    RELEASE_COMMUNICATION_NOT_FOUND: "NOT_FOUND",
    RELEASE_COMMUNICATION_NOT_PUBLISHED: "CONFLICT",
    RELEASE_COMMUNICATION_PREVIEW_BLOCKED: "CONFLICT",
    RELEASE_COMMUNICATION_PREVIEW_STALE: "PRECONDITION_FAILED",
    RELEASE_COMMUNICATION_ROUND_CLOSED: "CONFLICT",
    RELEASE_COMMUNICATION_SCOPE_INVALID: "BAD_REQUEST",
    RELEASE_COMMUNICATION_STALE_REVISION: "PRECONDITION_FAILED",
  }[error.code] as
    | "BAD_REQUEST"
    | "CONFLICT"
    | "NOT_FOUND"
    | "PRECONDITION_FAILED"
    | undefined;
  if (!status) {
    throw error;
  }
  throw new ORPCError(status, {
    data: { code: error.code },
    defined: true,
    message:
      error instanceof Error ? error.message : "Release communication failed.",
  });
}

function rethrowWorkAutomationError(error: unknown): never {
  if (!isRecord(error)) {
    throw error;
  }
  if (error.code === "WORK_AUTOMATION_PROJECT_NOT_FOUND") {
    throw new ORPCError("NOT_FOUND", {
      defined: true,
      message: "Project is unavailable.",
    });
  }
  if (error.code === "WORK_AUTOMATION_RULE_NAME_CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { code: error.code },
      defined: true,
      message: "An Automation rule with this name already exists.",
    });
  }
  if (error.code === "WORK_AUTOMATION_STALE_REVISION") {
    throw new ORPCError("PRECONDITION_FAILED", {
      data: { code: error.code },
      defined: true,
      message: "Automation rule changed. Reload and try again.",
    });
  }
  throw error;
}

function rethrowRecordActionError(error: unknown): never {
  if (!isRecord(error)) {
    throw error;
  }

  if (error.code === "RECORD_ACTION_PROJECT_NOT_FOUND") {
    throw new ORPCError("NOT_FOUND", {
      defined: true,
      message: "Project is unavailable.",
    });
  }

  if (error.code === "RECORD_ACTION_NAME_CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { code: error.code },
      defined: true,
      message:
        typeof error.message === "string"
          ? error.message
          : "A Record Action with this name already exists in this Project.",
    });
  }

  if (error.code === "RECORD_ACTION_STALE_REVISION") {
    throw new ORPCError("PRECONDITION_FAILED", {
      data: { code: error.code },
      defined: true,
      message: "Record Action changed. Reload and try again.",
    });
  }

  if (error.code === "CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { code: error.code },
      defined: true,
      message: "Conflict",
    });
  }

  if (error.code === "STALE_BASE_REVISION") {
    throw new ORPCError("PRECONDITION_FAILED", {
      data: { code: error.code },
      defined: true,
      message: "Work changed. Start the Record Action again to review it.",
    });
  }

  if (error.code === "UNDO_NOT_SUPPORTED") {
    throw new ORPCError("PRECONDITION_FAILED", {
      data: { code: error.code },
      defined: true,
      message: "Record Action could not be undone safely.",
    });
  }

  if (
    error.code === "RECORD_ACTION_STEP_UNAVAILABLE" ||
    error.code === "CUSTOM_FIELD_TRASHED" ||
    error.code === "CUSTOM_FIELD_NOT_FOUND" ||
    error.code === "CUSTOM_FIELD_RECORD_TYPE_NOT_BOUND" ||
    error.code === "CUSTOM_FIELD_VALUE_TYPE_MISMATCH" ||
    error.code === "CUSTOM_FIELD_OPTION_INVALID"
  ) {
    throw new ORPCError("BAD_REQUEST", {
      data: { code: error.code },
      defined: true,
      message:
        typeof error.message === "string"
          ? error.message
          : "The Record Action was rejected.",
    });
  }

  throw error;
}

function rethrowWorkTemplateError(error: unknown): never {
  if (!isRecord(error)) {
    throw error;
  }

  if (error.code === "APPLY_FAILED" && isRecord(error.cause)) {
    rethrowWorkTemplateError(error.cause);
  }

  if (error.code === "WORK_TEMPLATE_PROJECT_NOT_FOUND") {
    throw new ORPCError("NOT_FOUND", {
      defined: true,
      message: "Project is unavailable.",
    });
  }

  if (error.code === "WORK_TEMPLATE_NAME_CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { code: error.code },
      defined: true,
      message:
        typeof error.message === "string"
          ? error.message
          : "A Work Template with this name already exists in this Project.",
    });
  }

  if (error.code === "WORK_TEMPLATE_STALE_REVISION") {
    throw new ORPCError("PRECONDITION_FAILED", {
      data: { code: error.code },
      defined: true,
      message: "Work Template changed. Reload and try again.",
    });
  }

  if (
    error.code === "WORK_TEMPLATE_CUSTOM_FIELD_UNAVAILABLE" ||
    error.code === "CUSTOM_FIELD_TRASHED" ||
    error.code === "CUSTOM_FIELD_NOT_FOUND" ||
    error.code === "CUSTOM_FIELD_RECORD_TYPE_NOT_BOUND" ||
    error.code === "CUSTOM_FIELD_VALUE_TYPE_MISMATCH" ||
    error.code === "CUSTOM_FIELD_OPTION_INVALID"
  ) {
    throw new ORPCError("BAD_REQUEST", {
      data: { code: error.code },
      defined: true,
      message:
        typeof error.message === "string"
          ? error.message
          : "The Work Template was rejected.",
    });
  }

  if (error.code === "WORK_DUPLICATE_SOURCE_STALE") {
    throw new ORPCError("PRECONDITION_FAILED", {
      data: { code: error.code },
      defined: true,
      message: "Work changed. Reload and try again.",
    });
  }

  const lifecycleError = mapWorkLifecycleError(error);
  if (lifecycleError) {
    throw lifecycleError;
  }

  throw error;
}

function requireCustomFieldMutationContracts(context: Context) {
  if (!context.customFieldMutationContracts) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.customFieldMutationContracts;
}

function requireFeedback(context: Context) {
  if (!context.feedback) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.feedback;
}

function requireScreens(context: Context) {
  if (!context.screens) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.screens;
}

function requireProjectWall(context: Context) {
  if (!context.projectWall) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.projectWall;
}

const PROJECT_WALL_UNAVAILABLE_MESSAGES: Record<string, string> = {
  PROJECT_WALL_CARD_NOT_FOUND: "Card is not on this Project Wall.",
  PROJECT_WALL_GROUP_NOT_FOUND: "Group is not on this Project Wall.",
  PROJECT_WALL_LINK_NOT_FOUND: "Visual link is not on this Project Wall.",
  PROJECT_WALL_NOT_FOUND: "Project Wall is unavailable.",
  PROJECT_WALL_PROJECT_NOT_FOUND: "Project is unavailable.",
};

const PROJECT_WALL_SOURCE_TYPE_LIST = `${PROJECT_WALL_SOURCE_TYPES.slice(0, -1).join(", ")} or ${PROJECT_WALL_SOURCE_TYPES.at(-1)}`;

const PROJECT_WALL_REJECTED_MESSAGES: Record<string, string> = {
  PROJECT_WALL_CARD_DUPLICATE:
    "This record is already a card on this Project Wall.",
  PROJECT_WALL_PROJECT_READ_ONLY: "Archived Projects are read-only.",
  PROJECT_WALL_SKELETON_NOT_SELECTED:
    "This skeleton is not selected for this Project.",
  PROJECT_WALL_RELATION_UNAVAILABLE:
    "A Smart Collection block cannot be a relation endpoint.",
  PROJECT_WALL_SOURCE_UNAVAILABLE: `The record is not an active ${PROJECT_WALL_SOURCE_TYPE_LIST} of this Project.`,
};

async function runProjectWallOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isRecord(error) || typeof error.code !== "string") {
      throw error;
    }
    // Same stale-preview condition as the relations seam: 412, not 400.
    if (error.code === "PROJECT_WALL_RELATION_PREVIEW_REQUIRED") {
      throw new ORPCError("PRECONDITION_FAILED", {
        cause: error,
        data: { code: error.code },
        defined: true,
        message: "Review the current relation preview before confirming.",
      });
    }
    // The refusal reason is the user's action item; the seam refuses scopes,
    // it does not truncate them.
    if (error.code === "PROJECT_WALL_SNAPSHOT_FAILED") {
      throw new ORPCError("BAD_REQUEST", {
        cause: error,
        data: { code: error.code },
        defined: true,
        message:
          typeof error.message === "string" && error.message
            ? error.message
            : "The Project Wall snapshot could not be taken.",
      });
    }
    const rejected = PROJECT_WALL_REJECTED_MESSAGES[error.code];
    if (rejected) {
      throw new ORPCError("BAD_REQUEST", {
        cause: error,
        data: { code: error.code },
        defined: true,
        message: rejected,
      });
    }
    const message = PROJECT_WALL_UNAVAILABLE_MESSAGES[error.code];
    if (message) {
      throw new ORPCError("NOT_FOUND", {
        cause: error,
        data: { code: error.code },
        defined: true,
        message,
      });
    }
    throw error;
  }
}

function requireTestAssessments(context: Context) {
  if (!context.testAssessments) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.testAssessments;
}

function requireProjectHistory(context: Context) {
  if (!context.projectHistory) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.projectHistory;
}

function requireProjectActivity(context: Context) {
  if (!context.projectActivity) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.projectActivity;
}

function requireProjectClosureSummary(context: Context) {
  if (!context.projectClosureSummary) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.projectClosureSummary;
}

function requireValueChain(context: Context) {
  if (!context.valueChain) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.valueChain;
}

function requirePublicRoadmapReview(context: Context) {
  if (!context.publicRoadmapReview) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.publicRoadmapReview;
}

function requireAttentionSignals(context: Context) {
  if (!context.attentionSignals) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.attentionSignals;
}

function requireReleaseEvidence(context: Context) {
  if (!context.releaseEvidence) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.releaseEvidence;
}

function requireGitHubIntegration(context: Context) {
  if (!context.gitHubIntegration) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.gitHubIntegration;
}

function requirePlannedTests(context: Context) {
  if (!context.plannedTests) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.plannedTests;
}

function requireTestReview(context: Context) {
  if (!context.testReview) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.testReview;
}

function requireProductGaps(context: Context) {
  if (!context.productGaps) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.productGaps;
}

function requireTestGaps(context: Context) {
  if (!context.testGaps) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.testGaps;
}

function requireTestReports(context: Context) {
  if (!context.testReports) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.testReports;
}

/** A refusal carries the closed code, a safe field path and a fixable explanation, never payload. */
async function runTestReportOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof TestReportRejectedError) {
      throw new ORPCError(
        error.code === "project_not_authorized" ? "NOT_FOUND" : "BAD_REQUEST",
        {
          cause: error,
          data: { code: error.code, fieldPath: error.fieldPath },
          defined: true,
          message: error.explanation,
        },
      );
    }
    throw error;
  }
}

function requireSpecChangeReview(context: Context) {
  if (!context.specChangeReview) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.specChangeReview;
}

function requireSpecChangeReviewMutationContracts(context: Context) {
  if (!context.specChangeReviewMutationContracts) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.specChangeReviewMutationContracts;
}

function requireUserFlow(context: Context) {
  if (!context.userFlow) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.userFlow;
}

const USER_FLOW_UNAVAILABLE_MESSAGES: Record<string, string> = {
  USER_FLOW_BIND_NOT_FOUND: "Bind is unavailable.",
  USER_FLOW_NODE_NOT_FOUND: "Node is not in this version of the User Flow.",
  USER_FLOW_NOT_FOUND: "User Flow is unavailable.",
  USER_FLOW_PROJECT_NOT_FOUND: "Project is unavailable.",
  USER_FLOW_TEMPLATE_NOT_FOUND: "User Flow template is unavailable.",
};

const USER_FLOW_STALE_MESSAGES: Record<string, string> = {
  USER_FLOW_CONVERSION_STALE:
    "The User Flow changed since the preview. Preview again.",
  USER_FLOW_REBIND_STALE: "The bind changed since the preview. Preview again.",
};

const USER_FLOW_REJECTED_MESSAGES: Record<string, string> = {
  USER_FLOW_NODE_NOT_PROMOTABLE: "This node already references a Screen.",
  USER_FLOW_PROJECT_READ_ONLY: "Archived Projects are read-only.",
  USER_FLOW_REBIND_NOT_NEEDED: "This bind has nothing to rebind.",
  USER_FLOW_RECORD_UNAVAILABLE:
    "The record is not an active Work, Decision or Risk of this Project.",
  USER_FLOW_SCENE_LIMIT:
    "A User Flow holds at most 500 visible items and 750 links.",
  USER_FLOW_SCREEN_UNAVAILABLE:
    "The Screen is not an active Screen of this Project.",
};

async function runUserFlowOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isRecord(error) || typeof error.code !== "string") {
      throw error;
    }
    if (error.code === "USER_FLOW_VERSION_CONFLICT") {
      throw new ORPCError("PRECONDITION_FAILED", {
        cause: error,
        data: { code: error.code },
        defined: true,
        message: "User Flow changed since it was loaded. Reload and try again.",
      });
    }
    const stale = USER_FLOW_STALE_MESSAGES[error.code];
    if (stale) {
      throw new ORPCError("PRECONDITION_FAILED", {
        cause: error,
        data: { code: error.code },
        defined: true,
        message: stale,
      });
    }
    const rejected = USER_FLOW_REJECTED_MESSAGES[error.code];
    if (rejected) {
      throw new ORPCError("BAD_REQUEST", {
        cause: error,
        data: { code: error.code },
        defined: true,
        message: rejected,
      });
    }
    const message = USER_FLOW_UNAVAILABLE_MESSAGES[error.code];
    if (message) {
      throw new ORPCError("NOT_FOUND", {
        cause: error,
        data: { code: error.code },
        defined: true,
        message,
      });
    }
    throw error;
  }
}

function requireContacts(context: Context) {
  if (!context.contacts) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.contacts;
}

function requireTags(context: Context) {
  if (!context.tags) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.tags;
}

function requireTagMutationContracts(context: Context) {
  if (!context.tagMutationContracts) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.tagMutationContracts;
}

function requireProjectShellMutationContract(
  context: Context,
  operation: "create" | "update",
  accountId: string,
) {
  const contracts = context.projectShellMutationContracts;
  if (!contracts) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return contracts[operation](accountId);
}

function requireWorkLifecycle(context: Context) {
  if (!context.workLifecycle) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.workLifecycle;
}

function requireRelations(context: Context) {
  if (!context.relations) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.relations;
}

function requireWorkContext(context: Context): WorkContextAccess {
  if (!context.workContext) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.workContext;
}

function requireWorkDrafts(context: Context): WorkDraftsAccess {
  if (!context.workDrafts) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.workDrafts;
}

function requireCaptureInbox(context: Context): CaptureInboxAccess {
  if (!context.captureInbox) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.captureInbox;
}

function requireWebCapture(context: Context): WebCaptureAccess {
  if (!context.webCapture) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.webCapture;
}

function requireFileAttachments(context: Context) {
  if (!context.fileAttachments) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.fileAttachments;
}

type DocumentReference = ReturnType<
  typeof parseDocumentRecordReferences
>[number];
type DocumentLiveDirective = ReturnType<typeof documentLiveDirectives>[number];
type PinnedEvidenceRecordType = z.infer<
  typeof pinDocumentEvidenceInputSchema
>["targetRecordType"];

async function pinnedEvidenceTargetProjectId(
  context: Context,
  accountId: string,
  recordType: PinnedEvidenceRecordType,
  recordId: string,
) {
  switch (recordType) {
    case "Work":
      return (await context.workLifecycle?.find(accountId, recordId))
        ?.projectId;
    case "Document":
      return (await context.documents?.get(accountId, recordId))?.projectId;
    case "Technical Diagram":
      return (await context.technicalDiagrams?.get(accountId, recordId))
        ?.projectId;
    default:
      return (
        await context.projectSourceRecords?.find(
          accountId,
          recordType as ProjectSourceType,
          recordId,
        )
      )?.projectId;
  }
}

async function documentReferenceSource(
  context: Context,
  accountId: string,
  reference: DocumentReference,
) {
  switch (reference.recordType) {
    case "Work": {
      const record = await context.workLifecycle?.find(
        accountId,
        reference.recordId,
      );
      return record
        ? {
            id: record.id,
            projectId: record.projectId,
            title: `${record.key} · ${record.title}`,
          }
        : null;
    }
    case "Document": {
      const record = await context.documents?.get(
        accountId,
        reference.recordId,
      );
      return record
        ? {
            id: record.id,
            projectId: record.projectId,
            title: record.title,
          }
        : null;
    }
    case "Technical Diagram": {
      const record = await context.technicalDiagrams?.get(
        accountId,
        reference.recordId,
      );
      return record
        ? { id: record.id, projectId: record.projectId, title: record.title }
        : null;
    }
    default: {
      const record = await context.projectSourceRecords?.find(
        accountId,
        reference.recordType as ProjectSourceType,
        reference.recordId,
      );
      if (!record) {
        return null;
      }
      return {
        id: record.id,
        projectId: record.projectId,
        title: "name" in record ? record.name : record.title,
      };
    }
  }
}

async function liveDocumentBlockSource(
  context: Context,
  accountId: string,
  directive: DocumentLiveDirective,
) {
  if (directive.kind === "Work") {
    return null;
  }
  if (directive.kind === "Document section") {
    if (!directive.sectionId) {
      return null;
    }
    return (
      (await context.documents?.getLiveSection?.(
        accountId,
        directive.id,
        directive.sectionId,
      )) ?? null
    );
  }
  if (directive.kind === "Smart Collection") {
    return (
      (await context.smartCollections?.getView(accountId, directive.id)) ?? null
    );
  }
  const diagram = await context.technicalDiagrams?.get(
    accountId,
    directive.id,
    directive.viewId,
  );
  if (!(diagram && directive.versionId)) {
    return diagram ?? null;
  }
  // An exact card reads its checkpoint, never the live model; a checkpoint
  // that is gone or foreign is a broken reference, not the live diagram.
  const version = await context.technicalDiagrams?.getVersion(
    accountId,
    directive.versionId,
  );
  return version ? pinDiagramToVersion(diagram, version) : null;
}

function rethrowFileAttachmentError(error: unknown): never {
  if (!isRecord(error) || typeof error.code !== "string") {
    throw error;
  }
  const message =
    typeof error.message === "string"
      ? error.message
      : "File Attachment request was rejected.";
  switch (error.code) {
    case "FILE_ATTACHMENT_IDEMPOTENCY_CONFLICT":
    case "FILE_ATTACHMENT_REVISION_CONFLICT":
      throw new ORPCError("CONFLICT", {
        data: { code: error.code },
        defined: true,
        message,
      });
    case "FILE_ATTACHMENT_ACCOUNT_NOT_FOUND":
    case "FILE_ATTACHMENT_TARGET_NOT_FOUND":
    case "FILE_ATTACHMENT_UPLOAD_NOT_FOUND":
      throw new ORPCError("NOT_FOUND", {
        cause: error,
        data: { code: error.code },
        defined: true,
        message,
      });
    case "FILE_ATTACHMENT_PREVIEW_UNAVAILABLE":
      throw new ORPCError("SERVICE_UNAVAILABLE", {
        data: { code: error.code },
        defined: true,
        message,
      });
    case "FILE_ATTACHMENT_QUOTA_EXCEEDED":
      throw new ORPCError("PRECONDITION_FAILED", {
        data: { code: error.code },
        defined: true,
        message,
      });
    default:
      if (error.code.startsWith("FILE_ATTACHMENT_")) {
        throw new ORPCError("BAD_REQUEST", {
          cause: error,
          data: { code: error.code },
          defined: true,
          message,
        });
      }
      throw error;
  }
}

function rethrowFileAttachmentWorkError(error: unknown): never {
  if (
    isRecord(error) &&
    typeof error.code === "string" &&
    error.code.startsWith("FILE_ATTACHMENT_")
  ) {
    rethrowFileAttachmentError(error);
  }
  rethrowWorkLifecycleError(error);
}

function requireCaptureInboxTriage(context: Context): CaptureInboxTriageAccess {
  const captureInbox = requireCaptureInbox(context);
  if (!isCaptureInboxTriage(captureInbox)) {
    throw new ORPCError("NOT_IMPLEMENTED", {
      data: { code: "CAPTURE_TRIAGE_UNAVAILABLE" },
      defined: true,
      message: "Capture triage is not available yet.",
    });
  }
  return captureInbox;
}

function isCaptureInboxTriage(
  captureInbox: CaptureInboxAccess,
): captureInbox is CaptureInboxTriageAccess {
  return (
    "attachToExisting" in captureInbox &&
    typeof captureInbox.attachToExisting === "function" &&
    "convert" in captureInbox &&
    typeof captureInbox.convert === "function" &&
    "delete" in captureInbox &&
    typeof captureInbox.delete === "function" &&
    "previewAttachToExisting" in captureInbox &&
    typeof captureInbox.previewAttachToExisting === "function" &&
    "previewConvert" in captureInbox &&
    typeof captureInbox.previewConvert === "function" &&
    "previewUndoMerge" in captureInbox &&
    typeof captureInbox.previewUndoMerge === "function" &&
    "suggestions" in captureInbox &&
    typeof captureInbox.suggestions === "function" &&
    "undoMerge" in captureInbox &&
    typeof captureInbox.undoMerge === "function"
  );
}

function rethrowUnavailableCaptureWorkCreate(
  error: Record<string, unknown>,
): void {
  if (
    error.code === "CAPTURE_WORK_CREATE_UNAVAILABLE" ||
    error.code === "CAPTURE_TRIAGE_UNAVAILABLE"
  ) {
    let message = "Work creation is not available yet.";
    if (error.code === "CAPTURE_TRIAGE_UNAVAILABLE") {
      message = "Capture triage is not available yet.";
    }
    const { message: errorMessage } = error;
    if (typeof errorMessage === "string") {
      message = errorMessage;
    }
    throw new ORPCError("NOT_IMPLEMENTED", {
      data: { code: error.code },
      defined: true,
      message,
    });
  }
}

function rethrowCaptureConflict(error: Record<string, unknown>): void {
  if (error.code === "CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: {
        code: "CONFLICT",
        label: MUTATION_UI_LABELS.conflict,
        ...(typeof error.targetId === "string"
          ? { targetId: error.targetId }
          : {}),
      },
      defined: true,
      message: MUTATION_UI_LABELS.conflict,
    });
  }
}

function rethrowCaptureInboxError(error: unknown): never {
  if (!isRecord(error)) {
    throw error;
  }

  rethrowUnavailableCaptureWorkCreate(error);
  rethrowCaptureConflict(error);

  if (
    typeof error.code === "string" &&
    (error.code.startsWith("CAPTURE_") ||
      error.code === "UNKNOWN_CAPTURE_FIELD")
  ) {
    throw new ORPCError("BAD_REQUEST", {
      data: { code: error.code },
      defined: true,
      message:
        "message" in error && typeof error.message === "string"
          ? error.message
          : "Capture Inbox request was rejected.",
    });
  }

  if (
    error.code === "PROJECT_REQUIRED_FOR_CREATE_BUG" ||
    error.code === "PROJECT_REQUIRED_FOR_WORK_CONVERSION" ||
    error.code === "CREATE_BUG_TEMPLATE_UNSUPPORTED"
  ) {
    throw new ORPCError("BAD_REQUEST", {
      data: { code: error.code },
      defined: true,
      message:
        "message" in error && typeof error.message === "string"
          ? error.message
          : "Create Bug is unavailable in this context.",
    });
  }

  if (error.code === "WORK_PROJECT_NOT_FOUND") {
    throw new ORPCError("BAD_REQUEST", {
      data: { code: error.code },
      defined: true,
      message: "Choose an available Project.",
    });
  }

  const workLifecycleError = mapWorkLifecycleError(error);
  if (workLifecycleError) {
    throw workLifecycleError;
  }

  throw error;
}

function mapWorkLifecycleFeatureError(error: Record<string, unknown>) {
  if (error.code === "WORK_FEATURE_EXIT_BLOCKED") {
    return new ORPCError("PRECONDITION_FAILED", {
      data: {
        code: error.code,
        ...(isRecord(error.blockers) ? { blockers: error.blockers } : {}),
      },
      defined: true,
      message:
        "Detach included Work, Feature health history, and Primary spec before leaving Feature.",
    });
  }

  return null;
}

function mapWorkLifecycleError(
  error: Record<string, unknown>,
): ORPCError<string, unknown> | null {
  if (error.code === "APPLY_FAILED") {
    return isRecord(error.cause) ? mapWorkLifecycleError(error.cause) : null;
  }

  switch (error.code) {
    case "WORK_NOT_FOUND":
      return new ORPCError("NOT_FOUND", {
        defined: true,
        message: "Work is unavailable.",
      });
    case "RESEARCH_DIRECTION_UNAVAILABLE":
      return new ORPCError("BAD_REQUEST", {
        defined: true,
        message: "Research direction belongs to Research Work.",
      });
    case "WORK_PROJECT_NOT_FOUND":
      return new ORPCError("NOT_FOUND", {
        defined: true,
        message: "Project is unavailable.",
      });
    case "WORK_CREATION_CONFLICT":
      return new ORPCError("CONFLICT", {
        data: { code: error.code },
        defined: true,
        message: "Work could not be created. Try again.",
      });
    case "WORK_PRIMARY_SPEC_NOT_FOUND":
      return new ORPCError("NOT_FOUND", {
        data: { code: error.code },
        defined: true,
        message: "Primary spec is unavailable.",
      });
    case "WORK_PRIMARY_SPEC_UNAVAILABLE":
      return new ORPCError("NOT_IMPLEMENTED", {
        data: { code: error.code },
        defined: true,
        message: "Primary spec is not available yet.",
      });
    case "WORK_TYPE_IMPACT_PREVIEW_REQUIRED":
      return new ORPCError("PRECONDITION_FAILED", {
        data: {
          code: error.code,
          ...(typeof error.previewId === "string"
            ? { previewId: error.previewId }
            : {}),
        },
        defined: true,
        message:
          "Impact preview is required before changing to or from Feature.",
      });
    case "WORK_RECREATE_PREVIEW_REQUIRED":
      return new ORPCError("PRECONDITION_FAILED", {
        data: { code: error.code },
        defined: true,
        message: "Review the current recreate preview before confirming.",
      });
    case "WORK_CHECKLIST_CONVERT_PREVIEW_REQUIRED":
      return new ORPCError("PRECONDITION_FAILED", {
        data: { code: error.code },
        defined: true,
        message:
          "Review the current checklist conversion preview before confirming.",
      });
    case "WORK_CHECKLIST_CONVERSION_REQUIRED":
      return new ORPCError("BAD_REQUEST", {
        data: { code: error.code },
        defined: true,
        message:
          "Converted checklist Work links can only be changed through conversion.",
      });
    case "WORK_CHECKLIST_ITEM_TITLE_TOO_LONG":
      return new ORPCError("BAD_REQUEST", {
        data: { code: error.code },
        defined: true,
        message:
          "Checklist item text is too long to become a Work title. Shorten the item text before converting.",
      });
    case "WORK_MERGE_PREVIEW_REQUIRED":
      return new ORPCError("PRECONDITION_FAILED", {
        data: { code: error.code },
        defined: true,
        message: "Review the current Merge Preview before confirming.",
      });
    case "WORK_MERGE_CONFLICT":
      return new ORPCError("CONFLICT", {
        data: { code: error.code },
        defined: true,
        message:
          typeof error.message === "string"
            ? error.message
            : "The selected Work merge is no longer available.",
      });
    case "WORK_MERGE_RESOLUTION_REQUIRED":
      return new ORPCError("BAD_REQUEST", {
        data: {
          code: error.code,
          ...(Array.isArray(error.fields) ? { fields: error.fields } : {}),
        },
        defined: true,
        message:
          typeof error.message === "string"
            ? error.message
            : "Resolve every Field conflict before confirming the merge.",
      });
    case "WORK_MERGE_UNSUPPORTED":
      return new ORPCError("BAD_REQUEST", {
        data: { code: error.code },
        defined: true,
        message:
          typeof error.message === "string"
            ? error.message
            : "This Work merge is not supported.",
      });
    case "WORK_MERGE_UNDO_UNAVAILABLE":
      return new ORPCError("CONFLICT", {
        data: { code: error.code },
        defined: true,
        message: "This Work merge is no longer available for Undo.",
      });
    case "WORK_STATUS_UNDO_UNAVAILABLE":
      return new ORPCError("CONFLICT", {
        data: { code: error.code },
        defined: true,
        message: "This Work status change is no longer available for Undo.",
      });
    case "WORK_DATE_UNDO_UNAVAILABLE":
      return new ORPCError("CONFLICT", {
        data: { code: error.code },
        defined: true,
        message: "This Work date change is no longer available for Undo.",
      });
    case "WORK_RELATION_NOT_PORTABLE":
    case "WORK_RECREATE_FIELD_REQUIRED":
      return new ORPCError("BAD_REQUEST", {
        data: { code: error.code },
        defined: true,
        message:
          typeof error.message === "string"
            ? error.message
            : "The recreate selection is unavailable.",
      });
    case "WORK_CLOSURE_RESULT_REQUIRED":
    case "WORK_CLOSURE_CHECK_REQUIRED":
    case "WORK_REOPEN_CONFIRMATION_REQUIRED":
    case "WORK_ALREADY_CLOSED":
    case "WORK_NOT_CLOSED":
    case "WORK_VISIBLE_USER_INITIATOR_REQUIRED":
      return mapWorkLifecyclePreconditionError(error);
    case "WORK_FEATURE_EXIT_BLOCKED":
      return mapWorkLifecycleFeatureError(error);
    case "WORK_INCLUSION_CONFLICT":
      return new ORPCError("CONFLICT", {
        data: { code: error.code },
        defined: true,
        message:
          typeof error.message === "string"
            ? error.message
            : "Work inclusion could not be changed.",
      });
    case "WORK_FEATURE_REQUIRED":
      return new ORPCError("BAD_REQUEST", {
        data: { code: error.code },
        defined: true,
        message: "This action is available only for Feature Work.",
      });
    case "CONFLICT":
      return new ORPCError("CONFLICT", {
        data: { code: error.code },
        defined: true,
        message: "Work could not be changed. Try again.",
      });
    case "STALE_BASE_REVISION":
      return mapWorkLifecycleStaleRevisionError(error);
    case "TARGET_NOT_FOUND":
      return new ORPCError("NOT_FOUND", {
        defined: true,
        message: "Work is unavailable.",
      });
    default:
      return null;
  }
}

function mapWorkLifecycleStaleRevisionError(
  error: Record<string, unknown>,
): ORPCError<string, unknown> {
  return new ORPCError("PRECONDITION_FAILED", {
    data: {
      code: error.code,
      ...(typeof error.currentRevision === "number"
        ? { currentRevision: error.currentRevision }
        : {}),
      ...(typeof error.currentValue === "object" && error.currentValue !== null
        ? { currentValue: error.currentValue }
        : {}),
    },
    defined: true,
    message: "Work has changed. Reload and try again.",
  });
}

function mapWorkLifecyclePreconditionError(
  error: Record<string, unknown>,
): ORPCError<string, unknown> {
  return new ORPCError("PRECONDITION_FAILED", {
    data: { code: error.code },
    defined: true,
    message:
      typeof error.message === "string"
        ? error.message
        : "The Work lifecycle precondition was not met.",
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function rethrowPreferenceMutationError<T>(
  error: unknown,
  targetId: string,
  schema: z.ZodType<T>,
): never {
  if (!isRecord(error)) {
    throw error;
  }

  const { code, currentRevision, currentValue: rawCurrentValue } = error;
  if (code === "CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: {
        code: "CONFLICT",
        label: MUTATION_UI_LABELS.conflict,
        targetId,
      },
      defined: true,
      message: MUTATION_UI_LABELS.conflict,
    });
  }

  if (code === "STALE_BASE_REVISION") {
    const currentValue = schema.safeParse(rawCurrentValue);
    if (
      typeof currentRevision === "number" &&
      Number.isSafeInteger(currentRevision) &&
      currentRevision >= 0 &&
      currentValue.success
    ) {
      throw new ORPCError("PRECONDITION_FAILED", {
        data: {
          code: "STALE_BASE_REVISION",
          currentRevision,
          currentValue: currentValue.data,
          label: MUTATION_UI_LABELS.currentValue,
          targetId,
        },
        defined: true,
        message: MUTATION_UI_LABELS.currentValue,
      });
    }
  }

  throw error;
}

async function mutateAccountPreferences<TPayload extends MutationPayload>(
  context: Context,
  command: MutationCommand<TPayload>,
  apply: MutationApply<AccountPreferences, TPayload>,
): Promise<MutationReceipt<AccountPreferences>> {
  try {
    return await requireAccountPreferencesMutationContract(context).mutate(
      command,
      apply,
    );
  } catch (error) {
    rethrowPreferenceMutationError(
      error,
      command.targetId,
      accountPreferencesSchema,
    );
  }
}

function preferencesSnapshotFromReceipt(
  receipt: MutationReceipt<AccountPreferences>,
): AccountPreferencesSnapshot {
  return {
    ...receipt.nextValue,
    isSaved: true,
    revision: receipt.revision,
    savedAt: receipt.committedAt,
  };
}

async function mutateCompletionEffectsPreferences<
  TPayload extends MutationPayload,
>(
  context: Context,
  command: MutationCommand<TPayload>,
  apply: MutationApply<CompletionEffectsPreferences, TPayload>,
): Promise<MutationReceipt<CompletionEffectsPreferences>> {
  try {
    return await requireCompletionEffectsPreferencesMutationContract(
      context,
    ).mutate(command, apply);
  } catch (error) {
    rethrowPreferenceMutationError(
      error,
      command.targetId,
      completionEffectsPreferencesSchema,
    );
  }
}

function completionEffectsPreferencesSnapshotFromReceipt(
  receipt: MutationReceipt<CompletionEffectsPreferences>,
): CompletionEffectsPreferencesSnapshot {
  return {
    ...receipt.nextValue,
    isSaved: true,
    revision: receipt.revision,
    savedAt: receipt.committedAt,
  };
}

function rethrowProjectShellError(error: unknown): never {
  if (!isRecord(error)) {
    throw error;
  }

  if (error.code === "SHORT_CODE_CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: {
        code: "SHORT_CODE_CONFLICT",
        label: "Short code is already used in this Workspace.",
      },
      defined: true,
      message: "Short code is already used in this Workspace.",
    });
  }

  if (error.code === "SHORT_CODE_LOCKED") {
    throw new ORPCError("PRECONDITION_FAILED", {
      data: {
        code: "SHORT_CODE_LOCKED",
        label: "Short code is locked after the first Work.",
      },
      defined: true,
      message: "Short code is locked after the first Work.",
    });
  }

  if (error.code === "WORKSPACE_NOT_FOUND") {
    throw new ORPCError("NOT_FOUND", {
      defined: true,
      message: "Workspace is unavailable.",
    });
  }

  if (error.code === "PROJECT_CONFIGURATION_CHANGE_REJECTED") {
    throw new ORPCError("BAD_REQUEST", {
      data: {
        code: error.code,
      },
      defined: true,
      message:
        typeof error.message === "string"
          ? error.message
          : "Project configuration change was rejected.",
    });
  }

  throw error;
}

function rethrowWorkLifecycleError(error: unknown): never {
  if (!isRecord(error)) {
    throw error;
  }

  const workLifecycleError = mapWorkLifecycleError(error);
  if (workLifecycleError) {
    throw workLifecycleError;
  }

  throw error;
}

function mapWorkDraftError(
  error: Record<string, unknown>,
): ORPCError<string, unknown> | null {
  switch (error.code) {
    case "WORK_DRAFT_NOT_FOUND":
      return new ORPCError("NOT_FOUND", {
        defined: true,
        message: "Draft is unavailable.",
      });
    case "WORK_DRAFT_PROJECT_NOT_FOUND":
      return new ORPCError("NOT_FOUND", {
        defined: true,
        message: "Project is unavailable.",
      });
    case "WORK_DRAFT_CONSUMED":
      return new ORPCError("CONFLICT", {
        data: { code: error.code },
        defined: true,
        message: "This Draft has already been created.",
      });
    case "WORK_DRAFT_FINALIZING":
      return new ORPCError("CONFLICT", {
        data: { code: error.code },
        defined: true,
        message: "This Draft is already being created.",
      });
    case "STALE_BASE_REVISION":
      return new ORPCError("PRECONDITION_FAILED", {
        data: {
          code: error.code,
          ...(typeof error.currentRevision === "number"
            ? { currentRevision: error.currentRevision }
            : {}),
          ...(isRecord(error.currentValue)
            ? { currentValue: error.currentValue }
            : {}),
        },
        defined: true,
        message: "Draft has changed. Reload and try again.",
      });
    case "TARGET_NOT_FOUND":
      return new ORPCError("NOT_FOUND", {
        defined: true,
        message: "Draft is unavailable.",
      });
    default:
      return mapWorkLifecycleError(error);
  }
}

function rethrowWorkDraftError(error: unknown): never {
  if (!isRecord(error)) {
    throw error;
  }

  const workDraftError = mapWorkDraftError(error);
  if (workDraftError) {
    throw workDraftError;
  }

  throw error;
}

async function runWorkDraftOperation<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    rethrowWorkDraftError(error);
  }
}

async function runWorkLifecycleOperation<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    rethrowWorkLifecycleError(error);
  }
}

function rethrowWorkNotNowError(error: unknown): never {
  if (!isRecord(error)) {
    throw error;
  }
  switch (error.code) {
    case "WORK_NOT_NOW_CONFLICT":
      throw new ORPCError("PRECONDITION_FAILED", {
        data: { code: error.code },
        defined: true,
        message:
          typeof error.message === "string"
            ? error.message
            : "Not now has changed. Reload and try again.",
      });
    case "WORK_NOT_NOW_GROUND_UNAVAILABLE":
      throw new ORPCError("CONFLICT", {
        data: { code: error.code },
        defined: true,
        message: "A selected supporting record is no longer available.",
      });
    default:
      throw error;
  }
}

async function runWorkNotNowOperation<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    rethrowWorkNotNowError(error);
  }
}

async function runPersonalReminderOperation<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (isRecord(error)) {
      if (
        error.code === "PERSONAL_REMINDER_FIRE_AT_MUST_BE_FUTURE" ||
        error.code === "WORK_REVIEW_LATER_FIRE_AT_MUST_BE_FUTURE"
      ) {
        throw new ORPCError("BAD_REQUEST", {
          cause: error,
          data: { code: error.code },
          defined: true,
          message: "Reminder must be scheduled for a future time.",
        });
      }
      if (
        error.code === "PERSONAL_REMINDER_IDEMPOTENCY_CONFLICT" ||
        error.code === "WORK_REVIEW_LATER_IDEMPOTENCY_CONFLICT"
      ) {
        throw new ORPCError("CONFLICT", {
          cause: error,
          data: { code: error.code },
          defined: true,
          message: "This reminder request key was already used.",
        });
      }
    }
    throw error;
  }
}

function mapRelationsError(error: Record<string, unknown>) {
  if (error.code === "APPLY_FAILED" && isRecord(error.cause)) {
    return mapRelationsError(error.cause);
  }

  switch (error.code) {
    case "RELATION_ENDPOINT_NOT_ALLOWED":
      return new ORPCError("BAD_REQUEST", {
        data: { code: error.code },
        defined: true,
        message: "The selected relation endpoints are not allowed.",
      });
    case "RELATION_RECORD_UNAVAILABLE":
      return new ORPCError("NOT_FOUND", {
        defined: true,
        message: "The selected record is unavailable.",
      });
    case "RELATION_DUPLICATE":
      return new ORPCError("CONFLICT", {
        data: { code: error.code },
        defined: true,
        message: "This relation already exists.",
      });
    case "BLOCKING_RELATION_STATE_CONFLICT":
      return new ORPCError("CONFLICT", {
        data: { code: error.code },
        defined: true,
        message: "The blocker has changed. Reload and try again.",
      });
    case "RELATION_CYCLE":
      return new ORPCError("BAD_REQUEST", {
        data: { code: error.code },
        defined: true,
        message: "This relation would create a cycle in the catalog.",
      });
    case "RELATION_PREVIEW_REQUIRED":
      return new ORPCError("PRECONDITION_FAILED", {
        data: { code: error.code },
        defined: true,
        message: "Review the current relation preview before confirming.",
      });
    case "RELATION_NOT_FOUND":
      return new ORPCError("NOT_FOUND", {
        defined: true,
        message: "The relation is unavailable.",
      });
    case "RELATION_UNDO_UNAVAILABLE":
      return new ORPCError("CONFLICT", {
        data: { code: error.code },
        defined: true,
        message: "This relation is no longer available for Undo.",
      });
    case "STALE_BASE_REVISION":
      return new ORPCError("PRECONDITION_FAILED", {
        data: { code: error.code },
        defined: true,
        message: "Relation has changed. Reload and try again.",
      });
    case "CONFLICT":
    case "MUTATION_CONFLICT":
      return new ORPCError("CONFLICT", {
        data: { code: error.code },
        defined: true,
        message: "The relation change could not be applied. Try again.",
      });
    default:
      return null;
  }
}

function rethrowRelationsError(error: unknown): never {
  if (!isRecord(error)) {
    throw error;
  }
  const mapped = mapRelationsError(error);
  if (mapped) {
    throw mapped;
  }
  throw error;
}

async function runRelationsOperation<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    rethrowRelationsError(error);
  }
}

function rethrowProjectShellMutationError(
  error: unknown,
  targetId: string,
): never {
  if (!isRecord(error)) {
    throw error;
  }

  const { code, currentRevision, currentValue: rawCurrentValue } = error;

  if (code === "CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: {
        code: "CONFLICT",
        label: MUTATION_UI_LABELS.conflict,
        targetId,
      },
      defined: true,
      message: MUTATION_UI_LABELS.conflict,
    });
  }

  if (code === "STALE_BASE_REVISION") {
    const currentValue =
      isRecord(rawCurrentValue) && "project" in rawCurrentValue
        ? rawCurrentValue.project
        : undefined;
    if (
      typeof currentRevision === "number" &&
      Number.isSafeInteger(currentRevision) &&
      currentRevision >= 0
    ) {
      throw new ORPCError("PRECONDITION_FAILED", {
        data: {
          code: "STALE_BASE_REVISION",
          currentRevision,
          ...(currentValue ? { currentValue } : {}),
          label: MUTATION_UI_LABELS.currentValue,
          targetId,
        },
        defined: true,
        message: MUTATION_UI_LABELS.currentValue,
      });
    }
  }

  if (code === "TARGET_NOT_FOUND") {
    throw new ORPCError("NOT_FOUND", {
      defined: true,
      message: "Project is unavailable.",
    });
  }

  if (code === "UNDO_NOT_SUPPORTED") {
    throw new ORPCError("BAD_REQUEST", {
      data: {
        code,
        targetId,
      },
      defined: true,
      message: "Work Context Card layout undo is not available.",
    });
  }

  rethrowProjectShellError(error);
}

function rethrowCustomFieldMutationError(
  error: unknown,
  targetId: string,
  {
    targetNotFoundMessage = "Custom field is unavailable.",
  }: { targetNotFoundMessage?: string } = {},
): never {
  if (!isRecord(error)) {
    throw error;
  }

  if (error.code === "APPLY_FAILED" && isRecord(error.cause)) {
    rethrowCustomFieldMutationError(error.cause, targetId, {
      targetNotFoundMessage,
    });
  }

  if (
    error.code === "CUSTOM_FIELD_PROJECT_NOT_FOUND" ||
    error.code === "TARGET_NOT_FOUND"
  ) {
    throw new ORPCError("NOT_FOUND", {
      defined: true,
      message: targetNotFoundMessage,
    });
  }

  if (error.code === "CUSTOM_FIELD_NOT_FOUND") {
    throw new ORPCError("NOT_FOUND", {
      defined: true,
      message: "Custom field is unavailable.",
    });
  }

  if (
    error.code === "CUSTOM_FIELD_TRASHED" ||
    error.code === "CUSTOM_FIELD_NOT_TRASHED" ||
    error.code === "CUSTOM_FIELD_RECORD_TYPE_NOT_BOUND" ||
    error.code === "CUSTOM_FIELD_VALUE_TYPE_MISMATCH" ||
    error.code === "CUSTOM_FIELD_OPTION_INVALID" ||
    error.code === "CUSTOM_FIELD_OPTIONS_NOT_SUPPORTED" ||
    error.code === "CUSTOM_FIELD_OPTIONS_REQUIRED"
  ) {
    throw new ORPCError("BAD_REQUEST", {
      data: { code: error.code },
      defined: true,
      message:
        typeof error.message === "string"
          ? error.message
          : "The request was rejected.",
    });
  }

  if (error.code === "CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { code: error.code, targetId },
      defined: true,
      message: MUTATION_UI_LABELS.conflict,
    });
  }

  if (error.code === "CUSTOM_FIELD_NAME_CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { code: error.code },
      defined: true,
      message:
        typeof error.message === "string"
          ? error.message
          : "A Custom field with this name already exists in this Project.",
    });
  }

  if (error.code === "STALE_BASE_REVISION") {
    throw new ORPCError("PRECONDITION_FAILED", {
      data: {
        code: error.code,
        ...(typeof error.currentRevision === "number"
          ? { currentRevision: error.currentRevision }
          : {}),
        label: MUTATION_UI_LABELS.currentValue,
        targetId,
      },
      defined: true,
      message: MUTATION_UI_LABELS.currentValue,
    });
  }

  throw error;
}

function rethrowPriorityMetricMutationError(
  error: unknown,
  targetId: string,
): never {
  if (!isRecord(error)) {
    throw error;
  }
  if (error.code === "APPLY_FAILED" && isRecord(error.cause)) {
    rethrowPriorityMetricMutationError(error.cause, targetId);
  }
  if (
    error.code === "PRIORITY_METRIC_PROJECT_NOT_FOUND" ||
    error.code === "PRIORITY_METRIC_NOT_FOUND" ||
    error.code === "PRIORITY_METRIC_WORK_NOT_FOUND" ||
    error.code === "TARGET_NOT_FOUND"
  ) {
    throw new ORPCError("NOT_FOUND", {
      defined: true,
      message: "Priority metric or Work is unavailable.",
    });
  }
  if (error.code === "PRIORITY_METRIC_NAME_CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { code: error.code, targetId },
      defined: true,
      message:
        "A Priority metric with this name already exists in this Project.",
    });
  }
  if (error.code === "PRIORITY_METRIC_NOT_TRASHED") {
    throw new ORPCError("BAD_REQUEST", {
      data: { code: error.code, targetId },
      defined: true,
      message: "Only a Priority metric in Trash can be restored or deleted.",
    });
  }
  if (
    error.code === "23505" &&
    (error.constraint === "priority_metric_definition_project_name_uidx" ||
      error.constraint_name === "priority_metric_definition_project_name_uidx")
  ) {
    throw new ORPCError("CONFLICT", {
      data: { targetId },
      defined: true,
      message:
        "A Priority metric with this name already exists in this Project.",
    });
  }
  if (error.code === "23505") {
    throw new ORPCError("CONFLICT", {
      data: { targetId },
      defined: true,
      message: MUTATION_UI_LABELS.currentValue,
    });
  }
  if (
    error.code === "PRIORITY_METRIC_TRASHED" ||
    error.code === "PRIORITY_METRIC_PROJECT_MISMATCH" ||
    error.code === "PRIORITY_METRIC_DISABLED"
  ) {
    throw new ORPCError("BAD_REQUEST", {
      data: { code: error.code, targetId },
      defined: true,
      message: "This Priority metric is unavailable for Work values.",
    });
  }
  if (error.code === "CONFLICT" || error.code === "REVISION_CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { targetId },
      defined: true,
      message: MUTATION_UI_LABELS.currentValue,
    });
  }
  throw error;
}

function rethrowBacklogMutationError(error: unknown, targetId: string): never {
  if (!isRecord(error)) {
    throw error;
  }
  if (error.code === "APPLY_FAILED" && isRecord(error.cause)) {
    rethrowBacklogMutationError(error.cause, targetId);
  }
  if (error.code === "TARGET_NOT_FOUND") {
    throw new ORPCError("NOT_FOUND", {
      defined: true,
      message: "The Project Backlog is unavailable.",
    });
  }
  if (error.code === "BACKLOG_ORDER_MISMATCH") {
    throw new ORPCError("BAD_REQUEST", {
      data: { code: error.code, targetId },
      defined: true,
      message: "The Backlog changed. Reload it before reordering Work.",
    });
  }
  if (error.code === "CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { code: error.code, targetId },
      defined: true,
      message: MUTATION_UI_LABELS.conflict,
    });
  }
  throw error;
}

function rethrowPrioritizationSessionMutationError(
  error: unknown,
  targetId: string,
): never {
  if (!isRecord(error)) {
    throw error;
  }
  if (error.code === "APPLY_FAILED" && isRecord(error.cause)) {
    rethrowPrioritizationSessionMutationError(error.cause, targetId);
  }
  if (
    error.code === "PRIORITIZATION_SESSION_PROJECT_NOT_FOUND" ||
    error.code === "PRIORITIZATION_SESSION_WORK_NOT_FOUND" ||
    error.code === "TARGET_NOT_FOUND"
  ) {
    throw new ORPCError("NOT_FOUND", {
      defined: true,
      message: "The Prioritization session or its Work is unavailable.",
    });
  }
  if (
    error.code === "PRIORITIZATION_SESSION_CLOSED" ||
    error.code === "PRIORITIZATION_SESSION_TRASHED" ||
    error.code === "PRIORITIZATION_SESSION_NOT_TRASHED"
  ) {
    throw new ORPCError("BAD_REQUEST", {
      data: { code: error.code, targetId },
      defined: true,
      message:
        typeof error.message === "string"
          ? error.message
          : "The Prioritization session cannot be changed in its current state.",
    });
  }
  if (error.code === "CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { code: error.code, targetId },
      defined: true,
      message: MUTATION_UI_LABELS.conflict,
    });
  }
  throw error;
}

function rethrowMoodboardMutationError(
  error: unknown,
  targetId: string,
): never {
  if (!isRecord(error)) {
    throw error;
  }
  if (error.code === "APPLY_FAILED" && isRecord(error.cause)) {
    rethrowMoodboardMutationError(error.cause, targetId);
  }
  if (
    error.code === "MOODBOARD_PALETTE_GROUP_NOT_FOUND" ||
    error.code === "MOODBOARD_PROJECT_NOT_FOUND" ||
    error.code === "MOODBOARD_SWATCH_NOT_FOUND" ||
    error.code === "MOODBOARD_VISUAL_NOT_FOUND" ||
    error.code === "TARGET_NOT_FOUND"
  ) {
    throw new ORPCError("NOT_FOUND", {
      defined: true,
      message: "The Moodboard is unavailable.",
    });
  }
  if (error.code === "MOODBOARD_ORIGIN_UNAVAILABLE") {
    throw new ORPCError("BAD_REQUEST", {
      data: { code: error.code, targetId },
      defined: true,
      message:
        typeof error.message === "string"
          ? error.message
          : "The visual origin is unavailable.",
    });
  }
  if (error.code === "CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { code: error.code, targetId },
      defined: true,
      message: MUTATION_UI_LABELS.conflict,
    });
  }
  throw error;
}

function requireMoodboardSnapshots(context: Context) {
  if (!context.moodboardSnapshots) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.moodboardSnapshots;
}

function rethrowMoodboardSnapshotError(error: unknown): never {
  if (error instanceof MoodboardSnapshotError) {
    throw new ORPCError("BAD_REQUEST", {
      data: { code: error.code },
      defined: true,
      message: error.message,
    });
  }
  throw error;
}

function requireMoodboardPersonalViews(context: Context) {
  if (!context.moodboardPersonalViews) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.moodboardPersonalViews;
}

function requireMoodboards(context: Context) {
  if (!context.moodboards) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.moodboards;
}

function requireMoodboardMutationContracts(context: Context) {
  if (!context.moodboardMutationContracts) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.moodboardMutationContracts;
}

function rethrowTagError(error: unknown): never {
  if (!isRecord(error)) {
    throw error;
  }
  if (error.code === "TAG_NAME_CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { code: error.code },
      defined: true,
      message:
        typeof error.message === "string"
          ? error.message
          : "A Tag with this name already exists in this Workspace.",
    });
  }

  if (error.code === "TAG_REVISION_CONFLICT") {
    throw new ORPCError("PRECONDITION_FAILED", {
      data: { code: error.code },
      defined: true,
      message: "Tag changed since it was loaded. Reload before renaming it.",
    });
  }

  if (
    error.code === "TAG_NOT_FOUND" ||
    error.code === "TAG_PROJECT_NOT_FOUND" ||
    error.code === "TAG_RECORD_NOT_FOUND" ||
    error.code === "TAG_WORKSPACE_NOT_FOUND"
  ) {
    throw new ORPCError("NOT_FOUND", {
      data: { code: error.code },
      defined: true,
      message: tagUnavailableMessage(error.code),
    });
  }

  throw error;
}

function rethrowTagMutationError(error: unknown, targetId: string): never {
  if (!isRecord(error)) {
    throw error;
  }
  if (error.code === "APPLY_FAILED" && isRecord(error.cause)) {
    rethrowTagMutationError(error.cause, targetId);
  }
  if (error.code === "TAG_NAME_CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { code: error.code },
      defined: true,
      message:
        typeof error.message === "string"
          ? error.message
          : "A Tag with this name already exists in this Workspace.",
    });
  }
  if (error.code === "STALE_BASE_REVISION") {
    throw new ORPCError("PRECONDITION_FAILED", {
      data: {
        code: error.code,
        ...(typeof error.currentRevision === "number"
          ? { currentRevision: error.currentRevision }
          : {}),
        label: MUTATION_UI_LABELS.currentValue,
        targetId,
      },
      defined: true,
      message: MUTATION_UI_LABELS.currentValue,
    });
  }
  if (
    error.code === "TAG_NOT_FOUND" ||
    error.code === "TAG_WORKSPACE_NOT_FOUND" ||
    error.code === "TARGET_NOT_FOUND"
  ) {
    throw new ORPCError("NOT_FOUND", {
      data: { code: error.code },
      defined: true,
      message: "Tag is unavailable.",
    });
  }
  if (error.code === "CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { code: error.code, targetId, label: MUTATION_UI_LABELS.conflict },
      defined: true,
      message: MUTATION_UI_LABELS.conflict,
    });
  }
  if (error.code === "UNDO_NOT_SUPPORTED") {
    throw new ORPCError("CONFLICT", {
      data: { code: error.code, targetId },
      defined: true,
      message: "Tag rename could not be undone safely.",
    });
  }
  throw error;
}

function rethrowUsageLinkMutationError(
  error: unknown,
  targetId: string,
): never {
  if (!isRecord(error)) {
    throw error;
  }

  if (error.code === "APPLY_FAILED" && isRecord(error.cause)) {
    rethrowUsageLinkMutationError(error.cause, targetId);
  }

  if (error.code === "TARGET_NOT_FOUND") {
    throw new ORPCError("NOT_FOUND", {
      defined: true,
      message: "Usage link is unavailable.",
    });
  }

  if (error.code === "CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { code: error.code, targetId },
      defined: true,
      message: MUTATION_UI_LABELS.conflict,
    });
  }

  if (error.code === "STALE_BASE_REVISION") {
    throw new ORPCError("PRECONDITION_FAILED", {
      data: {
        code: error.code,
        ...(isRecord(error.currentValue)
          ? { currentValue: error.currentValue }
          : {}),
        ...(typeof error.currentRevision === "number"
          ? { currentRevision: error.currentRevision }
          : {}),
        label: MUTATION_UI_LABELS.currentValue,
        targetId,
      },
      defined: true,
      message: MUTATION_UI_LABELS.currentValue,
    });
  }

  throw error;
}

function rethrowDocumentMutationError(error: unknown, targetId: string): never {
  if (error instanceof DocumentTransferError) {
    throw new ORPCError("BAD_REQUEST", {
      message: error.message,
      cause: error,
    });
  }
  if (error instanceof DocumentConflictDraftError) {
    throw new ORPCError("CONFLICT", { defined: true, message: error.message });
  }
  if (error instanceof DocumentUnavailableError) {
    throw new ORPCError("NOT_FOUND", { cause: error });
  }
  if (error instanceof DocumentHierarchyError) {
    throw new ORPCError("BAD_REQUEST", {
      message: error.message,
      cause: error,
    });
  }
  if (error instanceof DocumentSectionCycleError) {
    throw new ORPCError("CONFLICT", {
      defined: true,
      message: error.message,
    });
  }
  if (!isRecord(error)) {
    throw error;
  }

  if (error.code === "APPLY_FAILED" && isRecord(error.cause)) {
    rethrowDocumentMutationError(error.cause, targetId);
  }

  if (error.code === "TARGET_NOT_FOUND") {
    throw new ORPCError("NOT_FOUND", {
      defined: true,
      message: "Document or Project is unavailable.",
    });
  }

  if (error.code === "CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { code: error.code, targetId, label: MUTATION_UI_LABELS.conflict },
      defined: true,
      message: MUTATION_UI_LABELS.conflict,
    });
  }

  if (error.code === "STALE_BASE_REVISION") {
    throw new ORPCError("PRECONDITION_FAILED", {
      data: {
        code: error.code,
        ...(isRecord(error.currentValue)
          ? { currentValue: error.currentValue }
          : {}),
        ...(typeof error.currentRevision === "number"
          ? { currentRevision: error.currentRevision }
          : {}),
        label: MUTATION_UI_LABELS.currentValue,
        targetId,
      },
      defined: true,
      message: MUTATION_UI_LABELS.currentValue,
    });
  }

  throw error;
}

const UNDO_MERGE_PRECONDITION_MESSAGES: Record<string, string> = {
  CONTACT_MERGE_UNDO_BLOCKED:
    "The surviving Contact was merged away. Undo that merge first.",
  CONTACT_MERGE_UNDO_CONFLICT:
    "Undo Merge needs a decision. Review the Undo Merge Preview and try again.",
  CONTACT_MERGE_UNDO_PAYLOAD_CHANGED:
    "Undo Merge was already confirmed with a different answer. Review the Undo Merge Preview.",
};

const CONTACT_UNAVAILABLE_MESSAGES: Record<string, string> = {
  COMPANY_NOT_FOUND: "Company is unavailable.",
  CONTACT_FEEDBACK_NOT_FOUND: "Feedback is unavailable.",
  CONTACT_MERGE_NOT_FOUND: "Merge is unavailable.",
  CONTACT_NOT_FOUND: "Contact is unavailable.",
  CONTACT_PERSONA_DOCUMENT_NOT_FOUND: "Persona Document is unavailable.",
  CONTACT_WORKSPACE_NOT_FOUND: "Workspace is unavailable.",
};

const FEEDBACK_UNAVAILABLE_MESSAGES: Record<string, string> = {
  FEEDBACK_NOT_FOUND: "Feedback is unavailable.",
  FEEDBACK_PROJECT_NOT_FOUND: "Project is unavailable.",
};

const FEEDBACK_REJECTED_MESSAGES: Record<string, string> = {
  FEEDBACK_IDENTITY_UNAVAILABLE:
    "The Contact or Company is not available in this Workspace.",
  FEEDBACK_ATTACHMENT_UNAVAILABLE:
    "An attachment is not an active File Attachment of this Project.",
  FEEDBACK_PROJECT_READ_ONLY: "Archived Projects are read-only.",
};

async function runFeedbackOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isRecord(error) || typeof error.code !== "string") {
      throw error;
    }
    if (error.code === "FEEDBACK_CONVERSION_STALE") {
      throw new ORPCError("CONFLICT", {
        cause: error,
        data: { code: error.code, label: MUTATION_UI_LABELS.conflict },
        defined: true,
        message: "Feedback changed since the preview. Preview again.",
      });
    }
    if (error.code === "FEEDBACK_REVISION_CONFLICT") {
      throw new ORPCError("PRECONDITION_FAILED", {
        cause: error,
        data: { code: error.code },
        defined: true,
        message: "Feedback changed since it was loaded. Reload and try again.",
      });
    }
    const rejected = FEEDBACK_REJECTED_MESSAGES[error.code];
    if (rejected) {
      throw new ORPCError("BAD_REQUEST", {
        cause: error,
        data: { code: error.code },
        defined: true,
        message: rejected,
      });
    }
    const message = FEEDBACK_UNAVAILABLE_MESSAGES[error.code];
    if (message) {
      throw new ORPCError("NOT_FOUND", {
        cause: error,
        data: { code: error.code },
        defined: true,
        message,
      });
    }
    throw error;
  }
}

const SCREEN_UNAVAILABLE_MESSAGES: Record<string, string> = {
  SCREEN_LINKED_BLOCK_NOT_FOUND: "Linked block is unavailable.",
  SCREEN_NOT_FOUND: "Screen is unavailable.",
  SCREEN_PROJECT_NOT_FOUND: "Project is unavailable.",
  SCREEN_TEMPLATE_NOT_FOUND: "Wireframe template is unavailable.",
  SCREEN_VERSION_NOT_FOUND: "Wireframe version is unavailable.",
};

const SCREEN_REJECTED_MESSAGES: Record<string, string> = {
  SCREEN_CONVERSION_STALE:
    "The block or Wireframe version changed since the preview. Preview again.",
  SCREEN_LIFECYCLE_INVALID:
    "That action does not apply to this Screen in its current state.",
  SCREEN_PROJECT_READ_ONLY: "Archived Projects are read-only.",
};

async function runScreenOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isRecord(error) || typeof error.code !== "string") {
      throw error;
    }
    if (error.code === "SCREEN_REVISION_CONFLICT") {
      throw new ORPCError("PRECONDITION_FAILED", {
        cause: error,
        data: { code: error.code },
        defined: true,
        message: "Screen changed since it was loaded. Reload and try again.",
      });
    }
    if (error instanceof WireframeDocumentError) {
      throw new ORPCError("BAD_REQUEST", {
        cause: error,
        data: { code: error.code },
        defined: true,
        message: error.message,
      });
    }
    const rejected = SCREEN_REJECTED_MESSAGES[error.code];
    if (rejected) {
      throw new ORPCError("BAD_REQUEST", {
        cause: error,
        data: { code: error.code },
        defined: true,
        message: rejected,
      });
    }
    const message = SCREEN_UNAVAILABLE_MESSAGES[error.code];
    if (message) {
      throw new ORPCError("NOT_FOUND", {
        cause: error,
        data: { code: error.code },
        defined: true,
        message,
      });
    }
    throw error;
  }
}

interface PlannedTestFailure {
  /** `null` passes the error's own message, which names a section and kind only, never a value. */
  message: string | null;
  status: "BAD_REQUEST" | "NOT_FOUND" | "PRECONDITION_FAILED";
}

const PLANNED_TEST_FAILURES: Record<string, PlannedTestFailure> = {
  PLANNED_TEST_CASE_NOT_FOUND: {
    message: "Planned Test Case is unavailable.",
    status: "NOT_FOUND",
  },
  PLANNED_TEST_NO_CHANGE: {
    message:
      "Nothing changed. Change the Planned Test Case before saving a new version.",
    status: "BAD_REQUEST",
  },
  PLANNED_TEST_PROJECT_NOT_FOUND: {
    message: "Project is unavailable.",
    status: "NOT_FOUND",
  },
  PLANNED_TEST_PROJECT_READ_ONLY: {
    message: "Archived Projects are read-only.",
    status: "BAD_REQUEST",
  },
  PLANNED_TEST_RELATION_TARGET_UNAVAILABLE: {
    message:
      "A relation target is not an existing, active record of this Project.",
    status: "BAD_REQUEST",
  },
  PLANNED_TEST_VERSION_CONFLICT: {
    message:
      "Planned Test Case changed since it was loaded. Reload and try again.",
    status: "PRECONDITION_FAILED",
  },
  PLANNED_TEST_VERSION_NOT_FOUND: {
    message: "Planned Test Case version is unavailable.",
    status: "NOT_FOUND",
  },
  SESSION_TEST_ALREADY_BOUND: {
    message:
      "This Session Test is already bound to a Planned Test Case version. A bind does not move.",
    status: "BAD_REQUEST",
  },
  SESSION_TEST_ALREADY_IN_HANDOFF: {
    message: "This Session Test already arrived on a Test Handoff.",
    status: "BAD_REQUEST",
  },
  SESSION_TEST_NOT_FOUND: {
    message: "Session Test is unavailable.",
    status: "NOT_FOUND",
  },
  TEST_HANDOFF_LOCKED: {
    message:
      "A shared Test Handoff is history. Open a new Test Handoff instead of rewriting it.",
    status: "BAD_REQUEST",
  },
  TEST_HANDOFF_NOT_FOUND: {
    message: "Test Handoff is unavailable.",
    status: "NOT_FOUND",
  },
  TEST_HANDOFF_PACKAGE_BLOCKED: { message: null, status: "BAD_REQUEST" },
  TEST_HANDOFF_PACKAGE_STALE: {
    message: "The package changed since the preview. Preview it again.",
    status: "PRECONDITION_FAILED",
  },
  TEST_HANDOFF_PACKAGE_STATE: { message: null, status: "BAD_REQUEST" },
  TEST_HANDOFF_SCOPE_MISMATCH: {
    message:
      "This Session Test is bound to a Planned Test Case version the Test Handoff did not select.",
    status: "BAD_REQUEST",
  },
  TEST_HANDOFF_STATE_CONFLICT: {
    message: "Test Handoff changed since it was loaded. Reload and try again.",
    status: "PRECONDITION_FAILED",
  },
  TEST_HANDOFF_TRANSITION_NOT_ALLOWED: {
    message: "A Test Handoff cannot move to that state from here.",
    status: "BAD_REQUEST",
  },
};

const TEST_ASSESSMENT_FAILURES: Record<string, PlannedTestFailure> = {
  TEST_ASSESSMENT_CONTEXT_UNAVAILABLE: {
    message: "The chosen context is not an available record of this Project.",
    status: "BAD_REQUEST",
  },
  TEST_ASSESSMENT_PROJECT_NOT_FOUND: {
    message: "Project is unavailable.",
    status: "NOT_FOUND",
  },
  TEST_ASSESSMENT_PROJECT_READ_ONLY: {
    message: "Archived Projects are read-only.",
    status: "BAD_REQUEST",
  },
  TEST_ASSESSMENT_SOURCE_UNAVAILABLE: { message: null, status: "BAD_REQUEST" },
};

const PROJECT_HISTORY_FAILURES: Record<string, PlannedTestFailure> = {
  PROJECT_HISTORY_PROJECT_NOT_FOUND: {
    message: "Project is unavailable.",
    status: "NOT_FOUND",
  },
  PROJECT_HISTORY_WORK_NOT_FEATURE: {
    message: "Only a Feature has its own story.",
    status: "BAD_REQUEST",
  },
  PROJECT_HISTORY_WORK_NOT_FOUND: {
    message: "Work is unavailable.",
    status: "NOT_FOUND",
  },
  PROJECT_ACTIVITY_PROJECT_NOT_FOUND: {
    message: "Project is unavailable.",
    status: "NOT_FOUND",
  },
};

const ATTENTION_SIGNAL_FAILURES: Record<string, PlannedTestFailure> = {
  ATTENTION_FOLLOW_UP_ATTEMPT_CONFLICT: {
    message: null,
    status: "PRECONDITION_FAILED",
  },
  ATTENTION_FOLLOW_UP_PROJECT_REQUIRED: {
    message: null,
    status: "BAD_REQUEST",
  },
  ATTENTION_FOLLOW_UP_PROJECT_UNAVAILABLE: {
    message: "Project is unavailable.",
    status: "NOT_FOUND",
  },
  ATTENTION_FOLLOW_UP_STALE: { message: null, status: "PRECONDITION_FAILED" },
  PUBLIC_ROADMAP_REVIEW_PROJECT_NOT_FOUND: {
    message: "Project is unavailable.",
    status: "NOT_FOUND",
  },
  PUBLIC_ROADMAP_REVIEW_PROJECT_READ_ONLY: {
    message: "Archived Projects are read-only.",
    status: "BAD_REQUEST",
  },
  ATTENTION_SIGNAL_NOT_FOUND: {
    message: "Notification is unavailable.",
    status: "NOT_FOUND",
  },
};

const PROJECT_CLOSURE_SUMMARY_FAILURES: Record<string, PlannedTestFailure> = {
  PROJECT_CLOSURE_SUMMARY_PROJECT_NOT_CLOSED: {
    message: "The Project is neither completed nor abandoned.",
    status: "PRECONDITION_FAILED",
  },
  PROJECT_CLOSURE_SUMMARY_PROJECT_NOT_FOUND: {
    message: "Project is unavailable.",
    status: "NOT_FOUND",
  },
  PROJECT_CLOSURE_SUMMARY_SOURCE_NOT_FOUND: {
    message: "A selected source is unavailable.",
    status: "BAD_REQUEST",
  },
};

const RELEASE_EVIDENCE_FAILURES: Record<string, PlannedTestFailure> = {
  RELEASE_EVIDENCE_CHECKLIST_FULL: { message: null, status: "BAD_REQUEST" },
  RELEASE_EVIDENCE_CHECKLIST_ITEM_NOT_FOUND: {
    message: "Checklist item is unavailable.",
    status: "NOT_FOUND",
  },
  RELEASE_EVIDENCE_PROJECT_NOT_FOUND: {
    message: "Project is unavailable.",
    status: "NOT_FOUND",
  },
  RELEASE_EVIDENCE_PROJECT_READ_ONLY: {
    message: "Archived Projects are read-only.",
    status: "BAD_REQUEST",
  },
  RELEASE_EVIDENCE_RELEASE_NOT_FOUND: {
    message: "Project Release is unavailable.",
    status: "NOT_FOUND",
  },
};

interface GitHubIntegrationFailure {
  message: string | null;
  status: "BAD_REQUEST" | "CONFLICT" | "NOT_FOUND" | "PRECONDITION_FAILED";
}

const GITHUB_INTEGRATION_FAILURES: Record<string, GitHubIntegrationFailure> = {
  GITHUB_APP_NOT_CONFIGURED: { message: null, status: "PRECONDITION_FAILED" },
  GITHUB_INSTALL_STATE_INVALID: { message: null, status: "BAD_REQUEST" },
  GITHUB_INSTALLATION_CLAIMED: { message: null, status: "CONFLICT" },
  GITHUB_INSTALLATION_NOT_FOUND: { message: null, status: "NOT_FOUND" },
  GITHUB_INSTALLATION_REMOVED: { message: null, status: "PRECONDITION_FAILED" },
  GITHUB_INSTALLATION_UNCLAIMABLE: {
    message: null,
    status: "PRECONDITION_FAILED",
  },
  GITHUB_LINK_NOT_FOUND: { message: null, status: "NOT_FOUND" },
  GITHUB_PROJECT_NOT_FOUND: {
    message: "Project is unavailable.",
    status: "NOT_FOUND",
  },
  GITHUB_PROJECT_READ_ONLY: {
    message: "Archived Projects are read-only.",
    status: "BAD_REQUEST",
  },
  GITHUB_REPOSITORY_UNAVAILABLE: {
    message: null,
    status: "PRECONDITION_FAILED",
  },
  GITHUB_SIGNAL_NOT_FOUND: { message: null, status: "NOT_FOUND" },
  GITHUB_UNAVAILABLE: {
    message: null,
    status: "PRECONDITION_FAILED",
  },
  GITHUB_WORK_LINK_EXISTS: { message: null, status: "CONFLICT" },
  GITHUB_WORK_LINK_NOT_FOUND: { message: null, status: "NOT_FOUND" },
  GITHUB_WORK_LINK_ROLE_INVALID: { message: null, status: "BAD_REQUEST" },
  GITHUB_WORK_LINK_TARGET_UNAVAILABLE: {
    message: null,
    status: "PRECONDITION_FAILED",
  },
  GITHUB_WORK_NOT_FOUND: { message: null, status: "NOT_FOUND" },
};

async function runGitHubIntegrationOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isRecord(error) || typeof error.code !== "string") {
      throw error;
    }
    const failure = Object.hasOwn(GITHUB_INTEGRATION_FAILURES, error.code)
      ? GITHUB_INTEGRATION_FAILURES[error.code]
      : undefined;
    if (!failure) {
      throw error;
    }
    throw new ORPCError(failure.status, {
      cause: error,
      data: { code: error.code },
      defined: true,
      message:
        failure.message ??
        (error instanceof Error ? error.message : "Request refused."),
    });
  }
}

async function runTestAssessmentOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isRecord(error) || typeof error.code !== "string") {
      throw error;
    }
    const failure = Object.hasOwn(TEST_ASSESSMENT_FAILURES, error.code)
      ? TEST_ASSESSMENT_FAILURES[error.code]
      : undefined;
    if (!failure) {
      throw error;
    }
    throw new ORPCError(failure.status, {
      cause: error,
      data: { code: error.code },
      defined: true,
      message:
        failure.message ??
        (error instanceof Error ? error.message : "Request refused."),
    });
  }
}

async function runProjectHistoryOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isRecord(error) || typeof error.code !== "string") {
      throw error;
    }
    const failure = Object.hasOwn(PROJECT_HISTORY_FAILURES, error.code)
      ? PROJECT_HISTORY_FAILURES[error.code]
      : undefined;
    if (!failure) {
      throw error;
    }
    throw new ORPCError(failure.status, {
      cause: error,
      data: { code: error.code },
      defined: true,
      message:
        failure.message ??
        (error instanceof Error ? error.message : "Request refused."),
    });
  }
}

async function runAttentionSignalOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isRecord(error) || typeof error.code !== "string") {
      throw error;
    }
    const failure = Object.hasOwn(ATTENTION_SIGNAL_FAILURES, error.code)
      ? ATTENTION_SIGNAL_FAILURES[error.code]
      : undefined;
    if (!failure) {
      throw error;
    }
    throw new ORPCError(failure.status, {
      cause: error,
      data: { code: error.code },
      defined: true,
      message:
        failure.message ??
        (error instanceof Error ? error.message : "Request refused."),
    });
  }
}

/**
 * Explicit `Save as Document`: the Documents create path of the Mutation
 * Contract writes one `General` Project Document in the source Project (its
 * Kökeni). The closure module only checks that the Project is completed or
 * abandoned; it writes nothing, and no Project, source record or lifecycle
 * status is touched.
 */
async function saveProjectClosureSummaryDocument(
  context: Context & { session: NonNullable<Context["session"]> },
  input: z.infer<typeof saveClosureSummaryInputSchema>,
) {
  const accountId = context.session.user.id;
  const { baseRevision, clientIdempotencyKey, ...fields } = input;
  await runProjectClosureSummaryOperation(() =>
    requireProjectClosureSummary(context).saveTarget(
      accountId,
      input.projectId,
    ),
  );
  const payload = createDocumentInputSchema.parse({
    ...fields,
    type: CLOSURE_SUMMARY_DOCUMENT_TYPE,
  });
  const mutation = requireDocumentMutationContracts(context).create(accountId);
  try {
    const receipt = await mutation.mutate(
      {
        actor: { actorId: accountId, type: "User" },
        baseRevision,
        clientIdempotencyKey,
        kind: "human",
        payload,
        targetId: clientIdempotencyKey,
      },
      ({ committedAt, currentRevision }) =>
        ({
          document: documentSchema.parse({
            ...payload,
            createdAt: committedAt,
            id: crypto.randomUUID(),
            revision: currentRevision + 1,
            updatedAt: committedAt,
          }),
        }) satisfies DocumentMutationValue,
    );
    if (!receipt.nextValue.document) {
      throw new ORPCError("NOT_FOUND");
    }
    return receipt.nextValue.document;
  } catch (error) {
    rethrowDocumentMutationError(error, clientIdempotencyKey);
  }
}

async function runProjectClosureSummaryOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isRecord(error) || typeof error.code !== "string") {
      throw error;
    }
    const failure = Object.hasOwn(PROJECT_CLOSURE_SUMMARY_FAILURES, error.code)
      ? PROJECT_CLOSURE_SUMMARY_FAILURES[error.code]
      : undefined;
    if (!failure) {
      throw error;
    }
    throw new ORPCError(failure.status, {
      cause: error,
      data: { code: error.code },
      defined: true,
      message:
        failure.message ??
        (error instanceof Error ? error.message : "Request refused."),
    });
  }
}

async function runReleaseEvidenceOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isRecord(error) || typeof error.code !== "string") {
      throw error;
    }
    const failure = Object.hasOwn(RELEASE_EVIDENCE_FAILURES, error.code)
      ? RELEASE_EVIDENCE_FAILURES[error.code]
      : undefined;
    if (!failure) {
      throw error;
    }
    throw new ORPCError(failure.status, {
      cause: error,
      data: { code: error.code },
      defined: true,
      message:
        failure.message ??
        (error instanceof Error ? error.message : "Request refused."),
    });
  }
}

async function runPlannedTestOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isRecord(error) || typeof error.code !== "string") {
      throw error;
    }
    const failure = Object.hasOwn(PLANNED_TEST_FAILURES, error.code)
      ? PLANNED_TEST_FAILURES[error.code]
      : undefined;
    if (!failure) {
      throw error;
    }
    throw new ORPCError(failure.status, {
      cause: error,
      data: { code: error.code },
      defined: true,
      message:
        failure.message ??
        (error instanceof Error ? error.message : "Package refused."),
    });
  }
}

interface TestGapFailure {
  message: string;
  status: "BAD_REQUEST" | "NOT_FOUND" | "PRECONDITION_FAILED";
}

const TEST_GAP_FAILURES: Record<string, TestGapFailure> = {
  TEST_GAP_CLOSED: {
    message:
      "This Test Gap is closed and its history is fixed. Its relations and decision are not rewritten.",
    status: "BAD_REQUEST",
  },
  TEST_GAP_DECISION_UNAVAILABLE: {
    message: "The Decision is not an available Decision of this Project.",
    status: "BAD_REQUEST",
  },
  TEST_GAP_SESSION_TEST_NOT_FOUND: {
    message: "A selected Session Test is unavailable.",
    status: "NOT_FOUND",
  },
  TEST_GAP_CASE_VERSION_NOT_FOUND: {
    message: "Planned Test Case version is unavailable.",
    status: "NOT_FOUND",
  },
  TEST_GAP_HANDOFF_NOT_FOUND: {
    message: "Test Handoff is unavailable.",
    status: "NOT_FOUND",
  },
  TEST_GAP_NOT_FOUND: {
    message: "Test Gap is unavailable.",
    status: "NOT_FOUND",
  },
  TEST_GAP_STATE_CONFLICT: {
    message: "Test Gap changed since it was loaded. Reload and try again.",
    status: "PRECONDITION_FAILED",
  },
  TEST_GAP_PROJECT_NOT_FOUND: {
    message: "Project is unavailable.",
    status: "NOT_FOUND",
  },
  TEST_GAP_PROJECT_READ_ONLY: {
    message: "Archived Projects are read-only.",
    status: "BAD_REQUEST",
  },
  TEST_GAP_RELATION_TARGET_UNAVAILABLE: {
    message:
      "A relation target is not an existing, active record of this Project.",
    status: "BAD_REQUEST",
  },
};

async function runTestGapOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isRecord(error) || typeof error.code !== "string") {
      throw error;
    }
    const failure = Object.hasOwn(TEST_GAP_FAILURES, error.code)
      ? TEST_GAP_FAILURES[error.code]
      : undefined;
    if (!failure) {
      throw error;
    }
    throw new ORPCError(failure.status, {
      cause: error,
      data: { code: error.code },
      defined: true,
      message: failure.message,
    });
  }
}

interface TestReviewFailure {
  message: string;
  status: "BAD_REQUEST" | "NOT_FOUND";
}

const TEST_REVIEW_FAILURES: Record<string, TestReviewFailure> = {
  TEST_REVIEW_ALREADY_REDACTED: {
    message: "This value was already redacted.",
    status: "BAD_REQUEST",
  },
  TEST_REVIEW_ALREADY_WITHDRAWN: {
    message: "This record was already withdrawn.",
    status: "BAD_REQUEST",
  },
  TEST_REVIEW_BINDING_INVALID: {
    message: "Bind a usable result of the same exact scenario version.",
    status: "BAD_REQUEST",
  },
  TEST_REVIEW_SUPERSEDE_CYCLE: {
    message: "This Supersedes relation would close a cycle.",
    status: "BAD_REQUEST",
  },
  TEST_REVIEW_SUPERSEDE_TYPE_MISMATCH: {
    message:
      "Supersedes relates two Session Tests of the same specialist type.",
    status: "BAD_REQUEST",
  },
  TEST_REVIEW_PREVIEW_STALE: {
    message: "The records changed since the preview. Preview again to confirm.",
    status: "BAD_REQUEST",
  },
  TEST_REVIEW_PROJECT_NOT_FOUND: {
    message: "Project is unavailable.",
    status: "NOT_FOUND",
  },
  TEST_REVIEW_PROJECT_READ_ONLY: {
    message: "Archived Projects are read-only.",
    status: "BAD_REQUEST",
  },
  TEST_REVIEW_RECORD_NOT_FOUND: {
    message: "Test Session or Session Test is unavailable.",
    status: "NOT_FOUND",
  },
  TEST_REVIEW_SUMMARY_SCOPE_NOT_FOUND: {
    message: "The Test Summary scope is unavailable.",
    status: "NOT_FOUND",
  },
};

async function runTestReviewOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isRecord(error) || typeof error.code !== "string") {
      throw error;
    }
    const failure = Object.hasOwn(TEST_REVIEW_FAILURES, error.code)
      ? TEST_REVIEW_FAILURES[error.code]
      : undefined;
    if (!failure) {
      throw error;
    }
    throw new ORPCError(failure.status, {
      cause: error,
      data: { code: error.code },
      defined: true,
      message: failure.message,
    });
  }
}

interface ProductGapFailure {
  message: string;
  status: "BAD_REQUEST" | "NOT_FOUND" | "PRECONDITION_FAILED";
}

const PRODUCT_GAP_FAILURES: Record<string, ProductGapFailure> = {
  TOOL_ESCAPE_ALREADY_CLOSED: {
    message: "This Tool Escape is already closed.",
    status: "PRECONDITION_FAILED",
  },
  TOOL_ESCAPE_CLOSE_REFUSED: {
    message:
      "A high-impact close needs all four conditions; at least one is unmet.",
    status: "PRECONDITION_FAILED",
  },
  TOOL_ESCAPE_NOT_FOUND: {
    message: "Tool Escape is unavailable.",
    status: "NOT_FOUND",
  },
  TOOL_ESCAPE_SOURCE_UNAVAILABLE: {
    message:
      "The escape source is not an existing, active record of this Workspace.",
    status: "BAD_REQUEST",
  },
  PRODUCT_GAP_FOLLOW_UP_STALE: {
    message: "The follow-up preview is stale. Open the preview again.",
    status: "PRECONDITION_FAILED",
  },
  PRODUCT_GAP_FOLLOW_UP_TARGET_UNAVAILABLE: {
    message: "The follow-up Project or Feature is unavailable.",
    status: "NOT_FOUND",
  },
  PRODUCT_GAP_LINK_TARGET_UNAVAILABLE: {
    message:
      "A related record is not an existing, active record of this Workspace.",
    status: "BAD_REQUEST",
  },
  PRODUCT_GAP_NOT_FOUND: {
    message: "Product Gap is unavailable.",
    status: "NOT_FOUND",
  },
  PRODUCT_GAP_PROJECT_READ_ONLY: {
    message: "Archived Projects are read-only.",
    status: "BAD_REQUEST",
  },
  PRODUCT_GAP_STATUS_CONFLICT: {
    message: "Product Gap changed since it was loaded. Reload and try again.",
    status: "PRECONDITION_FAILED",
  },
  PRODUCT_GAP_WORKSPACE_NOT_FOUND: {
    message: "Workspace is unavailable.",
    status: "NOT_FOUND",
  },
};

async function runProductGapOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isRecord(error) || typeof error.code !== "string") {
      throw error;
    }
    const failure = Object.hasOwn(PRODUCT_GAP_FAILURES, error.code)
      ? PRODUCT_GAP_FAILURES[error.code]
      : undefined;
    if (!failure) {
      throw error;
    }
    throw new ORPCError(failure.status, {
      cause: error,
      data: {
        code: error.code,
        ...(Array.isArray(error.conditions)
          ? { conditions: error.conditions }
          : {}),
      },
      defined: true,
      message: failure.message,
    });
  }
}

const SPEC_CHANGE_REVIEW_UNAVAILABLE_MESSAGES: Record<string, string> = {
  SPEC_CHANGE_REVIEW_NOT_FOUND: "Spec Change Review is unavailable.",
  SPEC_CHANGE_REVIEW_CANDIDATE_UNAVAILABLE:
    "Spec Change Review candidate is unavailable.",
  SPEC_CHANGE_REVIEW_PROJECT_NOT_FOUND: "Project is unavailable.",
  SPEC_CHANGE_REVIEW_VERSION_UNAVAILABLE:
    "The Document version of this Spec Change Review is unavailable.",
};

async function runSpecChangeReviewOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isRecord(error) || typeof error.code !== "string") {
      throw error;
    }
    if (error.code === "SPEC_CHANGE_REVIEW_FOLLOW_UP_EXISTS") {
      throw new ORPCError("PRECONDITION_FAILED", {
        cause: error,
        data: { code: error.code },
        defined: true,
        message: "This candidate already has follow-up Work.",
      });
    }
    const message = SPEC_CHANGE_REVIEW_UNAVAILABLE_MESSAGES[error.code];
    if (message) {
      throw new ORPCError("NOT_FOUND", {
        cause: error,
        data: { code: error.code },
        defined: true,
        message,
      });
    }
    throw error;
  }
}

async function runContactOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isRecord(error) || typeof error.code !== "string") {
      throw error;
    }
    if (error.code === "CONTACT_REVISION_CONFLICT") {
      throw new ORPCError("PRECONDITION_FAILED", {
        cause: error,
        data: { code: error.code },
        defined: true,
        message: "Contact changed since it was loaded. Reload and try again.",
      });
    }
    if (
      error.code === "CONTACT_MERGE_UNDO_BLOCKED" ||
      error.code === "CONTACT_MERGE_UNDO_CONFLICT" ||
      error.code === "CONTACT_MERGE_UNDO_PAYLOAD_CHANGED"
    ) {
      throw new ORPCError("PRECONDITION_FAILED", {
        cause: error,
        data: { code: error.code },
        defined: true,
        message: UNDO_MERGE_PRECONDITION_MESSAGES[error.code],
      });
    }
    const message = CONTACT_UNAVAILABLE_MESSAGES[error.code];
    if (message) {
      throw new ORPCError("NOT_FOUND", {
        cause: error,
        data: { code: error.code },
        defined: true,
        message,
      });
    }
    throw error;
  }
}

async function runTagOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    rethrowTagError(error);
  }
}

function tagUnavailableMessage(code: unknown) {
  if (code === "TAG_PROJECT_NOT_FOUND") {
    return "Project is unavailable.";
  }
  if (code === "TAG_RECORD_NOT_FOUND") {
    return "Work is unavailable.";
  }
  if (code === "TAG_WORKSPACE_NOT_FOUND") {
    return "Workspace is unavailable.";
  }
  return "Tag is unavailable.";
}
function nullableProjectValue(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

async function previewWikiDocumentTransfer(
  context: Context,
  accountId: string,
  input: WikiDocumentTransferInput,
) {
  if (!context.documents?.previewTransfer) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  try {
    const preview = await context.documents.previewTransfer(accountId, input);
    return {
      ...preview,
      references: await Promise.all(
        preview.references.map(async (reference) => {
          let source: { projectId: string | null } | null = null;
          let title: string | null = null;
          if (reference.directive?.kind === "Work") {
            const resolved = await documentReferenceSource(context, accountId, {
              recordType: "Work",
              recordId: reference.directive.id,
              label: reference.title,
              start: reference.directive.start,
              end: reference.directive.end,
            });
            source = resolved;
            title = resolved?.title ?? null;
          } else if (reference.directive) {
            const block = await liveDocumentBlockSource(
              context,
              accountId,
              reference.directive,
            );
            source = block;
            title =
              block && "title" in block ? block.title : (block?.name ?? null);
          } else if (reference.reference) {
            const resolved = await documentReferenceSource(
              context,
              accountId,
              reference.reference,
            );
            source = resolved;
            title = resolved ? resolved.title : null;
          }
          return {
            ...reference,
            available: source !== null,
            projectId: source?.projectId ?? null,
            title: title ?? reference.title,
          };
        }),
      ),
    };
  } catch (error) {
    rethrowDocumentMutationError(error, input.documentId);
  }
}

async function transferWikiDocument(
  context: Context,
  accountId: string,
  input: z.infer<typeof transferDocumentMutationInputSchema>,
) {
  const { baseRevision, clientIdempotencyKey, previewFingerprint, ...fields } =
    input;
  const payload = wikiDocumentTransferInputSchema.parse(fields);
  if (
    baseRevision !== (payload.action === "copy" ? 0 : payload.documentRevision)
  ) {
    throw new ORPCError("BAD_REQUEST");
  }
  const mutation = requireDocumentMutationContracts(context).transfer?.(
    accountId,
    payload,
    previewFingerprint,
  );
  if (!mutation) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  try {
    const receipt = await mutation.mutate(
      {
        actor: { actorId: accountId, type: "User" },
        baseRevision,
        clientIdempotencyKey,
        kind: "human",
        payload: { ...payload, previewFingerprint },
        targetId:
          payload.action === "copy"
            ? payload.copyDocumentId
            : payload.documentId,
      },
      ({ committedAt, currentRevision, currentValue }) => {
        const source =
          payload.action === "copy"
            ? currentValue.sourceDocument
            : currentValue.document;
        if (!source) {
          throw new DocumentUnavailableError();
        }
        return {
          document: documentSchema.parse({
            ...source,
            id: payload.action === "copy" ? payload.copyDocumentId : source.id,
            projectId: payload.targetProjectId,
            parentDocumentId: null,
            folder: null,
            ...(payload.action === "copy"
              ? {
                  archivedAt: null,
                  createdAt: committedAt,
                  origin: {
                    documentId: source.id,
                    revision: source.revision,
                  },
                }
              : {}),
            revision: currentRevision + 1,
            updatedAt: committedAt,
          }),
        } satisfies DocumentMutationValue;
      },
    );
    if (!receipt.nextValue.document) {
      throw new ORPCError("NOT_FOUND");
    }
    return receipt.nextValue.document;
  } catch (error) {
    rethrowDocumentMutationError(error, input.documentId);
  }
}

function requireProjectGoals(context: Context) {
  if (!context.projectGoals) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.projectGoals;
}
function rethrowProjectGoalError(error: unknown, targetId: string): never {
  if (error instanceof ProjectGoalConflictError) {
    throw new ORPCError("CONFLICT", {
      cause: error,
      data: { code: "CONFLICT", targetId },
      defined: true,
      message: "Conflict",
    });
  }
  throw error;
}
function requireProjectReleasePlanning(context: Context) {
  if (!context.projectReleasePlanning) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.projectReleasePlanning;
}
async function projectReleasePlanningWrite<T>(
  targetId: string,
  write: () => Promise<T | null>,
): Promise<T> {
  try {
    const result = await write();
    if (!result) {
      throw new ORPCError("NOT_FOUND");
    }
    return result;
  } catch (error) {
    if (error instanceof ProjectReleasePlanningConflictError) {
      throw new ORPCError("CONFLICT", {
        cause: error,
        data: { code: "CONFLICT", targetId },
        defined: true,
        message: "Conflict",
      });
    }
    throw error;
  }
}
function requireProductionIncidents(context: Context) {
  if (!context.productionIncidents) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.productionIncidents;
}
async function productionIncidentWrite<T>(
  targetId: string,
  write: () => Promise<T | null>,
): Promise<T> {
  try {
    const result = await write();
    if (!result) {
      throw new ORPCError("NOT_FOUND");
    }
    return result;
  } catch (error) {
    if (error instanceof ProductionIncidentFollowUpStaleError) {
      throw new ORPCError("CONFLICT", {
        cause: error,
        data: { code: "PREVIEW_STALE", targetId },
        defined: true,
        message: "Preview changed",
      });
    }
    if (error instanceof ProductionIncidentConflictError) {
      throw new ORPCError("CONFLICT", {
        cause: error,
        data: { code: "CONFLICT", targetId },
        defined: true,
        message: "Conflict",
      });
    }
    throw error;
  }
}
function requireLinkSharing(context: Context) {
  if (!context.linkSharing) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.linkSharing;
}
function requireProjectUpdates(context: Context) {
  if (!context.projectUpdates) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.projectUpdates;
}
function requireTrash(context: Context) {
  if (!context.trash) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.trash;
}
function requireDataImport(context: Context) {
  if (!context.dataImport) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.dataImport;
}
async function dataImportRead<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof ImportRefusedError) {
      throw new ORPCError("BAD_REQUEST", {
        cause: error,
        data: { code: error.code },
        defined: true,
        message: error.message,
      });
    }
    if (error instanceof ImportConflictError) {
      throw new ORPCError("CONFLICT", {
        cause: error,
        defined: true,
        message: error.message,
      });
    }
    if (
      error instanceof ImportScopeNotFoundError ||
      error instanceof ImportStagingExpiredError ||
      error instanceof ImportReceiptNotFoundError
    ) {
      throw new ORPCError("NOT_FOUND", {
        cause: error,
        defined: true,
        message: error.message,
      });
    }
    throw error;
  }
}
function requireTrashEarlyDelete(context: Context) {
  const { earlyDelete } = requireTrash(context);
  if (!earlyDelete) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return earlyDelete;
}
interface TrashErrorMapping {
  code: string;
  /** Extra secret-free fields the client needs next to the code. */
  data?: (error: never) => Record<string, unknown>;
  /** Fixed copy; defaults to the error's own message. */
  message?: string;
  status: "BAD_REQUEST" | "CONFLICT" | "FORBIDDEN";
  test: (error: unknown) => boolean;
}

const trashErrorMappings: readonly TrashErrorMapping[] = [
  {
    code: "TRASH_CHILD_RECORD",
    status: "BAD_REQUEST",
    test: (error) => error instanceof TrashChildRecordError,
  },
  {
    code: "TRASH_KEEP_SURFACE_NOT_ALLOWED",
    status: "BAD_REQUEST",
    test: (error) => error instanceof TrashKeepSurfaceNotAllowedError,
  },
  {
    code: "TRASH_SURFACE_NOT_REVOKED",
    message: "Revoke the External Surface before moving it to Trash",
    status: "CONFLICT",
    test: (error) => error instanceof TrashSurfaceNotRevokedError,
  },
  {
    code: "TRASH_DELETE_BLOCKED",
    data: (error: TrashDeleteBlockedError) => ({ blockers: error.blockers }),
    status: "CONFLICT",
    test: (error) => error instanceof TrashDeleteBlockedError,
  },
  {
    code: "TRASH_RESTORE_CONFLICT",
    data: (error: TrashRestoreConflictError) => ({
      conflicts: error.conflicts,
    }),
    status: "CONFLICT",
    test: (error) => error instanceof TrashRestoreConflictError,
  },
  {
    code: "TRASH_TYPED_NAME_MISMATCH",
    message: "The Project name does not match.",
    status: "BAD_REQUEST",
    test: (error) => error instanceof TrashTypedNameMismatchError,
  },
  {
    code: "TRASH_GRANT_REJECTED",
    status: "FORBIDDEN",
    test: (error) => error instanceof TrashGrantRejectedError,
  },
  {
    code: "TRASH_ALREADY_TRASHED",
    message: "Already in Trash",
    status: "CONFLICT",
    test: (error) => error instanceof TrashAlreadyTrashedError,
  },
];

async function trashWrite<T>(
  targetId: string,
  write: () => Promise<T | null>,
): Promise<T> {
  try {
    const result = await write();
    if (!result) {
      throw new ORPCError("NOT_FOUND");
    }
    return result;
  } catch (error) {
    const mapping = trashErrorMappings.find(({ test }) => test(error));
    if (mapping && error instanceof Error) {
      throw new ORPCError(mapping.status, {
        cause: error,
        data: {
          ...mapping.data?.(error as never),
          code: mapping.code,
          targetId,
        },
        defined: true,
        message: mapping.message ?? error.message,
      });
    }
    return rethrowProjectShellMutationError(error, targetId);
  }
}
function requireSecurityRedaction(context: Context) {
  if (!context.securityRedaction) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.securityRedaction;
}
async function securityRedactionWrite<T>(
  write: () => Promise<T | null>,
): Promise<T> {
  try {
    const result = await write();
    if (!result) {
      throw new ORPCError("NOT_FOUND");
    }
    return result;
  } catch (error) {
    if (error instanceof SecurityRedactionTypedNameMismatchError) {
      throw new ORPCError("BAD_REQUEST", {
        cause: error,
        data: { code: error.code },
        defined: true,
        message: "The Account or Project name does not match.",
      });
    }
    if (error instanceof SecurityRedactionSpreadIncompleteError) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        cause: error,
        data: { code: error.code, failed: error.failed },
        defined: true,
        message: error.message,
      });
    }
    if (error instanceof SecurityRedactionGrantRejectedError) {
      throw new ORPCError("FORBIDDEN", {
        cause: error,
        data: { code: error.code },
        defined: true,
        message: error.message,
      });
    }
    throw error;
  }
}
async function projectUpdateWrite<T>(
  targetId: string,
  write: () => Promise<T | null>,
): Promise<T> {
  try {
    const result = await write();
    if (!result) {
      throw new ORPCError("NOT_FOUND");
    }
    return result;
  } catch (error) {
    if (error instanceof ProjectUpdateConflictError) {
      throw new ORPCError("CONFLICT", {
        cause: error,
        data: { code: "CONFLICT", targetId },
        defined: true,
        message: "Conflict",
      });
    }
    if (error instanceof ProjectUpdateReadOnlyError) {
      throw new ORPCError("CONFLICT", {
        cause: error,
        data: { code: "PROJECT_READ_ONLY", targetId },
        defined: true,
        message: "Project is archived",
      });
    }
    if (error instanceof ProjectUpdateLinkError) {
      throw new ORPCError("BAD_REQUEST", {
        cause: error,
        message: error.message,
      });
    }
    throw error;
  }
}
function requireExternalSurfaceManagement(context: Context) {
  if (!context.externalSurfaceManagement) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.externalSurfaceManagement;
}
export const appRouter = {
  previewPersonalDataExport: protectedProcedure
    .input(personalDataPreviewInputSchema)
    .handler(({ context, input }) =>
      personalDataPreviewHandler(context, input),
    ),
  exportPersonalData: protectedProcedure
    .input(personalDataProduceInputSchema)
    .handler(({ context, input }) =>
      personalDataProduceHandler(context, input),
    ),
  previewPersonalDataErase: protectedProcedure
    .input(personalDataErasePreviewInputSchema)
    .handler(({ context, input }) =>
      personalDataErasePreviewHandler(context, input),
    ),
  erasePersonalData: protectedProcedure
    .input(erasePersonalDataInputSchema)
    .handler(({ context, input }) => personalDataEraseHandler(context, input)),
  exportCatalog: protectedProcedure
    .input(exportCatalogInputSchema)
    .handler(({ context }) => exportCatalogHandler(context)),
  exportPreview: protectedProcedure
    .input(exportRequestSchema)
    .handler(({ context, input }) => exportPreviewHandler(context, input)),
  exportProduce: protectedProcedure
    .input(exportProduceInputSchema)
    .handler(({ context, input }) => exportProduceHandler(context, input)),
  previewImport: protectedProcedure
    .input(previewImportInputSchema)
    .handler(({ context, input }) =>
      dataImportRead(() =>
        requireDataImport(context).preview(context.session.user.id, input),
      ),
    ),
  reopenImportPreview: protectedProcedure
    .input(reopenImportPreviewInputSchema)
    .handler(({ context, input }) =>
      dataImportRead(() =>
        requireDataImport(context).reopen(context.session.user.id, input),
      ),
    ),
  applyImport: protectedProcedure
    .input(applyImportInputSchema)
    .handler(({ context, input }) =>
      dataImportRead(() =>
        requireDataImport(context).apply(context.session.user.id, input),
      ),
    ),
  cancelImport: protectedProcedure
    .input(cancelImportInputSchema)
    .handler(({ context, input }) =>
      dataImportRead(() =>
        requireDataImport(context).cancel(context.session.user.id, input),
      ),
    ),
  reopenImportReceipt: protectedProcedure
    .input(reopenImportReceiptInputSchema)
    .handler(({ context, input }) =>
      dataImportRead(() =>
        requireDataImport(context).receipt(context.session.user.id, input),
      ),
    ),
  trash: protectedProcedure
    .input(trashOverviewInputSchema)
    .handler(async ({ context, input }) => {
      const overview = await requireTrash(context).overview(
        context.session.user.id,
        input.projectId,
      );
      if (!overview) {
        throw new ORPCError("NOT_FOUND");
      }
      return overview;
    }),
  moveToTrashPreview: protectedProcedure
    .input(moveToTrashPreviewInputSchema)
    .handler(({ context, input }) =>
      trashWrite(input.recordId, () =>
        requireTrash(context).preview(context.session.user.id, input, {
          deletion: "record",
        }),
      ),
    ),
  moveToTrash: protectedProcedure
    .input(moveToTrashInputSchema)
    .handler(({ context, input }) =>
      trashWrite(input.recordId, () =>
        requireTrash(context).move(context.session.user.id, input, {
          deletion: "record",
        }),
      ),
    ),
  previewPermanentDeleteFromTrash: protectedProcedure
    .input(trashEarlyDeletePreviewInputSchema)
    .handler(({ context, input }) =>
      trashWrite(input.entryId, () =>
        requireTrashEarlyDelete(context).preview(
          context.session.user.id,
          input,
        ),
      ),
    ),
  permanentlyDeleteFromTrash: protectedProcedure
    .input(permanentlyDeleteFromTrashInputSchema)
    .handler(({ context, input }) => {
      const confirmation = context.githubIdentityConfirmation;
      if (!confirmation) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      return trashWrite(input.entryId, () =>
        requireTrashEarlyDelete(context).permanentlyDelete(
          context.session.user.id,
          input,
          (grant) =>
            confirmation.consume(
              sessionPrincipal(context.session),
              "early-permanent-delete",
              grant,
              context.clientKey,
            ),
        ),
      );
    }),
  previewSecurityRedaction: protectedProcedure
    .input(securityRedactionPreviewInputSchema)
    .handler(({ context, input }) =>
      securityRedactionWrite(() =>
        requireSecurityRedaction(context).preview(
          {
            accountId: context.session.user.id,
            accountName: context.session.user.name,
          },
          input,
        ),
      ),
    ),
  applySecurityRedaction: protectedProcedure
    .input(applySecurityRedactionInputSchema)
    .handler(({ context, input }) => {
      const confirmation = context.githubIdentityConfirmation;
      if (!confirmation) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      return securityRedactionWrite(() =>
        requireSecurityRedaction(context).apply(
          {
            accountId: context.session.user.id,
            accountName: context.session.user.name,
          },
          input,
          (grant) =>
            confirmation.consume(
              sessionPrincipal(context.session),
              SECURITY_REDACTION_OPERATION_ID,
              grant,
              context.clientKey,
            ),
        ),
      );
    }),
  restoreFromTrashPreview: protectedProcedure
    .input(trashRestorePreviewInputSchema)
    .handler(({ context, input }) =>
      trashWrite(input.entryId, () =>
        requireTrash(context).restorePreview(context.session.user.id, input),
      ),
    ),
  restoreFromTrash: protectedProcedure
    .input(restoreFromTrashInputSchema)
    .handler(({ context, input }) =>
      trashWrite(input.entryId, () =>
        requireTrash(context).restore(context.session.user.id, input),
      ),
    ),
  removeExternalSurface: protectedProcedure
    .input(removeExternalSurfaceInputSchema)
    .handler(async ({ context, input }) => {
      try {
        // Link errors map through the Link Sharing write; Wiki errors through its own.
        return await linkSharingWrite(input.surfaceId, async () => {
          try {
            return await requireExternalSurfaceManagement(context).remove(
              context.session.user.id,
              input,
            );
          } catch (error) {
            if (error instanceof ExternalSurfaceManagementStateError) {
              throw new ORPCError("CONFLICT", {
                cause: error,
                data: { code: error.code, targetId: input.surfaceId },
                defined: true,
                message: error.message,
              });
            }
            return rethrowWikiPublishingError(error);
          }
        });
      } catch (error) {
        if (error instanceof ORPCError) {
          throw error;
        }
        return rethrowWikiPublishingError(error);
      }
    }),
  listExternalSurfaces: protectedProcedure
    .input(listExternalSurfacesInputSchema)
    .handler(async ({ context, input }) => {
      const directory = await requireExternalSurfaceManagement(context).list(
        context.session.user.id,
        input,
      );
      return directory ?? externalSurfaceManagementUnavailable();
    }),
  shareRoots: protectedProcedure
    .input(shareRootsInputSchema)
    .handler(({ context, input }) =>
      linkSharingWrite(input.projectId, () =>
        requireLinkSharing(context).roots(
          context.session.user.id,
          input.projectId,
        ),
      ),
    ),
  previewShareScope: protectedProcedure
    .input(previewShareScopeInputSchema)
    .handler(({ context, input }) =>
      linkSharingWrite(input.root.id, () =>
        requireLinkSharing(context).preview(context.session.user.id, input),
      ),
    ),
  approveShareScope: protectedProcedure
    .input(approveShareScopeInputSchema)
    .handler(({ context, input }) =>
      linkSharingWrite(input.approvalId, () =>
        requireLinkSharing(context).approve(context.session.user.id, input),
      ),
    ),
  setShareExpiry: protectedProcedure
    .input(setShareExpiryInputSchema)
    .handler(({ context, input }) =>
      linkSharingWrite(input.surfaceId, () =>
        requireLinkSharing(context).setExpiry(context.session.user.id, input),
      ),
    ),
  reopenShareLink: protectedProcedure
    .input(reopenExpiredLinkInputSchema)
    .handler(({ context, input }) =>
      linkSharingWrite(input.surfaceId, () =>
        requireLinkSharing(context).reopen(context.session.user.id, input),
      ),
    ),
  reshareShareLink: protectedProcedure
    .input(reshareExpiredLinkInputSchema)
    .handler(({ context, input }) =>
      linkSharingWrite(input.surfaceId, () =>
        requireLinkSharing(context).reshare(context.session.user.id, input),
      ),
    ),
  revokeShareLink: protectedProcedure
    .input(revokeShareInputSchema)
    .handler(({ context, input }) =>
      linkSharingWrite(input.surfaceId, () =>
        requireLinkSharing(context).revoke(context.session.user.id, input),
      ),
    ),
  setLinkPassword: protectedProcedure
    .input(setLinkPasswordInputSchema)
    .handler(({ context, input }) =>
      linkSharingWrite(input.surfaceId, () =>
        requireLinkSharing(context).setPassword(context.session.user.id, input),
      ),
    ),
  rotateShareToken: protectedProcedure
    .input(rotateShareTokenInputSchema)
    .handler(({ context, input }) =>
      linkSharingWrite(input.surfaceId, () =>
        requireLinkSharing(context).rotateToken(context.session.user.id, input),
      ),
    ),
  projectUpdates: protectedProcedure
    .input(projectUpdatesInputSchema)
    .handler(async ({ context, input }) => {
      const overview = await requireProjectUpdates(context).overview(
        context.session.user.id,
        input.projectId,
      );
      if (!overview) {
        throw new ORPCError("NOT_FOUND");
      }
      return overview;
    }),
  createProjectUpdate: protectedProcedure
    .input(createProjectUpdateInputSchema)
    .handler(({ context, input }) =>
      projectUpdateWrite(input.updateId, () =>
        requireProjectUpdates(context).create(context.session.user.id, input),
      ),
    ),
  projectUpdateReminder: protectedProcedure
    .input(projectUpdatesInputSchema)
    .handler(async ({ context, input }) => {
      const reminder = await requireProjectUpdates(context).reminder(
        context.session.user.id,
        input.projectId,
      );
      if (!reminder) {
        throw new ORPCError("NOT_FOUND");
      }
      return reminder;
    }),
  configureProjectUpdateReminder: protectedProcedure
    .input(configureProjectUpdateReminderInputSchema)
    .handler(({ context, input }) =>
      projectUpdateWrite(input.projectId, () =>
        requireProjectUpdates(context).configureReminder(
          context.session.user.id,
          input,
        ),
      ),
    ),
  skipProjectUpdateReminder: protectedProcedure
    .input(projectUpdatesInputSchema)
    .handler(({ context, input }) =>
      projectUpdateWrite(input.projectId, () =>
        requireProjectUpdates(context).skipReminder(
          context.session.user.id,
          input.projectId,
        ),
      ),
    ),
  productionIncidents: protectedProcedure
    .input(productionIncidentsInputSchema)
    .handler(async ({ context, input }) => {
      const overview = await requireProductionIncidents(context).overview(
        context.session.user.id,
        input.projectId,
      );
      if (!overview) {
        throw new ORPCError("NOT_FOUND");
      }
      return overview;
    }),
  productionIncidentDetail: protectedProcedure
    .input(productionIncidentInputSchema)
    .handler(async ({ context, input }) => {
      const detail = await requireProductionIncidents(context).detail(
        context.session.user.id,
        input,
      );
      if (!detail) {
        throw new ORPCError("NOT_FOUND");
      }
      return detail;
    }),
  previewProductionIncidentFollowUp: protectedProcedure
    .input(previewProductionIncidentFollowUpInputSchema)
    .handler(async ({ context, input }) => {
      const preview = await requireProductionIncidents(context).previewFollowUp(
        context.session.user.id,
        input,
      );
      if (!preview) {
        throw new ORPCError("NOT_FOUND");
      }
      return preview;
    }),
  createProductionIncidentFollowUp: protectedProcedure
    .input(createProductionIncidentFollowUpInputSchema)
    .handler(({ context, input }) =>
      productionIncidentWrite(input.incidentId, () =>
        requireProductionIncidents(context).createFollowUp(
          context.session.user.id,
          input,
        ),
      ),
    ),
  setProductionIncidentLink: protectedProcedure
    .input(setProductionIncidentLinkInputSchema)
    .handler(({ context, input }) =>
      productionIncidentWrite(input.incidentId, () =>
        requireProductionIncidents(context).setLink(
          context.session.user.id,
          input,
        ),
      ),
    ),
  projectReleases: protectedProcedure
    .input(projectReleasePlanningProjectInputSchema)
    .handler(async ({ context, input }) => {
      const overview = await requireProjectReleasePlanning(context).overview(
        context.session.user.id,
        input.projectId,
      );
      if (!overview) {
        throw new ORPCError("NOT_FOUND");
      }
      return overview;
    }),
  projectReleasePlanning: protectedProcedure
    .input(projectReleasePlanningInputSchema)
    .handler(async ({ context, input }) => {
      const detail = await requireProjectReleasePlanning(context).detail(
        context.session.user.id,
        input,
      );
      if (!detail) {
        throw new ORPCError("NOT_FOUND");
      }
      return detail;
    }),
  setProjectReleaseScope: protectedProcedure
    .input(setProjectReleaseScopeInputSchema)
    .handler(({ context, input }) =>
      projectReleasePlanningWrite(input.releaseId, () =>
        requireProjectReleasePlanning(context).setScope(
          context.session.user.id,
          input,
        ),
      ),
    ),
  setProjectReleaseLink: protectedProcedure
    .input(setProjectReleaseLinkInputSchema)
    .handler(({ context, input }) =>
      projectReleasePlanningWrite(input.releaseId, () =>
        requireProjectReleasePlanning(context).setLink(
          context.session.user.id,
          input,
        ),
      ),
    ),
  setProjectReleaseAudience: protectedProcedure
    .input(setProjectReleaseAudienceInputSchema)
    .handler(({ context, input }) =>
      projectReleasePlanningWrite(input.releaseId, () =>
        requireProjectReleasePlanning(context).setAudience(
          context.session.user.id,
          input,
        ),
      ),
    ),
  projectGoalDetail: protectedProcedure
    .input(projectGoalInputSchema)
    .handler(({ context, input }) => {
      const { membership } = requireProjectGoals(context);
      if (!membership) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      return membership.detail(context.session.user.id, input);
    }),
  setProjectGoalRelation: protectedProcedure
    .input(projectGoalRelationInputSchema)
    .handler(async ({ context, input }) => {
      const { membership } = requireProjectGoals(context);
      if (!membership) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        const relation = await membership.setRelation(
          context.session.user.id,
          input,
        );
        if (!relation) {
          throw new ORPCError("NOT_FOUND");
        }
        return relation;
      } catch (error) {
        rethrowProjectGoalError(error, input.goalId);
      }
    }),
  projectGoals: protectedProcedure
    .input(projectGoalsProjectInputSchema)
    .handler(({ context, input }) =>
      requireProjectGoals(context).list(
        context.session.user.id,
        input.projectId,
      ),
    ),
  projectGoal: protectedProcedure
    .input(projectGoalInputSchema)
    .handler(({ context, input }) =>
      requireProjectGoals(context).find(context.session.user.id, input),
    ),
  createProjectGoal: protectedProcedure
    .input(createProjectGoalInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const record = await requireProjectGoals(context).create(
          context.session.user.id,
          input,
        );
        if (!record) {
          throw new ORPCError("NOT_FOUND");
        }
        return record;
      } catch (error) {
        rethrowProjectGoalError(error, input.id);
      }
    }),
  updateProjectGoal: protectedProcedure
    .input(updateProjectGoalInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const record = await requireProjectGoals(context).update(
          context.session.user.id,
          input,
        );
        if (!record) {
          throw new ORPCError("NOT_FOUND");
        }
        return record;
      } catch (error) {
        rethrowProjectGoalError(error, input.id);
      }
    }),
  documentTemplates: protectedProcedure
    .input(documentTemplateScopeSchema)
    .handler(async ({ context, input }) => {
      const templates = context.documents?.templates;
      if (!templates) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        return await templates.list(context.session.user.id, input.projectId);
      } catch (error) {
        rethrowDocumentMutationError(error, "document-templates");
      }
    }),
  previewDocumentTemplate: protectedProcedure
    .input(z.object({ documentId: documentIdSchema }).strict())
    .handler(async ({ context, input }) => {
      const source = await context.documents?.get(
        context.session.user.id,
        input.documentId,
      );
      if (!source) {
        throw new ORPCError("NOT_FOUND");
      }
      return {
        body: documentTemplateSkeleton(source.body),
        name: source.title,
        projectId: source.projectId,
        sourceDocumentId: source.id,
        sourceRevision: source.revision,
        type: source.type,
      };
    }),
  createDocumentTemplate: protectedProcedure
    .input(createDocumentTemplateInputSchema)
    .handler(async ({ context, input }) => {
      const contracts = context.documentMutationContracts?.templates;
      if (!contracts) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const { baseRevision, clientIdempotencyKey, ...payload } = input;
      try {
        const receipt = await contracts.create(context.session.user.id).mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload,
            targetId: clientIdempotencyKey,
          },
          ({ committedAt }) => ({
            template: documentTemplateSchema.parse({
              ...documentTemplateDefinitionSchema.parse({
                projectId: payload.projectId,
                name: payload.name,
                body: documentTemplateSkeleton(payload.body),
                type: payload.type,
              }),
              id: crypto.randomUUID(),
              revision: 1,
              createdAt: committedAt,
              updatedAt: committedAt,
            }),
          }),
        );
        if (!receipt.nextValue.template) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.template;
      } catch (error) {
        rethrowDocumentMutationError(error, clientIdempotencyKey);
      }
    }),
  updateDocumentTemplate: protectedProcedure
    .input(updateDocumentTemplateInputSchema)
    .handler(async ({ context, input }) => {
      const contracts = context.documentMutationContracts?.templates;
      if (!contracts) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const { baseRevision, clientIdempotencyKey, ...payload } = input;
      try {
        const receipt = await contracts.update(context.session.user.id).mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload,
            targetId: payload.templateId,
          },
          ({ committedAt, currentRevision, currentValue }) => ({
            template: currentValue.template
              ? documentTemplateSchema.parse({
                  ...currentValue.template,
                  name: payload.name,
                  body: documentTemplateSkeleton(payload.body),
                  type: payload.type,
                  revision: currentRevision + 1,
                  updatedAt: committedAt,
                })
              : null,
          }),
        );
        if (!receipt.nextValue.template) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.template;
      } catch (error) {
        rethrowDocumentMutationError(error, payload.templateId);
      }
    }),
  createDocumentFromTemplate: protectedProcedure
    .input(createDocumentFromTemplateInputSchema)
    .handler(async ({ context, input }) => {
      const accountId = context.session.user.id;
      const { baseRevision, clientIdempotencyKey, ...templatePayload } = input;
      const contract =
        requireDocumentMutationContracts(context).create(accountId);
      const command = {
        actor: { actorId: accountId, type: "User" as const },
        baseRevision,
        clientIdempotencyKey,
        kind: "human" as const,
        payload: templatePayload,
        targetId: clientIdempotencyKey,
      };
      try {
        const replay = await contract.replay(command);
        if (replay?.nextValue.document) {
          return replay.nextValue.document;
        }
      } catch (error) {
        rethrowDocumentMutationError(error, clientIdempotencyKey);
      }
      const template =
        input.templateId === personalReviewTemplate.id
          ? personalReviewTemplate
          : await context.documents?.templates?.get(
              accountId,
              input.templateId,
            );
      if (
        !template ||
        ("projectId" in template && template.projectId !== input.projectId)
      ) {
        throw new ORPCError("NOT_FOUND");
      }
      if (
        "revision" in template &&
        template.revision !== input.templateRevision
      ) {
        throw new ORPCError("PRECONDITION_FAILED", {
          message:
            "Document Template changed. Reload it before creating a Document.",
        });
      }
      let body: string;
      try {
        body = renderDocumentTemplate(template.body, input.values);
      } catch (error) {
        throw new ORPCError("BAD_REQUEST", {
          cause: error,
          message:
            error instanceof Error
              ? error.message
              : "Document Template values are invalid.",
        });
      }
      const payload = documentCreationInputSchema.parse({
        projectId: input.projectId,
        title: input.title,
        type: template.type,
        body,
      });
      try {
        const receipt = await contract.mutate(
          command,
          ({ committedAt, currentRevision }) => ({
            document: documentSchema.parse({
              ...payload,
              id: crypto.randomUUID(),
              revision: currentRevision + 1,
              createdAt: committedAt,
              updatedAt: committedAt,
            }),
          }),
        );
        if (!receipt.nextValue.document) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.document;
      } catch (error) {
        rethrowDocumentMutationError(error, input.clientIdempotencyKey);
      }
    }),
  discoverDocuments: protectedProcedure
    .input(documentDiscoveryInputSchema)
    .handler(({ context, input }) => {
      const discovery = context.documents?.discovery;
      if (!discovery) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      return discovery.discover(context.session.user.id, input);
    }),
  searchRecords: protectedProcedure
    .input(universalSearchInputSchema)
    .handler(({ context, input }) => {
      const search = context.universalSearch;
      if (!search) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      return search.search(context.session.user.id, input);
    }),
  tableRecords: protectedProcedure
    .input(recordTableInputSchema)
    .handler(({ context, input }) => {
      const table = context.recordTable;
      if (!table) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      return table.list(context.session.user.id, input);
    }),
  updateTableCell: protectedProcedure
    .input(recordTableCellUpdateInputSchema)
    .handler(({ context, input }) => {
      const table = context.recordTable;
      if (!table) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      return table.updateCell(context.session.user.id, input);
    }),
  applyTablePaste: protectedProcedure
    .input(recordTablePasteInputSchema)
    .handler(({ context, input }) => {
      const table = context.recordTable;
      if (!table) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      return table.applyPaste(context.session.user.id, input);
    }),
  documents: protectedProcedure
    .input(
      z
        .object({
          projectId: projectIdSchema.nullable(),
          archived: z.boolean().optional(),
        })
        .strict(),
    )
    .handler(async ({ context, input }) => {
      if (!context.documents) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        return await context.documents.list(
          context.session.user.id,
          input.projectId,
          input.archived,
        );
      } catch (error) {
        if (error instanceof DocumentUnavailableError) {
          throw new ORPCError("NOT_FOUND", { cause: error });
        }
        throw error;
      }
    }),
  document: protectedProcedure
    .input(z.object({ documentId: documentIdSchema }).strict())
    .handler(async ({ context, input }) => {
      if (!context.documents) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const result = await context.documents.get(
        context.session.user.id,
        input.documentId,
      );
      if (!result) {
        throw new ORPCError("NOT_FOUND");
      }
      return result;
    }),
  documentConflictDrafts: protectedProcedure
    .input(z.object({ documentId: documentIdSchema }).strict())
    .handler(async ({ context, input }) => {
      const drafts = await context.documents?.conflictDrafts?.(
        context.session.user.id,
        input.documentId,
      );
      if (!drafts) {
        throw new ORPCError("NOT_FOUND");
      }
      return drafts;
    }),
  discardDocumentConflictDraft: protectedProcedure
    .input(discardDocumentConflictDraftInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.documents?.discardConflictDraft) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        await context.documents.discardConflictDraft(
          context.session.user.id,
          input.documentId,
          input.conflictDraftId,
        );
      } catch (error) {
        rethrowDocumentMutationError(error, input.documentId);
      }
    }),
  documentLiveWorkBlocks: protectedProcedure
    .input(
      z
        .object({
          documentId: documentIdSchema,
          body: documentBodySchema.optional(),
        })
        .strict(),
    )
    .handler(async ({ context, input }) => {
      if (!context.documents) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const { documents } = context;
      const record = await documents.get(
        context.session.user.id,
        input.documentId,
      );
      if (!record) {
        throw new ORPCError("NOT_FOUND");
      }
      return Promise.all(
        documentLiveWorkIds(input.body ?? record.body).map(async (workId) => {
          const work = await documents.getLiveWork(
            context.session.user.id,
            workId,
          );
          return {
            workId,
            source: work ?? null,
          };
        }),
      );
    }),
  pinDocumentEvidence: protectedProcedure
    .input(pinDocumentEvidenceInputSchema)
    .handler(async ({ context, input }) => {
      const accountId = context.session.user.id;
      const documentRecord = await context.documents?.get(
        accountId,
        input.documentId,
      );
      if (!documentRecord) {
        throw new ORPCError("NOT_FOUND");
      }
      if (
        documentRecord.revision !== input.documentRevision ||
        input.selectionEnd > documentRecord.body.length ||
        documentRecord.body.slice(input.selectionStart, input.selectionEnd) !==
          input.selectedText
      ) {
        throw new ORPCError("CONFLICT", {
          defined: true,
          message: "The Document changed after the text was selected.",
        });
      }
      const targetProjectId = await pinnedEvidenceTargetProjectId(
        context,
        accountId,
        input.targetRecordType,
        input.targetRecordId,
      );
      if (targetProjectId !== documentRecord.projectId) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "The evidence target is unavailable.",
        });
      }
      if (
        input.targetRecordType === "Document" &&
        input.targetRecordId === documentRecord.id
      ) {
        throw new ORPCError("BAD_REQUEST", {
          defined: true,
          message: "A Document cannot pin evidence to itself.",
        });
      }
      const mutation =
        requireUsageLinkMutationContracts(context).create(accountId);
      const { baseRevision, clientIdempotencyKey } = input;
      const payload = usageLinkPayloadSchema.parse({
        kind: "Pinned bind",
        location: {
          ...(input.targetRecordType === "Assumption"
            ? { projectId: targetProjectId }
            : {}),
          documentVersion: {
            documentId: documentRecord.id,
            revision: documentRecord.revision,
          },
          end: input.selectionEnd,
          excerpt: input.selectedText,
          start: input.selectionStart,
        },
        source: { recordId: documentRecord.id, recordType: "Document" },
        surface: {
          recordId: input.targetRecordId,
          recordType: input.targetRecordType,
        },
      });
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: accountId, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload,
            targetId: clientIdempotencyKey,
          },
          ({ committedAt, currentRevision, payload: mutationPayload }) => ({
            usageLink: usageLinkSchema.parse({
              ...mutationPayload,
              createdAt: committedAt,
              id: crypto.randomUUID(),
              revision: currentRevision + 1,
            }),
          }),
        );
        if (!receipt.nextValue.usageLink) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.usageLink;
      } catch (error) {
        rethrowUsageLinkMutationError(error, clientIdempotencyKey);
      }
    }),
  documentLiveOtherBlocks: protectedProcedure
    .input(
      z
        .object({
          documentId: documentIdSchema,
          body: documentBodySchema.optional(),
        })
        .strict(),
    )
    .handler(async ({ context, input }) => {
      if (
        !(
          context.documents &&
          context.smartCollections &&
          context.technicalDiagrams
        )
      ) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const record = await context.documents.get(
        context.session.user.id,
        input.documentId,
      );
      if (!record) {
        throw new ORPCError("NOT_FOUND");
      }
      return Promise.all(
        documentLiveDirectives(input.body ?? record.body)
          .filter(({ kind }) => kind !== "Work")
          .map(async (directive) => ({
            id: directive.id,
            kind: directive.kind,
            sectionId: directive.sectionId ?? null,
            versionId: directive.versionId ?? null,
            viewId: directive.viewId ?? null,
            source: await liveDocumentBlockSource(
              context,
              context.session.user.id,
              directive,
            ),
          })),
      );
    }),
  documentRecordReferences: protectedProcedure
    .input(
      z
        .object({
          body: documentBodySchema.optional(),
          documentId: documentIdSchema,
        })
        .strict(),
    )
    .handler(async ({ context, input }) => {
      const accountId = context.session.user.id;
      const documentRecord = await context.documents?.get(
        accountId,
        input.documentId,
      );
      if (!documentRecord) {
        throw new ORPCError("NOT_FOUND");
      }
      return Promise.all(
        parseDocumentRecordReferences(input.body ?? documentRecord.body).map(
          async (reference) => ({
            ...reference,
            source: await documentReferenceSource(
              context,
              accountId,
              reference,
            ),
          }),
        ),
      );
    }),
  createSmartCollection: protectedProcedure
    .input(createSmartCollectionInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.smartCollections) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        return await context.smartCollections.create(
          context.session.user.id,
          input,
        );
      } catch (error) {
        if (error instanceof SmartCollectionUnavailableError) {
          throw new ORPCError("NOT_FOUND", { cause: error });
        }
        if (error instanceof SmartCollectionConflictError) {
          throw new ORPCError("CONFLICT", { cause: error });
        }
        throw error;
      }
    }),
  smartCollectionViews: protectedProcedure
    .input(z.object({ projectId: projectIdSchema }).strict())
    .handler(({ context, input }) => {
      if (!context.smartCollections) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      return context.smartCollections.listViews(
        context.session.user.id,
        input.projectId,
      );
    }),
  setSmartCollectionSubscription: protectedProcedure
    .input(setSmartCollectionSubscriptionInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.smartCollections) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        return await context.smartCollections.setSubscription(
          context.session.user.id,
          input,
        );
      } catch (error) {
        if (error instanceof SmartCollectionUnavailableError) {
          throw new ORPCError("NOT_FOUND", { cause: error });
        }
        throw error;
      }
    }),
  smartCollectionView: protectedProcedure
    .input(
      z
        .object({ viewId: z.string().min(1), readOnly: z.boolean().optional() })
        .strict(),
    )
    .handler(async ({ context, input }) => {
      if (!context.smartCollections) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const view = await context.smartCollections.getView(
        context.session.user.id,
        input.viewId,
        { readOnly: input.readOnly },
      );
      if (!view) {
        throw new ORPCError("NOT_FOUND");
      }
      return view;
    }),
  projectWalls: protectedProcedure
    .input(projectWallProjectInputSchema)
    .handler(({ context, input }) =>
      runProjectWallOperation(() =>
        requireProjectWall(context).list(
          context.session.user.id,
          input.projectId,
        ),
      ),
    ),
  projectWall: protectedProcedure
    .input(projectWallInputSchema)
    .handler(({ context, input }) =>
      runProjectWallOperation(() =>
        requireProjectWall(context).get(
          context.session.user.id,
          input.projectId,
          input.wallId,
        ),
      ),
    ),
  projectWallSourceOptions: protectedProcedure
    .input(projectWallProjectInputSchema)
    .handler(({ context, input }) =>
      runProjectWallOperation(() =>
        requireProjectWall(context).sourceOptions(
          context.session.user.id,
          input.projectId,
        ),
      ),
    ),
  projectWallSkeletons: protectedProcedure
    .input(projectWallProjectInputSchema)
    .handler(({ context, input }) =>
      runProjectWallOperation(() =>
        requireProjectWall(context).skeletons(
          context.session.user.id,
          input.projectId,
        ),
      ),
    ),
  createProjectWallFromSkeleton: protectedProcedure
    .input(createProjectWallFromSkeletonInputSchema)
    .handler(({ context, input }) =>
      runProjectWallOperation(() =>
        requireProjectWall(context).createFromSkeleton(
          context.session.user.id,
          input,
        ),
      ),
    ),
  createProjectWall: protectedProcedure
    .input(createProjectWallInputSchema)
    .handler(({ context, input }) =>
      runProjectWallOperation(() =>
        requireProjectWall(context).create(context.session.user.id, input),
      ),
    ),
  renameProjectWall: protectedProcedure
    .input(renameProjectWallInputSchema)
    .handler(({ context, input }) =>
      runProjectWallOperation(() =>
        requireProjectWall(context).rename(context.session.user.id, input),
      ),
    ),
  deleteProjectWall: protectedProcedure
    .input(projectWallInputSchema)
    .handler(({ context, input }) =>
      runProjectWallOperation(() =>
        requireProjectWall(context).delete(
          context.session.user.id,
          input.projectId,
          input.wallId,
        ),
      ),
    ),
  addProjectWallCard: protectedProcedure
    .input(addProjectWallCardInputSchema)
    .handler(({ context, input }) =>
      runProjectWallOperation(() =>
        requireProjectWall(context).addCard(context.session.user.id, input),
      ),
    ),
  moveProjectWallCards: protectedProcedure
    .input(moveProjectWallCardsInputSchema)
    .handler(({ context, input }) =>
      runProjectWallOperation(() =>
        requireProjectWall(context).moveCards(context.session.user.id, input),
      ),
    ),
  reorderProjectWallCards: protectedProcedure
    .input(reorderProjectWallCardsInputSchema)
    .handler(({ context, input }) =>
      runProjectWallOperation(() =>
        requireProjectWall(context).reorderCards(
          context.session.user.id,
          input,
        ),
      ),
    ),
  projectWallViewport: protectedProcedure
    .input(projectWallViewportInputSchema)
    .handler(({ context, input }) =>
      runProjectWallOperation(() =>
        requireProjectWall(context).viewport(
          context.session.user.id,
          input.projectId,
          input.wallId,
        ),
      ),
    ),
  saveProjectWallViewport: protectedProcedure
    .input(saveProjectWallViewportInputSchema)
    .handler(({ context, input }) =>
      runProjectWallOperation(() =>
        requireProjectWall(context).saveViewport(
          context.session.user.id,
          input,
        ),
      ),
    ),
  setProjectWallCardDensity: protectedProcedure
    .input(setProjectWallCardDensityInputSchema)
    .handler(({ context, input }) =>
      runProjectWallOperation(() =>
        requireProjectWall(context).setCardDensity(
          context.session.user.id,
          input,
        ),
      ),
    ),
  setProjectWallCardDiagramPin: protectedProcedure
    .input(setProjectWallCardDiagramPinInputSchema)
    .handler(({ context, input }) =>
      runProjectWallOperation(() =>
        requireProjectWall(context).setCardPin(context.session.user.id, input),
      ),
    ),
  setProjectWallCardHighlight: protectedProcedure
    .input(setProjectWallCardHighlightInputSchema)
    .handler(({ context, input }) =>
      runProjectWallOperation(() =>
        requireProjectWall(context).setCardHighlight(
          context.session.user.id,
          input,
        ),
      ),
    ),
  removeProjectWallCard: protectedProcedure
    .input(removeProjectWallCardInputSchema)
    .handler(({ context, input }) =>
      runProjectWallOperation(() =>
        requireProjectWall(context).removeCard(context.session.user.id, input),
      ),
    ),
  drawProjectWallLink: protectedProcedure
    .input(drawProjectWallLinkInputSchema)
    .handler(({ context, input }) =>
      runProjectWallOperation(() =>
        requireProjectWall(context).drawLink(context.session.user.id, input),
      ),
    ),
  unbindProjectWallLink: protectedProcedure
    .input(unbindProjectWallLinkInputSchema)
    .handler(({ context, input }) =>
      runProjectWallOperation(() =>
        requireProjectWall(context).unbindLink(context.session.user.id, input),
      ),
    ),
  previewProjectWallPersistentRelation: protectedProcedure
    .input(previewProjectWallPersistentRelationInputSchema)
    .handler(({ context, input }) =>
      runRelationsOperation(() =>
        runProjectWallOperation(() =>
          requireProjectWall(context).previewPersistentRelation(
            context.session.user.id,
            input,
          ),
        ),
      ),
    ),
  createProjectWallPersistentRelation: protectedProcedure
    .input(createProjectWallPersistentRelationInputSchema)
    .handler(({ context, input }) =>
      runRelationsOperation(() =>
        runProjectWallOperation(() =>
          requireProjectWall(context).createPersistentRelation(
            context.session.user.id,
            input,
          ),
        ),
      ),
    ),
  setProjectWallCardLock: protectedProcedure
    .input(setProjectWallCardLockInputSchema)
    .handler(({ context, input }) =>
      runProjectWallOperation(() =>
        requireProjectWall(context).setCardLock(context.session.user.id, input),
      ),
    ),
  createProjectWallGroup: protectedProcedure
    .input(createProjectWallGroupInputSchema)
    .handler(({ context, input }) =>
      runProjectWallOperation(() =>
        requireProjectWall(context).createGroup(context.session.user.id, input),
      ),
    ),
  deleteProjectWallGroup: protectedProcedure
    .input(projectWallGroupInputSchema)
    .handler(({ context, input }) =>
      runProjectWallOperation(() =>
        requireProjectWall(context).deleteGroup(context.session.user.id, input),
      ),
    ),
  setProjectWallFocusOrder: protectedProcedure
    .input(setProjectWallFocusOrderInputSchema)
    .handler(({ context, input }) =>
      runProjectWallOperation(() =>
        requireProjectWall(context).setFocusOrder(
          context.session.user.id,
          input,
        ),
      ),
    ),
  previewProjectWallSnapshot: protectedProcedure
    .input(previewProjectWallSnapshotInputSchema)
    .handler(({ context, input }) =>
      runProjectWallOperation(() =>
        requireProjectWall(context).previewSnapshot(
          context.session.user.id,
          input,
        ),
      ),
    ),
  exportProjectWallSnapshot: protectedProcedure
    .input(exportProjectWallSnapshotInputSchema)
    .handler(({ context, input }) =>
      runProjectWallOperation(() =>
        requireProjectWall(context).exportSnapshot(
          context.session.user.id,
          input,
        ),
      ),
    ),
  setProjectWallCardGroup: protectedProcedure
    .input(setProjectWallCardGroupInputSchema)
    .handler(({ context, input }) =>
      runProjectWallOperation(() =>
        requireProjectWall(context).setCardGroup(
          context.session.user.id,
          input,
        ),
      ),
    ),
  userFlows: protectedProcedure
    .input(userFlowProjectInputSchema)
    .handler(({ context, input }) =>
      runUserFlowOperation(() =>
        requireUserFlow(context).list(context.session.user.id, input.projectId),
      ),
    ),
  userFlow: protectedProcedure
    .input(userFlowInputSchema)
    .handler(({ context, input }) =>
      runUserFlowOperation(() =>
        requireUserFlow(context).get(
          context.session.user.id,
          input.projectId,
          input.userFlowId,
        ),
      ),
    ),
  userFlowScreens: protectedProcedure
    .input(userFlowProjectInputSchema)
    .handler(({ context, input }) =>
      runUserFlowOperation(() =>
        requireUserFlow(context).screens(
          context.session.user.id,
          input.projectId,
        ),
      ),
    ),
  createUserFlow: protectedProcedure
    .input(createUserFlowInputSchema)
    .handler(({ context, input }) =>
      runUserFlowOperation(() =>
        requireUserFlow(context).create(context.session.user.id, input),
      ),
    ),
  saveUserFlowVersion: protectedProcedure
    .input(saveUserFlowVersionInputSchema)
    .handler(({ context, input }) =>
      runUserFlowOperation(() =>
        requireUserFlow(context).save(context.session.user.id, input),
      ),
    ),
  placeUserFlowNode: protectedProcedure
    .input(placeUserFlowNodeInputSchema)
    .handler(({ context, input }) =>
      runUserFlowOperation(() =>
        requireUserFlow(context).placeNode(context.session.user.id, input),
      ),
    ),
  userFlowCardRecords: protectedProcedure
    .input(userFlowProjectInputSchema)
    .handler(({ context, input }) =>
      runUserFlowOperation(() =>
        requireUserFlow(context).cardRecords(
          context.session.user.id,
          input.projectId,
        ),
      ),
    ),
  userFlowBinds: protectedProcedure
    .input(userFlowInputSchema)
    .handler(({ context, input }) =>
      runUserFlowOperation(() =>
        requireUserFlow(context).binds(
          context.session.user.id,
          input.projectId,
          input.userFlowId,
        ),
      ),
    ),
  previewUserFlowConvert: protectedProcedure
    .input(previewConvertUserFlowNodeInputSchema)
    .handler(({ context, input }) =>
      runUserFlowOperation(() =>
        requireUserFlow(context).previewConvert(context.session.user.id, input),
      ),
    ),
  convertUserFlowNode: protectedProcedure
    .input(convertUserFlowNodeInputSchema)
    .handler(({ context, input }) =>
      runUserFlowOperation(() =>
        requireUserFlow(context).convertNode(context.session.user.id, input),
      ),
    ),
  previewUserFlowRebind: protectedProcedure
    .input(previewRebindUserFlowBindInputSchema)
    .handler(({ context, input }) =>
      runUserFlowOperation(() =>
        requireUserFlow(context).previewRebind(context.session.user.id, input),
      ),
    ),
  rebindUserFlowBind: protectedProcedure
    .input(rebindUserFlowBindInputSchema)
    .handler(({ context, input }) =>
      runUserFlowOperation(() =>
        requireUserFlow(context).rebind(context.session.user.id, input),
      ),
    ),
  promoteUserFlowNode: protectedProcedure
    .input(promoteUserFlowNodeInputSchema)
    .handler(({ context, input }) =>
      runUserFlowOperation(() =>
        requireUserFlow(context).promoteToScreen(
          context.session.user.id,
          input,
        ),
      ),
    ),
  placeUserFlowCard: protectedProcedure
    .input(placeUserFlowCardInputSchema)
    .handler(({ context, input }) =>
      runUserFlowOperation(() =>
        requireUserFlow(context).placeCard(context.session.user.id, input),
      ),
    ),
  userFlowViewport: protectedProcedure
    .input(userFlowInputSchema)
    .handler(({ context, input }) =>
      runUserFlowOperation(() =>
        requireUserFlow(context).viewport(
          context.session.user.id,
          input.projectId,
          input.userFlowId,
        ),
      ),
    ),
  saveUserFlowViewport: protectedProcedure
    .input(saveUserFlowViewportInputSchema)
    .handler(({ context, input }) =>
      runUserFlowOperation(() =>
        requireUserFlow(context).saveViewport(context.session.user.id, input),
      ),
    ),
  userFlowTemplates: protectedProcedure
    .input(userFlowProjectInputSchema)
    .handler(({ context, input }) =>
      runUserFlowOperation(() =>
        requireUserFlow(context).templates(
          context.session.user.id,
          input.projectId,
        ),
      ),
    ),
  saveUserFlowTemplate: protectedProcedure
    .input(saveUserFlowTemplateInputSchema)
    .handler(({ context, input }) =>
      runUserFlowOperation(() =>
        requireUserFlow(context).saveTemplate(context.session.user.id, input),
      ),
    ),
  createUserFlowFromTemplate: protectedProcedure
    .input(createUserFlowFromTemplateInputSchema)
    .handler(({ context, input }) =>
      runUserFlowOperation(() =>
        requireUserFlow(context).createFromTemplate(
          context.session.user.id,
          input,
        ),
      ),
    ),
  moodboards: protectedProcedure
    .input(moodboardsProjectInputSchema)
    .handler(async ({ context, input }) => {
      const moodboards = await requireMoodboards(context).list(
        context.session.user.id,
        input.projectId,
      );
      if (!moodboards) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "The Project Moodboards are unavailable.",
        });
      }
      return moodboards;
    }),
  createMoodboard: protectedProcedure
    .input(createMoodboardMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const parsed = createMoodboardInputSchema.parse(payloadInput);
      const targetId = clientIdempotencyKey;
      const mutation = requireMoodboardMutationContracts(context).create(
        context.session.user.id,
      );
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          ({ currentRevision, payload }) =>
            newMoodboard({
              id: targetId,
              now: new Date().toISOString(),
              payload,
              revision: currentRevision + 1,
            }),
        );
        if (!receipt.nextValue.moodboard) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.moodboard;
      } catch (error) {
        rethrowMoodboardMutationError(error, targetId);
      }
    }),
  addMoodboardVisual: protectedProcedure
    .input(addMoodboardVisualMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const parsed = addMoodboardVisualInputSchema.parse(payloadInput);
      const targetId = parsed.moodboardId;
      const mutation = requireMoodboardMutationContracts(context).addVisual(
        context.session.user.id,
      );
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          ({ currentRevision, currentValue, payload }) =>
            withAddedVisual(currentValue, {
              itemId: clientIdempotencyKey,
              now: new Date().toISOString(),
              payload,
              revision: currentRevision + 1,
            }),
        );
        if (!receipt.nextValue.moodboard) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.moodboard;
      } catch (error) {
        rethrowMoodboardMutationError(error, targetId);
      }
    }),
  updateMoodboardVisualCaption: protectedProcedure
    .input(updateMoodboardVisualCaptionMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const parsed =
        updateMoodboardVisualCaptionInputSchema.parse(payloadInput);
      const targetId = parsed.moodboardId;
      const mutation = requireMoodboardMutationContracts(
        context,
      ).updateVisualCaption(context.session.user.id);
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          ({ currentRevision, currentValue, payload }) =>
            withVisualCaption(currentValue, {
              now: new Date().toISOString(),
              payload,
              revision: currentRevision + 1,
            }),
        );
        if (!receipt.nextValue.moodboard) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.moodboard;
      } catch (error) {
        rethrowMoodboardMutationError(error, targetId);
      }
    }),
  addColorSwatch: protectedProcedure
    .input(addColorSwatchMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const parsed = addColorSwatchInputSchema.parse(payloadInput);
      const targetId = parsed.moodboardId;
      const mutation = requireMoodboardMutationContracts(
        context,
      ).addColorSwatch(context.session.user.id);
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          ({ currentRevision, currentValue, payload }) =>
            withAddedColorSwatch(currentValue, {
              itemId: clientIdempotencyKey,
              now: new Date().toISOString(),
              payload,
              revision: currentRevision + 1,
            }),
        );
        if (!receipt.nextValue.moodboard) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.moodboard;
      } catch (error) {
        rethrowMoodboardMutationError(error, targetId);
      }
    }),
  addPaletteGroup: protectedProcedure
    .input(addPaletteGroupMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const parsed = addPaletteGroupInputSchema.parse(payloadInput);
      const targetId = parsed.moodboardId;
      const mutation = requireMoodboardMutationContracts(
        context,
      ).addPaletteGroup(context.session.user.id);
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          ({ currentRevision, currentValue, payload }) =>
            withAddedPaletteGroup(currentValue, {
              groupId: clientIdempotencyKey,
              now: new Date().toISOString(),
              payload,
              revision: currentRevision + 1,
            }),
        );
        if (!receipt.nextValue.moodboard) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.moodboard;
      } catch (error) {
        rethrowMoodboardMutationError(error, targetId);
      }
    }),
  assignColorSwatchPaletteGroup: protectedProcedure
    .input(assignColorSwatchPaletteGroupMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const parsed =
        assignColorSwatchPaletteGroupInputSchema.parse(payloadInput);
      const targetId = parsed.moodboardId;
      const mutation = requireMoodboardMutationContracts(
        context,
      ).assignColorSwatchPaletteGroup(context.session.user.id);
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          ({ currentRevision, currentValue, payload }) =>
            withColorSwatchPaletteGroup(currentValue, {
              now: new Date().toISOString(),
              payload,
              revision: currentRevision + 1,
            }),
        );
        if (!receipt.nextValue.moodboard) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.moodboard;
      } catch (error) {
        rethrowMoodboardMutationError(error, targetId);
      }
    }),
  setMoodboardVisualView: protectedProcedure
    .input(setMoodboardVisualViewMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const parsed = setMoodboardVisualViewInputSchema.parse(payloadInput);
      const targetId = parsed.moodboardId;
      const mutation = requireMoodboardMutationContracts(context).setVisualView(
        context.session.user.id,
      );
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          ({ currentRevision, currentValue, payload }) =>
            withVisualView(currentValue, {
              now: new Date().toISOString(),
              payload,
              revision: currentRevision + 1,
            }),
        );
        if (!receipt.nextValue.moodboard) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.moodboard;
      } catch (error) {
        rethrowMoodboardMutationError(error, targetId);
      }
    }),
  setMoodboardFocusOrder: protectedProcedure
    .input(setMoodboardFocusOrderMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const parsed = setMoodboardFocusOrderInputSchema.parse(payloadInput);
      const targetId = parsed.moodboardId;
      const mutation = requireMoodboardMutationContracts(context).setFocusOrder(
        context.session.user.id,
      );
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          ({ currentRevision, currentValue, payload }) =>
            withFocusOrder(currentValue, {
              now: new Date().toISOString(),
              payload,
              revision: currentRevision + 1,
            }),
        );
        if (!receipt.nextValue.moodboard) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.moodboard;
      } catch (error) {
        rethrowMoodboardMutationError(error, targetId);
      }
    }),
  reorderMoodboardItems: protectedProcedure
    .input(reorderMoodboardItemsMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const parsed = reorderMoodboardItemsInputSchema.parse(payloadInput);
      const targetId = parsed.moodboardId;
      const mutation = requireMoodboardMutationContracts(context).reorderItems(
        context.session.user.id,
      );
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          ({ currentRevision, currentValue, payload }) =>
            withReorderedItems(currentValue, {
              now: new Date().toISOString(),
              payload,
              revision: currentRevision + 1,
            }),
        );
        if (!receipt.nextValue.moodboard) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.moodboard;
      } catch (error) {
        rethrowMoodboardMutationError(error, targetId);
      }
    }),
  moodboardPersonalView: protectedProcedure
    .input(personalMoodboardViewInputSchema)
    .handler(async ({ context, input }) => {
      const view = await requireMoodboardPersonalViews(context).get(
        context.session.user.id,
        input.moodboardId,
      );
      if (!view) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "The Moodboard is unavailable.",
        });
      }
      return view;
    }),
  saveMoodboardPersonalView: protectedProcedure
    .input(savePersonalMoodboardViewInputSchema)
    .handler(async ({ context, input }) => {
      const view = await requireMoodboardPersonalViews(context).save(
        context.session.user.id,
        input.moodboardId,
        input.view,
      );
      if (!view) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "The Moodboard is unavailable.",
        });
      }
      return view;
    }),
  moodboardSnapshotPreview: protectedProcedure
    .input(moodboardSnapshotPreviewInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const preview = await requireMoodboardSnapshots(context).preview(
          context.session.user.id,
          input,
        );
        if (!preview) {
          throw new ORPCError("NOT_FOUND");
        }
        return preview;
      } catch (error) {
        rethrowMoodboardSnapshotError(error);
      }
    }),
  exportMoodboardSnapshot: protectedProcedure
    .input(moodboardSnapshotExportInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const output = await requireMoodboardSnapshots(context).export(
          context.session.user.id,
          input,
        );
        if (!output) {
          throw new ORPCError("NOT_FOUND");
        }
        return output;
      } catch (error) {
        rethrowMoodboardSnapshotError(error);
      }
    }),
  schemaDdlPreview: protectedProcedure
    .input(schemaDdlPreviewInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.schemaArtifacts) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const preview = await context.schemaArtifacts.previewDdl(
        context.session.user.id,
        input,
      );
      if (!preview) {
        throw new ORPCError("NOT_FOUND");
      }
      return preview;
    }),
  confirmMigrationArtifact: protectedProcedure
    .input(confirmMigrationArtifactInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.schemaArtifacts) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        const artifact = await context.schemaArtifacts.confirmArtifact(
          context.session.user.id,
          input,
        );
        if (!artifact) {
          throw new ORPCError("NOT_FOUND");
        }
        return artifact;
      } catch (error) {
        if (error instanceof SchemaArtifactError) {
          throw new ORPCError("BAD_REQUEST", { cause: error });
        }
        throw error;
      }
    }),
  migrationArtifacts: protectedProcedure
    .input(migrationArtifactListInputSchema)
    .handler(({ context, input }) => {
      if (!context.schemaArtifacts) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      return context.schemaArtifacts.listArtifacts(
        context.session.user.id,
        input.diagramId,
      );
    }),
  migrationArtifactExport: protectedProcedure
    .input(migrationArtifactInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.schemaArtifacts) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const exported = await context.schemaArtifacts.exportArtifact(
        context.session.user.id,
        input.artifactId,
      );
      if (!exported) {
        throw new ORPCError("NOT_FOUND");
      }
      return exported;
    }),
  schemaChangePreview: protectedProcedure
    .input(schemaChangePreviewInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.schemaArtifacts) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        const preview = await context.schemaArtifacts.previewChange(
          context.session.user.id,
          input,
        );
        if (!preview) {
          throw new ORPCError("NOT_FOUND");
        }
        return preview;
      } catch (error) {
        if (error instanceof SchemaArtifactError) {
          throw new ORPCError("BAD_REQUEST", { cause: error });
        }
        throw error;
      }
    }),
  technicalDiagrams: protectedProcedure
    .input(z.object({ projectId: projectIdSchema }).strict())
    .handler(({ context, input }) => {
      if (!context.technicalDiagrams) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      return context.technicalDiagrams.list(
        context.session.user.id,
        input.projectId,
      );
    }),
  technicalDiagram: protectedProcedure
    .input(
      z
        .object({
          diagramId: z.string().min(1),
          viewId: z.string().min(1).optional(),
        })
        .strict(),
    )
    .handler(async ({ context, input }) => {
      if (!context.technicalDiagrams) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const diagram = await context.technicalDiagrams.get(
        context.session.user.id,
        input.diagramId,
        input.viewId,
      );
      if (!diagram) {
        throw new ORPCError("NOT_FOUND");
      }
      return diagram;
    }),
  createTechnicalDiagram: protectedProcedure
    .input(createTechnicalDiagramInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.technicalDiagrams) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        const diagram = await context.technicalDiagrams.create(
          context.session.user.id,
          input,
        );
        if (!diagram) {
          throw new ORPCError("NOT_FOUND");
        }
        return diagram;
      } catch (error) {
        if (error instanceof ORPCError) {
          throw error;
        }
        throw new ORPCError(
          error instanceof DiagramAuthorityError ||
            error instanceof StructuralModelError
            ? "BAD_REQUEST"
            : "CONFLICT",
          { cause: error },
        );
      }
    }),
  previewDiagramAuthorityConversion: protectedProcedure
    .input(authorityConversionInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.technicalDiagrams) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const preview =
        await context.technicalDiagrams.previewAuthorityConversion(
          context.session.user.id,
          input,
        );
      if (!preview) {
        throw new ORPCError("NOT_FOUND");
      }
      return preview;
    }),
  convertDiagramAuthority: protectedProcedure
    .input(confirmAuthorityConversionInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.technicalDiagrams) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        const diagram = await context.technicalDiagrams.convertAuthority(
          context.session.user.id,
          input,
        );
        if (!diagram) {
          throw new ORPCError("NOT_FOUND");
        }
        return diagram;
      } catch (error) {
        if (error instanceof ORPCError) {
          throw error;
        }
        throw new ORPCError(
          error instanceof DiagramAuthorityError ||
            error instanceof StructuralModelError
            ? "BAD_REQUEST"
            : "CONFLICT",
          { cause: error },
        );
      }
    }),
  createDiagramView: protectedProcedure
    .input(createDiagramViewInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.technicalDiagrams) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        const view = await context.technicalDiagrams.createView(
          context.session.user.id,
          input,
        );
        if (!view) {
          throw new ORPCError("NOT_FOUND");
        }
        return view;
      } catch (error) {
        if (error instanceof ORPCError) {
          throw error;
        }
        throw new ORPCError("CONFLICT", { cause: error });
      }
    }),
  createDiagramVersion: protectedProcedure
    .input(createDiagramVersionInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.technicalDiagrams) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        const version = await context.technicalDiagrams.createVersion(
          context.session.user.id,
          input,
        );
        if (!version) {
          throw new ORPCError("NOT_FOUND");
        }
        return version;
      } catch (error) {
        if (error instanceof ORPCError) {
          throw error;
        }
        throw new ORPCError("CONFLICT", { cause: error });
      }
    }),
  technicalDiagramRecordCards: protectedProcedure
    .input(z.object({ diagramId: z.string().min(1) }).strict())
    .handler(async ({ context, input }) => {
      if (!context.technicalDiagrams) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const cards = await context.technicalDiagrams.listRecordCards(
        context.session.user.id,
        input.diagramId,
      );
      if (!cards) {
        throw new ORPCError("NOT_FOUND");
      }
      return cards;
    }),
  placeDiagramRecordCard: protectedProcedure
    .input(placeDiagramRecordCardInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.technicalDiagrams) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        const card = await context.technicalDiagrams.placeRecordCard(
          context.session.user.id,
          input,
        );
        if (!card) {
          throw new ORPCError("NOT_FOUND");
        }
        return card;
      } catch (error) {
        if (error instanceof ORPCError) {
          throw error;
        }
        throw new ORPCError("CONFLICT", { cause: error });
      }
    }),
  moveDiagramRecordCard: protectedProcedure
    .input(moveDiagramRecordCardInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.technicalDiagrams) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const card = await context.technicalDiagrams.moveRecordCard(
        context.session.user.id,
        input,
      );
      if (!card) {
        throw new ORPCError("NOT_FOUND");
      }
      return card;
    }),
  removeDiagramRecordCard: protectedProcedure
    .input(removeDiagramRecordCardInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.technicalDiagrams) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      if (
        !(await context.technicalDiagrams.removeRecordCard(
          context.session.user.id,
          input,
        ))
      ) {
        throw new ORPCError("NOT_FOUND");
      }
      return { removed: true };
    }),
  previewDiagramNodeConversion: protectedProcedure
    .input(previewConvertToRecordInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.technicalDiagrams) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        const plan = await context.technicalDiagrams.previewConvertToRecord(
          context.session.user.id,
          input,
        );
        if (!plan) {
          throw new ORPCError("NOT_FOUND");
        }
        return plan;
      } catch (error) {
        if (error instanceof DiagramConversionError) {
          throw new ORPCError("CONFLICT", { cause: error });
        }
        throw error;
      }
    }),
  convertDiagramNodeToRecord: protectedProcedure
    .input(confirmConvertToRecordInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.technicalDiagrams) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        const linked = await context.technicalDiagrams.convertToRecord(
          context.session.user.id,
          input,
        );
        if (!linked) {
          throw new ORPCError("NOT_FOUND");
        }
        return linked;
      } catch (error) {
        if (error instanceof DiagramConversionError) {
          throw new ORPCError("CONFLICT", { cause: error });
        }
        throw error;
      }
    }),
  technicalDiagramVersions: protectedProcedure
    .input(z.object({ diagramId: z.string().min(1) }).strict())
    .handler(async ({ context, input }) => {
      if (!context.technicalDiagrams) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const versions = await context.technicalDiagrams.listVersions(
        context.session.user.id,
        input.diagramId,
      );
      if (!versions) {
        throw new ORPCError("NOT_FOUND");
      }
      return versions;
    }),
  technicalDiagramVersion: protectedProcedure
    .input(z.object({ versionId: z.string().min(1) }).strict())
    .handler(async ({ context, input }) => {
      if (!context.technicalDiagrams) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const version = await context.technicalDiagrams.getVersion(
        context.session.user.id,
        input.versionId,
      );
      if (!version) {
        throw new ORPCError("NOT_FOUND");
      }
      return version;
    }),
  restoreDiagramVersion: protectedProcedure
    .input(restoreDiagramVersionInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.technicalDiagrams) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        const diagram = await context.technicalDiagrams.restoreVersion(
          context.session.user.id,
          input,
        );
        if (!diagram) {
          throw new ORPCError("NOT_FOUND");
        }
        return diagram;
      } catch (error) {
        if (error instanceof ORPCError) {
          throw error;
        }
        throw new ORPCError("CONFLICT", { cause: error });
      }
    }),
  saveTechnicalDiagramStructure: protectedProcedure
    .input(saveTechnicalDiagramModelInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.technicalDiagrams) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        const diagram = await context.technicalDiagrams.saveModel(
          context.session.user.id,
          input,
        );
        if (!diagram) {
          throw new ORPCError("NOT_FOUND");
        }
        return diagram;
      } catch (error) {
        if (error instanceof ORPCError) {
          throw error;
        }
        throw new ORPCError(
          error instanceof StructuralModelError ? "BAD_REQUEST" : "CONFLICT",
          { cause: error },
        );
      }
    }),
  saveDiagramLayout: protectedProcedure
    .input(saveDiagramLayoutInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.technicalDiagrams) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        const diagram = await context.technicalDiagrams.saveLayout(
          context.session.user.id,
          input,
        );
        if (!diagram) {
          throw new ORPCError("NOT_FOUND");
        }
        return diagram;
      } catch (error) {
        if (error instanceof ORPCError) {
          throw error;
        }
        throw new ORPCError(
          error instanceof StructuralModelError ? "BAD_REQUEST" : "CONFLICT",
          { cause: error },
        );
      }
    }),
  technicalDiagramViewport: protectedProcedure
    .input(technicalDiagramViewportInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.technicalDiagrams) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const result = await context.technicalDiagrams.viewport(
        context.session.user.id,
        input,
      );
      if (!result) {
        throw new ORPCError("NOT_FOUND");
      }
      return result.viewport;
    }),
  saveTechnicalDiagramViewport: protectedProcedure
    .input(saveTechnicalDiagramViewportInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.technicalDiagrams) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const saved = await context.technicalDiagrams.saveViewport(
        context.session.user.id,
        input,
      );
      if (!saved) {
        throw new ORPCError("NOT_FOUND");
      }
      return saved;
    }),
  technicalDiagramViews: protectedProcedure
    .input(z.object({ diagramId: z.string().min(1) }).strict())
    .handler(async ({ context, input }) => {
      if (!context.technicalDiagrams) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const views = await context.technicalDiagrams.listViews(
        context.session.user.id,
        input.diagramId,
      );
      if (!views) {
        throw new ORPCError("NOT_FOUND");
      }
      return views;
    }),
  previewMermaidConversion: protectedProcedure
    .input(mermaidConversionInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.technicalDiagrams) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        const preview = await context.technicalDiagrams.previewConversion(
          context.session.user.id,
          input,
        );
        if (!preview) {
          throw new ORPCError("NOT_FOUND");
        }
        return preview;
      } catch (error) {
        if (error instanceof ORPCError) {
          throw error;
        }
        throw new ORPCError("BAD_REQUEST", { cause: error });
      }
    }),
  convertMermaidToTechnicalDiagram: protectedProcedure
    .input(confirmMermaidConversionInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.technicalDiagrams) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        const diagram = await context.technicalDiagrams.convert(
          context.session.user.id,
          input,
        );
        if (!diagram) {
          throw new ORPCError("NOT_FOUND");
        }
        return diagram;
      } catch (error) {
        if (error instanceof ORPCError) {
          throw error;
        }
        throw new ORPCError("CONFLICT", { cause: error });
      }
    }),
  documentVersions: protectedProcedure
    .input(z.object({ documentId: documentIdSchema }).strict())
    .handler(async ({ context, input }) => {
      if (!context.documents) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const versions = await context.documents.versions(
        context.session.user.id,
        input.documentId,
      );
      if (!versions) {
        throw new ORPCError("NOT_FOUND");
      }
      return versions;
    }),
  documentVersion: protectedProcedure
    .input(documentVersionInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.documents) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const version = await context.documents.getVersion(
        context.session.user.id,
        input.documentId,
        input.revision,
      );
      if (!version) {
        throw new ORPCError("NOT_FOUND");
      }
      return version;
    }),
  restoreDocumentVersion: protectedProcedure
    .input(restoreDocumentVersionInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.documents) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const selected = await context.documents.getVersion(
        context.session.user.id,
        input.documentId,
        input.revision,
      );
      if (!selected) {
        throw new ORPCError("NOT_FOUND");
      }
      const mutation = requireDocumentMutationContracts(context).update(
        context.session.user.id,
      );
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision: input.baseRevision,
            clientIdempotencyKey: input.clientIdempotencyKey,
            kind: "human",
            payload: {
              documentId: input.documentId,
              title: selected.title,
              body: selected.body,
              type: selected.type,
            },
            targetId: input.documentId,
          },
          ({ committedAt, currentRevision, currentValue }) =>
            ({
              document: currentValue.document
                ? documentSchema.parse({
                    ...currentValue.document,
                    title: selected.title,
                    body: selected.body,
                    inlineTags: selected.inlineTags,
                    type: selected.type,
                    revision: currentRevision + 1,
                    updatedAt: committedAt,
                  })
                : null,
            }) satisfies DocumentMutationValue,
        );
        if (!receipt.nextValue.document) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.document;
      } catch (error) {
        rethrowDocumentMutationError(error, input.documentId);
      }
    }),
  previewDocumentTransfer: protectedProcedure
    .input(
      z.union([documentTransferInputSchema, wikiDocumentTransferInputSchema]),
    )
    .handler(async ({ context, input }) => {
      if (input.action === "move" || input.action === "copy") {
        return previewWikiDocumentTransfer(
          context,
          context.session.user.id,
          input,
        );
      }
      if (!context.documentTransfers) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        const preview = await context.documentTransfers.preview(
          context.session.user.id,
          input,
        );
        if (
          context.documents?.previewTransfer &&
          (input.action === "Move" || input.action === "Copy")
        ) {
          const source = await context.documents.get(
            context.session.user.id,
            input.documentId,
          );
          if (!source) {
            throw new DocumentUnavailableError();
          }
          if (input.action === "Copy" && !input.newDocumentId) {
            throw new ORPCError("BAD_REQUEST");
          }
          const selection: WikiDocumentTransferInput =
            input.action === "Move"
              ? {
                  action: "move",
                  documentId: input.documentId,
                  documentRevision: input.sourceRevision,
                  targetProjectId: input.targetProjectId,
                  children: preview.documents
                    .filter((item) => item.id !== input.documentId)
                    .map(({ id, revision }) => ({ id, revision })),
                }
              : {
                  action: "copy",
                  documentId: input.documentId,
                  documentRevision: source.revision,
                  targetProjectId: input.targetProjectId,
                  sourceRevision: input.sourceRevision,
                  copyDocumentId: input.newDocumentId ?? "",
                };
          const scopePreview = await previewWikiDocumentTransfer(
            context,
            context.session.user.id,
            selection,
          );
          return {
            ...preview,
            descendants: scopePreview.descendants,
            detachedChildren: scopePreview.detachedChildren,
            references: scopePreview.references,
          };
        }
        return preview;
      } catch (error) {
        if (error instanceof DocumentUnavailableError) {
          throw new ORPCError("NOT_FOUND", { cause: error });
        }
        throw new ORPCError("BAD_REQUEST", {
          cause: error,
          message:
            error instanceof Error
              ? error.message
              : "Document selection is unavailable.",
        });
      }
    }),
  transferDocument: protectedProcedure
    .input(
      z.union([
        documentTransferMutationInputSchema,
        transferDocumentMutationInputSchema,
      ]),
    )
    .handler(async ({ context, input }) => {
      if (input.action === "move" || input.action === "copy") {
        return transferWikiDocument(context, context.session.user.id, input);
      }
      if (!context.documentTransfers) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const { baseRevision, clientIdempotencyKey, ...command } = input;
      try {
        const receipt = await context.documentTransfers
          .mutation(context.session.user.id)
          .mutate(
            {
              actor: { actorId: context.session.user.id, type: "User" },
              kind: "human",
              clientIdempotencyKey,
              baseRevision,
              targetId:
                command.action === "Copy"
                  ? (command.newDocumentId ?? "")
                  : command.documentId,
              payload: command,
            },
            ({ currentValue }) => ({ ...currentValue, command }),
          );
        if (!receipt.nextValue.document) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.document;
      } catch (error) {
        rethrowDocumentMutationError(error, command.documentId);
      }
    }),
  exportDocument: protectedProcedure
    .input(
      z
        .object({
          documentId: documentIdSchema,
          revision: z.number().int().positive(),
          format: z.enum(["Markdown", "PDF"]),
        })
        .strict(),
    )
    .handler(async ({ context, input }) => {
      if (!context.documentTransfers) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        const snapshot = await context.documentTransfers.snapshot(
          context.session.user.id,
          input.documentId,
          input.revision,
        );
        return {
          ...snapshot,
          format: input.format,
          content:
            input.format === "PDF"
              ? await context.documentTransfers.pdf(snapshot)
              : snapshot.markdown,
        };
      } catch (error) {
        if (error instanceof DocumentUnavailableError) {
          throw new ORPCError("NOT_FOUND", { cause: error });
        }
        if (error instanceof DocumentTransferError) {
          throw new ORPCError("BAD_REQUEST", {
            message: error.message,
            cause: error,
          });
        }
        throw error;
      }
    }),
  previewDocumentOrganization: protectedProcedure
    .input(documentOrganizationInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.documents?.previewOrganization) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        return await context.documents.previewOrganization(
          context.session.user.id,
          input,
        );
      } catch (error) {
        if (error instanceof DocumentUnavailableError) {
          throw new ORPCError("NOT_FOUND", { cause: error });
        }
        throw error;
      }
    }),
  organizeDocument: protectedProcedure
    .input(organizeDocumentMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const payload = documentOrganizationInputSchema.parse(payloadInput);
      const mutation = requireDocumentMutationContracts(context).organize?.(
        context.session.user.id,
      );
      if (!mutation) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload,
            targetId: payload.documentId,
          },
          ({ committedAt, currentRevision, currentValue }) => {
            const current = currentValue.document;
            return {
              document: current
                ? documentSchema.parse({
                    ...current,
                    ...(payload.action === "archive"
                      ? { archivedAt: payload.archived ? committedAt : null }
                      : {
                          folder: payload.folder,
                          parentDocumentId: payload.parentDocumentId,
                        }),
                    revision: currentRevision + 1,
                    updatedAt: committedAt,
                  })
                : null,
            } satisfies DocumentMutationValue;
          },
        );
        if (!receipt.nextValue.document) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.document;
      } catch (error) {
        rethrowDocumentMutationError(error, payload.documentId);
      }
    }),
  createDocument: protectedProcedure
    .input(createDocumentMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const payloadSource: Record<string, unknown> = payloadInput;
      const { conflictDraftId, ...creationSource } = payloadSource;
      const payload = documentCreationInputSchema.parse(creationSource);
      const conflictDraftOwnerId =
        typeof conflictDraftId === "string" ? conflictDraftId : undefined;
      const mutation = requireDocumentMutationContracts(context).create(
        context.session.user.id,
      );
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload,
            targetId: clientIdempotencyKey,
          },
          ({ committedAt, currentRevision }) =>
            ({
              document: documentSchema.parse({
                ...documentCreationFields(payload),
                createdAt: committedAt,
                id: crypto.randomUUID(),
                revision: currentRevision + 1,
                updatedAt: committedAt,
              }),
              ...(conflictDraftOwnerId
                ? { conflictDraftId: conflictDraftOwnerId }
                : {}),
            }) satisfies DocumentMutationValue,
        );
        if (!receipt.nextValue.document) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.document;
      } catch (error) {
        rethrowDocumentMutationError(error, clientIdempotencyKey);
      }
    }),
  updateDocument: protectedProcedure
    .input(updateDocumentMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const payload = updateDocumentInputSchema.parse(payloadInput);
      const mutation = requireDocumentMutationContracts(context).update(
        context.session.user.id,
      );
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload,
            targetId: payload.documentId,
          },
          ({ committedAt, currentRevision, currentValue }) => {
            const current = currentValue.document;
            return {
              ...(payload.conflictDraftId
                ? { conflictDraftId: payload.conflictDraftId }
                : {}),
              document: current
                ? documentSchema.parse({
                    ...current,
                    ...(payload.title === undefined
                      ? {}
                      : { title: payload.title }),
                    ...(payload.body === undefined
                      ? {}
                      : { body: payload.body }),
                    ...(payload.type === undefined
                      ? {}
                      : { type: payload.type }),
                    revision: currentRevision + 1,
                    updatedAt: committedAt,
                  })
                : null,
            } satisfies DocumentMutationValue;
          },
        );
        if (!receipt.nextValue.document) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.document;
      } catch (error) {
        if (
          isRecord(error) &&
          error.code === "STALE_BASE_REVISION" &&
          context.documents?.captureConflictDraft &&
          !payload.conflictDraftId
        ) {
          let conflictDraft: Awaited<
            ReturnType<
              NonNullable<typeof context.documents.captureConflictDraft>
            >
          >;
          try {
            conflictDraft = await context.documents.captureConflictDraft(
              context.session.user.id,
              input,
            );
          } catch (captureError) {
            rethrowDocumentMutationError(captureError, payload.documentId);
          }
          throw new ORPCError("PRECONDITION_FAILED", {
            cause: error,
            defined: true,
            message: "Conflict Draft",
            data: {
              code: "STALE_BASE_REVISION",
              conflictDraft,
              currentRevision: error.currentRevision,
              currentValue: error.currentValue,
              targetId: payload.documentId,
            },
          });
        }
        rethrowDocumentMutationError(error, payload.documentId);
      }
    }),
  externalExecutionHandoffs: protectedProcedure
    .input(listExternalExecutionHandoffsInputSchema)
    .handler(async ({ context, input }) => {
      const handoffs = await requireExternalExecutionHandoffs(context).list(
        context.session.user.id,
        input.workId,
      );
      if (!handoffs) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Work is unavailable.",
        });
      }
      return handoffs;
    }),
  externalExecutionHandoffHistory: protectedProcedure
    .input(listExternalExecutionHandoffHistoryInputSchema)
    .handler(async ({ context, input }) => {
      const history = await requireExternalExecutionHandoffs(
        context,
      ).listHistory(context.session.user.id, input.workId);
      if (!history) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Work is unavailable.",
        });
      }
      return history;
    }),
  externalExecutionHandoffRelatedWorks: protectedProcedure
    .input(listExternalExecutionHandoffRelatedWorksInputSchema)
    .handler(async ({ context, input }) => {
      const works = await requireExternalExecutionHandoffs(
        context,
      ).listRelatedWorks(context.session.user.id, input.workId);
      if (!works) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Handoff is unavailable.",
        });
      }
      return works;
    }),
  previewExternalExecutionHandoffReconcile: protectedProcedure
    .input(previewExternalExecutionHandoffReconcileInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const preview = await requireExternalExecutionHandoffs(
          context,
        ).previewReconcile(context.session.user.id, input);
        if (!preview) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Handoff is unavailable.",
          });
        }
        return preview;
      } catch (error) {
        rethrowExternalExecutionHandoffError(error);
      }
    }),
  recordExternalExecutionHandoffReturn: protectedProcedure
    .input(recordExternalExecutionHandoffReturnInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const handoff = await requireExternalExecutionHandoffs(
          context,
        ).recordReturn(context.session.user.id, input);
        if (!handoff) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Handoff is unavailable.",
          });
        }
        return handoff;
      } catch (error) {
        rethrowExternalExecutionHandoffError(error);
      }
    }),
  confirmExternalExecutionHandoffReconcile: protectedProcedure
    .input(confirmExternalExecutionHandoffReconcileInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const handoff = await requireExternalExecutionHandoffs(
          context,
        ).confirmReconcile(context.session.user.id, input);
        if (!handoff) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Handoff is unavailable.",
          });
        }
        return handoff;
      } catch (error) {
        rethrowExternalExecutionHandoffError(error);
      }
    }),
  startExternalExecutionHandoff: protectedProcedure
    .input(startExternalExecutionHandoffMutationInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const handoff = await requireExternalExecutionHandoffs(context).start(
          context.session.user.id,
          input,
        );
        if (!handoff) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Work is unavailable.",
          });
        }
        return handoff;
      } catch (error) {
        rethrowExternalExecutionHandoffError(error);
      }
    }),
  cancelExternalExecutionHandoff: protectedProcedure
    .input(cancelExternalExecutionHandoffInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const handoff = await requireExternalExecutionHandoffs(context).cancel(
          context.session.user.id,
          input,
        );
        if (!handoff) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Handoff is unavailable.",
          });
        }
        return handoff;
      } catch (error) {
        rethrowExternalExecutionHandoffError(error);
      }
    }),
  recordExternalExecutionHandoffPackageExport: protectedProcedure
    .input(recordExternalExecutionHandoffPackageExportInputSchema)
    .handler(async ({ context, input }) => {
      const event = await requireExternalExecutionHandoffs(
        context,
      ).recordPackageExport(context.session.user.id, input);
      if (!event) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Handoff is unavailable.",
        });
      }
      return event;
    }),
  workTemplates: protectedProcedure
    .input(workTemplatesInputSchema)
    .handler(async ({ context, input }) => {
      const templates = await requireWorkTemplates(context).list(
        context.session.user.id,
        input.projectId,
      );
      if (!templates) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Project is unavailable.",
        });
      }
      return templates;
    }),
  createWorkTemplate: protectedProcedure
    .input(createWorkTemplateMutationInputSchema)
    .handler(async ({ context, input }) => {
      const {
        baseRevision: _baseRevision,
        clientIdempotencyKey: _key,
        ...payload
      } = input;
      try {
        return await requireWorkTemplates(context).create(
          context.session.user.id,
          createWorkTemplateInputSchema.parse(payload),
        );
      } catch (error) {
        rethrowWorkTemplateError(error);
      }
    }),
  instantiateWorkTemplate: protectedProcedure
    .input(instantiateWorkTemplateMutationInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const created = await requireWorkTemplates(context).instantiate(
          context.session.user.id,
          input,
        );
        if (!created) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Work Template is unavailable.",
          });
        }
        return created;
      } catch (error) {
        rethrowWorkTemplateError(error);
      }
    }),
  previewDuplicateWork: protectedProcedure
    .input(previewDuplicateWorkInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const preview = await requireWorkTemplates(context).previewDuplicate(
          context.session.user.id,
          input.sourceWorkId,
        );
        if (!preview) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Work is unavailable.",
          });
        }
        return preview;
      } catch (error) {
        rethrowWorkTemplateError(error);
      }
    }),
  duplicateWork: protectedProcedure
    .input(duplicateWorkMutationInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const created = await requireWorkTemplates(context).duplicate(
          context.session.user.id,
          input,
        );
        if (!created) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Work is unavailable.",
          });
        }
        return created;
      } catch (error) {
        rethrowWorkTemplateError(error);
      }
    }),
  updateWorkTemplate: protectedProcedure
    .input(updateWorkTemplateMutationInputSchema)
    .handler(async ({ context, input }) => {
      const {
        baseRevision,
        clientIdempotencyKey: _key,
        templateId,
        ...payload
      } = input;
      try {
        const updated = await requireWorkTemplates(context).update(
          context.session.user.id,
          templateId,
          baseRevision,
          updateWorkTemplateInputSchema.parse(payload),
        );
        if (!updated) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Work Template is unavailable.",
          });
        }
        return updated;
      } catch (error) {
        rethrowWorkTemplateError(error);
      }
    }),
  trashWorkTemplate: protectedProcedure
    .input(trashWorkTemplateMutationInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const trashed = await requireWorkTemplates(context).trash(
          context.session.user.id,
          input.templateId,
          input.baseRevision,
        );
        if (!trashed) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Work Template is unavailable.",
          });
        }
        return trashed;
      } catch (error) {
        rethrowWorkTemplateError(error);
      }
    }),
  recordActions: protectedProcedure
    .input(recordActionsInputSchema)
    .handler(async ({ context, input }) => {
      const actions = await requireRecordActions(context).list(
        context.session.user.id,
        input.projectId,
      );
      if (!actions) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Project is unavailable.",
        });
      }
      return actions;
    }),
  previewRecordAction: protectedProcedure
    .input(previewRecordActionInputSchema)
    .handler(async ({ context, input }) => {
      const preview = await requireRecordActions(context).preview(
        context.session.user.id,
        input,
      );
      if (!preview) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Record Action or Work is unavailable.",
        });
      }
      return preview;
    }),
  applyRecordAction: protectedProcedure
    .input(applyRecordActionInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireRecordActions(context).apply(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowRecordActionError(error);
      }
    }),
  undoRecordAction: protectedProcedure
    .input(undoRecordActionInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireRecordActions(context).undo(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowRecordActionError(error);
      }
    }),
  createRecordAction: protectedProcedure
    .input(createRecordActionMutationInputSchema)
    .handler(async ({ context, input }) => {
      const {
        baseRevision: _baseRevision,
        clientIdempotencyKey: _key,
        ...payload
      } = input;
      try {
        return await requireRecordActions(context).create(
          context.session.user.id,
          createRecordActionInputSchema.parse(payload),
        );
      } catch (error) {
        rethrowRecordActionError(error);
      }
    }),
  updateRecordAction: protectedProcedure
    .input(updateRecordActionMutationInputSchema)
    .handler(async ({ context, input }) => {
      const {
        actionId,
        baseRevision,
        clientIdempotencyKey: _key,
        ...payload
      } = input;
      try {
        const updated = await requireRecordActions(context).update(
          context.session.user.id,
          actionId,
          baseRevision,
          updateRecordActionInputSchema.parse(payload),
        );
        if (!updated) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Record Action is unavailable.",
          });
        }
        return updated;
      } catch (error) {
        rethrowRecordActionError(error);
      }
    }),
  trashRecordAction: protectedProcedure
    .input(trashRecordActionMutationInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const trashed = await requireRecordActions(context).trash(
          context.session.user.id,
          input.actionId,
          input.baseRevision,
        );
        if (!trashed) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Record Action is unavailable.",
          });
        }
        return trashed;
      } catch (error) {
        rethrowRecordActionError(error);
      }
    }),
  workAutomationRules: protectedProcedure
    .input(workAutomationRulesInputSchema)
    .handler(async ({ context, input }) => {
      const rules = await requireWorkAutomation(context).list(
        context.session.user.id,
        input.projectId,
      );
      if (!rules) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Project is unavailable.",
        });
      }
      return rules;
    }),
  workAutomationRuleVersions: protectedProcedure
    .input(workAutomationRuleVersionsInputSchema)
    .handler(async ({ context, input }) => {
      const versions = await requireWorkAutomation(context).versions(
        context.session.user.id,
        input.ruleId,
      );
      if (!versions) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Automation rule is unavailable.",
        });
      }
      return versions;
    }),
  createWorkAutomationRule: protectedProcedure
    .input(createWorkAutomationRuleMutationInputSchema)
    .handler(async ({ context, input }) => {
      const {
        baseRevision: _baseRevision,
        clientIdempotencyKey: _key,
        ...payload
      } = input;
      try {
        return await requireWorkAutomation(context).create(
          context.session.user.id,
          payload,
        );
      } catch (error) {
        rethrowWorkAutomationError(error);
      }
    }),
  createWorkAutomationRequiredPrMergeRule: protectedProcedure
    .input(createRequiredPrMergeRuleInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireWorkAutomation(context).createRequiredPrMergeRule(
          context.session.user.id,
          input.projectId,
        );
      } catch (error) {
        rethrowWorkAutomationError(error);
      }
    }),
  updateWorkAutomationRule: protectedProcedure
    .input(updateWorkAutomationRuleMutationInputSchema)
    .handler(async ({ context, input }) => {
      const {
        baseRevision,
        clientIdempotencyKey: _key,
        ruleId,
        ...payload
      } = input;
      try {
        const updated = await requireWorkAutomation(context).update(
          context.session.user.id,
          ruleId,
          baseRevision,
          updateWorkAutomationRuleInputSchema.parse(payload),
        );
        if (!updated) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Automation rule is unavailable.",
          });
        }
        return updated;
      } catch (error) {
        rethrowWorkAutomationError(error);
      }
    }),
  setWorkAutomationRuleEnabled: protectedProcedure
    .input(setWorkAutomationRuleEnabledInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const updated = await requireWorkAutomation(context).setEnabled(
          context.session.user.id,
          {
            baseRevision: input.baseRevision,
            enabled: input.enabled,
            ruleId: input.ruleId,
          },
        );
        if (!updated) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Automation rule is unavailable.",
          });
        }
        return updated;
      } catch (error) {
        rethrowWorkAutomationError(error);
      }
    }),
  restoreWorkAutomationRuleVersion: protectedProcedure
    .input(restoreWorkAutomationRuleVersionInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const restored = await requireWorkAutomation(context).restoreVersion(
          context.session.user.id,
          {
            baseRevision: input.baseRevision,
            ruleId: input.ruleId,
            version: input.version,
          },
        );
        if (!restored) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Automation rule version is unavailable.",
          });
        }
        return restored;
      } catch (error) {
        rethrowWorkAutomationError(error);
      }
    }),
  trashWorkAutomationRule: protectedProcedure
    .input(trashWorkAutomationRuleInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const trashed = await requireWorkAutomation(context).trash(
          context.session.user.id,
          input.ruleId,
          input.baseRevision,
        );
        if (!trashed) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Automation rule is unavailable.",
          });
        }
        return trashed;
      } catch (error) {
        rethrowWorkAutomationError(error);
      }
    }),
  dryRunWorkAutomationRule: protectedProcedure
    .input(workAutomationDryRunInputSchema)
    .handler(async ({ context, input }) => {
      const result = await requireWorkAutomation(context).dryRun(
        context.session.user.id,
        input.ruleId,
      );
      if (!result) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Automation rule is unavailable.",
        });
      }
      return result;
    }),
  undoWorkAutomation: protectedProcedure
    .input(workAutomationUndoInputSchema)
    .handler(({ context, input }) =>
      requireWorkAutomation(context).undo(
        context.session.user.id,
        input.receiptId,
      ),
    ),
  releaseNotes: protectedProcedure
    .input(releaseNotesInputSchema)
    .handler(async ({ context, input }) => {
      const notes = await requireReleaseCommunication(context).listNotes(
        context.session.user.id,
        input.releaseId,
      );
      return notes ?? releaseUnavailable();
    }),
  saveReleaseNoteDraft: protectedProcedure
    .input(saveReleaseNoteDraftMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { clientIdempotencyKey: _key, ...payload } = input;
      try {
        const note = await requireReleaseCommunication(context).saveDraft(
          context.session.user.id,
          payload,
        );
        return note ?? releaseUnavailable();
      } catch (error) {
        rethrowReleaseCommunicationError(error);
      }
    }),
  previewReleaseNotePublish: protectedProcedure
    .input(releaseNotePreviewInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const preview = await requireReleaseCommunication(
          context,
        ).previewPublish(context.session.user.id, input.noteId);
        return preview ?? releaseUnavailable();
      } catch (error) {
        rethrowReleaseCommunicationError(error);
      }
    }),
  publishReleaseNote: protectedProcedure
    .input(publishReleaseNoteInputSchema)
    .handler(async ({ context, input }) => {
      const {
        baseRevision: _base,
        clientIdempotencyKey: _key,
        ...payload
      } = input;
      try {
        const entry = await requireReleaseCommunication(context).publish(
          context.session.user.id,
          payload,
        );
        return entry ?? releaseUnavailable();
      } catch (error) {
        rethrowReleaseCommunicationError(error);
      }
    }),
  buildInPublicSettings: protectedProcedure
    .input(buildInPublicProjectInputSchema)
    .handler(async ({ context, input }) => {
      const settings = await requireBuildInPublic(context).settings(
        context.session.user.id,
        input.projectId,
      );
      return settings ?? buildInPublicUnavailable();
    }),
  setBuildInPublicEnabled: protectedProcedure
    .input(setBuildInPublicEnabledInputSchema)
    .handler(async ({ context, input }) => {
      const settings = await requireBuildInPublic(context).setEnabled(
        context.session.user.id,
        { enabled: input.enabled, projectId: input.projectId },
      );
      return settings ?? buildInPublicUnavailable();
    }),
  setBuildInPublicStatusMap: protectedProcedure
    .input(setBuildInPublicStatusMapInputSchema)
    .handler(async ({ context, input }) => {
      const settings = await requireBuildInPublic(context).setStatusMap(
        context.session.user.id,
        {
          label: input.label,
          projectId: input.projectId,
          statusKey: input.statusKey,
        },
      );
      return settings ?? buildInPublicUnavailable();
    }),
  setBuildInPublicWorkCopy: protectedProcedure
    .input(setBuildInPublicWorkCopyInputSchema)
    .handler(async ({ context, input }) => {
      const copy = await requireBuildInPublic(context).setWorkCopy(
        context.session.user.id,
        {
          dueDatePresentation: input.dueDatePresentation,
          projectId: input.projectId,
          publicStatusLabel: input.publicStatusLabel,
          publicSummary: input.publicSummary,
          publicTitle: input.publicTitle,
          workId: input.workId,
        },
      );
      return copy ?? buildInPublicUnavailable();
    }),
  previewBuildInPublic: protectedProcedure
    .input(buildInPublicPreviewInputSchema)
    .handler(async ({ context, input }) => {
      const preview = await requireBuildInPublic(context).preview(
        context.session.user.id,
        input,
      );
      return preview ?? buildInPublicUnavailable();
    }),
  approveBuildInPublic: protectedProcedure
    .input(approveBuildInPublicInputSchema)
    .handler(async ({ context, input }) => {
      const {
        baseRevision: _base,
        clientIdempotencyKey: _key,
        ...payload
      } = input;
      try {
        const approved = await requireBuildInPublic(context).approve(
          context.session.user.id,
          payload,
        );
        return approved ?? buildInPublicUnavailable();
      } catch (error) {
        rethrowBuildInPublicError(error);
      }
    }),
  buildInPublicPublication: protectedProcedure
    .input(buildInPublicProjectInputSchema)
    .handler(async ({ context, input }) => {
      const publication = await requireBuildInPublic(context).publication(
        context.session.user.id,
        input.projectId,
      );
      return publication ?? buildInPublicUnavailable();
    }),
  previewBuildInPublicSlug: protectedProcedure
    .input(buildInPublicSlugPreviewInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const preview = await requireBuildInPublic(context).previewSlug(
          context.session.user.id,
          input,
        );
        return preview ?? buildInPublicUnavailable();
      } catch (error) {
        rethrowBuildInPublicError(error);
      }
    }),
  setBuildInPublicSlug: protectedProcedure
    .input(setBuildInPublicSlugInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const publication = await requireBuildInPublic(context).setSlug(
          context.session.user.id,
          {
            confirmRedirect: input.confirmRedirect,
            projectId: input.projectId,
            slug: input.slug,
          },
        );
        return publication ?? buildInPublicUnavailable();
      } catch (error) {
        rethrowBuildInPublicError(error);
      }
    }),
  setBuildInPublicIndexing: protectedProcedure
    .input(setBuildInPublicIndexingInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const publication = await requireBuildInPublic(context).setIndexing(
          context.session.user.id,
          {
            acknowledgeThirdPartyCopies: input.acknowledgeThirdPartyCopies,
            enabled: input.enabled,
            projectId: input.projectId,
          },
        );
        return publication ?? buildInPublicUnavailable();
      } catch (error) {
        rethrowBuildInPublicError(error);
      }
    }),
  unpublishBuildInPublic: protectedProcedure
    .input(unpublishBuildInPublicInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const publication = await requireBuildInPublic(context).unpublish(
          context.session.user.id,
          input.projectId,
        );
        return publication ?? buildInPublicUnavailable();
      } catch (error) {
        rethrowBuildInPublicError(error);
      }
    }),
  previewWikiPublish: protectedProcedure
    .input(wikiPublishPreviewInputSchema)
    .handler(async ({ context, input }) => {
      const preview = await requireWikiPublishing(context).preview(
        context.session.user.id,
        input.documentId,
      );
      return preview ?? wikiDocumentUnavailable();
    }),
  publishWikiDocument: protectedProcedure
    .input(publishWikiDocumentInputSchema)
    .handler(async ({ context, input }) => {
      const {
        baseRevision: _base,
        clientIdempotencyKey: _key,
        ...payload
      } = input;
      try {
        const published = await requireWikiPublishing(context).publish(
          context.session.user.id,
          payload,
        );
        return published ?? wikiDocumentUnavailable();
      } catch (error) {
        rethrowWikiPublishingError(error);
      }
    }),
  wikiPublication: protectedProcedure
    .input(wikiPublicationInputSchema)
    .handler(async ({ context, input }) => {
      const publication = await requireWikiPublishing(context).publication(
        context.session.user.id,
        input.documentId,
      );
      return publication ?? wikiDocumentUnavailable();
    }),
  unpublishWikiDocument: protectedProcedure
    .input(unpublishWikiDocumentInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const publication = await requireWikiPublishing(context).unpublish(
          context.session.user.id,
          input.documentId,
        );
        return publication ?? wikiDocumentUnavailable();
      } catch (error) {
        rethrowWikiPublishingError(error);
      }
    }),
  setWikiIndexing: protectedProcedure
    .input(setWikiIndexingInputSchema)
    .handler(async ({ context, input }) => {
      const {
        baseRevision: _base,
        clientIdempotencyKey: _key,
        ...payload
      } = input;
      try {
        const publication = await requireWikiPublishing(context).setIndexing(
          context.session.user.id,
          payload,
        );
        return publication ?? wikiDocumentUnavailable();
      } catch (error) {
        rethrowWikiPublishingError(error);
      }
    }),
  releaseChangelog: protectedProcedure
    .input(changelogInputSchema)
    .handler(async ({ context, input }) => {
      const entries = await requireReleaseCommunication(context).changelog(
        context.session.user.id,
        input,
      );
      return entries ?? releaseUnavailable();
    }),
  releaseReassessment: protectedProcedure
    .input(reassessmentInputSchema)
    .handler(async ({ context, input }) => {
      const view = await requireReleaseCommunication(context).reassessment(
        context.session.user.id,
        input.releaseId,
      );
      return view ?? releaseUnavailable();
    }),
  reassessmentActionNeeded: protectedProcedure
    .input(changelogInputSchema.pick({ projectId: true }))
    .handler(async ({ context, input }) => {
      const rounds = await requireReleaseCommunication(context).actionNeeded(
        context.session.user.id,
        input.projectId,
      );
      return rounds ?? projectUnavailable();
    }),
  startReleaseReassessment: protectedProcedure
    .input(startReassessmentInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const round = await requireReleaseCommunication(
          context,
        ).startReassessment(context.session.user.id, {
          lookAgainAt: input.lookAgainAt,
          releaseId: input.releaseId,
        });
        return round ?? releaseUnavailable();
      } catch (error) {
        rethrowReleaseCommunicationError(error);
      }
    }),
  recordReleaseObservation: protectedProcedure
    .input(recordObservationInputSchema)
    .handler(async ({ context, input }) => {
      const { clientIdempotencyKey: _key, ...payload } = input;
      try {
        const round = await requireReleaseCommunication(
          context,
        ).recordObservation(context.session.user.id, payload);
        return round ?? releaseUnavailable();
      } catch (error) {
        rethrowReleaseCommunicationError(error);
      }
    }),
  closeReleaseAssessment: protectedProcedure
    .input(closeAssessmentInputSchema)
    .handler(async ({ context, input }) => {
      const round = await requireReleaseCommunication(context).closeAssessment(
        context.session.user.id,
        input.roundId,
      );
      return round ?? releaseUnavailable();
    }),
  setReleaseLookAgain: protectedProcedure
    .input(setLookAgainInputSchema)
    .handler(async ({ context, input }) => {
      const set = await requireReleaseCommunication(context).setLookAgain(
        context.session.user.id,
        input.releaseId,
        input.fireAt,
      );
      return set
        ? { fireAt: input.fireAt, releaseId: input.releaseId }
        : releaseUnavailable();
    }),
  healthCheck: publicProcedure.handler(() => "OK"),
  githubAvailability: publicProcedure.handler(({ context }) => ({
    status: context.githubAvailability.getStatus(),
  })),
  privateData: protectedProcedure.handler(({ context }) => ({
    message: "This is private",
    user: context.session?.user,
  })),
  projects: protectedProcedure.handler(({ context }) =>
    requireProjectShell(context).list(context.session.user.id),
  ),
  workspaceOverview: protectedProcedure.handler(({ context }) =>
    requireWorkspaceOverview(context).get(context.session.user.id),
  ),
  saveWorkspaceOverviewPresentation: protectedProcedure
    .input(workspaceOverviewPresentationSchema)
    .handler(({ context, input }) =>
      requireWorkspaceOverviewWriter(context)(context.session.user.id, input),
    ),
  project: protectedProcedure
    .input(z.object({ projectId: z.string().trim().min(1) }).strict())
    .handler(async ({ context, input }) => {
      const project = await requireProjectShell(context).find(
        context.session.user.id,
        input.projectId,
      );
      if (!project) {
        throw new ORPCError("NOT_FOUND");
      }
      return project;
    }),
  projectFeedback: protectedProcedure
    .input(feedbackProjectInputSchema)
    .handler(({ context, input }) =>
      runFeedbackOperation(() =>
        requireFeedback(context).list(context.session.user.id, input.projectId),
      ),
    ),
  feedbackFeed: protectedProcedure
    .input(feedInputSchema)
    .handler(({ context, input }) => {
      const { feed } = requireFeedback(context);
      if (!feed) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return runFeedbackOperation(() => feed(context.session.user.id, input));
    }),
  createFeedback: protectedProcedure
    .input(createFeedbackInputSchema)
    .handler(({ context, input }) =>
      runFeedbackOperation(() =>
        requireFeedback(context).create(context.session.user.id, input),
      ),
    ),
  setFeedbackIdentity: protectedProcedure
    .input(setFeedbackIdentityInputSchema)
    .handler(({ context, input }) =>
      runFeedbackOperation(() =>
        requireFeedback(context).setIdentity(context.session.user.id, input),
      ),
    ),
  setFeedbackEvidence: protectedProcedure
    .input(setFeedbackEvidenceInputSchema)
    .handler(({ context, input }) =>
      runFeedbackOperation(() =>
        requireFeedback(context).setEvidence(context.session.user.id, input),
      ),
    ),
  previewFeedbackWork: protectedProcedure
    .input(previewFeedbackWorkInputSchema)
    .handler(({ context, input }) =>
      runFeedbackOperation(() =>
        requireFeedback(context).previewConvertToWork(
          context.session.user.id,
          input,
        ),
      ),
    ),
  convertFeedbackToWork: protectedProcedure
    .input(convertFeedbackToWorkInputSchema)
    .handler(({ context, input }) =>
      runFeedbackOperation(() =>
        requireFeedback(context).convertToWork(context.session.user.id, input),
      ),
    ),
  setFeedbackStatus: protectedProcedure
    .input(setFeedbackStatusInputSchema)
    .handler(({ context, input }) =>
      runFeedbackOperation(() =>
        requireFeedback(context).setStatus(context.session.user.id, input),
      ),
    ),
  projectGitHubOverview: protectedProcedure
    .input(gitHubProjectInputSchema)
    .output(gitHubOverviewSchema)
    .handler(({ context, input }) =>
      runGitHubIntegrationOperation(() =>
        requireGitHubIntegration(context).overview(
          context.session.user.id,
          input.projectId,
        ),
      ),
    ),
  startGitHubAppInstall: protectedProcedure
    .input(gitHubInstallStartInputSchema)
    .output(gitHubInstallStartOutputSchema)
    .handler(({ context, input }) =>
      runGitHubIntegrationOperation(() =>
        requireGitHubIntegration(context).startInstall(
          context.session.user.id,
          input,
        ),
      ),
    ),
  completeGitHubAppInstall: protectedProcedure
    .input(gitHubInstallCompleteInputSchema)
    .output(gitHubInstallCompleteOutputSchema)
    .handler(({ context, input }) =>
      runGitHubIntegrationOperation(() =>
        requireGitHubIntegration(context).completeInstall(
          context.session.user.id,
          input,
        ),
      ),
    ),
  gitHubAppRepositories: protectedProcedure
    .input(gitHubAvailableRepositoriesInputSchema)
    .output(gitHubAvailableRepositoriesOutputSchema)
    .handler(({ context, input }) =>
      runGitHubIntegrationOperation(() =>
        requireGitHubIntegration(context).availableRepositories(
          context.session.user.id,
          input,
        ),
      ),
    ),
  linkGitHubRepository: protectedProcedure
    .input(gitHubLinkRepositoryInputSchema)
    .output(gitHubRepositoryLinkSchema)
    .handler(({ context, input }) =>
      runGitHubIntegrationOperation(() =>
        requireGitHubIntegration(context).linkRepository(
          context.session.user.id,
          input,
        ),
      ),
    ),
  reconnectGitHubRepository: protectedProcedure
    .input(gitHubLinkInputSchema)
    .output(gitHubRepositoryLinkSchema)
    .handler(({ context, input }) =>
      runGitHubIntegrationOperation(() =>
        requireGitHubIntegration(context).reconnect(
          context.session.user.id,
          input,
        ),
      ),
    ),
  disconnectGitHubRepository: protectedProcedure
    .input(gitHubLinkInputSchema)
    .output(gitHubDisconnectOutputSchema)
    .handler(({ context, input }) =>
      runGitHubIntegrationOperation(() =>
        requireGitHubIntegration(context).disconnect(
          context.session.user.id,
          input,
        ),
      ),
    ),
  syncGitHubNow: protectedProcedure
    .input(gitHubLinkInputSchema)
    .output(gitHubSyncNowOutputSchema)
    .handler(({ context, input }) =>
      runGitHubIntegrationOperation(() =>
        requireGitHubIntegration(context).syncNow(
          context.session.user.id,
          input,
        ),
      ),
    ),
  previewGitHubReconnect: protectedProcedure
    .input(gitHubLinkInputSchema)
    .output(gitHubLinkPreviewSchema)
    .handler(({ context, input }) =>
      runGitHubIntegrationOperation(() =>
        requireGitHubIntegration(context).previewReconnect(
          context.session.user.id,
          input,
        ),
      ),
    ),
  previewGitHubDisconnect: protectedProcedure
    .input(gitHubLinkInputSchema)
    .output(gitHubLinkPreviewSchema)
    .handler(({ context, input }) =>
      runGitHubIntegrationOperation(() =>
        requireGitHubIntegration(context).previewDisconnect(
          context.session.user.id,
          input,
        ),
      ),
    ),
  gitHubTriagePreview: protectedProcedure
    .input(gitHubLinkInputSchema)
    .output(gitHubTriagePreviewSchema)
    .handler(({ context, input }) =>
      runGitHubIntegrationOperation(() =>
        requireGitHubIntegration(context).triagePreview(
          context.session.user.id,
          input,
        ),
      ),
    ),
  skipGitHubTriage: protectedProcedure
    .input(gitHubLinkInputSchema)
    .output(gitHubRepositoryLinkSchema)
    .handler(({ context, input }) =>
      runGitHubIntegrationOperation(() =>
        requireGitHubIntegration(context).skipTriage(
          context.session.user.id,
          input,
        ),
      ),
    ),
  searchGitHubRecords: protectedProcedure
    .input(gitHubSearchRecordsInputSchema)
    .output(gitHubSearchRecordsOutputSchema)
    .handler(({ context, input }) =>
      runGitHubIntegrationOperation(() =>
        requireGitHubIntegration(context).searchRecords(
          context.session.user.id,
          input,
        ),
      ),
    ),
  projectGitHubWorkLinks: protectedProcedure
    .input(gitHubWorkLinksInputSchema)
    .output(gitHubWorkLinksOutputSchema)
    .handler(({ context, input }) =>
      runGitHubIntegrationOperation(() =>
        requireGitHubIntegration(context).workLinks(
          context.session.user.id,
          input,
        ),
      ),
    ),
  linkGitHubWork: protectedProcedure
    .input(gitHubLinkWorkInputSchema)
    .output(gitHubWorkLinkSchema)
    .handler(({ context, input }) =>
      runGitHubIntegrationOperation(() =>
        requireGitHubIntegration(context).linkWork(
          context.session.user.id,
          input,
        ),
      ),
    ),
  unlinkGitHubWork: protectedProcedure
    .input(gitHubUnlinkWorkInputSchema)
    .handler(({ context, input }) =>
      runGitHubIntegrationOperation(() =>
        requireGitHubIntegration(context).unlinkWork(
          context.session.user.id,
          input,
        ),
      ),
    ),
  previewGitHubCreateWork: protectedProcedure
    .input(gitHubCreateWorkPreviewInputSchema)
    .output(gitHubCreateWorkPreviewSchema)
    .handler(({ context, input }) =>
      runGitHubIntegrationOperation(() =>
        requireGitHubIntegration(context).previewCreateWork(
          context.session.user.id,
          input,
        ),
      ),
    ),
  createGitHubWorkAndLink: protectedProcedure
    .input(gitHubCreateWorkInputSchema)
    .output(gitHubCreateWorkOutputSchema)
    .handler(({ context, input }) =>
      runGitHubIntegrationOperation(() =>
        requireGitHubIntegration(context).createWorkAndLink(
          context.session.user.id,
          input,
        ),
      ),
    ),
  projectGitHubAttentionSignals: protectedProcedure
    .input(gitHubWorkLinksInputSchema)
    .output(z.array(gitHubAttentionSignalSchema))
    .handler(({ context, input }) =>
      runGitHubIntegrationOperation(() =>
        requireGitHubIntegration(context).attentionSignals(
          context.session.user.id,
          input,
        ),
      ),
    ),
  projectGitHubChecks: protectedProcedure
    .input(gitHubChecksInputSchema)
    .output(gitHubChecksOutputSchema)
    .handler(({ context, input }) =>
      runGitHubIntegrationOperation(() =>
        requireGitHubIntegration(context).checks(
          context.session.user.id,
          input,
        ),
      ),
    ),
  projectGitHubPrContext: protectedProcedure
    .input(gitHubPrContextInputSchema)
    .output(gitHubPrContextOutputSchema)
    .handler(({ context, input }) =>
      runGitHubIntegrationOperation(() =>
        requireGitHubIntegration(context).prContext(
          context.session.user.id,
          input,
        ),
      ),
    ),
  dismissGitHubAttentionSignal: protectedProcedure
    .input(gitHubDismissSignalInputSchema)
    .handler(({ context, input }) =>
      runGitHubIntegrationOperation(() =>
        requireGitHubIntegration(context).dismissSignal(
          context.session.user.id,
          input,
        ),
      ),
    ),
  projectStoryTimeline: protectedProcedure
    .input(storyTimelineInputSchema)
    .output(storyTimelineSchema)
    .handler(({ context, input }) =>
      runProjectHistoryOperation(() =>
        requireProjectHistory(context).storyTimeline(
          context.session.user.id,
          input,
        ),
      ),
    ),
  projectActivity: protectedProcedure
    .input(projectActivityInputSchema)
    .output(projectActivitySchema)
    .handler(({ context, input }) =>
      runProjectHistoryOperation(() =>
        requireProjectActivity(context).list(context.session.user.id, input),
      ),
    ),
  projectClosureSummarySources: protectedProcedure
    .input(closureSummarySourcesInputSchema)
    .output(closureSummarySourcesSchema)
    .handler(({ context, input }) =>
      runProjectClosureSummaryOperation(() =>
        requireProjectClosureSummary(context).sources(
          context.session.user.id,
          input,
        ),
      ),
    ),
  projectClosureSummaryDraft: protectedProcedure
    .input(closureSummaryDraftInputSchema)
    .output(closureSummaryDraftSchema)
    .handler(({ context, input }) =>
      runProjectClosureSummaryOperation(() =>
        requireProjectClosureSummary(context).draft(
          context.session.user.id,
          input,
        ),
      ),
    ),
  projectClosureSummaryDateComparison: protectedProcedure
    .input(closureSummaryDateComparisonInputSchema)
    .output(closureSummaryDateComparisonSchema)
    .handler(({ context, input }) =>
      runProjectClosureSummaryOperation(() =>
        requireProjectClosureSummary(context).dateComparison(
          context.session.user.id,
          input,
        ),
      ),
    ),
  saveProjectClosureSummary: protectedProcedure
    .input(saveClosureSummaryInputSchema)
    .output(saveClosureSummaryResultSchema)
    .handler(({ context, input }) =>
      saveProjectClosureSummaryDocument(context, input),
    ),
  projectValueChain: protectedProcedure
    .input(valueChainInputSchema)
    .handler(async ({ context, input }) => {
      const chain = await requireValueChain(context).chain(
        context.session.user.id,
        input,
      );
      if (!chain) {
        throw new ORPCError("NOT_FOUND");
      }
      return chain;
    }),
  notificationCenter: protectedProcedure
    .output(notificationCenterSchema)
    .handler(({ context }) =>
      requireAttentionSignals(context).center(context.session.user.id),
    ),
  projectPublicRoadmapReviewInterval: protectedProcedure
    .input(publicRoadmapReviewTargetSchema)
    .output(publicRoadmapReviewIntervalSchema)
    .handler(({ context, input }) =>
      runAttentionSignalOperation(() =>
        requirePublicRoadmapReview(context).interval(
          context.session.user.id,
          input,
        ),
      ),
    ),
  setPublicRoadmapReviewInterval: protectedProcedure
    .input(setPublicRoadmapReviewIntervalInputSchema)
    .output(publicRoadmapReviewIntervalSchema)
    .handler(({ context, input }) =>
      runAttentionSignalOperation(() =>
        requirePublicRoadmapReview(context).setInterval(
          context.session.user.id,
          input,
        ),
      ),
    ),
  refreshPublicRoadmapReviewSignals: protectedProcedure
    .output(refreshPublicRoadmapReviewOutputSchema)
    .handler(({ context }) =>
      runAttentionSignalOperation(() =>
        requirePublicRoadmapReview(context).refresh(context.session.user.id),
      ),
    ),
  markNotification: protectedProcedure
    .input(markAttentionSignalInputSchema)
    .output(attentionSignalSchema)
    .handler(({ context, input }) =>
      runAttentionSignalOperation(() =>
        requireAttentionSignals(context).mark(context.session.user.id, input),
      ),
    ),
  openNotification: protectedProcedure
    .input(attentionSignalTargetSchema)
    .output(openAttentionSignalOutputSchema)
    .handler(({ context, input }) =>
      runAttentionSignalOperation(() =>
        requireAttentionSignals(context).open(context.session.user.id, input),
      ),
    ),
  previewNotificationFollowUp: protectedProcedure
    .input(previewAttentionFollowUpInputSchema)
    .output(attentionFollowUpPreviewSchema)
    .handler(({ context, input }) =>
      runAttentionSignalOperation(() =>
        requireAttentionSignals(context).previewFollowUp(
          context.session.user.id,
          input,
        ),
      ),
    ),
  createNotificationFollowUp: protectedProcedure
    .input(createAttentionFollowUpInputSchema)
    .output(attentionFollowUpResultSchema)
    .handler(({ context, input }) =>
      runAttentionSignalOperation(() =>
        requireAttentionSignals(context).createFollowUp(
          context.session.user.id,
          input,
        ),
      ),
    ),
  projectReleaseEvidencePack: protectedProcedure
    .input(releaseEvidencePackInputSchema)
    .output(releaseEvidencePackSchema)
    .handler(({ context, input }) =>
      runReleaseEvidenceOperation(() =>
        requireReleaseEvidence(context).pack(context.session.user.id, input),
      ),
    ),
  projectReleaseOpenScopeSignal: protectedProcedure
    .input(releaseEvidencePackInputSchema)
    .output(releaseOpenScopeSignalOutputSchema)
    .handler(({ context, input }) =>
      runReleaseEvidenceOperation(async () => ({
        signal: await requireReleaseEvidence(context).openScopeSignal(
          context.session.user.id,
          input,
        ),
      })),
    ),
  closeReleaseOpenScopeSignal: protectedProcedure
    .input(closeReleaseOpenScopeSignalInputSchema)
    .handler(({ context, input }) =>
      runReleaseEvidenceOperation(() =>
        requireReleaseEvidence(context).closeOpenScopeSignal(
          context.session.user.id,
          input,
        ),
      ),
    ),
  addReleaseChecklistItem: protectedProcedure
    .input(addReleaseChecklistItemInputSchema)
    .output(releaseChecklistItemOutputSchema)
    .handler(({ context, input }) =>
      runReleaseEvidenceOperation(() =>
        requireReleaseEvidence(context).addChecklistItem(
          context.session.user.id,
          input,
        ),
      ),
    ),
  setReleaseChecklistItem: protectedProcedure
    .input(setReleaseChecklistItemInputSchema)
    .output(releaseChecklistItemOutputSchema)
    .handler(({ context, input }) =>
      runReleaseEvidenceOperation(() =>
        requireReleaseEvidence(context).setChecklistItem(
          context.session.user.id,
          input,
        ),
      ),
    ),
  removeReleaseChecklistItem: protectedProcedure
    .input(removeReleaseChecklistItemInputSchema)
    .handler(({ context, input }) =>
      runReleaseEvidenceOperation(() =>
        requireReleaseEvidence(context).removeChecklistItem(
          context.session.user.id,
          input,
        ),
      ),
    ),
  projectTestAssessments: protectedProcedure
    .input(testAssessmentProjectInputSchema)
    .output(testAssessmentListOutputSchema)
    .handler(({ context, input }) =>
      runTestAssessmentOperation(() =>
        requireTestAssessments(context).list(
          context.session.user.id,
          input.projectId,
        ),
      ),
    ),
  recordTestAssessment: protectedProcedure
    .input(recordTestAssessmentInputSchema)
    .output(testAssessmentRecordSchema)
    .handler(({ context, input }) =>
      runTestAssessmentOperation(() =>
        requireTestAssessments(context).record(context.session.user.id, input),
      ),
    ),
  testAssessmentContextTargets: protectedProcedure
    .input(testAssessmentContextTargetsInputSchema)
    .output(testAssessmentContextTargetsOutputSchema)
    .handler(({ context, input }) =>
      runTestAssessmentOperation(() =>
        requireTestAssessments(context).contextTargets(
          context.session.user.id,
          input,
        ),
      ),
    ),
  projectPlannedTestCases: protectedProcedure
    .input(plannedTestCaseProjectInputSchema)
    .handler(({ context, input }) =>
      runPlannedTestOperation(() =>
        requirePlannedTests(context).list(
          context.session.user.id,
          input.projectId,
        ),
      ),
    ),
  createPlannedTestCase: protectedProcedure
    .input(createPlannedTestCaseInputSchema)
    .handler(({ context, input }) =>
      runPlannedTestOperation(() =>
        requirePlannedTests(context).create(context.session.user.id, input),
      ),
    ),
  createPlannedTestCaseVersion: protectedProcedure
    .input(createPlannedTestCaseVersionInputSchema)
    .handler(({ context, input }) =>
      runPlannedTestOperation(() =>
        requirePlannedTests(context).createVersion(
          context.session.user.id,
          input,
        ),
      ),
    ),
  projectTestSessions: protectedProcedure
    .input(testSessionProjectInputSchema)
    .handler(({ context, input }) =>
      runTestReportOperation(() =>
        requireTestReports(context).sessions(
          context.session.user.id,
          input.projectId,
        ),
      ),
    ),
  acceptTestReport: protectedProcedure
    .input(applicationTestReportInputSchema)
    .handler(({ context, input }) =>
      runTestReportOperation(() =>
        requireTestReports(context).accept(
          {
            accountId: context.session.user.id,
            reporter: { id: context.session.user.id, kind: "user" },
          },
          input,
        ),
      ),
    ),
  projectSessionTests: protectedProcedure
    .input(sessionTestProjectInputSchema)
    .handler(({ context, input }) =>
      runPlannedTestOperation(() =>
        requirePlannedTests(context).sessionTests(
          context.session.user.id,
          input.projectId,
        ),
      ),
    ),
  recordSessionTest: protectedProcedure
    .input(recordSessionTestInputSchema)
    .handler(({ context, input }) =>
      runPlannedTestOperation(() =>
        requirePlannedTests(context).recordSessionTest(
          context.session.user.id,
          input,
        ),
      ),
    ),
  linkSessionTest: protectedProcedure
    .input(linkSessionTestInputSchema)
    .handler(({ context, input }) =>
      runPlannedTestOperation(() =>
        requirePlannedTests(context).linkSessionTest(
          context.session.user.id,
          input,
        ),
      ),
    ),
  projectTestHandoffs: protectedProcedure
    .input(testHandoffProjectInputSchema)
    .handler(({ context, input }) =>
      runPlannedTestOperation(() =>
        requirePlannedTests(context).handoffs(
          context.session.user.id,
          input.projectId,
        ),
      ),
    ),
  createTestHandoff: protectedProcedure
    .input(createTestHandoffInputSchema)
    .handler(({ context, input }) =>
      runPlannedTestOperation(() =>
        requirePlannedTests(context).createHandoff(
          context.session.user.id,
          input,
        ),
      ),
    ),
  updateTestHandoff: protectedProcedure
    .input(updateTestHandoffInputSchema)
    .handler(({ context, input }) =>
      runPlannedTestOperation(() =>
        requirePlannedTests(context).updateHandoff(
          context.session.user.id,
          input,
        ),
      ),
    ),
  transitionTestHandoff: protectedProcedure
    .input(transitionTestHandoffInputSchema)
    .handler(({ context, input }) =>
      runPlannedTestOperation(() =>
        requirePlannedTests(context).transitionHandoff(
          context.session.user.id,
          input,
        ),
      ),
    ),
  linkTestHandoffSessionTest: protectedProcedure
    .input(linkTestHandoffSessionTestInputSchema)
    .handler(({ context, input }) =>
      runPlannedTestOperation(() =>
        requirePlannedTests(context).linkHandoffSessionTest(
          context.session.user.id,
          input,
        ),
      ),
    ),
  previewTestHandoffPackage: protectedProcedure
    .input(testHandoffPackageInputSchema)
    .handler(({ context, input }) =>
      runPlannedTestOperation(() =>
        requirePlannedTests(context).previewPackage(
          context.session.user.id,
          input,
        ),
      ),
    ),
  produceTestHandoffPackage: protectedProcedure
    .input(produceTestHandoffPackageInputSchema)
    .handler(({ context, input }) =>
      runPlannedTestOperation(() =>
        requirePlannedTests(context).producePackage(
          context.session.user.id,
          input,
        ),
      ),
    ),
  projectTestHandoffPackages: protectedProcedure
    .input(testHandoffPackageInputSchema)
    .handler(({ context, input }) =>
      runPlannedTestOperation(() =>
        requirePlannedTests(context).packages(context.session.user.id, input),
      ),
    ),
  testHandoffContextTargets: protectedProcedure
    .input(testHandoffContextTargetsInputSchema)
    .handler(({ context, input }) =>
      runPlannedTestOperation(() =>
        requirePlannedTests(context).contextTargets(
          context.session.user.id,
          input,
        ),
      ),
    ),
  plannedTestCaseVersion: protectedProcedure
    .input(plannedTestCaseVersionInputSchema)
    .handler(({ context, input }) =>
      runPlannedTestOperation(() =>
        requirePlannedTests(context).version(context.session.user.id, input),
      ),
    ),
  plannedTestRelationTargets: protectedProcedure
    .input(plannedTestRelationTargetsInputSchema)
    .handler(({ context, input }) =>
      runPlannedTestOperation(() =>
        requirePlannedTests(context).relationTargets(
          context.session.user.id,
          input,
        ),
      ),
    ),
  projectTestReview: protectedProcedure
    .input(testReviewProjectInputSchema)
    .output(testReviewListOutputSchema)
    .handler(({ context, input }) =>
      runTestReviewOperation(() =>
        requireTestReview(context).list(
          context.session.user.id,
          input.projectId,
        ),
      ),
    ),
  projectTestSummary: protectedProcedure
    .input(testSummaryInputSchema)
    .output(testSummarySchema)
    .handler(({ context, input }) =>
      runTestReviewOperation(() =>
        requireTestReview(context).summary(context.session.user.id, input),
      ),
    ),
  setReviewSessionState: protectedProcedure
    .input(setSessionReviewStateInputSchema)
    .output(testReviewReceiptSchema)
    .handler(({ context, input }) =>
      runTestReviewOperation(() =>
        requireTestReview(context).setSessionReviewState(
          context.session.user.id,
          input,
        ),
      ),
    ),
  setReviewItemState: protectedProcedure
    .input(setItemReviewStateInputSchema)
    .output(testReviewReceiptSchema)
    .handler(({ context, input }) =>
      runTestReviewOperation(() =>
        requireTestReview(context).setItemReviewState(
          context.session.user.id,
          input,
        ),
      ),
    ),
  previewReviewClose: protectedProcedure
    .input(previewSessionCloseInputSchema)
    .output(testReviewClosePreviewSchema)
    .handler(({ context, input }) =>
      runTestReviewOperation(() =>
        requireTestReview(context).previewSessionClose(
          context.session.user.id,
          input,
        ),
      ),
    ),
  previewReviewBulk: protectedProcedure
    .input(previewBulkReviewInputSchema)
    .output(testReviewBulkPreviewSchema)
    .handler(({ context, input }) =>
      runTestReviewOperation(() =>
        requireTestReview(context).previewBulkReview(
          context.session.user.id,
          input,
        ),
      ),
    ),
  commitReviewBulk: protectedProcedure
    .input(commitBulkReviewInputSchema)
    .output(testReviewBulkReceiptSchema)
    .handler(({ context, input }) =>
      runTestReviewOperation(() =>
        requireTestReview(context).commitBulkReview(
          context.session.user.id,
          input,
        ),
      ),
    ),
  recordReviewCorrection: protectedProcedure
    .input(recordCorrectionInputSchema)
    .output(testResultEventReceiptSchema)
    .handler(({ context, input }) =>
      runTestReviewOperation(() =>
        requireTestReview(context).recordCorrection(
          context.session.user.id,
          input,
        ),
      ),
    ),
  recordReviewWithdrawal: protectedProcedure
    .input(recordWithdrawalInputSchema)
    .output(testResultEventReceiptSchema)
    .handler(({ context, input }) =>
      runTestReviewOperation(() =>
        requireTestReview(context).recordWithdrawal(
          context.session.user.id,
          input,
        ),
      ),
    ),
  recordReviewRedaction: protectedProcedure
    .input(recordRedactionInputSchema)
    .output(testResultEventReceiptSchema)
    .handler(({ context, input }) =>
      runTestReviewOperation(() =>
        requireTestReview(context).recordRedaction(
          context.session.user.id,
          input,
        ),
      ),
    ),
  supersedeReviewResult: protectedProcedure
    .input(supersedeInputSchema)
    .output(supersedeReceiptSchema)
    .handler(({ context, input }) =>
      runTestReviewOperation(() =>
        requireTestReview(context).supersede(context.session.user.id, input),
      ),
    ),
  bindReviewResult: protectedProcedure
    .input(bindValidResultInputSchema)
    .output(bindValidResultReceiptSchema)
    .handler(({ context, input }) =>
      runTestReviewOperation(() =>
        requireTestReview(context).bindValidResult(
          context.session.user.id,
          input,
        ),
      ),
    ),
  previewReviewFollowUp: protectedProcedure
    .input(previewFollowUpInputSchema)
    .output(followUpPreviewSchema)
    .handler(({ context, input }) =>
      runTestReviewOperation(() =>
        requireTestReview(context).previewFollowUp(
          context.session.user.id,
          input,
        ),
      ),
    ),
  commitReviewFollowUp: protectedProcedure
    .input(commitFollowUpInputSchema)
    .output(followUpReceiptSchema)
    .handler(({ context, input }) =>
      runTestReviewOperation(() =>
        requireTestReview(context).commitFollowUp(
          context.session.user.id,
          input,
        ),
      ),
    ),
  projectTestGaps: protectedProcedure
    .input(testGapProjectInputSchema)
    .handler(({ context, input }) =>
      runTestGapOperation(() =>
        requireTestGaps(context).list(context.session.user.id, input.projectId),
      ),
    ),
  createTestGap: protectedProcedure
    .input(createTestGapInputSchema)
    .handler(({ context, input }) =>
      runTestGapOperation(() =>
        requireTestGaps(context).create(context.session.user.id, input),
      ),
    ),
  closeTestGap: protectedProcedure
    .input(closeTestGapInputSchema)
    .handler(({ context, input }) =>
      runTestGapOperation(() =>
        requireTestGaps(context).close(context.session.user.id, input),
      ),
    ),
  testGapDecisionTargets: protectedProcedure
    .input(testGapDecisionTargetsInputSchema)
    .handler(({ context, input }) =>
      runTestGapOperation(() =>
        requireTestGaps(context).decisionTargets(
          context.session.user.id,
          input.projectId,
        ),
      ),
    ),
  bindTestGapCase: protectedProcedure
    .input(testGapCaseBindInputSchema)
    .handler(({ context, input }) =>
      runTestGapOperation(() =>
        requireTestGaps(context).bindCase(context.session.user.id, input),
      ),
    ),
  unbindTestGapCase: protectedProcedure
    .input(testGapCaseBindInputSchema)
    .handler(({ context, input }) =>
      runTestGapOperation(() =>
        requireTestGaps(context).unbindCase(context.session.user.id, input),
      ),
    ),
  bindTestGapHandoff: protectedProcedure
    .input(testGapHandoffBindInputSchema)
    .handler(({ context, input }) =>
      runTestGapOperation(() =>
        requireTestGaps(context).bindHandoff(context.session.user.id, input),
      ),
    ),
  unbindTestGapHandoff: protectedProcedure
    .input(testGapHandoffBindInputSchema)
    .handler(({ context, input }) =>
      runTestGapOperation(() =>
        requireTestGaps(context).unbindHandoff(context.session.user.id, input),
      ),
    ),
  testGapRelationTargets: protectedProcedure
    .input(testGapRelationTargetsInputSchema)
    .handler(({ context, input }) =>
      runTestGapOperation(() =>
        requireTestGaps(context).relationTargets(
          context.session.user.id,
          input,
        ),
      ),
    ),
  productGaps: protectedProcedure
    .input(productGapListInputSchema.optional())
    .output(productGapListSchema)
    .handler(({ context, input }) =>
      runProductGapOperation(() =>
        requireProductGaps(context).list(context.session.user.id, input),
      ),
    ),
  recordProductGap: protectedProcedure
    .input(recordProductGapInputSchema)
    .output(productGapRecordSchema)
    .handler(({ context, input }) =>
      runProductGapOperation(() =>
        requireProductGaps(context).record(context.session.user.id, input),
      ),
    ),
  recordToolEscape: protectedProcedure
    .input(recordToolEscapeInputSchema)
    .output(recordToolEscapeResultSchema)
    .handler(({ context, input }) =>
      runProductGapOperation(() =>
        requireProductGaps(context).recordToolEscape(
          context.session.user.id,
          input,
        ),
      ),
    ),
  closeToolEscape: protectedProcedure
    .input(closeToolEscapeInputSchema)
    .output(toolEscapeRecordSchema)
    .handler(({ context, input }) =>
      runProductGapOperation(() =>
        requireProductGaps(context).closeToolEscape(
          context.session.user.id,
          input,
        ),
      ),
    ),

  productGapEscapes: protectedProcedure
    .input(listToolEscapesInputSchema)
    .output(toolEscapeListSchema)
    .handler(({ context, input }) =>
      runProductGapOperation(() =>
        requireProductGaps(context).listEscapes(context.session.user.id, input),
      ),
    ),
  setProductGapStatus: protectedProcedure
    .input(setProductGapStatusInputSchema)
    .output(productGapRecordSchema)
    .handler(({ context, input }) =>
      runProductGapOperation(() =>
        requireProductGaps(context).setStatus(context.session.user.id, input),
      ),
    ),
  productGapLinkTargets: protectedProcedure
    .input(productGapLinkTargetsInputSchema)
    .output(z.array(productGapLinkTargetSchema))
    .handler(({ context, input }) =>
      runProductGapOperation(() =>
        requireProductGaps(context).linkTargets(context.session.user.id, input),
      ),
    ),
  previewProductGapFollowUp: protectedProcedure
    .input(previewProductGapFollowUpInputSchema)
    .output(productGapFollowUpPlanSchema)
    .handler(({ context, input }) =>
      runProductGapOperation(() =>
        requireProductGaps(context).previewFollowUp(
          context.session.user.id,
          input,
        ),
      ),
    ),
  confirmProductGapFollowUp: protectedProcedure
    .input(confirmProductGapFollowUpInputSchema)
    .output(productGapFollowUpResultSchema)
    .handler(({ context, input }) =>
      runProductGapOperation(() =>
        requireProductGaps(context).confirmFollowUp(
          context.session.user.id,
          input,
        ),
      ),
    ),
  projectScreens: protectedProcedure
    .input(screenProjectInputSchema)
    .handler(({ context, input }) =>
      runScreenOperation(() =>
        requireScreens(context).list(context.session.user.id, input.projectId),
      ),
    ),
  createScreen: protectedProcedure
    .input(createScreenInputSchema)
    .handler(({ context, input }) =>
      runScreenOperation(() =>
        requireScreens(context).create(context.session.user.id, input),
      ),
    ),
  setScreenLifecycle: protectedProcedure
    .input(setScreenLifecycleInputSchema)
    .handler(({ context, input }) =>
      runScreenOperation(() =>
        requireScreens(context).setLifecycle(context.session.user.id, input),
      ),
    ),
  screenViewport: protectedProcedure
    .input(screenViewportInputSchema)
    .handler(({ context, input }) =>
      runScreenOperation(() =>
        requireScreens(context).viewport(context.session.user.id, input),
      ),
    ),
  saveScreenViewport: protectedProcedure
    .input(saveScreenViewportInputSchema)
    .handler(({ context, input }) =>
      runScreenOperation(() =>
        requireScreens(context).saveViewport(context.session.user.id, input),
      ),
    ),
  screenWireframe: protectedProcedure
    .input(screenWireframeInputSchema)
    .handler(({ context, input }) =>
      runScreenOperation(() =>
        requireScreens(context).wireframe(context.session.user.id, input),
      ),
    ),
  saveScreenWireframe: protectedProcedure
    .input(saveScreenWireframeInputSchema)
    .handler(({ context, input }) =>
      runScreenOperation(() =>
        requireScreens(context).saveWireframe(context.session.user.id, input),
      ),
    ),
  saveScreenWireframeVersion: protectedProcedure
    .input(saveScreenWireframeVersionInputSchema)
    .handler(({ context, input }) =>
      runScreenOperation(() =>
        requireScreens(context).attachWireframeVersion(
          context.session.user.id,
          input.projectId,
          input.screenId,
          input.document,
        ),
      ),
    ),
  projectLinkedBlocks: protectedProcedure
    .input(screenProjectInputSchema)
    .handler(({ context, input }) =>
      runScreenOperation(() =>
        requireScreens(context).linkedBlocks(
          context.session.user.id,
          input.projectId,
        ),
      ),
    ),
  createLinkedBlock: protectedProcedure
    .input(createLinkedBlockInputSchema)
    .handler(({ context, input }) =>
      runScreenOperation(() =>
        requireScreens(context).createLinkedBlock(
          context.session.user.id,
          input,
        ),
      ),
    ),
  previewLinkedBlockChange: protectedProcedure
    .input(linkedBlockChangeInputSchema)
    .handler(({ context, input }) =>
      runScreenOperation(() =>
        requireScreens(context).previewLinkedBlockChange(
          context.session.user.id,
          input,
        ),
      ),
    ),
  applyLinkedBlockChange: protectedProcedure
    .input(linkedBlockChangeInputSchema)
    .handler(({ context, input }) =>
      runScreenOperation(() =>
        requireScreens(context).applyLinkedBlockChange(
          context.session.user.id,
          input,
        ),
      ),
    ),
  previewConvertAndBind: protectedProcedure
    .input(previewConvertAndBindInputSchema)
    .handler(({ context, input }) =>
      runScreenOperation(() =>
        requireScreens(context).previewConvertAndBind(
          context.session.user.id,
          input,
        ),
      ),
    ),
  confirmConvertAndBind: protectedProcedure
    .input(confirmConvertAndBindInputSchema)
    .handler(({ context, input }) =>
      runScreenOperation(() =>
        requireScreens(context).convertAndBind(context.session.user.id, input),
      ),
    ),
  screenOrigins: protectedProcedure
    .input(resolveScreenInputSchema)
    .handler(({ context, input }) =>
      runScreenOperation(() =>
        requireScreens(context).origins(context.session.user.id, input),
      ),
    ),
  previewRebindScreenOrigin: protectedProcedure
    .input(previewRebindInputSchema)
    .handler(({ context, input }) =>
      runScreenOperation(() =>
        requireScreens(context).previewRebind(context.session.user.id, input),
      ),
    ),
  rebindScreenOrigin: protectedProcedure
    .input(confirmRebindInputSchema)
    .handler(({ context, input }) =>
      runScreenOperation(() =>
        requireScreens(context).rebind(context.session.user.id, input),
      ),
    ),
  saveScreenTemplate: protectedProcedure
    .input(saveScreenTemplateInputSchema)
    .handler(({ context, input }) =>
      runScreenOperation(() =>
        requireScreens(context).saveTemplate(context.session.user.id, input),
      ),
    ),
  screenTemplates: protectedProcedure
    .input(screenTemplateListInputSchema)
    .handler(({ context, input }) =>
      runScreenOperation(() =>
        requireScreens(context).templates(
          context.session.user.id,
          input.projectId,
        ),
      ),
    ),
  createScreenFromTemplate: protectedProcedure
    .input(createScreenFromTemplateInputSchema)
    .handler(({ context, input }) =>
      runScreenOperation(() =>
        requireScreens(context).createScreenFromTemplate(
          context.session.user.id,
          input,
        ),
      ),
    ),
  resolveScreen: protectedProcedure
    .input(resolveScreenInputSchema)
    .handler(({ context, input }) =>
      runScreenOperation(() =>
        requireScreens(context).resolveTarget(context.session.user.id, input),
      ),
    ),
  projectSpecChangeReviews: protectedProcedure
    .input(specChangeReviewProjectInputSchema)
    .handler(({ context, input }) =>
      runSpecChangeReviewOperation(() =>
        requireSpecChangeReview(context).list(
          context.session.user.id,
          input.projectId,
        ),
      ),
    ),
  specChangeReview: protectedProcedure
    .input(specChangeReviewInputSchema)
    .handler(({ context, input }) =>
      runSpecChangeReviewOperation(() =>
        requireSpecChangeReview(context).get(context.session.user.id, input),
      ),
    ),
  previewSpecChangeReviewFollowUp: protectedProcedure
    .input(previewSpecChangeReviewFollowUpInputSchema)
    .handler(({ context, input }) =>
      runSpecChangeReviewOperation(() =>
        requireSpecChangeReview(context).previewFollowUp(
          context.session.user.id,
          input,
        ),
      ),
    ),
  createSpecChangeReviewFollowUp: protectedProcedure
    .input(createSpecChangeReviewFollowUpInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const payload = specChangeReviewFollowUpPayloadSchema.parse(payloadInput);
      const accountId = context.session.user.id;
      const targetId = await specChangeReviewFollowUpId(
        payload.reviewId,
        payload.candidate,
      );
      const mutation =
        requireSpecChangeReviewMutationContracts(context).followUp(accountId);
      const command = {
        actor: { actorId: accountId, type: "User" as const },
        baseRevision,
        clientIdempotencyKey,
        kind: "human" as const,
        payload,
        targetId,
      };
      // A retry of a confirmed command returns its receipt before any preview check.
      try {
        const replay = await mutation.replay(command);
        if (replay?.nextValue.followUp) {
          return replay.nextValue.followUp;
        }
      } catch (error) {
        rethrowUsageLinkMutationError(error, targetId);
      }
      // Confirm needs the exact preview the founder saw, re-derived now.
      const preview = await runSpecChangeReviewOperation(() =>
        requireSpecChangeReview(context).previewFollowUp(accountId, {
          candidate: payload.candidate,
          reviewId: payload.reviewId,
          title: payload.title,
          workType: payload.workType,
        }),
      );
      if (preview.fingerprint !== payload.previewFingerprint) {
        throw new ORPCError("PRECONDITION_FAILED", {
          data: { code: "SPEC_CHANGE_REVIEW_FOLLOW_UP_STALE" },
          defined: true,
          message:
            "The follow-up preview is out of date. Preview Create Follow-up Work again.",
        });
      }
      try {
        const receipt = await mutation.mutate(
          command,
          ({ committedAt, payload: mutationPayload }) =>
            ({
              followUp: {
                candidate: mutationPayload.candidate,
                createdAt: committedAt,
                id: targetId,
                reviewId: mutationPayload.reviewId,
                revision: 1,
                workId: mutationPayload.workId,
                workKey: null,
                workTitle: preview.plan.work.title,
              } satisfies SpecChangeReviewFollowUp,
              plan: preview.plan,
            }) satisfies SpecChangeReviewFollowUpValue,
        );
        if (!receipt.nextValue.followUp) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.followUp;
      } catch (error) {
        if (isRecord(error) && error.code === "TARGET_NOT_FOUND") {
          throw new ORPCError("NOT_FOUND", {
            cause: error,
            defined: true,
            message: "Spec Change Review candidate is unavailable.",
          });
        }
        rethrowUsageLinkMutationError(error, targetId);
      }
    }),
  markSpecChangeReviewCandidate: protectedProcedure
    .input(markSpecChangeReviewCandidateInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const payload = specChangeReviewMarkPayloadSchema.parse({
        ...payloadInput,
        note: payloadInput.note === "" ? null : payloadInput.note,
      });
      const accountId = context.session.user.id;
      // Only a candidate of the recorded-link closure of this exact pair can be marked.
      const detail = await runSpecChangeReviewOperation(() =>
        requireSpecChangeReview(context).get(accountId, {
          reviewId: payload.reviewId,
        }),
      );
      if (
        !detail.candidates.some(
          ({ key }) => key === specCandidateKey(payload.candidate),
        )
      ) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Spec Change Review candidate is unavailable.",
        });
      }
      const targetId = await specChangeReviewMarkId(
        payload.reviewId,
        payload.candidate,
      );
      const mutation =
        requireSpecChangeReviewMutationContracts(context).mark(accountId);
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: accountId, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload,
            targetId,
          },
          ({ committedAt, currentRevision, payload: mutationPayload }) =>
            ({
              mark: {
                candidate: mutationPayload.candidate,
                id: targetId,
                note: mutationPayload.note,
                reviewId: mutationPayload.reviewId,
                revision: currentRevision + 1,
                state: mutationPayload.state,
                updatedAt: committedAt,
              } satisfies SpecChangeReviewMark,
            }) satisfies SpecChangeReviewMarkValue,
        );
        if (!receipt.nextValue.mark) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.mark;
      } catch (error) {
        if (isRecord(error) && error.code === "TARGET_NOT_FOUND") {
          throw new ORPCError("NOT_FOUND", {
            cause: error,
            defined: true,
            message: "Spec Change Review candidate is unavailable.",
          });
        }
        rethrowUsageLinkMutationError(error, targetId);
      }
    }),
  contacts: protectedProcedure.handler(({ context }) =>
    runContactOperation(() =>
      requireContacts(context).listContacts(context.session.user.id),
    ),
  ),
  contact: protectedProcedure
    .input(contactIdentityInputSchema)
    .handler(({ context, input }) =>
      runContactOperation(() =>
        requireContacts(context).getContact(context.session.user.id, input),
      ),
    ),
  resolveContact: protectedProcedure
    .input(contactIdentityInputSchema)
    .handler(({ context, input }) =>
      runContactOperation(() =>
        requireContacts(context).resolveContact(context.session.user.id, input),
      ),
    ),
  contactMergePreview: protectedProcedure
    .input(mergePreviewInputSchema)
    .handler(({ context, input }) =>
      runContactOperation(() =>
        requireContacts(context).previewMerge(context.session.user.id, input),
      ),
    ),
  contactMergeUndoPreview: protectedProcedure
    .input(mergeUndoPreviewInputSchema)
    .handler(({ context, input }) =>
      runContactOperation(() =>
        requireContacts(context).previewMergeUndo(
          context.session.user.id,
          input,
        ),
      ),
    ),
  undoMerge: protectedProcedure
    .input(undoMergeInputSchema)
    .handler(({ context, input }) =>
      runContactOperation(() =>
        requireContacts(context).undoMerge(context.session.user.id, input),
      ),
    ),
  mergeContacts: protectedProcedure
    .input(mergeContactsInputSchema)
    .handler(({ context, input }) =>
      runContactOperation(() =>
        requireContacts(context).mergeContacts(context.session.user.id, input),
      ),
    ),
  contactDuplicateCandidates: protectedProcedure.handler(({ context }) =>
    runContactOperation(() =>
      requireContacts(context).listDuplicateCandidates(context.session.user.id),
    ),
  ),
  companies: protectedProcedure.handler(({ context }) =>
    runContactOperation(() =>
      requireContacts(context).listCompanies(context.session.user.id),
    ),
  ),
  createContact: protectedProcedure
    .input(createContactInputSchema)
    .handler(({ context, input }) =>
      runContactOperation(() =>
        requireContacts(context).createContact(context.session.user.id, input),
      ),
    ),
  createCompany: protectedProcedure
    .input(createCompanyInputSchema)
    .handler(({ context, input }) =>
      runContactOperation(() =>
        requireContacts(context).createCompany(context.session.user.id, input),
      ),
    ),
  setContactCompany: protectedProcedure
    .input(setContactCompanyInputSchema)
    .handler(({ context, input }) =>
      runContactOperation(() =>
        requireContacts(context).setCompany(context.session.user.id, input),
      ),
    ),
  linkContactPersona: protectedProcedure
    .input(contactPersonaInputSchema)
    .handler(({ context, input }) =>
      runContactOperation(() =>
        requireContacts(context).linkPersona(context.session.user.id, input),
      ),
    ),
  unlinkContactPersona: protectedProcedure
    .input(contactPersonaInputSchema)
    .handler(({ context, input }) =>
      runContactOperation(() =>
        requireContacts(context).unlinkPersona(context.session.user.id, input),
      ),
    ),
  updateContact: protectedProcedure
    .input(updateContactInputSchema)
    .handler(({ context, input }) =>
      runContactOperation(() =>
        requireContacts(context).updateContact(context.session.user.id, input),
      ),
    ),
  tags: protectedProcedure
    .input(tagsInputSchema)
    .handler(({ context, input }) =>
      runTagOperation(async () => {
        const tags = await requireTags(context).list(
          context.session.user.id,
          input.projectId,
        );
        if (!tags) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Project is unavailable.",
          });
        }
        return tags;
      }),
    ),
  tagRecords: protectedProcedure
    .input(tagRecordsInputSchema)
    .handler(({ context, input }) =>
      runTagOperation(async () => {
        const records = await requireTags(context).records(
          context.session.user.id,
          input,
        );
        if (!records) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Project is unavailable.",
          });
        }
        return records;
      }),
    ),
  createTag: protectedProcedure
    .input(createTagInputSchema)
    .handler(({ context, input }) =>
      runTagOperation(() =>
        requireTags(context).create(context.session.user.id, input),
      ),
    ),
  applyTag: protectedProcedure
    .input(applyTagInputSchema)
    .handler(({ context, input }) =>
      runTagOperation(async () => {
        const assignment = await requireTags(context).apply(
          context.session.user.id,
          input,
        );
        if (!assignment) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Work is unavailable.",
          });
        }
        return assignment;
      }),
    ),
  removeTag: protectedProcedure
    .input(removeTagInputSchema)
    .handler(({ context, input }) =>
      runTagOperation(async () => {
        const result = await requireTags(context).remove(
          context.session.user.id,
          input,
        );
        if (!result) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Work is unavailable.",
          });
        }
        return result;
      }),
    ),
  renameTag: protectedProcedure
    .input(renameTagMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...inputPayload } = input;
      const parsed = renameTagCommandSchema.parse(inputPayload);
      const mutation = requireTagMutationContracts(context).rename(
        context.session.user.id,
      );

      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId: parsed.tagId,
          },
          ({ currentValue, currentRevision, payload }) => {
            if (!currentValue.tag) {
              throw new ORPCError("NOT_FOUND");
            }
            return {
              tag: {
                ...currentValue.tag,
                name: payload.name,
                revision: currentRevision + 1,
                updatedAt: new Date().toISOString(),
              },
            } satisfies TagMutationValue;
          },
          {
            undo: {
              kind: "atomic-transform",
              scope: "tag.name",
            },
          },
        );
        if (!receipt.nextValue.tag) {
          throw new ORPCError("NOT_FOUND");
        }
        return { receiptId: receipt.id, tag: receipt.nextValue.tag };
      } catch (error) {
        rethrowTagMutationError(error, parsed.tagId);
      }
    }),
  undoTagRename: protectedProcedure
    .input(undoTagRenameInputSchema)
    .handler(async ({ context, input }) => {
      const mutation = requireTagMutationContracts(context).rename(
        context.session.user.id,
      );
      if (!(mutation.findReceiptById && mutation.undo)) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const sourceReceipt = await mutation.findReceiptById(input.receiptId);
      if (!sourceReceipt) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Tag rename is no longer available for Undo.",
        });
      }

      try {
        const receipt = await mutation.undo(
          sourceReceipt,
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision: input.baseRevision,
            clientIdempotencyKey: input.clientIdempotencyKey,
            kind: "human",
            payload: {},
            targetId: input.tagId,
          },
          ({ currentValue, currentRevision, previousValue }) => {
            if (!(currentValue.tag && previousValue.tag)) {
              throw new ORPCError("NOT_FOUND");
            }
            return {
              tag: {
                ...currentValue.tag,
                name: previousValue.tag.name,
                revision: currentRevision + 1,
                updatedAt: new Date().toISOString(),
              },
            } satisfies TagMutationValue;
          },
        );
        if (!receipt.nextValue.tag) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.tag;
      } catch (error) {
        rethrowTagMutationError(error, input.tagId);
      }
    }),
  usageLinks: protectedProcedure
    .input(listUsageLinksInputSchema)
    .handler(({ context, input }) =>
      requireUsageLinks(context).listBySource(
        context.session.user.id,
        input.source,
      ),
    ),
  createUsageLink: protectedProcedure
    .input(createUsageLinkMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const payload = usageLinkPayloadSchema.parse(payloadInput);
      const mutation = requireUsageLinkMutationContracts(context).create(
        context.session.user.id,
      );

      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload,
            targetId: clientIdempotencyKey,
          },
          ({ currentRevision, payload: mutationPayload }) =>
            ({
              usageLink: usageLinkSchema.parse({
                ...mutationPayload,
                createdAt: new Date().toISOString(),
                id: crypto.randomUUID(),
                revision: currentRevision + 1,
              }),
            }) satisfies UsageLinkMutationValue,
        );
        if (!receipt.nextValue.usageLink) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.usageLink;
      } catch (error) {
        rethrowUsageLinkMutationError(error, clientIdempotencyKey);
      }
    }),
  unlinkUsageLink: protectedProcedure
    .input(unlinkUsageLinkInputSchema)
    .handler(async ({ context, input }) => {
      const mutation = requireUsageLinkMutationContracts(context).unlink(
        context.session.user.id,
      );

      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision: input.baseRevision,
            clientIdempotencyKey: input.clientIdempotencyKey,
            kind: "human",
            payload: {},
            targetId: input.usageLinkId,
          },
          ({ currentValue }) => {
            if (!currentValue.usageLink) {
              throw new ORPCError("NOT_FOUND");
            }
            return { usageLink: null } satisfies UsageLinkMutationValue;
          },
        );
        if (receipt.nextValue.usageLink !== null) {
          throw new ORPCError("NOT_FOUND");
        }
        return { status: true };
      } catch (error) {
        rethrowUsageLinkMutationError(error, input.usageLinkId);
      }
    }),
  customFields: protectedProcedure
    .input(z.object({ projectId: z.string().trim().min(1) }).strict())
    .handler(async ({ context, input }) => {
      const fields = await requireCustomFields(context).list(
        context.session.user.id,
        input.projectId,
      );
      if (!fields) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Project is unavailable.",
        });
      }
      return fields;
    }),
  priorityMetrics: protectedProcedure
    .input(z.object({ projectId: z.string().trim().min(1) }).strict())
    .handler(async ({ context, input }) => {
      const metrics = await requirePriorityMetrics(context).list(
        context.session.user.id,
        input.projectId,
      );
      if (!metrics) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Project is unavailable.",
        });
      }
      return metrics;
    }),
  copyPriorityMetricDefinitions: protectedProcedure
    .input(copyPriorityMetricDefinitionsInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...copyInput } = input;
      const mutation = requirePriorityMetricMutationContracts(
        context,
      ).copyDefinitions(context.session.user.id);
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: copyInput,
            targetId: `priority-metric-copy:${clientIdempotencyKey}`,
          },
          ({ payload }) =>
            ({
              definitions: [],
              sourceProjectId: payload.sourceProjectId,
              targetProjectId: payload.targetProjectId,
            }) satisfies PriorityMetricDefinitionsCopyMutationValue,
        );
        return receipt.nextValue.definitions;
      } catch (error) {
        rethrowPriorityMetricMutationError(error, clientIdempotencyKey);
      }
    }),
  priorityMetricProjectValues: protectedProcedure
    .input(priorityMetricProjectValuesInputSchema)
    .handler(async ({ context, input }) => {
      const values = await requirePriorityMetrics(context).projectValues(
        context.session.user.id,
        input.projectId,
      );
      if (!values) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Project is unavailable.",
        });
      }
      return values;
    }),
  priorityMetricTrashImpactPreview: protectedProcedure
    .input(priorityMetricTrashImpactPreviewInputSchema)
    .handler(async ({ context, input }) => {
      const preview = await requirePriorityMetrics(context).trashImpactPreview(
        context.session.user.id,
        input.metricId,
      );
      if (!preview) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Priority metric is unavailable.",
        });
      }
      return preview;
    }),
  priorityMetricValues: protectedProcedure
    .input(priorityMetricValuesInputSchema)
    .handler(async ({ context, input }) => {
      const values = await requirePriorityMetrics(context).values(
        context.session.user.id,
        input.workId,
      );
      if (!values) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Work is unavailable.",
        });
      }
      return values;
    }),
  createPriorityMetric: protectedProcedure
    .input(createPriorityMetricMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...createInput } = input;
      const parsed = createPriorityMetricInputSchema.parse(createInput);
      const mutation = requirePriorityMetricMutationContracts(context).create(
        context.session.user.id,
      );
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId: clientIdempotencyKey,
          },
          ({ currentRevision, payload }) => {
            const timestamp = new Date().toISOString();
            return {
              metric: {
                createdAt: timestamp,
                enabled: true,
                id: crypto.randomUUID(),
                name: payload.name,
                projectId: payload.projectId,
                rankDescriptions: payload.rankDescriptions,
                revision: currentRevision + 1,
                shortDescription: payload.shortDescription,
                trashedAt: null,
                updatedAt: timestamp,
              },
            } satisfies PriorityMetricMutationValue;
          },
        );
        const { metric } = receipt.nextValue;
        if (!metric) {
          throw new ORPCError("NOT_FOUND");
        }
        return metric;
      } catch (error) {
        rethrowPriorityMetricMutationError(error, clientIdempotencyKey);
      }
    }),
  updatePriorityMetric: protectedProcedure
    .input(updatePriorityMetricMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, metricId, ...payloadInput } =
        input;
      const parsed = updatePriorityMetricInputSchema.parse(payloadInput);
      const mutation = requirePriorityMetricMutationContracts(context).update(
        context.session.user.id,
      );
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId: metricId,
          },
          ({ currentRevision, currentValue, payload }) => {
            const current = currentValue.metric;
            if (!current) {
              throw new ORPCError("NOT_FOUND");
            }
            const timestamp = new Date().toISOString();
            return {
              metric: {
                ...current,
                enabled: payload.enabled,
                name: payload.name,
                rankDescriptions: payload.rankDescriptions,
                revision: currentRevision + 1,
                shortDescription: payload.shortDescription,
                updatedAt: timestamp,
              },
            } satisfies PriorityMetricMutationValue;
          },
        );
        const { metric } = receipt.nextValue;
        if (!metric) {
          throw new ORPCError("NOT_FOUND");
        }
        return metric;
      } catch (error) {
        rethrowPriorityMetricMutationError(error, metricId);
      }
    }),
  trashPriorityMetric: protectedProcedure
    .input(trashPriorityMetricMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, metricId } = input;
      const mutation = requirePriorityMetricMutationContracts(context).trash(
        context.session.user.id,
      );
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: {},
            targetId: metricId,
          },
          ({ currentRevision, currentValue }) => {
            const current = currentValue.metric;
            if (!current) {
              throw new ORPCError("NOT_FOUND");
            }
            const timestamp = new Date().toISOString();
            return {
              metric: {
                ...current,
                revision: currentRevision + 1,
                trashedAt: timestamp,
                updatedAt: timestamp,
              },
            } satisfies PriorityMetricMutationValue;
          },
        );
        const { metric } = receipt.nextValue;
        if (!metric) {
          throw new ORPCError("NOT_FOUND");
        }
        return metric;
      } catch (error) {
        rethrowPriorityMetricMutationError(error, metricId);
      }
    }),
  restorePriorityMetric: protectedProcedure
    .input(restorePriorityMetricMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, metricId } = input;
      const mutation = requirePriorityMetricMutationContracts(context).restore(
        context.session.user.id,
      );
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: {},
            targetId: metricId,
          },
          ({ currentRevision, currentValue }) => {
            const current = currentValue.metric;
            if (!current) {
              throw new ORPCError("NOT_FOUND");
            }
            const timestamp = new Date().toISOString();
            return {
              metric: {
                ...current,
                revision: currentRevision + 1,
                trashedAt: null,
                updatedAt: timestamp,
              },
            } satisfies PriorityMetricMutationValue;
          },
        );
        const { metric } = receipt.nextValue;
        if (!metric) {
          throw new ORPCError("NOT_FOUND");
        }
        return metric;
      } catch (error) {
        rethrowPriorityMetricMutationError(error, metricId);
      }
    }),
  deletePriorityMetric: protectedProcedure
    .input(deletePriorityMetricMutationInputSchema)
    .handler(async ({ context, input }) => {
      const {
        baseRevision,
        clientIdempotencyKey,
        grant,
        metricId,
        projectId,
        typedProjectName,
      } = input;
      const mutation = requirePriorityMetricMutationContracts(context).delete(
        context.session.user.id,
      );
      const confirmation = context.githubIdentityConfirmation;
      if (!confirmation) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: { projectId },
            targetId: metricId,
          },
          async ({ currentValue }) => {
            const current = currentValue.metric;
            if (!current || current.projectId !== projectId) {
              throw new ORPCError("NOT_FOUND");
            }
            const project = await requireProjectShell(context).find(
              context.session.user.id,
              projectId,
            );
            if (!project) {
              throw new ORPCError("NOT_FOUND");
            }
            if (project.name !== typedProjectName) {
              throw new ORPCError("BAD_REQUEST", {
                defined: true,
                message: "The Project name does not match.",
              });
            }
            const consumed = await confirmation.consume(
              sessionPrincipal(context.session),
              "early-permanent-delete",
              grant,
              context.clientKey,
            );
            if (!consumed) {
              throw new ORPCError("FORBIDDEN", {
                defined: true,
                message:
                  "Confirm GitHub Identity is required to delete this criterion.",
              });
            }
            return { metric: null } satisfies PriorityMetricMutationValue;
          },
        );
        if (receipt.nextValue.metric !== null) {
          throw new ORPCError("NOT_FOUND");
        }
        return { status: true };
      } catch (error) {
        rethrowPriorityMetricMutationError(error, metricId);
      }
    }),
  setPriorityMetricValue: protectedProcedure
    .input(setPriorityMetricValueMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const parsed = setPriorityMetricValueInputSchema.parse(payloadInput);
      const targetId = `${parsed.workId}:${parsed.metricId}`;
      const mutation = requirePriorityMetricMutationContracts(context).setValue(
        context.session.user.id,
      );
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          ({ currentRevision, currentValue, payload }) => {
            const timestamp = new Date().toISOString();
            const current = currentValue.value;
            return {
              value: {
                createdAt: current?.createdAt ?? timestamp,
                id: current?.id ?? crypto.randomUUID(),
                metricId: payload.metricId,
                projectId: payload.projectId,
                rank: payload.rank,
                revision: currentRevision + 1,
                updatedAt: timestamp,
                workId: payload.workId,
              },
            } satisfies PriorityMetricValueMutationValue;
          },
        );
        if (!receipt.nextValue.value) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.value;
      } catch (error) {
        rethrowPriorityMetricMutationError(error, targetId);
      }
    }),
  clearPriorityMetricValue: protectedProcedure
    .input(clearPriorityMetricValueMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const parsed = clearPriorityMetricValueInputSchema.parse(payloadInput);
      const targetId = `${parsed.workId}:${parsed.metricId}`;
      const mutation = requirePriorityMetricMutationContracts(
        context,
      ).clearValue(context.session.user.id);
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          () => ({ value: null }) satisfies PriorityMetricValueMutationValue,
        );
        if (receipt.nextValue.value !== null) {
          throw new ORPCError("NOT_FOUND");
        }
        return { status: true };
      } catch (error) {
        rethrowPriorityMetricMutationError(error, targetId);
      }
    }),
  focusPeriods: protectedProcedure.handler(({ context }) =>
    requireFocusPeriod(context).list(context.session.user.id),
  ),
  focusPeriod: protectedProcedure
    .input(focusPeriodIdInputSchema)
    .handler(({ context, input }) =>
      requireFocusPeriod(context).find(context.session.user.id, input.periodId),
    ),
  createFocusPeriod: protectedProcedure
    .input(createFocusPeriodInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireFocusPeriod(context).create(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowFocusPeriodError(error);
      }
    }),
  addToFocusPeriod: protectedProcedure
    .input(focusPeriodMembershipInputSchema)
    .handler(async ({ context, input }) => {
      try {
        await requireFocusPeriod(context).add(
          context.session.user.id,
          input.periodId,
          input.workId,
        );
        return { status: true };
      } catch (error) {
        rethrowFocusPeriodError(error);
      }
    }),
  moveToFocusPeriod: protectedProcedure
    .input(focusPeriodMembershipInputSchema)
    .handler(async ({ context, input }) => {
      try {
        await requireFocusPeriod(context).move(
          context.session.user.id,
          input.periodId,
          input.workId,
        );
        return { status: true };
      } catch (error) {
        rethrowFocusPeriodError(error);
      }
    }),
  removeFromFocusPeriod: protectedProcedure
    .input(focusPeriodMembershipInputSchema)
    .handler(async ({ context, input }) => {
      try {
        await requireFocusPeriod(context).remove(
          context.session.user.id,
          input.periodId,
          input.workId,
        );
        return { status: true };
      } catch (error) {
        rethrowFocusPeriodError(error);
      }
    }),
  cancelFocusPeriod: protectedProcedure
    .input(focusPeriodIdInputSchema)
    .handler(async ({ context, input }) => {
      try {
        await requireFocusPeriod(context).cancel(
          context.session.user.id,
          input.periodId,
        );
        return { status: true };
      } catch (error) {
        rethrowFocusPeriodError(error);
      }
    }),
  closeFocusPeriod: protectedProcedure
    .input(focusPeriodIdInputSchema)
    .handler(async ({ context, input }) => {
      try {
        await requireFocusPeriod(context).close(
          context.session.user.id,
          input.periodId,
        );
        return { status: true };
      } catch (error) {
        rethrowFocusPeriodError(error);
      }
    }),
  decideFocusPeriodLeftovers: protectedProcedure
    .input(focusPeriodDecisionInputSchema)
    .handler(async ({ context, input }) => {
      try {
        await requireFocusPeriod(context).decide(
          context.session.user.id,
          input,
        );
        return { status: true };
      } catch (error) {
        rethrowFocusPeriodError(error);
      }
    }),
  saveFocusPeriodEvaluation: protectedProcedure
    .input(focusPeriodEvaluationInputSchema)
    .handler(async ({ context, input }) => {
      try {
        await requireFocusPeriod(context).saveEvaluation(
          context.session.user.id,
          input,
        );
        return { status: true };
      } catch (error) {
        rethrowFocusPeriodError(error);
      }
    }),
  createFocusPeriodFollowUpWork: protectedProcedure
    .input(focusPeriodFollowUpWorkInputSchema)
    .handler(async ({ context, input }) => {
      const accountId = context.session.user.id;
      const access = requireFocusPeriod(context);
      try {
        const source = await access.find(accountId, input.periodId);
        if (!source) {
          throw new FocusPeriodUnavailableError("Focus Period is unavailable.");
        }
        if (source.status !== "Closed") {
          throw new FocusPeriodConflictError(
            "Follow-up Work needs a Closed Focus Period.",
          );
        }
        const learningKey = {
          Keep: "keep",
          Change: "change",
          "Try next": "tryNext",
        } as const satisfies Record<
          typeof input.learning,
          "keep" | "change" | "tryNext"
        >;
        const learningText = source.evaluation?.[learningKey[input.learning]];
        if (!learningText) {
          throw new FocusPeriodConflictError(
            "Follow-up Work needs a saved period learning.",
          );
        }
        const created = await runWorkLifecycleOperation(() =>
          requireWorkLifecycle(context).create(accountId, {
            baseRevision: 0,
            clientIdempotencyKey: input.clientIdempotencyKey,
            projectId: input.projectId,
            title: input.title,
            type: input.type,
            ...(input.description === undefined
              ? {}
              : { description: input.description }),
          }),
        );
        await access.linkFollowUpWork(accountId, {
          periodId: input.periodId,
          workId: created.id,
          learning: input.learning,
          learningText,
        });
        return created;
      } catch (error) {
        rethrowFocusPeriodError(error);
      }
    }),
  returnToWork: protectedProcedure
    .input(returnContextInputSchema)
    .handler(({ context, input }) =>
      requireReturnToWork(context).read(context.session.user.id, input),
    ),
  markReturnContextViewed: protectedProcedure
    .input(returnContextInputSchema)
    .handler(async ({ context, input }) => {
      await requireReturnToWork(context).markViewed(
        context.session.user.id,
        input,
      );
      return { status: true };
    }),
  saveNextConcreteStep: protectedProcedure
    .input(saveNextConcreteStepInputSchema)
    .handler(async ({ context, input }) => {
      try {
        await requireReturnToWork(context).saveNextStep(
          context.session.user.id,
          input,
        );
        return { status: true };
      } catch (error) {
        if (input.workId) {
          rethrowWorkLifecycleError(error);
        }
        rethrowProjectShellMutationError(error, input.projectId);
      }
    }),
  dailyFocusDay: protectedProcedure
    .input(dailyFocusDayInputSchema)
    .handler(({ context, input }) =>
      requireDailyFocus(context).list(context.session.user.id, input.focusDate),
    ),
  decisionSupersessionGraph: protectedProcedure
    .input(projectSourceRecordsProjectInputSchema)
    .handler(({ context, input }) => {
      const access = requireProjectSourceRecords(context).supersession;
      if (!access) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return access.read(context.session.user.id, input.projectId);
    }),
  decisionSupersessionHistory: protectedProcedure
    .input(projectSourceRecordsProjectInputSchema)
    .handler(({ context, input }) => {
      const access = requireProjectSourceRecords(context).supersession;
      if (!access) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return access.history(context.session.user.id, input.projectId);
    }),
  previewDecisionSupersession: protectedProcedure
    .input(decisionSupersessionSelectionSchema)
    .handler(async ({ context, input }) => {
      try {
        const access = requireProjectSourceRecords(context).supersession;
        if (!access) {
          throw new ORPCError("NOT_IMPLEMENTED");
        }
        const result = await access.preview(context.session.user.id, input);
        if (!result) {
          throw new ORPCError("NOT_FOUND");
        }
        return result;
      } catch (error) {
        rethrowProjectSourceRecordError(error);
      }
    }),
  commitDecisionSupersession: protectedProcedure
    .input(decisionSupersessionCommandSchema)
    .handler(async ({ context, input }) => {
      try {
        const access = requireProjectSourceRecords(context).supersession;
        if (!access) {
          throw new ORPCError("NOT_IMPLEMENTED");
        }
        const result = await access.commit(context.session.user.id, input);
        if (!result) {
          throw new ORPCError("NOT_FOUND");
        }
        return result;
      } catch (error) {
        rethrowProjectSourceRecordError(error);
      }
    }),
  projectResearchSessions: protectedProcedure
    .input(researchSessionProjectInputSchema)
    .handler(({ context, input }) => {
      if (!context.researchSessions) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return context.researchSessions.list(
        context.session.user.id,
        input.projectId,
      );
    }),
  saveResearchSession: protectedProcedure
    .input(saveResearchSessionInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.researchSessions) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      try {
        return await context.researchSessions.save(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowResearchSessionError(error);
      }
    }),
  saveResearchSessionNote: protectedProcedure
    .input(saveResearchSessionNoteInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.researchSessions) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      try {
        return await context.researchSessions.saveNote(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowResearchSessionError(error);
      }
    }),
  captureResearchSessionContent: protectedProcedure
    .input(captureResearchSessionInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.researchSessions) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      try {
        return await context.researchSessions.capture(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowResearchSessionError(error);
      }
    }),
  researchSessionBindingTargets: protectedProcedure
    .input(
      z
        .object({ id: z.string().min(1), projectId: z.string().min(1) })
        .strict(),
    )
    .handler(({ context, input }) => {
      if (!context.researchSessions?.bindingTargets) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return context.researchSessions.bindingTargets(
        context.session.user.id,
        input,
      );
    }),
  researchSessionBindingFeedback: protectedProcedure
    .input(
      z
        .object({
          id: z.string().min(1),
          projectId: z.string().min(1),
          bindingId: z.string().min(1),
        })
        .strict(),
    )
    .handler(async ({ context, input }) => {
      if (!context.researchSessions?.readBindingFeedback) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      try {
        return await context.researchSessions.readBindingFeedback(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowResearchSessionError(error);
      }
    }),
  projectResearchSessionBindings: protectedProcedure
    .input(
      z
        .object({ id: z.string().min(1), projectId: z.string().min(1) })
        .strict(),
    )
    .handler(async ({ context, input }) => {
      if (!context.researchSessions?.listBindings) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      try {
        return await context.researchSessions.listBindings(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowResearchSessionError(error);
      }
    }),
  previewResearchSessionBinding: protectedProcedure
    .input(previewResearchSessionBindingInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.researchSessions?.previewBinding) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      try {
        return await context.researchSessions.previewBinding(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowResearchSessionError(error);
      }
    }),
  confirmResearchSessionBinding: protectedProcedure
    .input(confirmResearchSessionBindingInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.researchSessions?.confirmBinding) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      try {
        return await context.researchSessions.confirmBinding(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowResearchSessionError(error);
      }
    }),
  previewResearchSessionSnapshot: protectedProcedure
    .input(researchSessionSnapshotPreviewInputSchema)
    .handler(async ({ context, input }) => {
      const session = await readOwnedResearchSession(context, input);
      return researchSessionSnapshotPreview(session, input.selection);
    }),
  previewResearchSessionConvert: protectedProcedure
    .input(researchSessionConvertPreviewInputSchema)
    .handler(async ({ context, input }) => {
      const session = await readOwnedResearchSession(context, input);
      if (
        !session.content.some((item) => item.content.id === input.contentId)
      ) {
        throw new ORPCError("NOT_FOUND");
      }
      try {
        return researchSessionConvertPreview(session, input.contentId);
      } catch (error) {
        rethrowResearchSessionError(error);
      }
    }),
  projectValidationRecords: protectedProcedure
    .input(projectSourceRecordsProjectInputSchema)
    .handler(({ context, input }) => {
      const access = requireProjectSourceRecords(context);
      if (!access.listValidationRecords) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return access.listValidationRecords(
        context.session.user.id,
        input.projectId,
      );
    }),
  projectAssumptions: protectedProcedure
    .input(projectSourceRecordsProjectInputSchema)
    .handler(({ context, input }) => {
      const access = requireProjectSourceRecords(context).listAssumptions;
      if (!access) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return access(context.session.user.id, input.projectId);
    }),
  projectRiskSignals: protectedProcedure
    .input(projectSourceRecordsProjectInputSchema)
    .handler(async ({ context, input }) => {
      const access = requireProjectSourceRecords(context).riskSignals;
      if (!access) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      const result = await access.list(
        context.session.user.id,
        input.projectId,
      );
      if (!result) {
        throw new ORPCError("NOT_FOUND");
      }
      return result;
    }),
  relateRiskContext: protectedProcedure
    .input(riskContextRelationInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const access = requireProjectSourceRecords(context).riskSignals;
        if (!access) {
          throw new ORPCError("NOT_IMPLEMENTED");
        }
        const result = await access.relate(context.session.user.id, input);
        if (!result) {
          throw new ORPCError("NOT_FOUND");
        }
        return result;
      } catch (error) {
        rethrowProjectSourceRecordError(error);
      }
    }),
  projectRisks: protectedProcedure
    .input(projectSourceRecordsProjectInputSchema)
    .handler(({ context, input }) =>
      requireProjectSourceRecords(context).listRisks(
        context.session.user.id,
        input.projectId,
      ),
    ),
  projectDecisions: protectedProcedure
    .input(projectSourceRecordsProjectInputSchema)
    .handler(({ context, input }) =>
      requireProjectSourceRecords(context).listDecisions(
        context.session.user.id,
        input.projectId,
      ),
    ),
  projectSourceRecords: protectedProcedure
    .input(projectSourceRecordsProjectInputSchema)
    .handler(({ context, input }) =>
      requireProjectSourceRecords(context).list(
        context.session.user.id,
        input.projectId,
      ),
    ),
  smartLinkPreview: protectedProcedure
    .input(smartLinkPreviewInputSchema)
    .output(smartLinkPreviewSchema)
    .handler(({ context, input }) => {
      if (!context.smartLinkPreview) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return context.smartLinkPreview(input.url);
    }),
  documentEvidenceTargets: protectedProcedure
    .input(documentSelectionSchema)
    .handler(({ context, input }) => {
      const access = context.documentEvidence;
      if (!access) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return access.targets(context.session.user.id, input);
    }),
  documentEvidenceBindings: protectedProcedure
    .input(documentSelectionSchema)
    .handler(({ context, input }) => {
      const access = context.documentEvidence;
      if (!access) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return access.list(context.session.user.id, input);
    }),
  evidenceFlow: protectedProcedure
    .input(evidenceFlowInputSchema)
    .handler(({ context, input }) => {
      const access = context.documentEvidence;
      if (!access) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return access.flow(context.session.user.id, input);
    }),
  documentEvidenceForTarget: protectedProcedure
    .input(documentEvidenceTargetSchema)
    .handler(({ context, input }) => {
      const access = context.documentEvidence;
      if (!access) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return access.forTarget(context.session.user.id, input);
    }),
  previewDocumentEvidence: protectedProcedure
    .input(previewDocumentEvidenceInputSchema)
    .handler(({ context, input }) => {
      const access = context.documentEvidence;
      if (!access) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return sourceSaveResult(() =>
        access.preview(context.session.user.id, input),
      );
    }),
  confirmDocumentEvidence: protectedProcedure
    .input(confirmDocumentEvidenceInputSchema)
    .handler(({ context, input }) => {
      const access = context.documentEvidence;
      if (!access) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return sourceSaveResult(() =>
        access.confirm(context.session.user.id, input),
      );
    }),
  setDocumentEvidenceRole: protectedProcedure
    .input(setDocumentEvidenceRoleInputSchema)
    .handler(({ context, input }) => {
      const access = context.documentEvidence;
      if (!access) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return sourceSaveResult(() =>
        access.setRole(context.session.user.id, input),
      );
    }),
  documentEvidenceHistory: protectedProcedure
    .input(documentEvidenceHistoryInputSchema)
    .handler(({ context, input }) => {
      const access = context.documentEvidence;
      if (!access) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return access.history(context.session.user.id, input);
    }),
  sourceEvidenceTargets: protectedProcedure
    .input(sourceSelectionSchema)
    .handler(({ context, input }) => {
      const access = context.sourceEvidence;
      if (!access) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return access.targets(context.session.user.id, input);
    }),
  sourceEvidenceUses: protectedProcedure
    .input(sourceSelectionSchema)
    .handler(({ context, input }) => {
      const access = context.sourceEvidence;
      if (!access) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return access.list(context.session.user.id, input);
    }),
  previewSourceEvidence: protectedProcedure
    .input(sourceEvidencePreviewInputSchema)
    .handler(({ context, input }) => {
      const access = context.sourceEvidence;
      if (!access) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return sourceSaveResult(() =>
        access.preview(context.session.user.id, input),
      );
    }),
  bindSourceEvidence: protectedProcedure
    .input(bindSourceEvidenceInputSchema)
    .handler(({ context, input }) => {
      const access = context.sourceEvidence;
      if (!access) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return sourceSaveResult(() =>
        access.bind(context.session.user.id, input),
      );
    }),
  reviewSourceEvidence: protectedProcedure
    .input(reviewSourceEvidenceInputSchema)
    .handler(({ context, input }) => {
      const access = context.sourceEvidence;
      if (!access) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return sourceSaveResult(() =>
        access.review(context.session.user.id, input),
      );
    }),
  recheckSource: protectedProcedure
    .input(recheckSourceInputSchema)
    .handler(({ context, input }) => {
      const access = context.sourceRecheck;
      if (!access) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return sourceSaveResult(() =>
        access.recheck(context.session.user.id, input),
      );
    }),
  sourceChecks: protectedProcedure
    .input(sourceSelectionSchema)
    .handler(({ context, input }) => {
      if (!context.sourceRecheck) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return context.sourceRecheck.list(context.session.user.id, input);
    }),
  decideSourceCheck: protectedProcedure
    .input(sourceCheckDecisionInputSchema)
    .handler(({ context, input }) => {
      const access = context.sourceRecheck;
      if (!access) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return sourceSaveResult(() =>
        access.decide(context.session.user.id, input),
      );
    }),
  createSource: protectedProcedure
    .input(createSourceInputSchema)
    .handler(({ context, input }) =>
      sourceSaveResult(() =>
        requireSourcesAndFreshness(context).create(
          context.session.user.id,
          input,
        ),
      ),
    ),
  saveSourceVersion: protectedProcedure
    .input(saveSourceVersionInputSchema)
    .handler(({ context, input }) =>
      sourceSaveResult(() =>
        requireSourcesAndFreshness(context).saveVersion(
          context.session.user.id,
          input,
        ),
      ),
    ),
  source: protectedProcedure
    .input(sourceSelectionSchema)
    .handler(({ context, input }) =>
      requireSourcesAndFreshness(context).find(context.session.user.id, input),
    ),
  projectSources: protectedProcedure
    .input(sourceProjectInputSchema)
    .handler(({ context, input }) =>
      requireSourcesAndFreshness(context).list(
        context.session.user.id,
        input.projectId,
      ),
    ),
  openQuestions: protectedProcedure
    .input(projectSourceRecordsProjectInputSchema)
    .handler(({ context, input }) => {
      const access = requireProjectSourceRecords(context).listOpenQuestions;
      if (!access) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return access(context.session.user.id, input.projectId);
    }),
  openQuestionContext: protectedProcedure
    .input(projectSourceRecordInputSchema)
    .handler(({ context, input }) => {
      if (input.sourceType !== "Open Question") {
        throw new ORPCError("BAD_REQUEST");
      }
      const access = requireProjectSourceRecords(context).openQuestionContext;
      if (!access) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return access(context.session.user.id, input.sourceId);
    }),
  projectSourceRecord: protectedProcedure
    .input(projectSourceRecordInputSchema)
    .handler(({ context, input }) =>
      requireProjectSourceRecords(context).find(
        context.session.user.id,
        input.sourceType,
        input.sourceId,
      ),
    ),
  createProjectSourceRecord: protectedProcedure
    .input(createProjectSourceRecordInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const record = await requireProjectSourceRecords(context).create(
          context.session.user.id,
          input,
        );
        if (!record) {
          throw new ORPCError("NOT_FOUND");
        }
        return record;
      } catch (error) {
        rethrowProjectSourceRecordError(error);
      }
    }),
  updateProjectSourceRecord: protectedProcedure
    .input(updateProjectSourceRecordInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const record = await requireProjectSourceRecords(context).update(
          context.session.user.id,
          input,
        );
        if (!record) {
          throw new ORPCError("NOT_FOUND");
        }
        return record;
      } catch (error) {
        rethrowProjectSourceRecordError(error);
      }
    }),
  transitionProjectSourceRecord: protectedProcedure
    .input(transitionProjectSourceRecordInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const record = await requireProjectSourceRecords(context).transition(
          context.session.user.id,
          input,
        );
        if (!record) {
          throw new ORPCError("NOT_FOUND");
        }
        return record;
      } catch (error) {
        rethrowProjectSourceRecordError(error);
      }
    }),
  dailyFocusClose: protectedProcedure
    .input(dailyFocusDayInputSchema)
    .handler(({ context, input }) =>
      requireDailyFocus(context).readClose(
        context.session.user.id,
        input.focusDate,
      ),
    ),
  favoritesList: protectedProcedure.handler(({ context }) =>
    requireFavorites(context).list(context.session.user.id),
  ),
  openFavoriteSource: protectedProcedure
    .input(favoriteSourceSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireFavorites(context).open(
          context.session.user.id,
          input,
        );
      } catch (error) {
        if (error instanceof FavoriteSourceUnavailableError) {
          throw new ORPCError("NOT_FOUND", {
            cause: error,
            message: "Source record is unavailable.",
          });
        }
        throw error;
      }
    }),
  favoriteMembership: protectedProcedure
    .input(favoriteSourceSchema)
    .handler(async ({ context, input }) => ({
      isFavorite: await requireFavorites(context).contains(
        context.session.user.id,
        input,
      ),
    })),
  addToFavorites: protectedProcedure
    .input(favoriteSourceSchema)
    .handler(async ({ context, input }) => {
      try {
        await requireFavorites(context).add(context.session.user.id, input);
      } catch (error) {
        if (error instanceof FavoriteSourceUnavailableError) {
          throw new ORPCError("NOT_FOUND", {
            cause: error,
            defined: true,
            message: "Source record is unavailable.",
          });
        }
        throw error;
      }
      return { status: true };
    }),
  removeFromFavorites: protectedProcedure
    .input(favoriteSourceSchema)
    .handler(async ({ context, input }) => {
      await requireFavorites(context).remove(context.session.user.id, input);
      return { status: true };
    }),
  addToDailyFocus: protectedProcedure
    .input(dailyFocusMembershipInputSchema)
    .handler(async ({ context, input }) => {
      try {
        await requireDailyFocus(context).add(
          context.session.user.id,
          input.focusDate,
          input.workId,
        );
      } catch (error) {
        if (error instanceof DailyFocusWorkUnavailableError) {
          throw new ORPCError("NOT_FOUND", { cause: error });
        }
        throw error;
      }
      return { status: true };
    }),
  removeFromDailyFocus: protectedProcedure
    .input(dailyFocusMembershipInputSchema)
    .handler(async ({ context, input }) => {
      try {
        await requireDailyFocus(context).remove(
          context.session.user.id,
          input.focusDate,
          input.workId,
        );
      } catch (error) {
        if (error instanceof DailyFocusWorkUnavailableError) {
          throw new ORPCError("NOT_FOUND", { cause: error });
        }
        throw error;
      }
      return { status: true };
    }),
  projectBacklogOrder: protectedProcedure
    .input(projectBacklogInputSchema)
    .handler(async ({ context, input }) => {
      const order = await requireBacklog(context).list(
        context.session.user.id,
        input.projectId,
      );
      if (!order) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "The Project Backlog is unavailable.",
        });
      }
      return order;
    }),
  projectBacklog: protectedProcedure
    .input(projectBacklogInputSchema)
    .handler(async ({ context, input }) => {
      const work = await requireBacklog(context).listPrepared(
        context.session.user.id,
        input.projectId,
      );
      if (!work) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "The Project Backlog is unavailable.",
        });
      }
      return work;
    }),
  projectRoadmapViews: protectedProcedure
    .input(projectRoadmapInputSchema)
    .handler(async ({ context, input }) => {
      const views = await requireRoadmapHorizon(context).listViews(
        context.session.user.id,
        input.projectId,
      );
      if (!views) {
        throw new ORPCError("NOT_FOUND");
      }
      return views;
    }),
  projectRoadmapOrigins: protectedProcedure
    .input(projectRoadmapInputSchema)
    .handler(async ({ context, input }) => {
      const origins = await requireRoadmapHorizon(context).listOrigins(
        context.session.user.id,
        input.projectId,
      );
      if (!origins) {
        throw new ORPCError("NOT_FOUND");
      }
      return origins;
    }),
  projectRoadmapBlockers: protectedProcedure
    .input(projectRoadmapInputSchema)
    .handler(async ({ context, input }) => {
      const blockers = await requireRoadmapHorizon(context).listActiveBlockers(
        context.session.user.id,
        input.projectId,
      );
      if (!blockers) {
        throw new ORPCError("NOT_FOUND");
      }
      return blockers;
    }),
  personalReminderSignals: protectedProcedure.handler(({ context }) =>
    requirePersonalReminders(context).listSignals(context.session.user.id),
  ),
  dismissPersonalReminderSignal: protectedProcedure
    .input(personalReminderSignalInputSchema)
    .handler(async ({ context, input }) => {
      const signal = await requirePersonalReminders(context).dismissSignal(
        context.session.user.id,
        input.signalId,
      );
      if (!signal) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Reminder signal is unavailable.",
        });
      }
      return signal;
    }),
  reschedulePersonalReminderSignal: protectedProcedure
    .input(reschedulePersonalReminderSignalInputSchema)
    .handler(({ context, input }) =>
      runPersonalReminderOperation(async () => {
        const reminder = await requirePersonalReminders(
          context,
        ).rescheduleSignal(context.session.user.id, input);
        if (!reminder) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Reminder signal is unavailable.",
          });
        }
        return reminder;
      }),
    ),
  personalReminders: protectedProcedure
    .input(personalRemindersInputSchema)
    .handler(async ({ context, input }) => {
      const reminders = await requirePersonalReminders(context).list(
        context.session.user.id,
        input,
      );
      if (!reminders) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Reminders are unavailable for this source.",
        });
      }
      return reminders;
    }),
  createPersonalReminder: protectedProcedure
    .input(createPersonalReminderInputSchema)
    .handler(({ context, input }) =>
      runPersonalReminderOperation(async () => {
        const reminder = await requirePersonalReminders(context).create(
          context.session.user.id,
          input,
        );
        if (!reminder) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Reminder is unavailable for this source.",
          });
        }
        return reminder;
      }),
    ),
  cancelPersonalReminder: protectedProcedure
    .input(cancelPersonalReminderInputSchema)
    .handler(async ({ context, input }) => {
      const reminder = await requirePersonalReminders(context).cancel(
        context.session.user.id,
        input.reminderId,
      );
      if (!reminder) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Planned reminder is unavailable.",
        });
      }
      return reminder;
    }),
  workReviewLater: protectedProcedure
    .input(workReviewLaterInputSchema)
    .handler(async ({ context, input }) => {
      const reminders = await requirePersonalReminders(context).list(
        context.session.user.id,
        { sourceRecordId: input.workId, sourceRecordType: "Work" },
      );
      if (!reminders) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Work reminders are unavailable.",
        });
      }
      return reminders.filter((reminder) => reminder.action === "Review Later");
    }),
  createWorkReviewLater: protectedProcedure
    .input(createWorkReviewLaterInputSchema)
    .handler(({ context, input }) =>
      runPersonalReminderOperation(async () => {
        const reminder = await requirePersonalReminders(context).create(
          context.session.user.id,
          {
            action: "Review Later",
            clientIdempotencyKey: input.clientIdempotencyKey,
            condition: input.condition,
            fireAt: input.fireAt,
            sourceRecordId: input.workId,
            sourceRecordType: "Work",
          },
        );
        if (!reminder) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Review Later is unavailable for this Work.",
          });
        }
        return reminder;
      }),
    ),
  cancelWorkReviewLater: protectedProcedure
    .input(cancelWorkReviewLaterInputSchema)
    .handler(async ({ context, input }) => {
      const reminder = await requirePersonalReminders(context).cancel(
        context.session.user.id,
        input.reminderId,
        { action: "Review Later", sourceRecordType: "Work" },
      );
      if (!reminder) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Planned Review Later is unavailable.",
        });
      }
      return reminder;
    }),
  workNotNowHistory: protectedProcedure
    .input(workNotNowHistoryInputSchema)
    .handler(async ({ context, input }) => {
      const history = await requireRoadmapHorizon(context).history(
        context.session.user.id,
        input.workId,
      );
      if (!history) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Work history is unavailable.",
        });
      }
      return history;
    }),
  recordWorkNotNow: protectedProcedure
    .input(recordWorkNotNowInputSchema)
    .handler(({ context, input }) =>
      runWorkNotNowOperation(async () => {
        const trail = await requireRoadmapHorizon(context).record(
          context.session.user.id,
          input,
        );
        if (!trail) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Not now can be recorded only on open Work.",
          });
        }
        return trail;
      }),
    ),
  reconsiderWorkNotNow: protectedProcedure
    .input(reconsiderWorkNotNowInputSchema)
    .handler(({ context, input }) =>
      runWorkNotNowOperation(async () => {
        const trail = await requireRoadmapHorizon(context).reconsider(
          context.session.user.id,
          input,
        );
        if (!trail) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "The active Not now trail is unavailable.",
          });
        }
        return trail;
      }),
    ),
  projectMilestones: protectedProcedure
    .input(projectRoadmapInputSchema)
    .handler(async ({ context, input }) => {
      const milestones = await requireRoadmapHorizon(context).listMilestones(
        context.session.user.id,
        input.projectId,
      );
      if (!milestones) {
        throw new ORPCError("NOT_FOUND");
      }
      return milestones;
    }),
  createMilestone: protectedProcedure
    .input(createMilestoneInputSchema)
    .handler(async ({ context, input }) => {
      const milestone = await requireRoadmapHorizon(context).createMilestone(
        context.session.user.id,
        input,
      );
      if (!milestone) {
        throw new ORPCError("NOT_FOUND");
      }
      return milestone;
    }),
  updateMilestone: protectedProcedure
    .input(updateMilestoneInputSchema)
    .handler(async ({ context, input }) => {
      const milestone = await requireRoadmapHorizon(context).updateMilestone(
        context.session.user.id,
        input,
      );
      if (!milestone) {
        throw new ORPCError("NOT_FOUND");
      }
      return milestone;
    }),
  updateMilestoneStatus: protectedProcedure
    .input(updateMilestoneStatusInputSchema)
    .handler(async ({ context, input }) => {
      const milestone = await requireRoadmapHorizon(
        context,
      ).updateMilestoneStatus(context.session.user.id, input);
      if (!milestone) {
        throw new ORPCError("NOT_FOUND");
      }
      return milestone;
    }),
  saveRoadmapView: protectedProcedure
    .input(saveRoadmapViewInputSchema)
    .handler(async ({ context, input }) => {
      const view = await requireRoadmapHorizon(context).saveView(
        context.session.user.id,
        input,
      );
      if (!view) {
        throw new ORPCError("NOT_FOUND");
      }
      return view;
    }),
  projectBacklogPresentation: protectedProcedure
    .input(projectBacklogInputSchema)
    .handler(async ({ context, input }) => {
      const presentation = await requireBacklog(context).listPresentation(
        context.session.user.id,
        input.projectId,
      );
      if (!presentation) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "The Project Backlog is unavailable.",
        });
      }
      return presentation;
    }),
  saveBacklogPresentation: protectedProcedure
    .input(saveBacklogPresentationMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const parsed = saveBacklogPresentationInputSchema.parse(payloadInput);
      const targetId = parsed.projectId;
      const mutation = requireBacklogMutationContracts(
        context,
      ).savePresentation(context.session.user.id);
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          ({ currentRevision, currentValue, payload }) => ({
            ...currentValue,
            revision: currentRevision + 1,
            saved: payload.saved,
          }),
        );
        return receipt.nextValue;
      } catch (error) {
        rethrowBacklogMutationError(error, targetId);
      }
    }),
  updateBacklogOrder: protectedProcedure
    .input(updateBacklogOrderMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const parsed = updateBacklogOrderInputSchema.parse(payloadInput);
      const targetId = parsed.projectId;
      const mutation = requireBacklogMutationContracts(context).updateOrder(
        context.session.user.id,
      );
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          ({ currentRevision, currentValue, payload }) => ({
            order: currentValue.order
              ? {
                  ...currentValue.order,
                  revision: currentRevision + 1,
                  workIds: payload.workIds,
                }
              : null,
          }),
        );
        if (!receipt.nextValue.order) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.order;
      } catch (error) {
        rethrowBacklogMutationError(error, targetId);
      }
    }),
  prioritizationSessions: protectedProcedure
    .input(prioritizationSessionsProjectInputSchema)
    .handler(async ({ context, input }) => {
      const sessions = await requirePrioritizationSessions(context).list(
        context.session.user.id,
        input.projectId,
      );
      if (!sessions) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "The Project Prioritization sessions are unavailable.",
        });
      }
      return sessions;
    }),
  createPrioritizationSession: protectedProcedure
    .input(createPrioritizationSessionMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const parsed = createPrioritizationSessionInputSchema.parse(payloadInput);
      const targetId = clientIdempotencyKey;
      const mutation = requirePrioritizationSessionMutationContracts(
        context,
      ).create(context.session.user.id);
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          ({ currentRevision, payload }) => {
            const timestamp = new Date().toISOString();
            return {
              session: {
                closedAt: null,
                createdAt: timestamp,
                id: crypto.randomUUID(),
                name: payload.name,
                projectId: payload.projectId,
                revision: currentRevision + 1,
                trashedAt: null,
                updatedAt: timestamp,
                workIds: payload.workIds,
              },
            } satisfies PrioritizationSessionMutationValue;
          },
        );
        if (!receipt.nextValue.session) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.session;
      } catch (error) {
        rethrowPrioritizationSessionMutationError(error, targetId);
      }
    }),
  updatePrioritizationSessionOrder: protectedProcedure
    .input(updatePrioritizationSessionOrderMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const parsed =
        updatePrioritizationSessionOrderInputSchema.parse(payloadInput);
      const targetId = parsed.sessionId;
      const mutation = requirePrioritizationSessionMutationContracts(
        context,
      ).updateOrder(context.session.user.id);
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          ({ currentRevision, currentValue, payload }) => {
            const current = currentValue.session;
            if (!current) {
              return { session: null };
            }
            return {
              session: {
                ...current,
                revision: currentRevision + 1,
                updatedAt: new Date().toISOString(),
                workIds: payload.workIds,
              },
            } satisfies PrioritizationSessionMutationValue;
          },
        );
        if (!receipt.nextValue.session) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.session;
      } catch (error) {
        rethrowPrioritizationSessionMutationError(error, targetId);
      }
    }),
  closePrioritizationSession: protectedProcedure
    .input(closePrioritizationSessionMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const parsed = closePrioritizationSessionInputSchema.parse(payloadInput);
      const targetId = parsed.sessionId;
      const mutation = requirePrioritizationSessionMutationContracts(
        context,
      ).close(context.session.user.id);
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          ({ currentRevision, currentValue }) => {
            const current = currentValue.session;
            if (!current) {
              return { session: null };
            }
            const timestamp = new Date().toISOString();
            return {
              session: {
                ...current,
                closedAt: timestamp,
                revision: currentRevision + 1,
                updatedAt: timestamp,
              },
            } satisfies PrioritizationSessionMutationValue;
          },
        );
        if (!receipt.nextValue.session) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.session;
      } catch (error) {
        rethrowPrioritizationSessionMutationError(error, targetId);
      }
    }),
  trashPrioritizationSession: protectedProcedure
    .input(trashPrioritizationSessionMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const parsed = trashPrioritizationSessionInputSchema.parse(payloadInput);
      const targetId = parsed.sessionId;
      const mutation = requirePrioritizationSessionMutationContracts(
        context,
      ).trash(context.session.user.id);
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          ({ currentRevision, currentValue }) => {
            const current = currentValue.session;
            if (!current) {
              return { session: null };
            }
            const timestamp = new Date().toISOString();
            return {
              session: {
                ...current,
                revision: currentRevision + 1,
                trashedAt: timestamp,
                updatedAt: timestamp,
              },
            } satisfies PrioritizationSessionMutationValue;
          },
        );
        if (!receipt.nextValue.session) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.session;
      } catch (error) {
        rethrowPrioritizationSessionMutationError(error, targetId);
      }
    }),
  restorePrioritizationSession: protectedProcedure
    .input(restorePrioritizationSessionMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const parsed =
        restorePrioritizationSessionInputSchema.parse(payloadInput);
      const targetId = parsed.sessionId;
      const mutation = requirePrioritizationSessionMutationContracts(
        context,
      ).restore(context.session.user.id);
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          ({ currentRevision, currentValue }) => {
            const current = currentValue.session;
            if (!current) {
              return { session: null };
            }
            return {
              session: {
                ...current,
                revision: currentRevision + 1,
                trashedAt: null,
                updatedAt: new Date().toISOString(),
              },
            } satisfies PrioritizationSessionMutationValue;
          },
        );
        if (!receipt.nextValue.session) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.session;
      } catch (error) {
        rethrowPrioritizationSessionMutationError(error, targetId);
      }
    }),
  copyCustomFieldDefinitions: protectedProcedure
    .input(copyCustomFieldDefinitionsInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const definitions = await requireCustomFields(context).copyDefinitions(
          context.session.user.id,
          input,
        );
        if (!definitions) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Source or target Project is unavailable.",
          });
        }
        return definitions;
      } catch (error) {
        rethrowCustomFieldMutationError(error, input.targetProjectId, {
          targetNotFoundMessage: "Source or target Project is unavailable.",
        });
      }
    }),
  projectWorks: protectedProcedure
    .input(
      z
        .object({
          archived: z.union([z.boolean(), z.literal("all")]).default(false),
          projectId: z.string().trim().min(1),
        })
        .strict(),
    )
    .handler(({ context, input }) =>
      requireWorkLifecycle(context).list(
        context.session.user.id,
        input.projectId,
        { archived: input.archived },
      ),
    ),
  workContext: protectedProcedure
    .input(workContextInputSchema)
    .handler(async ({ context, input }) => {
      const projection = await requireWorkContext(context).find(
        context.session.user.id,
        input.workId,
      );
      if (!projection) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Work context is unavailable.",
        });
      }
      return projection;
    }),
  relations: protectedProcedure
    .input(relationsInputSchema)
    .handler(({ context, input }) =>
      runRelationsOperation(() =>
        requireRelations(context).list(context.session.user.id, input),
      ),
    ),
  usedIn: protectedProcedure
    .input(relationsInputSchema)
    .handler(({ context, input }) =>
      runRelationsOperation(() =>
        requireRelations(context).listUsedIn(context.session.user.id, input),
      ),
    ),
  relationPreview: protectedProcedure
    .input(relationCreatePreviewInputSchema)
    .handler(({ context, input }) =>
      runRelationsOperation(() =>
        requireRelations(context).previewCreate(context.session.user.id, input),
      ),
    ),
  createRelation: protectedProcedure
    .input(relationCreateInputSchema)
    .handler(({ context, input }) =>
      runRelationsOperation(() =>
        requireRelations(context).create(context.session.user.id, input),
      ),
    ),
  resolveBlocker: protectedProcedure
    .input(resolveBlockerInputSchema)
    .handler(({ context, input }) =>
      runRelationsOperation(() =>
        requireRelations(context).resolveBlocker(
          context.session.user.id,
          input,
        ),
      ),
    ),
  reactivateBlocker: protectedProcedure
    .input(reactivateBlockerInputSchema)
    .handler(({ context, input }) =>
      runRelationsOperation(() =>
        requireRelations(context).reactivateBlocker(
          context.session.user.id,
          input,
        ),
      ),
    ),
  removeRelation: protectedProcedure
    .input(removeRelationInputSchema)
    .handler(({ context, input }) =>
      runRelationsOperation(() =>
        requireRelations(context).remove(context.session.user.id, input),
      ),
    ),
  undoRelation: protectedProcedure
    .input(undoRelationInputSchema)
    .handler(({ context, input }) =>
      runRelationsOperation(() =>
        requireRelations(context).undo(context.session.user.id, input),
      ),
    ),
  workDrafts: protectedProcedure
    .input(workDraftsInputSchema)
    .handler(({ context, input }) =>
      runWorkDraftOperation(() =>
        requireWorkDrafts(context).list(
          context.session.user.id,
          input.projectId,
        ),
      ),
    ),
  workDraft: protectedProcedure
    .input(workDraftInputSchema)
    .handler(({ context, input }) =>
      runWorkDraftOperation(() =>
        requireWorkDrafts(context).find(context.session.user.id, input.draftId),
      ),
    ),
  saveWorkDraft: protectedProcedure
    .input(saveWorkDraftInputSchema)
    .handler(({ context, input }) =>
      runWorkDraftOperation(() =>
        requireWorkDrafts(context).save(context.session.user.id, input),
      ),
    ),
  deleteWorkDraft: protectedProcedure
    .input(deleteWorkDraftInputSchema)
    .handler(({ context, input }) =>
      runWorkDraftOperation(() =>
        requireWorkDrafts(context).delete(context.session.user.id, input),
      ),
    ),
  finalizeWorkDraft: protectedProcedure
    .input(finalizeWorkDraftInputSchema)
    .handler(({ context, input }) =>
      runWorkDraftOperation(() =>
        requireWorkDrafts(context).finalize(context.session.user.id, input),
      ),
    ),
  scopeTree: protectedProcedure
    .input(z.object({ projectId: z.string().trim().min(1) }).strict())
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).scopeTree(
          context.session.user.id,
          input.projectId,
        ),
      ),
    ),
  featureProgress: protectedProcedure
    .input(z.object({ featureId: z.string().trim().min(1) }).strict())
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).featureProgress(
          context.session.user.id,
          input.featureId,
        ),
      ),
    ),
  includeWork: protectedProcedure
    .input(includeWorkInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).includeWork(
          context.session.user.id,
          input,
        ),
      ),
    ),
  detachIncludedWork: protectedProcedure
    .input(detachIncludedWorkInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).detachIncludedWork(
          context.session.user.id,
          input,
        ),
      ),
    ),
  recordFeatureHealth: protectedProcedure
    .input(recordFeatureHealthInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).recordFeatureHealth(
          context.session.user.id,
          input,
        ),
      ),
    ),
  detachFeatureHealthHistory: protectedProcedure
    .input(detachFeatureHealthHistoryInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).detachFeatureHealthHistory(
          context.session.user.id,
          input,
        ),
      ),
    ),
  updateFeaturePrimarySpec: protectedProcedure
    .input(updateFeaturePrimarySpecInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).updateFeaturePrimarySpec(
          context.session.user.id,
          input,
        ),
      ),
    ),
  work: protectedProcedure
    .input(z.object({ workId: z.string().trim().min(1) }).strict())
    .handler(async ({ context, input }) => {
      const record = await requireWorkLifecycle(context).find(
        context.session.user.id,
        input.workId,
      );
      if (!record) {
        throw new ORPCError("NOT_FOUND");
      }
      return record;
    }),
  workTypeChangePreview: protectedProcedure
    .input(workTypeChangePreviewInputSchema)
    .handler(async ({ context, input }) => {
      const preview = await requireWorkLifecycle(context).previewTypeChange(
        context.session.user.id,
        input,
      );
      if (!preview) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Work is unavailable.",
        });
      }
      return preview;
    }),
  workRecreatePreview: protectedProcedure
    .input(workRecreatePreviewInputSchema)
    .handler(async ({ context, input }) => {
      const preview = await requireWorkLifecycle(context).previewRecreate(
        context.session.user.id,
        input,
      );
      if (!preview) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Work or target Project is unavailable.",
        });
      }
      return preview;
    }),
  workChecklistConversionPreview: protectedProcedure
    .input(workChecklistConversionPreviewInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(async () => {
        const preview = await requireWorkLifecycle(
          context,
        ).previewChecklistConversion(context.session.user.id, input);
        if (!preview) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Work checklist item is unavailable.",
          });
        }
        return preview;
      }),
    ),
  workMergePreview: protectedProcedure
    .input(workMergePreviewInputSchema)
    .handler(async ({ context, input }) => {
      const preview = await requireWorkLifecycle(context).previewMerge(
        context.session.user.id,
        input,
      );
      if (!preview) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "The selected Work records are unavailable.",
        });
      }
      return preview;
    }),
  mergeWork: protectedProcedure
    .input(mergeWorkInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).merge(context.session.user.id, input),
      ),
    ),
  resolveWorkIdentity: protectedProcedure
    .input(workIdentityInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).resolve(context.session.user.id, input),
      ),
    ),
  undoWorkMerge: protectedProcedure
    .input(undoWorkMergeInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).undoMerge(context.session.user.id, input),
      ),
    ),
  undoWorkStatus: protectedProcedure
    .input(undoWorkStatusInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).undoStatus(
          context.session.user.id,
          input,
        ),
      ),
    ),
  undoWorkDate: protectedProcedure
    .input(undoWorkDateInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).undoDate(context.session.user.id, input),
      ),
    ),
  recreateWork: protectedProcedure
    .input(recreateWorkInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).recreate(context.session.user.id, input),
      ),
    ),
  workClosePreview: protectedProcedure
    .input(workClosePreviewInputSchema)
    .handler(async ({ context, input }) => {
      const preview = await requireWorkLifecycle(context).previewClose(
        context.session.user.id,
        input,
      );
      if (!preview) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Work is unavailable.",
        });
      }
      return preview;
    }),
  updateWorkType: protectedProcedure
    .input(updateWorkTypeInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).updateType(
          context.session.user.id,
          input,
        ),
      ),
    ),
  archiveWork: protectedProcedure
    .input(workArchiveMutationInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).archive(context.session.user.id, input),
      ),
    ),
  updateWorkStatus: protectedProcedure
    .input(updateWorkStatusInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).updateStatus(
          context.session.user.id,
          input,
          { kind: "Visible user" },
        ),
      ),
    ),
  updateWorkChecklist: protectedProcedure
    .input(updateWorkChecklistInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).updateChecklist(
          context.session.user.id,
          input,
        ),
      ),
    ),
  updateWorkReappearDate: protectedProcedure
    .input(updateWorkReappearDateInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).updateReappearDate(
          context.session.user.id,
          input,
        ),
      ),
    ),
  updateWorkPlannedDate: protectedProcedure
    .input(updateWorkPlannedDateInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).updatePlannedDate(
          context.session.user.id,
          input,
        ),
      ),
    ),
  updateWorkDate: protectedProcedure
    .input(updateWorkDateInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).updateDate(
          context.session.user.id,
          input,
        ),
      ),
    ),
  updateWorkHorizon: protectedProcedure
    .input(updateWorkHorizonInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).updateRoadmapHorizon(
          context.session.user.id,
          input,
        ),
      ),
    ),
  updateResearchDirection: protectedProcedure
    .input(updateResearchDirectionInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).updateResearchDirection(
          context.session.user.id,
          input,
        ),
      ),
    ),
  convertWorkChecklistItem: protectedProcedure
    .input(convertWorkChecklistItemInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).convertChecklistItem(
          context.session.user.id,
          input,
        ),
      ),
    ),
  closeWork: protectedProcedure
    .input(closeWorkInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).close(context.session.user.id, input, {
          kind: "Visible user",
        }),
      ),
    ),
  reopenWork: protectedProcedure
    .input(reopenWorkInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).reopen(context.session.user.id, input, {
          kind: "Visible user",
        }),
      ),
    ),
  unarchiveWork: protectedProcedure
    .input(workArchiveMutationInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).unarchive(context.session.user.id, input),
      ),
    ),
  createWork: protectedProcedure
    .input(createWorkRpcMutationInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).create(context.session.user.id, input),
      ),
    ),
  createDocumentWorkBatch: protectedProcedure
    .input(createDocumentWorkBatchInputSchema)
    .handler(({ context, input }) => {
      const createBatch = requireWorkLifecycle(context).createDocumentWorkBatch;
      if (!createBatch) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      return runWorkLifecycleOperation(() =>
        createBatch(context.session.user.id, input),
      );
    }),
  createProject: protectedProcedure
    .input(createProjectMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...createInput } = input;
      const parsed = createProjectInputSchema.parse(createInput);
      const mutation = requireProjectShellMutationContract(
        context,
        "create",
        context.session.user.id,
      );
      const baseShortCode =
        parsed.shortCode ?? suggestProjectShortCode(parsed.name);

      for (let attempt = 0; attempt < 10_000; attempt += 1) {
        const shortCode = shortCodeSchema.parse(
          attempt === 0 ? baseShortCode : `${baseShortCode}-${attempt + 1}`,
        );
        try {
          // biome-ignore lint/performance/noAwaitInLoops: Automatic suggestions must be retried in order so each candidate reflects the previous reservation result.
          const receipt = await mutation.mutate(
            {
              actor: { actorId: context.session.user.id, type: "User" },
              baseRevision,
              clientIdempotencyKey,
              kind: "human",
              payload: parsed,
              targetId: clientIdempotencyKey,
            },
            ({ currentRevision }) => {
              const timestamp = new Date().toISOString();
              return {
                project: {
                  createdAt: timestamp,
                  configuration: getProjectShellConfiguration(
                    parsed.starterConfiguration,
                  ),
                  id: crypto.randomUUID(),
                  logo: nullableProjectValue(parsed.logo),
                  name: parsed.name,
                  problem: nullableProjectValue(parsed.problem),
                  purpose: nullableProjectValue(parsed.purpose),
                  revision: currentRevision + 1,
                  scope: nullableProjectValue(parsed.scope),
                  shortCode,
                  shortCodeLocked: false,
                  starterConfiguration: parsed.starterConfiguration,
                  status: "Active",
                  targetDate: parsed.targetDate ?? null,
                  updatedAt: timestamp,
                },
              } satisfies ProjectShellMutationValue;
            },
          );
          return receipt.nextValue.project;
        } catch (error) {
          if (
            isRecord(error) &&
            error.code === "SHORT_CODE_CONFLICT" &&
            !parsed.shortCode
          ) {
            continue;
          }
          rethrowProjectShellMutationError(error, clientIdempotencyKey);
        }
      }

      throw new ORPCError("CONFLICT", {
        data: {
          code: "SHORT_CODE_CONFLICT",
          label: "Short code is already used in this Workspace.",
        },
        defined: true,
        message: "Short code could not be suggested.",
      });
    }),
  createCustomField: protectedProcedure
    .input(createCustomFieldMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...createInput } = input;
      const parsed = createCustomFieldInputSchema.parse(createInput);
      const mutation = requireCustomFieldMutationContracts(context).create(
        context.session.user.id,
      );

      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId: clientIdempotencyKey,
          },
          ({ currentRevision, payload }) => {
            const timestamp = new Date().toISOString();
            return {
              field: {
                createdAt: timestamp,
                id: crypto.randomUUID(),
                name: payload.name,
                options: payload.options,
                projectId: payload.projectId,
                recordTypes: payload.recordTypes,
                revision: currentRevision + 1,
                trashedAt: null,
                type: payload.type,
                updatedAt: timestamp,
              },
            } satisfies CustomFieldMutationValue;
          },
        );
        const { field } = receipt.nextValue;
        if (!field) {
          throw new ORPCError("NOT_FOUND");
        }
        return field;
      } catch (error) {
        rethrowCustomFieldMutationError(error, clientIdempotencyKey, {
          targetNotFoundMessage: "Project is unavailable.",
        });
      }
    }),
  customFieldValues: protectedProcedure
    .input(customFieldValuesInputSchema)
    .handler(async ({ context, input }) => {
      const items = await requireCustomFields(context).values(
        context.session.user.id,
        input,
      );
      if (!items) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Project is unavailable.",
        });
      }
      return items;
    }),
  customFieldSearchFields: protectedProcedure
    .input(customFieldSearchFieldsInputSchema)
    .handler(async ({ context, input }) => {
      const fields = await requireCustomFields(context).searchFields(
        context.session.user.id,
        input,
      );
      if (!fields) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Project is unavailable.",
        });
      }
      return fields;
    }),
  customFieldProjectValues: protectedProcedure
    .input(customFieldProjectValuesInputSchema)
    .handler(async ({ context, input }) => {
      const projectValues = await requireCustomFields(context).projectValues(
        context.session.user.id,
        input,
      );
      if (!projectValues) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Project is unavailable.",
        });
      }
      return projectValues;
    }),
  previewCustomFieldOptionDeletion: protectedProcedure
    .input(previewCustomFieldOptionDeletionInputSchema)
    .handler(({ context, input }) =>
      requireCustomFields(context).previewOptionDeletion(
        context.session.user.id,
        input,
      ),
    ),
  updateCustomField: protectedProcedure
    .input(updateCustomFieldMutationInputSchema)
    .handler(async ({ context, input }) => {
      const {
        baseRevision,
        clientIdempotencyKey,
        definitionId,
        ...inputPayload
      } = input;
      const parsed = updateCustomFieldInputSchema.parse(inputPayload);
      const mutation = requireCustomFieldMutationContracts(context).update(
        context.session.user.id,
      );

      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId: definitionId,
          },
          ({ currentValue, currentRevision, payload }) => {
            const current = currentValue.field;
            if (!current) {
              throw new ORPCError("NOT_FOUND");
            }
            const timestamp = new Date().toISOString();
            return {
              field: {
                ...current,
                name: payload.name,
                options: payload.options,
                recordTypes: payload.recordTypes,
                revision: currentRevision + 1,
                updatedAt: timestamp,
              },
            } satisfies CustomFieldMutationValue;
          },
        );
        const { field } = receipt.nextValue;
        if (!field) {
          throw new ORPCError("NOT_FOUND");
        }
        return field;
      } catch (error) {
        rethrowCustomFieldMutationError(error, definitionId);
      }
    }),
  trashCustomField: protectedProcedure
    .input(trashCustomFieldMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, definitionId } = input;
      const mutation = requireCustomFieldMutationContracts(context).trash(
        context.session.user.id,
      );

      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: {},
            targetId: definitionId,
          },
          ({ currentValue, currentRevision }) => {
            const current = currentValue.field;
            if (!current) {
              throw new ORPCError("NOT_FOUND");
            }
            const timestamp = new Date().toISOString();
            return {
              field: {
                ...current,
                revision: currentRevision + 1,
                trashedAt: timestamp,
                updatedAt: timestamp,
              },
            } satisfies CustomFieldMutationValue;
          },
        );
        const { field } = receipt.nextValue;
        if (!field) {
          throw new ORPCError("NOT_FOUND");
        }
        return field;
      } catch (error) {
        rethrowCustomFieldMutationError(error, definitionId);
      }
    }),
  restoreCustomField: protectedProcedure
    .input(restoreCustomFieldMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, definitionId } = input;
      const mutation = requireCustomFieldMutationContracts(context).restore(
        context.session.user.id,
      );

      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: {},
            targetId: definitionId,
          },
          ({ currentValue, currentRevision }) => {
            const current = currentValue.field;
            if (!current) {
              throw new ORPCError("NOT_FOUND");
            }
            const timestamp = new Date().toISOString();
            return {
              field: {
                ...current,
                revision: currentRevision + 1,
                trashedAt: null,
                updatedAt: timestamp,
              },
            } satisfies CustomFieldMutationValue;
          },
        );
        const { field } = receipt.nextValue;
        if (!field) {
          throw new ORPCError("NOT_FOUND");
        }
        return field;
      } catch (error) {
        rethrowCustomFieldMutationError(error, definitionId);
      }
    }),
  deleteCustomField: protectedProcedure
    .input(deleteCustomFieldMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, definitionId } = input;
      const mutation = requireCustomFieldMutationContracts(context).delete(
        context.session.user.id,
      );

      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: {},
            targetId: definitionId,
          },
          () => ({ field: null }) satisfies CustomFieldMutationValue,
        );
        if (receipt.nextValue.field !== null) {
          throw new ORPCError("NOT_FOUND");
        }
        return { status: true };
      } catch (error) {
        rethrowCustomFieldMutationError(error, definitionId);
      }
    }),
  setCustomFieldValue: protectedProcedure
    .input(setCustomFieldValueMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...valueInput } = input;
      const parsed = setCustomFieldValueInputSchema.parse(valueInput);
      const mutation = requireCustomFieldMutationContracts(context).setValue(
        context.session.user.id,
      );
      const targetId = `${parsed.definitionId}:${parsed.recordId}`;

      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          ({ currentValue, currentRevision }) => {
            const timestamp = new Date().toISOString();
            return {
              value: {
                createdAt: currentValue.value?.createdAt ?? timestamp,
                definitionId: parsed.definitionId,
                id: currentValue.value?.id ?? crypto.randomUUID(),
                recordId: parsed.recordId,
                recordType: parsed.recordType,
                revision: currentRevision + 1,
                updatedAt: timestamp,
                value: parsed.payload,
              },
            } satisfies CustomFieldValueMutationValue;
          },
        );
        const { value } = receipt.nextValue;
        if (!value) {
          throw new ORPCError("NOT_FOUND");
        }
        return value;
      } catch (error) {
        rethrowCustomFieldMutationError(error, targetId);
      }
    }),
  clearCustomFieldValue: protectedProcedure
    .input(clearCustomFieldValueMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...valueInput } = input;
      const parsed = clearCustomFieldValueInputSchema.parse(valueInput);
      const mutation = requireCustomFieldMutationContracts(context).clearValue(
        context.session.user.id,
      );
      const targetId = `${parsed.definitionId}:${parsed.recordId}`;

      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          () => ({ value: null }) satisfies CustomFieldValueMutationValue,
        );
        if (receipt.nextValue.value !== null) {
          throw new ORPCError("NOT_FOUND");
        }
        return { status: true };
      } catch (error) {
        rethrowCustomFieldMutationError(error, targetId);
      }
    }),
  updateProjectShortCode: protectedProcedure
    .input(updateProjectShortCodeInputSchema)
    .handler(async ({ context, input }) => {
      const mutation = requireProjectShellMutationContract(
        context,
        "update",
        context.session.user.id,
      );
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision: input.baseRevision,
            clientIdempotencyKey: input.clientIdempotencyKey,
            kind: "human",
            payload: { shortCode: input.shortCode },
            targetId: input.projectId,
          },
          ({ currentValue, currentRevision, payload }) => {
            if (!currentValue.project) {
              throw new ORPCError("NOT_FOUND");
            }
            return {
              project: {
                ...currentValue.project,
                revision: currentRevision + 1,
                shortCode: payload.shortCode,
                updatedAt: new Date().toISOString(),
              },
            } satisfies ProjectShellMutationValue;
          },
        );
        const { project } = receipt.nextValue;
        if (!project) {
          throw new ORPCError("NOT_FOUND");
        }
        return project;
      } catch (error) {
        rethrowProjectShellMutationError(error, input.projectId);
      }
    }),
  enableProjectArea: protectedProcedure
    .input(enableProjectAreaInputSchema)
    .handler(async ({ context, input }) => {
      const mutation = requireProjectShellMutationContract(
        context,
        "update",
        context.session.user.id,
      );
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision: input.baseRevision,
            clientIdempotencyKey: input.clientIdempotencyKey,
            kind: "human",
            payload: { area: input.area },
            targetId: input.projectId,
          },
          ({ currentValue, currentRevision, payload }) => {
            if (!currentValue.project) {
              throw new ORPCError("NOT_FOUND");
            }
            return {
              project: {
                ...currentValue.project,
                configuration: enableProjectArea(
                  currentValue.project.configuration,
                  payload.area,
                ),
                revision: currentRevision + 1,
                updatedAt: new Date().toISOString(),
              },
            } satisfies ProjectShellMutationValue;
          },
        );
        const { project } = receipt.nextValue;
        if (!project) {
          throw new ORPCError("NOT_FOUND");
        }
        return project;
      } catch (error) {
        rethrowProjectShellMutationError(error, input.projectId);
      }
    }),
  updateProjectConfiguration: protectedProcedure
    .input(updateProjectConfigurationInputSchema)
    .handler(async ({ context, input }) => {
      const mutation = requireProjectShellMutationContract(
        context,
        "update",
        context.session.user.id,
      );
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision: input.baseRevision,
            clientIdempotencyKey: input.clientIdempotencyKey,
            kind: "human",
            payload: { change: input.change },
            targetId: input.projectId,
          },
          ({ currentValue, currentRevision }) => {
            if (!currentValue.project) {
              throw new ORPCError("NOT_FOUND");
            }
            return {
              project: {
                ...currentValue.project,
                configuration: applyProjectShellConfigurationChange(
                  currentValue.project.configuration,
                  input.change,
                  currentValue.project.starterConfiguration,
                ),
                revision: currentRevision + 1,
                updatedAt: new Date().toISOString(),
              },
            } satisfies ProjectShellMutationValue;
          },
          input.change.kind === "set-work-context-layout"
            ? {
                undo: {
                  kind: "view-metadata",
                  scope: `${WORK_CONTEXT_LAYOUT_UNDO_SCOPE_PREFIX}${input.change.workType}`,
                },
              }
            : undefined,
        );
        const { project } = receipt.nextValue;
        if (!project) {
          throw new ORPCError("NOT_FOUND");
        }
        return input.change.kind === "set-work-context-layout"
          ? ({
              ...project,
              receiptId: receipt.id,
            } satisfies WorkContextLayoutMutationResult)
          : project;
      } catch (error) {
        rethrowProjectShellMutationError(error, input.projectId);
      }
    }),
  previewWorkContextLayout: protectedProcedure
    .input(previewWorkContextLayoutInputSchema)
    .handler(async ({ context, input }) => {
      const project = await requireProjectShell(context).find(
        context.session.user.id,
        input.projectId,
      );
      if (!project) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Project is unavailable.",
        });
      }
      if (project.revision !== input.baseRevision) {
        throw new ORPCError("PRECONDITION_FAILED", {
          data: {
            code: "STALE_BASE_REVISION",
            currentRevision: project.revision,
            currentValue: project,
            label: MUTATION_UI_LABELS.currentValue,
            targetId: input.projectId,
          },
          defined: true,
          message: MUTATION_UI_LABELS.currentValue,
        });
      }
      try {
        const nextConfiguration = applyProjectShellConfigurationChange(
          project.configuration,
          input.change,
          project.starterConfiguration,
        );
        return {
          baseRevision: project.revision,
          preview: previewWorkContextLayout(
            input.change.workType,
            project.configuration.workContextLayouts[input.change.workType],
            nextConfiguration.workContextLayouts[input.change.workType],
          ),
          projectId: project.id,
          workType: input.change.workType,
        };
      } catch (error) {
        rethrowProjectShellMutationError(error, input.projectId);
      }
    }),
  undoWorkContextLayout: protectedProcedure
    .input(undoWorkContextLayoutInputSchema)
    .handler(async ({ context, input }) => {
      const mutation = requireProjectShellMutationContract(
        context,
        "update",
        context.session.user.id,
      );
      if (!(mutation.findReceiptById && mutation.undo)) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        const sourceReceipt = await mutation.findReceiptById(input.receiptId);
        if (!sourceReceipt) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Work Context Card layout history is unavailable.",
          });
        }
        const workType = workContextLayoutTypeFromUndoScope(
          sourceReceipt.undo?.scope,
        );
        if (sourceReceipt.targetId !== input.projectId || !workType) {
          throw new ORPCError("BAD_REQUEST", {
            data: { code: "WORK_CONTEXT_LAYOUT_UNDO_NOT_SUPPORTED" },
            defined: true,
            message: "Only Work Context Card layout changes can be undone.",
          });
        }
        const receipt = await mutation.undo(
          sourceReceipt,
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision: input.baseRevision,
            clientIdempotencyKey: input.clientIdempotencyKey,
            kind: "human",
            payload: {},
            targetId: input.projectId,
          },
          ({ currentValue, currentRevision, previousValue }) => {
            if (!(currentValue.project && previousValue.project)) {
              throw new ORPCError("NOT_FOUND");
            }
            return {
              project: {
                ...currentValue.project,
                configuration: {
                  ...currentValue.project.configuration,
                  workContextLayouts: {
                    ...currentValue.project.configuration.workContextLayouts,
                    [workType]:
                      previousValue.project.configuration.workContextLayouts[
                        workType
                      ],
                  },
                },
                revision: currentRevision + 1,
                updatedAt: new Date().toISOString(),
              },
            } satisfies ProjectShellMutationValue;
          },
        );
        const { project } = receipt.nextValue;
        if (!project) {
          throw new ORPCError("NOT_FOUND");
        }
        return {
          ...project,
          receiptId: receipt.id,
        } satisfies WorkContextLayoutMutationResult;
      } catch (error) {
        rethrowProjectShellMutationError(error, input.projectId);
      }
    }),
  captureInbox: protectedProcedure.handler(({ context }) =>
    requireCaptureInbox(context).list(context.session.user.id),
  ),
  createCapture: protectedProcedure
    .input(captureInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireCaptureInbox(context).create(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowCaptureInboxError(error);
      }
    }),
  updateCaptureBulkSenseMaking: protectedProcedure
    .input(captureBulkSenseMakingInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireCaptureInbox(context).updateBulkSenseMaking(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowCaptureInboxError(error);
      }
    }),
  createBug: protectedProcedure
    .input(captureInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireCaptureInbox(context).createBug(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowCaptureInboxError(error);
      }
    }),
  captureSuggestions: protectedProcedure
    .input(captureSuggestionsInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireCaptureInboxTriage(context).suggestions(
          context.session.user.id,
          input.itemId,
        );
      } catch (error) {
        rethrowCaptureInboxError(error);
      }
    }),
  previewCaptureConversion: protectedProcedure
    .input(captureConvertPreviewInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireCaptureInboxTriage(context).previewConvert(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowCaptureInboxError(error);
      }
    }),
  convertCapture: protectedProcedure
    .input(captureConvertInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireCaptureInboxTriage(context).convert(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowCaptureInboxError(error);
      }
    }),
  previewCaptureAttachment: protectedProcedure
    .input(captureAttachPreviewInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireCaptureInboxTriage(context).previewAttachToExisting(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowCaptureInboxError(error);
      }
    }),
  attachCapture: protectedProcedure
    .input(captureAttachInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireCaptureInboxTriage(context).attachToExisting(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowCaptureInboxError(error);
      }
    }),
  deleteCapture: protectedProcedure
    .input(captureDeleteInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireCaptureInboxTriage(context).delete(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowCaptureInboxError(error);
      }
    }),
  previewCaptureMergeUndo: protectedProcedure
    .input(captureUndoMergePreviewInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireCaptureInboxTriage(context).previewUndoMerge(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowCaptureInboxError(error);
      }
    }),
  undoCaptureMerge: protectedProcedure
    .input(captureUndoMergeInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireCaptureInboxTriage(context).undoMerge(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowCaptureInboxError(error);
      }
    }),
  fileAttachments: protectedProcedure
    .input(fileAttachmentListInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireFileAttachments(context).list(
          context.session.user.id,
          input.scope,
        );
      } catch (error) {
        rethrowFileAttachmentError(error);
      }
    }),
  fileAttachmentQuota: protectedProcedure.handler(async ({ context }) => {
    try {
      return await requireFileAttachments(context).getQuota(
        context.session.user.id,
      );
    } catch (error) {
      rethrowFileAttachmentError(error);
    }
  }),
  fileAttachmentMarkings: protectedProcedure
    .input(fileAttachmentMarkingsInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireFileAttachments(context).listMarkings(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowFileAttachmentError(error);
      }
    }),
  createFileAttachmentMarking: protectedProcedure
    .input(fileAttachmentMarkingInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireFileAttachments(context).createMarking(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowFileAttachmentError(error);
      }
    }),
  undoFileAttachmentMarking: protectedProcedure
    .input(fileAttachmentUndoMarkingInputSchema)
    .handler(async ({ context, input }) => {
      try {
        await requireFileAttachments(context).undoMarking(
          context.session.user.id,
          input,
        );
        return { status: "undone" as const };
      } catch (error) {
        rethrowFileAttachmentError(error);
      }
    }),
  previewFileAttachmentLocationBind: protectedProcedure
    .input(fileAttachmentLocationBindPreviewInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireFileAttachments(context).previewLocationBind(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowFileAttachmentWorkError(error);
      }
    }),
  bindFileAttachmentLocation: protectedProcedure
    .input(fileAttachmentLocationBindInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireFileAttachments(context).bindLocation(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowFileAttachmentWorkError(error);
      }
    }),
  finalizeFileAttachment: protectedProcedure
    .input(fileAttachmentFinalizeInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireFileAttachments(context).finalize(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowFileAttachmentError(error);
      }
    }),
  previewFileAttachment: protectedProcedure
    .input(fileAttachmentPreviewInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireFileAttachments(context).preview(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowFileAttachmentError(error);
      }
    }),
  fileAttachmentExternalSurfaceSelection: protectedProcedure
    .input(fileAttachmentPreviewInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireFileAttachments(
          context,
        ).canSelectIntoExternalSurface(context.session.user.id, input);
      } catch (error) {
        rethrowFileAttachmentError(error);
      }
    }),
  sessions: protectedProcedure.handler(({ context }) =>
    context.accountAccess.listSessions(sessionPrincipal(context.session)),
  ),
  createWebCapturePairingCode: protectedProcedure.handler(({ context }) =>
    requireWebCapture(context).createPairingCode(context.session.user.id),
  ),
  webCaptureLinks: protectedProcedure.handler(({ context }) =>
    requireWebCapture(context).listLinks(context.session.user.id),
  ),
  revokeWebCaptureLink: protectedProcedure
    .input(revokeWebCaptureLinkInputSchema)
    .handler(async ({ context, input }) => {
      await requireWebCapture(context).revokeLink(
        context.session.user.id,
        input.linkId,
        sessionPrincipal(context.session).sessionId,
      );
      return { status: true };
    }),
  accountPreferences: protectedProcedure.handler(({ context }) =>
    context.accountPreferences.get(context.session.user.id),
  ),
  completionEffectsPreferences: protectedProcedure.handler(({ context }) =>
    requireCompletionEffectsPreferencesAccess(context).get(
      context.session.user.id,
    ),
  ),
  saveAccountAppearance: protectedProcedure
    .input(saveAccountAppearanceProcedureInputSchema)
    .handler(async ({ context, input }) => {
      if (!("baseRevision" in input)) {
        return requireAccountPreferencesCompatibility(context).saveAppearance(
          context.session.user.id,
          input.appearance,
        );
      }

      const receipt = await mutateAccountPreferences(
        context,
        {
          actor: { actorId: context.session.user.id, type: "User" },
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          kind: "human",
          payload: { appearance: input.appearance },
          targetId: context.session.user.id,
        },
        ({ currentValue, payload }) => ({
          ...currentValue,
          ...payload,
        }),
      );
      return preferencesSnapshotFromReceipt(receipt);
    }),
  saveAccountPreferences: protectedProcedure
    .input(saveAccountPreferencesProcedureInputSchema)
    .handler(async ({ context, input }) => {
      if (!("baseRevision" in input)) {
        return requireAccountPreferencesCompatibility(context).save(
          context.session.user.id,
          input,
        );
      }

      const receipt = await mutateAccountPreferences(
        context,
        {
          actor: { actorId: context.session.user.id, type: "User" },
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          kind: "human",
          payload: input.preferences,
          targetId: context.session.user.id,
        },
        ({ currentValue, payload }) => ({
          ...currentValue,
          ...payload,
        }),
      );
      return preferencesSnapshotFromReceipt(receipt);
    }),
  saveCompletionEffectsPreferences: protectedProcedure
    .input(saveCompletionEffectsPreferencesInputSchema)
    .handler(async ({ context, input }) => {
      const receipt = await mutateCompletionEffectsPreferences(
        context,
        {
          actor: { actorId: context.session.user.id, type: "User" },
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          kind: "human",
          payload: input.preferences,
          targetId: context.session.user.id,
        },
        ({ payload }) => payload,
      );
      return completionEffectsPreferencesSnapshotFromReceipt(receipt);
    }),
  revokeSession: protectedProcedure
    .input(z.object({ sessionId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      await context.accountAccess.revokeSession(
        sessionPrincipal(context.session),
        input.sessionId,
      );
      return { status: true };
    }),
  revokeOtherSessions: protectedProcedure.handler(async ({ context }) => {
    await context.accountAccess.revokeOtherSessions(
      sessionPrincipal(context.session),
    );
    return { status: true };
  }),
  startGitHubIdentityConfirmation: protectedProcedure
    .input(
      z.object({
        operationId: z.enum(CONFIRM_GITHUB_IDENTITY_OPERATION_IDS),
      }),
    )
    .handler(async ({ context, input }) => {
      const confirmation = context.githubIdentityConfirmation;
      if (!confirmation) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }

      const result = await confirmation.start(
        sessionPrincipal(context.session),
        input.operationId,
        context.clientKey,
        context.clientPlatform,
      );
      if (!result) {
        throw new ORPCError("BAD_REQUEST");
      }
      return result;
    }),
  exchangeGitHubIdentityHandoff: protectedProcedure
    .input(z.object({ code: z.string().min(1).max(512) }))
    .handler(async ({ context, input }) => {
      const confirmation = context.githubIdentityConfirmation;
      if (!confirmation) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }

      return {
        grant: await confirmation.exchange(
          sessionPrincipal(context.session),
          input.code,
          context.clientKey,
        ),
      };
    }),
  consumeGitHubIdentityGrant: protectedProcedure
    .input(
      z.object({
        grant: z.string().min(1).max(512),
        operationId: z.enum(CONFIRM_GITHUB_IDENTITY_OPERATION_IDS),
      }),
    )
    .handler(async ({ context, input }) => {
      const confirmation = context.githubIdentityConfirmation;
      if (!confirmation) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }

      return {
        consumed: await confirmation.consume(
          sessionPrincipal(context.session),
          input.operationId,
          input.grant,
          context.clientKey,
        ),
      };
    }),
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
