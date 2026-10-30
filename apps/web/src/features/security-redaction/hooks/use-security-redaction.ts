import type { SecurityRedactionScope } from "@cantiara/api/security-redaction";
import { requestGitHubIdentityGrant } from "@/features/account-access/lib/github-identity-confirmation";
import { client } from "@/utils/orpc";

/**
 * Security Redaction calls. The Account Access `Confirm GitHub Identity` grant
 * is minted by that feature's existing flow and only carried here; the server
 * consumes it once for the `security-redaction` operation.
 */
export function useSecurityRedaction(scope: SecurityRedactionScope) {
  return {
    apply: (confirmation: {
      grant: string;
      reason: string;
      sensitiveValue: string;
      typedName: string;
    }) => client.applySecurityRedaction({ ...confirmation, scope }),
    async confirmIdentity() {
      const grant = await requestGitHubIdentityGrant("security-redaction");
      if (!grant) {
        throw new Error("Confirm GitHub Identity did not return a grant.");
      }
      return grant;
    },
    preview: (sensitiveValue: string) =>
      client.previewSecurityRedaction({ scope, sensitiveValue }),
  };
}
