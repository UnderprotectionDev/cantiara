# Proje Arşivi ve Güvenli Silme

Kaynak: [`docs/workflow/83-project-retirement/phase-context.md`](../../workflow/83-project-retirement/phase-context.md)

## Problem Statement

Kurucu Projeyi önce salt okunur arşive, sonra tek geri yüklenebilir silme grubuna almak ister. Bugün Çöp Kutusu, gizleme filtresi, Hesap kapatma veya kabuğu silip çocukları bağımsız bırakmak bu işi taklit edebilir. Geri yükleme örtük yeniden yayınlamamalıdır. `Keep approved surface` Proje silmede yasaktır. Arşiv 77'nin Trash'i değildir.

## Solution

Kurucu Projeyi Arşiv görünümüne alır: salt okunur, hareketsiz; GitHub eşitlemesi, otomasyon, hatırlatma ve normal mutasyon durur. Yalnız erişimi azaltan güvenlik eylemleri açık kalır. Silme yalnız Arşivden başlar ve Proje silme grubunu 77'nin 30 günlük tek birimine koyar; Dış yüzeyler terminal iptal, ziyaretçi oturumları kapanır. Geri yükleme aynı kimlikleri Arşiv durumuna getirir, yayınları ve GitHub bağını örtük açmaz. Yeni yayın yeni Dış yüzey, URL/token ve açık onay ister.

## User Stories

1. As a founder, I want to archive a completed, abandoned, or unused Project into an Archive view without changing its life-cycle status (`Active`/`Pending`/`Completed`/`Abandoned`), so that Archive is not a status rewrite.
2. As a founder, I want archive preview to show the Project leaving normal working surfaces, in-flight import/upload/automation/sync exact states, previously approved External Surfaces that may remain, and security actions that stay available, so that Archive is not a surprise.
3. As a founder, I want the archived Project read-only and motionless: GitHub sync, automations, reminders, and normal mutations stop, so that Archive is stronger than a hide filter.
4. As a founder, I want previously explicitly approved immutable External Surfaces listed and allowed to keep living on archive (not on delete), so that Archive is not automatically unpublish.
5. As a founder, I want only access-reducing security actions still allowed: surface revoke, token/password rotation, session end, integration cut/secret rotation, and security redaction (78), so that Archive is not a total lockout of safety.
6. As a founder, I want publish, reactivation-as-write, password removal, content edit, and access expansion refused, so that Archive cannot grow attack surface.
7. As a founder, I want `Delete Project` offered only in the Archive view, so that an Active Project cannot jump straight to Trash.
8. As a founder deleting from Archive, I want the Project delete group (Project + canonically owned primary records, owned components, External Surfaces) treated as one restore or one permanent-delete unit, so that I cannot delete the shell and leave children independent.
9. As a founder on that delete preview, I want to see immediately terminal-revoked project-scoped External Surfaces and visitor sessions, stopping integrations, relations that will live on in other scopes as deleted-target marks, and that restore will not auto-republish — and I want `Keep approved surface` absent and rejected.
10. As a founder, I want that group to enter 77's 30-day Trash clock as one unit, so that children cannot permanently delete on their own clock.
11. As a founder, I want Workspace, Account, and Personal Wiki records not deleted with the Project, so that the group is Project-canonical only.
12. As a founder restoring the group, I want the same identities back in Archive — not Active, not republished — so that restore is not a launch.
13. As a founder, I want GitHub bağlantısı not implicitly re-enabled on unarchive or restore; the Archive view points me at the canonical reconnect contract (61), so that this feature is not a second GitHub life-cycle.
14. As a founder, I want old public URLs/tokens not silently revived, so that republish needs a new External Surface, URL/token, and explicit approval.
15. As a founder, I want English UI `Archive`, `Delete Project` (archive-only), and restore copy that says restore-to-Archive, so that the product language stays English.
16. As a founder using only a keyboard or a screen reader, I want to complete archive, delete-from-archive, and restore, so that Proje silme ve dış yüzey is possible.
17. As a founder, I do not want this to be record Trash for a single Work, Account closure, or Workspace Exit.

## Implementation Decisions

- **Owning documents.** [Ortak yaşam döngüsü](../../prd/02-domain-model-and-lifecycle.md#ortak-yaşam-döngüsü) (Project archive strength, group, restore-to-Archive, ban on `Onaylı dış yüzeyi koru` for Project deletion). UI/preview: [Proje arşivi](../../prd/04-workspace-and-projects.md#proje-arşivi). Retention/permanent delete: 77 / PRD 13. Surfaces: 14. GitHub reconnect: 12, not re-specified. Arşiv güvenlik istisnası is the allow-list of reducing actions. No new ADR.
- **Glossary.** Proje arşivi, Arşiv güvenlik istisnası, Proje silme grubu, Çöp Kutusu (77's clock), Dış yüzey, Silinmiş hedef işareti. Avoid: hide filter, deleting the shell, implicit republish, `Keep approved surface` on Project delete.
- **Project Retirement module.** Commands: archive (to read-only), list Archive view, delete-from-archive (hands group to Trash), restore group to Archive. Uses 77 for 30-day unit and permanent delete/grant. Uses 78 if redaction during archive. Does not implement OAuth.
- **Archive vs Trash.** Archive is mandatory before Project delete. Trash of a non-Project record is 77. This feature must not call `Keep approved surface` on Project deletion; 77 must reject it if asked.
- **Unarchive.** Returning from Archive to working (without having gone through Trash) is an archive-exit that still does not implicit-enable GitHub; PRD 04 points to GitHub reconnect. If the Project was deleted and restored, it lands in Archive, not Active.
- **English UI.** `Archive`, `Delete Project`, restore labels. `Keep approved surface` must not appear on this delete preview. Term table when first shown.
- **Grant.** Project delete into Trash is recoverable; early permanent delete of the group is 77-05 consuming 01. This feature's archive/delete-to-trash does not consume the grant unless PRD says so — PRD says GitHub reconfirm for early permanent delete and account close, not for archive. Typed name for early permanent delete stays in 77.

## Testing Decisions

- **What a good test is.** Tests observe Project Retirement: archive stops writes/sync/automation; reducing security actions still work; delete absent until Archive; delete preview has no `Keep approved surface`; group enters Trash as one clock; restore returns Archive without republish or GitHub enable. 77 double for the clock.
- **Seam (one).** Project Retirement. Trash, External Surface revoke, GitHub reconnect are adapters.
- **Modules under test.** Project Retirement only. 77 clock and 14 revoke are doubles. Account closure is a counterpart (unauthorized as Project delete).
- **Prior art.** Trash move/restore tests on 77. Synthetic [Proje silme ve dış yüzey](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
- **Required counterparts.** Archive ≠ Trash; restore ≠ republish; `Keep approved surface` forbidden; children not independently deletable; GitHub not implicit.

## Out of Scope

- Kayıt Çöp Kutusu mekaniği, yapılandırma çöpü, erken kalıcı silme grant UI — 77 (çağrılır).
- Hesap kapatma — 84.
- Çalışma Alanı çıkış paketi — 82.
- GitHub reconnect inbox — 61.
- Dış yüzey oluşturma — 14/76.

## Further Notes

- **Orient.** Glossary: Proje arşivi, Proje silme grubu, Arşiv güvenlik istisnası. Owning PRD: 02 `#ortak-yaşam-döngüsü`, 04 `#proje-arşivi`. Journey: Proje silme ve dış yüzey. Related: 13 trash clock, 14 surfaces, 12 GitHub.
- **Acceptance.** [Proje silme ve dış yüzey](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): Trash entry terminal-revokes project surfaces; restore does not auto-publish; single-source keep is 77, not this delete path.
- **Consumers.** 77 owns the clock. 84 is not this.
- **Grant rule.** Do not ship a second GitHub card. Early permanent delete of the group is 77 consuming 01. Archive itself does not consume the grant.
