# Manuel Proje Güncellemeleri

Kaynak: [`docs/workflow/69-project-updates/phase-context.md`](../../workflow/69-project-updates/phase-context.md)

## Problem Statement

Kurucu bir günde Projenin nasıl gittiğine dair kendi hükmünü tarihli bırakmak ister: kısa anlatı, öznel sağlık işareti ve o anda gördüğü bağlam. Bugün bu hüküm ya hiç kaydolmaz ya da canlı bir sağlık skoruna, genel bakış özetine veya kapanış/sürüm yazısına dönüşür. Eski hüküm silinip “proje sağlıklıdır” diye konuşan tek güncel skor bu sorunun çözümü değildir. Proje genel bakışı, kapanış özeti ve üretim olayı bu kaydın yerine geçmez.

## Solution

Kurucu istediği zaman `On Track`, `At Risk` veya `Off Track` işareti, kısa anlatı ve kaydetme anındaki canlı özet bloklarının salt okunur snapshot'ıyla bir Manuel Proje Güncellemesi kaydeder. Kayıt tarihli kalır; yeni kayıt eskisini silmez; sistem “proje sağlıklıdır” diye konuşmaz. İsteğe bağlı yinelenen hatırlatma mevcut formu açar; atlamak güncelleme yazmaz. Güncelleme canlı skor, durum kapısı veya Proje genel bakışının yerine geçen özet değildir.

## User Stories

1. As a founder, I want to record a dated Proje update with an `On Track`, `At Risk`, or `Off Track` mark, so that today’s subjective health is explicit.
2. As a founder, I want to write a short narrative with that mark, so that the mark is not a naked traffic light.
3. As a founder, I want to link the update to related Risk, Karar, Kilometre Taşı, or other ana kayıtlar, so that the judgment has sources.
4. As a founder saving an update, I want the live Proje summary blocks I am looking at to freeze as a timestamped read-only snapshot, so that later readers see the context I saw that day.
5. As a founder, I want linked ana kayıtlar to stay live and openable, so that the snapshot explains the past without becoming a second current truth.
6. As a founder, I want a new update to add a chronological entry rather than delete the previous one, so that history of judgment remains.
7. As a founder, I want a saved update’s mark, narrative, and snapshot to stay as they were that day, so that a later judgment cannot rewrite that dated entry in place.
8. As a founder, I want the product not to speak “the project is healthy,” so that the mark stays my judgment.
9. As a founder, I want this update not to become a live health score, status gate, or dashboard metric, so that planning and overview stay separate.
10. As a founder, I want Proje genel bakışı to remain the neutral source summary, so that dated updates do not replace it.
11. As a founder, I want an optional per-Proje repeating reminder with an editable reflection question and interval, so that I can be asked to write without being forced.
12. As a founder, I want that reminder, when due, to open the existing Manual Project Update form from Birleşik Bildirim Merkezi, so that the reminder is not a second editor.
13. As a founder, I want to skip the reminder without creating an update, so that nagging cannot mint history.
14. As a founder, I want an update to exist only when I explicitly save the form, so that drafts and skips are not records.
15. As a founder, I do not want automatic updates, AI drafts, cadence enforcement, or staleness-from-time-alone alerts, so that silence is allowed.
16. As a founder, I do not want this update to be a release note, kapanış özeti, or Üretim Olayı, so that those journeys keep their own records.
17. As a founder, I want English UI copy for the mark, form, and reminder action, so that the product language stays English.
18. As a founder using only a keyboard or a screen reader, I want to create, save, and reopen a dated update, so that the İlk Proje / kişisel bağlam journeys remain accessible.
19. As a founder, I want saved updates to follow normal Arşiv and Çöp Kutusu rules for the Proje, so that they are ordinary owned snapshots, not a side ledger.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [Manuel Proje Güncellemeleri](../../prd/04-workspace-and-projects.md#manuel-proje-güncellemeleri). The auxiliary entity is in [ana kayıt türleri](../../prd/02-domain-model-and-lifecycle.md#ana-kayıt-türleri-ve-asgari-sözleşmeler) (Manuel Proje Güncellemesi, Proje-owned, dated immutable summary snapshot). Proje genel bakışı is [ayrı yüzey](../../prd/04-workspace-and-projects.md#proje-genel-bakışı). Reminder presentation uses Birleşik Bildirim Merkezi; emission of `personal-reminder` stays with kişisel hatırlatmalar. No new ADR.
- **Glossary.** Use Manuel Proje Güncellemesi, Proje, Proje genel bakışı, Birleşik Bildirim Merkezi, Dikkat sinyali, Kapanış özeti taslağı, Üretim Olayı. Do not introduce health score, Mission Control, live status, automatic staleness, or a second overview. Do not call this record a Proje Sürümü note or kapanış Belgesi.
- **Marks.** Closed marks are `On Track`, `At Risk`, `Off Track` (PRD `Yolunda`, `Riskli`, `Yolunda değil`). The mark is subjective. The product never aggregates marks into a current health judgment or workspace Mission Control module (19).
- **Snapshot on save.** Live summary blocks shown on the update surface become a timestamped, read-only historical snapshot at save. Linked ana kayıtlar remain live and openable. The snapshot explains the founder’s context that day; it is not a new current source of truth and does not replace Proje genel bakışı.
- **Chronology.** Each save appends. A saved mark, narrative, and summary snapshot are immutable; a later judgment is a new dated entry, not an in-place rewrite of an old one. Updates are not reduced to a single current row. Normal Arşiv / Çöp Kutusu apply; this is not a restore-point product.
- **Optional reminder.** Per-Proje, the founder may enable, pause, or disable a repeating `Create Project Update` reminder with an editable reflection question and a preferred interval. When due, the reminder opens the existing form via Birleşik Bildirim Merkezi. Skip creates nothing. Only explicit save creates the Manuel Proje Güncellemesi. This feature does not add a new Dikkat sinyali kimliği; it uses `personal-reminder` owned by kişisel hatırlatmalar. 71 enforces the registry; 69 only supplies the form the reminder opens.
- **No automation of judgment.** No required cadence, no staleness-from-elapsed-time notification, no automatic update, no automatic health estimate, no AI draft.
- **English UI labels.** First user-visible copy uses: `Project Update`, `On Track`, `At Risk`, `Off Track`, `Create Project Update`. Missing labels go to the term table in the same change that first shows them.
- **Not overview, not closure.** Proje genel bakışı continues to summarize live sources. Kapanış özeti taslağı and sürüm notu stay in 70 and 65.

## Testing Decisions

- **What a good test is.** Tests observe Manual Project Updates through its public interface: create with mark/narrative/links, snapshot freeze at save, append-only chronology, in-place rewrite rejected, skip-reminder-creates-nothing, and “product did not emit a live health judgment.” They do not assert snapshot blob internals or Prisma shapes. Expected values are product rules (three marks, snapshot is historical and immutable, skip ≠ save).
- **Seam (one).** Manual Project Updates — the product-facing update interface used by the Proje shell and, when a reminder fires, the form opened from the notification. Notification Center is a collaborator, not this module.
- **Modules under test.** Manual Project Updates only. Overview, closure summary, production incident, and notification registry are counterparts (“not replaced / not minted”).
- **Prior art.** No Vitest/Playwright suite yet. Contract tests at this seam with Proje fixtures. Evidence binds to [İlk Proje](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) and [kişisel bağlam](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
- **Required counterparts.** No live score; old update still listed after a new save; saved entry cannot be rewritten in place; skip reminder writes zero records; overview still independent; AI draft absent; Mission Control module absent.

## Out of Scope

- Güncellemeyi canlı sağlık skoru, durum kapısı veya Mission Control modülü sayma.
- Eski değerlendirmeyi silip tek güncel hükme indirgeme.
- Güncellemeyi sürüm notu, kapanış özeti veya Üretim Olayı yapmak.
- Proje genel bakışını bu kaydın canlı özeti sayma.
- Yeni Dikkat sinyali kimliği eklemek; hatırlatma `personal-reminder` üretir.
- Zorunlu cadence, salt zaman staleness bildirimi, otomatik güncelleme, AI taslağı.

## Further Notes

- **Orient.** Glossary: Manuel Proje Güncellemesi, Proje, Proje genel bakışı, Birleşik Bildirim Merkezi, Dikkat sinyali, Kapanış özeti taslağı. Owning PRD: `docs/prd/04-workspace-and-projects.md` (Manuel Proje Güncellemeleri). ADRs in play: none. Related: PRD 02 (auxiliary entity), PRD 06 (kapanış), PRD 16 (İlk Proje, kişisel bağlam), PRD 19 (no Mission Control, no time-only staleness).
- **Acceptance.** Bind to [İlk Proje](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) as the place a living Proje first gets dated judgment, and to [kişisel bağlam](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) for reminder/form access. Negative bounds are 19-class counterparts on those journeys.
- **Consumers.** 08-project-overview must not treat this snapshot as live health. 71 presents `personal-reminder`; 35 owns emission rules. 70 must not reuse this record as closure.
