# GitHub Bağlantısı ve Geliştirme Gerçeği

Kaynak: [`docs/workflow/61-github-integration/phase-context.md`](../../workflow/61-github-integration/phase-context.md)

## Problem Statement

Kurucu Projeyi seçili GitHub Repository'leriyle bağlayıp issue, pull request, commit ve check gerçeğini salt okunur uzlaştırılabilir biçimde İşlere ilişkilendirmek ister. Bugün iskelet giriş OAuth'u kimliktir; App installation, kararlı repo kimliği, durable webhook inbox ve PR bağlam kartı yoktur. Login ile App karışır; check Test Oturumu sanılır; karttan review/merge yapılır; bağlantı İşi kapatır. Otomasyonun hazır PR-merge kuralı ve sürüm kanıtı bu sorunun parçası değildir.

## Solution

Kurucu GitHub App installation'ı ile (Better Auth login OAuth'undan ayrı) kararlı repository kimliği üzerinden Projeye bağlanır. İzinler salt okunur Metadata, Contents (allow-listed), Issues, Pull requests, Checks, Commit statuses'tır; yazma izni yoktur. Webhook imza doğrulaması 10 saniyeden kısa durable inbox kabulü, pg-boss worker ve en geç 15 dakikalık artımlı uzlaştırma aynı dış gerçeği çoğaltmaz. İş bağlantısı açık seçim veya tekil iş anahtarı eşlemesidir; durum yazmaz. PR check özeti yalnız güncel head SHA'dır ve Test Oturumu değildir. PR Bağlam Kartı ilişkili İş, Karar, Risk, test ve Sürüm ana kayıtlarına salt okunur açılır; inceleme ve merge GitHub'da kalır. Hazır `When required PRs merge, mark Work Completed` kuralı 62'dedir; bu feature İşi kapatmaz.

## User Stories

1. As a founder, I want to install a GitHub App and select repositories onto a Proje by GitHub's stable repository id, so that a rename is not a new link and login OAuth is not App authority.
2. As a founder, I want the App to request only the PRD read permission set, with Contents limited to versioned release/tag/commit endpoints, so that tree/blob/diff/full check logs are blocked and tested.
3. As a founder who revokes GitHub login OAuth, I want the App installation and historical GitHub dış kaydı rows to remain, so that identity logout is not uninstall (owned counterpart with 01).
4. As a founder who uninstalls the App, I want Hesap identity and product sessions to keep working while sync stops, so that development disconnect is not lockout.
5. As a founder, I want a skippable bulk triage on first connect that never silently turns Issues into İş records, so that skipped items stay searchable GitHub dış kaydı rows.
6. As a founder, I want webhook delivery to verify signature, persist a durable inbox id, and ACK GitHub in under 10 seconds without doing field sync in the HTTP request.
7. As a founder, I want duplicate deliveries to return the previous result without a second event, and older events not to rewind newer `updated_at` state.
8. As a founder, I want incremental read-only reconcile at least every 15 minutes plus `Sync now`, respecting `Retry-After`, with no write API and no silent busy-polling.
9. As a founder, I want last successful sync, last error, rate-limit wait, stale-after-30-minutes `Out of date`, and `Reconnect` / `Disconnect` with preview of affected links, with connection life `Connected` / `Paused` / `Disconnected` (PRD 02 `Bağlı` / `Duraklatıldı` / `Bağlantı kesildi`). Access revoked, repo missing, or App uninstall stop sync and show the reason; they are not a fourth life state and do not kill product sessions.
10. As a founder, I want local Archive of a GitHub dış kaydı not to stop source updates while the Proje link is healthy, and Trash to stop writes until restore with explicit reconcile.
11. As a founder, I want permanent delete to tombstone so a later webhook cannot auto-resurrect the same product identity; explicit re-include mints a new identity with visible origin.
12. As a founder, I want Work↔Issue/PR links by explicit pick or unique current/historical work key, with `Required for completion` vs `Contextual` roles, so that linking does not change Work status, close, or blockers.
13. As a founder, I want a unique work key plus `Fixes`/`Closes`/`Resolves` to mint `Required for completion`, other unique matches `Contextual`, and missing/multiple/out-of-project keys to only suggest.
14. As a founder, I want PR check summary on the current head SHA with provider + stable check id, `Required` only if GitHub says so else `Unknown`, superseded not shown as current, and no conversion into Test Oturumu.
15. As a founder, I want a read-only PR Context Card that opens related Work, Karar, Risk, test, and Proje Sürümü records, plus compact reviewer states when GitHub provides them, so that I go to GitHub to review or merge.
16. As a founder, I do not want the card to be a Work Context Card, in-context preview editor, or a write surface that declares the PR ready by filling missing links.
17. As a founder, I want `Completed` work + open PR and failed checks to emit source-linked attention, and unlinked open PRs to emit a deduped Notification Center signal about the existing GitHub dış kaydı, without minting an Unlinked-PR identity or closing Work.
18. As a founder on an archived Proje, I want the GitHub link paused and not auto-resumed with invented missed events on unarchive.
19. As a founder using only a keyboard or a screen reader, I want to complete GitHub connect and status, so that the closed journey **GitHub bağlantı ve durum** is possible.
20. As a founder, I want English UI for Repository, Sync now, Required for completion, Contextual, PR Context Card, Required/Unknown checks.

## Implementation Decisions

- **Owning documents.** [Repository bağlantıları](../../prd/12-github-and-project-releases.md#repository-bağlantıları), [GitHub geliştirme kayıtları](../../prd/12-github-and-project-releases.md#github-geliştirme-kayıtları), [PR Bağlam Kartı](../../prd/12-github-and-project-releases.md#pr-bağlam-kartı). [ADR-0006](../../adr/0006-github-entegrasyon-guven-siniri.md). Login vs App: PRD 03 / spec 01. Ready merge rule lives only in PRD 06 / spec 62. Common identity for webhook idempotency: PRD 02. Envelope encryption for App tokens: tech-stack + PRD 13. No new ADR.
- **Glossary.** GitHub bağlantısı, GitHub dış kaydı, Tamamlanma için gerekli / Bağlamsal. Avoid: treating login session as App, GitHub as a second Work machine, check as Test Oturumu, card as review/merge tool, card as Work Context Card.
- **One seam.** GitHub Integration — App install, repo select by stable id, webhook inbox, reconcile, Work links/roles, check summary, PR Context Card. Better Auth GitHub login stays Account Access; this spec does not redefine sign-in, session, or `Confirm GitHub Identity`. Work Automation (62) consumes `Required for completion`; this seam does not complete Work. Octokit + pg-boss + Hono webhook route.
- **Read-only reconcile.** Primary path: signed webhooks. Inbox durable; worker retries; dead-letter visible operator alarm (not 66/85 product UI). Reconcile applies by GitHub id + `updated_at`; same timestamp prefers reconcile snapshot. Payload retention: success encrypted raw ≤24h, failed ≤7 days, delivery id/hash/result 30 days. First GitHub sync for a new link completes within 30 minutes; incremental reconcile of missed events within 15 minutes (PRD 15). Webhook secret rotates at least every 90 days and immediately on suspected access; old and new secrets validate together for at most 15 minutes, then the old secret is rejected.
- **Permissions.** Metadata/Issues/PR/Checks/Commit statuses read + Contents read only on allow-listed version endpoints. The reason Contents is requested is shown to the founder (ADR-0006). Counterpart tests that tree/blob/archive/diff/full logs are not called.
- **Unlinked open PR.** The record remains a GitHub dış kaydı. Unlinked-ness is a deduped, dismissable Notification Center signal, not a second identity or Work type. Commit/branch do not emit that signal merely by being unlinked.
- **English UI.** `Repository`, `GitHub App`, `Sync now`, `Out of date`, `Reconnect`, `Disconnect`, `Connected`, `Paused`, `Disconnected`, `Create work and link`, `Required for completion`, `Contextual`, `PR Context Card`, `Required`, `Unknown`. Add missing labels with first display.

## Testing Decisions

- **What a good test is.** GitHub Integration with App/webhook/API test doubles: signature, <10s ACK, duplicate delivery, out-of-order events, reconcile, permission allow-list, login-revoke vs App-uninstall, archive/trash/tombstone, head SHA checks, role mapping, unlinked open-PR signal, card has no review/merge/write command, Work status unchanged.
- **Seam (one).** GitHub Integration. Playwright: **GitHub bağlantı ve durum**. Real-project journey **GitHub**.
- **Required counterparts.** Login OAuth ≠ App (identity/session owned by 01; this seam only asserts uninstall does not kill sessions and login revoke does not uninstall); check ≠ Test Oturumu; no GitHub write; no Work complete; card ≠ Work Context Card; review and merge stay on GitHub (card is not a write surface); unlinked PR is a signal on GitHub dış kaydı, not a new identity.

## Out of Scope

- GitHub login OAuth, oturum, Confirm GitHub Identity — 01.
- Hazır PR-merge kuralı ve İş `Completed` yazımı — 62.
- Sürüm Kanıt Paketi — 64.
- Test Oturumu kabulü — 54.
- GitHub'da review/merge, branch/commit/PR yazma — 19.
- GitLab/Bitbucket, cycle-time metrikleri, tam check logu.

## Further Notes

- **Orient.** Glossary: GitHub bağlantısı, GitHub dış kaydı, Tamamlanma için gerekli. Owning PRD: 12. ADR 0006. Related: ADR-0004 (inbox idempotency), PRD 16 GitHub journey, PRD 19 mutation ban.
- **Acceptance.** [GitHub](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) real project: least-privilege, signature/inbox/retry, duplicates, archive/trash/tombstone, head SHA/requiredness.
- **Consumers.** 62 reads required-PR roles. 64/63 open PR/check rows. 57 summary must not convert checks.
