export {
	AccountAccessError,
	CSRF_REJECTED_MESSAGE,
	OPERATION_ID_REQUIRED_MESSAGE,
	SESSION_WRITE_UNAUTHORIZED_MESSAGE,
} from "./account-access-error";
export type {
	AccountSession,
	AccountSessionAccess,
	GitHubIdentityConfirmation,
} from "./account-sessions";
export { createPrismaAuditLog } from "./audit-log";
export {
	CONFIRM_GITHUB_IDENTITY_CALLBACK_PATH,
	CONFIRM_GITHUB_IDENTITY_GRANT_SECONDS,
	CONFIRM_GITHUB_IDENTITY_OPERATION_IDS,
	type ConfirmGitHubIdentityOperationId,
	type ConfirmGitHubIdentityStart,
	confirmGitHubIdentityRedirectUri,
	isConfirmGitHubIdentityCallbackPath,
} from "./confirm-github-identity";
export { type CreateAuthOptions, createAuth } from "./create-auth";
export { assertCookieCsrf } from "./csrf";
export {
	type GitHubAvailability,
	type GitHubAvailabilityReport,
	WAITING_FOR_GITHUB_MESSAGE,
} from "./github-availability";
export {
	type AccountAccess,
	GITHUB_IDENTITY_SCOPES,
	getAccountAccessForUser,
	SIGN_IN_FAILED_MESSAGE,
	WORKSPACE_DEFAULT_NAME,
} from "./github-login";
export { identityAlias } from "./identity-alias";
export { auth } from "./instance";
export {
	createPostgresSecurityEventLog,
	LOCAL_SECURITY_EVENT_LOG_URL,
} from "./security-event-log";
export {
	type AuditLog,
	CONFIRM_GITHUB_IDENTITY_FAILED_EVENT_TYPE,
	CONFIRM_GITHUB_IDENTITY_STARTED_EVENT_TYPE,
	CONFIRM_GITHUB_IDENTITY_SUCCEEDED_EVENT_TYPE,
	createMemoryAuditLog,
	createMemorySecurityEventLog,
	SESSION_REVOKED_EVENT_TYPE,
	SESSION_SIGNED_IN_EVENT_TYPE,
	SESSION_SIGNED_OUT_EVENT_TYPE,
	type SecurityEventLog,
	type SessionAuditEvent,
	type SessionRevokedEvent,
} from "./session-events";
export {
	SESSION_ABSOLUTE_SECONDS,
	SESSION_IDLE_SECONDS,
	UNKNOWN_DEVICE,
} from "./session-policy";
export {
	oneTimeCodeFromDeepLink,
	productCorsOrigins,
	productTrustedOrigins,
	TAURI_CALLBACK_URL,
	TAURI_ONE_TIME_CODE_SECONDS,
} from "./tauri-session";
