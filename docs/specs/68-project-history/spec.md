# Proje Hikâyesi ve Etkinlik Geçmişi

Kaynak: [`docs/workflow/68-project-history/phase-context.md`](../../workflow/68-project-history/phase-context.md)

## Problem Statement

Kurucu bir Projede veya Özellik türündeki İşte neden-sonuç hikâyesini okumak ister: hangi Karar, tasarım, İş, Kilometre Taşı, sürüm ve öğrenimin sırayla gerçekleştiğini. Aynı anda kim hangi alanı değiştirdiğini, eski ve yeni değeri denetim izi olarak da incelemek ister. Bugün bu iki soru tek feed'de karışır; atomik alan diff'i hikâyeyi boğar, hikâye ise denetim izinin yerine geçmeye çalışır. Bildirim Merkezi, GitHub Activity, e-posta günlüğü, otomatik başarı anlatısı ve sürüm notu bu sorunun parçası değildir.

## Solution

Proje Hikâyesi iki ayrı yüzey sunar. Gerçekleşen olayların zaman çizelgesi yalnız önemli ürün olaylarını kronolojik hikâye olarak dizer; her alan değişikliğini göstermez. Proje Etkinliği mevcut kayıt geçmişlerinden türetilen filtrelenebilir atomik izdir; kaynak kaydı, aktörü ve desteklenen alanlarda önceki–sonraki değeri açar. İki yüzey tek feed değildir. Etkinlik Bildirim Merkezi değildir ve dikkat sinyali üretmez.

## User Stories

1. As a founder in a Proje, I want a chronological story of important realized events, so that I can read cause and effect without scanning every field edit.
2. As a founder on a Feature-type İş, I want that same story scoped to the Feature context, so that the narrative follows the work I am holding rather than the whole Proje by default.
3. As a founder reading the story, I want Karar, Belge, tasarım, İş, reached Kilometre Taşı, lifecycle change, code change, Üretim Olayı, experiment/validation result, and Proje Sürümü events to appear, so that the product history is the story of those records.
4. As a founder who abandoned work, I want the abandonment rationale visible on the related story event, so that Vazgeçildi is explained rather than silent.
5. As a founder, I want the story not to list every field change, so that atomic diffs do not drown the narrative.
6. As a founder, I want a story event to open its source ana kayıt, so that the timeline is not a second copy of the record.
7. As a founder, I want the story not to be a kapanış özeti or a public development feed, so that internal narrative stays internal and unsigned.
8. As a founder asking “what changed?”, I want Proje Etkinliği to list field, status, relation, automation, and GitHub changes with source and previous–next values, so that I can audit the record rather than reread the story.
9. As a founder, I want to filter Proje Etkinliği by source record or system type (İş, Belge, Karar, Risk, automation, GitHub) and by event type (create, field change, status change, archive, relation, automation), so that the feed is inspectable.
10. As a founder, I want each activity row to show whether a user, Sistem otomasyonu, or a bound GitHub source made the change, so that actors are not collapsed into one anonymous edit.
11. As a founder, I want an activity row to open the source record, so that the feed is not a second audit store.
12. As a founder, I want supported field changes to show previous and next values, so that I can see the exact mutation.
13. As a founder making several safe field edits on the same ana kayıt within five minutes, I want those edits in one expandable presentation cluster, so that the feed stays readable.
14. As a founder opening that cluster, I want every atomic event, time, previous–next value, origin, and undo boundary still separate, so that grouping is presentation only.
15. As a founder, I want human, automation, and GitHub changes never mixed in one cluster, so that actor meaning is preserved.
16. As a founder, I want comments, security events, publications, and important lifecycle changes not hidden inside ordinary field-edit clusters, so that consequential events stay visible.
17. As a founder, I want grouping not to merge Denetim kaydı events or Güvenli geri alma boundaries, so that presentation cannot rewrite audit or undo.
18. As a founder, I want Proje Etkinliği to aggregate existing Kayıt geçmişi rather than mint a second persistent event log, so that there is one history truth.
19. As a founder, I want an activity event not to become a Timeline event or a Dikkat sinyali by default, so that story, audit, and attention stay separate.
20. As a founder opening a Proje, I do not want Proje Etkinliği to be the default landing surface, so that activity does not impersonate overview.
21. As a founder, I want English UI copy for the story and activity surfaces, so that the product language stays English.
22. As a founder using only a keyboard or a screen reader, I want to move between story events and activity rows and open the source record, so that history is part of the closed accessibility journeys for record inspection.
23. As a founder, I do not want this feature to be GitHub Activity or an email digest, so that Cantiara history is not a provider inbox.
24. As a founder, I do not want the story to be an automatic success narrative or release notes, so that narrative remains the founder’s later writing, not this feed.
25. As a founder, I do not want Proje Etkinliği to be Birleşik Bildirim Merkezi, so that reading activity never stands in for Action Required.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [Gerçekleşen olayların zaman çizelgesi](../../prd/06-work-management-and-planning.md#gerçekleşen-olayların-zaman-çizelgesi) and [Proje Etkinliği](../../prd/06-work-management-and-planning.md#proje-etkinliği). Actor, Kayıt geçmişi, and Güvenli geri alma are [değişiklik geçmişi](../../prd/02-domain-model-and-lifecycle.md#değişiklik-geçmişi-aktör-ve-geri-alma). Attention is owned by [Birleşik Bildirim Merkezi](../../prd/04-workspace-and-projects.md#birleşik-bildirim-merkezi), not this feature. No new ADR: the surprising boundary is already the two-surface split in PRD 06 and the history-versus-audit split in CONTEXT.md.
- **Glossary.** Use Proje, Özellik, İş, Karar, Belge, Kilometre Taşı, Proje Sürümü, Üretim Olayı, Kayıt geçmişi, Proje Etkinliği, Denetim kaydı, Güvenli geri alma, Birleşik Bildirim Merkezi, Dikkat sinyali. Do not introduce activity feed, GitHub Activity, audit log (as a product surface), success narrative, or a second event store. The story view is gerçekleşen olayların zaman çizelgesi (`Story Timeline`). Do not call either surface Notification Center or Project Overview.
- **One module, two questions.** Project History is one product module. It answers “what is the product story?” and “what exactly changed?” as two operations, not one merged feed. A test that cannot tell the two views apart is testing the wrong thing.
- **Story membership.** The story includes realized important events: Karar, Belge, tasarım, İş, reached Kilometre Taşı, lifecycle change, code change, Üretim Olayı, experiment/validation result, and Proje Sürümü. Abandonment rationale is visible on the related event. Field-level edits are not story events. The story is available in Proje context and in Özellik-type İş context.
- **Story is not other narratives.** The story is not a Kapanış özeti taslağı, not herkese açık gelişim akışı, not Sürüm iletişim iskeleti, and not an AI or automatic success write-up. Those remain their features.
- **Activity is derived.** Proje Etkinliği is a secondary view derived from existing Kayıt geçmişi of current records. It does not insert a new persistent event type, a second Denetim kaydı store, or a dedicated automation run log. Writes continue to land on the source record’s history (mutation/undo feature). This feature only projects that history.
- **Activity filters and rows.** Filter by source record/system type (İş, Belge, Karar, Risk, automation, GitHub) and by event type (create, field change, status change, archive, relation, automation). Each row names the actor (Kullanıcı, Sistem otomasyonu, GitHub), opens the source record, and for supported field changes shows previous and next values.
- **Five-minute presentation cluster.** Safe field changes by the same actor on the same ana kayıt within five minutes may render as one expandable presentation cluster in Proje Etkinliği and on that record’s own Kayıt geçmişi view. Opening the cluster shows each atomic event, time, previous–next, origin, and undo boundary. Human, automation, and GitHub changes are never clustered together. Comments, security events, publications, and important lifecycle changes stay visible outside ordinary field-edit clusters. Clustering does not merge Denetim kaydı events or Güvenli geri alma boundaries.
- **No attention emission.** An activity row does not mint a Dikkat sinyali. A story event does not mint one either. Broken references do not mint signals here ([kırık referans sunumu](../../prd/02-domain-model-and-lifecycle.md#kirik-referans-sunumu)).
- **Not the landing surface.** Proje Etkinliği is not the default Proje opening surface. Proje genel bakışı stays in its own feature.
- **GitHub and code change.** Code-change story events and GitHub activity rows consume GitHub dış kaydı history owned by the GitHub bağlantısı feature. This module does not install the App, accept webhooks, or impersonate GitHub Activity.
- **English UI labels.** First user-visible copy uses: `Project History`, `Story Timeline`, `Project Activity`, `What changed?`, `Open source record`. Missing labels are added to the PRD term table in the same change that first shows them. No Turkish UI.
- **Envelope / secrets.** Secret values never appear as previous–next in Proje Etkinliği. Redacted history follows Güvenlik redaksiyonu marks, not reconstructed secret text.

## Testing Decisions

- **What a good test is.** Tests observe Project History through its public interface: story listing in Proje and Özellik context, activity listing with filters, row actor/previous–next, cluster expand on Proje Etkinliği and on the source record’s Kayıt geçmişi view, and “this event did not become a notification.” They do not assert Prisma row shapes, a private history table, or mock internal aggregators. Expected values are product rules (story excludes field edits; activity does not mint signals; five-minute cluster is presentation-only), not recomputed SQL.
- **Seam (one).** Project History — the product-facing history interface used by the Proje shell and Özellik context. Kayıt geçmişi writes, GitHub adapters, and notification registry are collaborators behind that interface (real versus test double). Playwright for keyboard/screen-reader inspection is the same seam through the UI, not a second module.
- **Modules under test.** Project History only. Birleşik Bildirim Merkezi, Proje genel bakışı, kapanış özeti, sürüm notu, and GitHub App packages are not in this suite except as “no signal minted / not default landing / not release notes” counterparts.
- **Prior art.** The repository has no Vitest/Playwright suite yet. First contract tests live at this seam with record-history fixtures and a GitHub history double. Evidence binds to [kişisel bağlam](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) and [Dogfooding](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). Cloud tests must not use production sessions or private user content.
- **Required counterparts.** Story and activity are not one feed; activity does not appear as Action Required; field edits are absent from the story; cluster expand still lists atomic undo boundaries; human/automation/GitHub are not mixed in one cluster; GitHub Activity/email digest surfaces absent.

## Out of Scope

- Hikâye ile atomik etkinliği tek feed sayma.
- Etkinliği GitHub Activity, e-posta günlüğü, Denetim kaydı ürünü veya ikinci kalıcı olay deposu yapmak.
- Hikâyeyi otomatik başarı anlatısı, retrospektif, kapanış özeti veya sürüm notu sayma.
- Proje Etkinliğini varsayılan Proje açılış yüzeyi veya Birleşik Bildirim Merkezi bölümü yapmak.
- Dikkat sinyali üretmek; sinyal registry'si 71'e aittir.
- Proje genel bakışı, Manuel Proje Güncellemesi, herkese açık gelişim akışı, GitHub App kurulumu.

## Further Notes

- **Orient.** Glossary: Proje, Özellik, İş, Kayıt geçmişi, Proje Etkinliği, Denetim kaydı, Birleşik Bildirim Merkezi, Dikkat sinyali. Owning PRD: `docs/prd/06-work-management-and-planning.md` (gerçekleşen olayların zaman çizelgesi, Proje Etkinliği). ADRs in play: none. Related but not owning: PRD 02 (history/undo), PRD 04 (overview and notifications), PRD 12 (GitHub history source), PRD 16 (kişisel bağlam, Dogfooding), PRD 19 (no automatic narrative, no GitHub Activity product).
- **Acceptance.** Bind to [kişisel bağlam](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) for day-to-day inspection and to [Dogfooding](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) for the real Cantiara Proje story. Negative bounds (no merged feed, no notification impersonation, no automatic success narrative) are 19-class counterparts on those journeys.
- **Consumers.** `70-project-closure-summary` may point at story headings as selected sources; it does not replace this timeline. `75-build-in-public` may later publish approved historical items; live story is not the public feed. `27-daily-focus` `Bugün ne oldu?` derives supported lifecycle events from sources this story also reads; Daily Focus does not own this module.
- **Producers.** Mutation/undo writes Kayıt geçmişi. GitHub bağlantısı writes GitHub dış kaydı history. This feature only projects.
