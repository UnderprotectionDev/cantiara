# Ürün Boşlukları ve Dış Araca Kaçışlar

Kaynak: [`docs/workflow/58-product-gaps/phase-context.md`](../../workflow/58-product-gaps/phase-context.md)

## Problem Statement

Kurucu Cantiara kapsamında gördüğü işi başka bir araçta bitirdiğinde bunu tarihli kanıtla kaydetmek ve karşılanmayan ihtiyacı Çalışma Alanında yönetmek ister. Bugün kaçış telemetry, özellik isteği kuyruğu veya GitHub issue'su gibi durur; tekrar sayısı öncelik üretir; yüksek etkili kaçış "hata düzeldi" notuyla kapanır. Dış yürütme devri, GitHub bağlantısı ve test Handoff'u bu kaydın yerine geçmemelidir. Ürünün durduğu yer görünür kalmalıdır.

## Solution

Kurucu açık `Record Product Gap` eylemiyle Çalışma Alanı ana kaydı Ürün Boşluğu ve ona bağlı tarihli Dış Araca Kaçış olayı yazar. Boşluk durumu `Open`, `Evaluating`, `Met` veya `Conscious boundary`dır; tekrar sayısı durumu değiştirmez, yalnız kesin olay kümesini açar. Kaçış amacı, aracı, nedeni, etkisi ve kaynak bağlamını taşır; dış içeriği kopyalamaz ve dış oturumu izlemez. Yüksek etkili kaçış, aynı gerçek iş akışı mevcut Ürün sürüm adayında tamamlanıp etkilenen gerçek ürün kayıtlarına dönmeden ve paralel dış doğruluk kaynağı kapanmadan kapanmış sayılmaz. Boşluk İş değildir; isteğe bağlı açık önizlemeyle İşe dönüşebilir.

## User Stories

1. As a founder, I want to start `Record Product Gap` myself, so that a tool switch is a conscious log rather than background telemetry.
2. As a founder, I want that action to create a Workspace-scoped Ürün Boşluğu with a dated Dış Araca Kaçış event, or to attach the event to an existing gap I choose, so that similar titles are never auto-merged.
3. As a founder, I want the gap to carry the unmet need, optional scope, related Proje/İş/Özellik/Karar links, and a status I control: `Open`, `Evaluating`, `Met`, or `Conscious boundary`.
4. As a founder, I want changing gap status not to rewrite past escape events or write into linked records' lifecycles, so that history stays dated.
5. As a founder, I want the escape event to keep when it happened, source project or record context, the job I meant to finish, the external tool, one or more of `Missing capability`, `Faster`, `More reliable`, `Usability`, or `Habit`, and an optional note.
6. As a founder, I do not want the product to copy external content or watch an external session, so that the event is only my explicit record.
7. As a founder, I do not want an escape to be a GitHub bağlantısı, Test Handoff, or Dış yürütme devri, so that those seams stay distinct.
8. As a founder, I want the repeat count on a gap to be derived only from explicitly recorded events and to open that exact event set, so that a number is not a priority or decision.
9. As a founder, I want a dogfooding summary that can filter gaps by tool, reason, project, and status, so that repeats are visible without becoming a roadmap score.
10. As a founder, I do not want a repeat count to create a Feature, İş, notification, or ranking, so that I remain the one who decides follow-up.
11. As a founder, I want a gap to stay not-an-İş, with an optional previewed conversion to follow-up İş or Feature relation, so that conversion is never implicit.
12. As a founder closing a high-impact escape, I want close to require that the same real workflow succeeded on the current Ürün sürüm adayı, that affected current truth is back in usable product records via manual recreate or supported import, that the external copy is no longer an active parallel source of truth, and that evidence is bound to those exact records.
13. As a founder, I want that close evidence to be visible, so that a screenshot of the other tool or a "fixed" note cannot close a high-impact escape.
14. As a founder, I do not want a numeric threshold or waiting period to auto-close an escape, so that close remains a judged proof.
15. As a founder, I do not want the product to watch app usage, browser history, window focus, clipboard, or other tools, so that escape detection is never automatic.
16. As a founder, I want gaps and events to follow normal search, relation, history, and import/export rules, so that they are first-class Workspace records.
17. As a founder, I want sharing or public publishing of a gap to require closed-world preview and explicit approval, so that dogfooding notes do not leak.
18. As a founder, I want English UI copy for gap statuses, escape reasons, and `Record Product Gap`, so that the product language stays English.
19. As a founder using only a keyboard or a screen reader, I want to record a gap, attach an escape, filter repeats, and complete high-impact close with evidence, so that the Dogfooding journey is operable.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [Dış araca kaçış günlüğü](../../prd/04-workspace-and-projects.md#dış-araca-kaçış-günlüğü) and dogfooding close in [Dogfooding ve tamamlanma](../../prd/01-product-vision-and-scope.md#dogfooding-ve-tamamlanma). Record shape is [ana kayıt türleri](../../prd/02-domain-model-and-lifecycle.md#ana-kayıt-türleri-ve-asgari-sözleşmeler) (Ürün Boşluğu Workspace; Dış Araca Kaçış historical event with gap as origin). Close proof is glossary **Dış Araca Kaçış kapanışı**. No new ADR.
- **Glossary.** Use Ürün Boşluğu, Dış Araca Kaçış, Dış Araca Kaçış kapanışı. Do not introduce feature request, automatic priority, external-tool session, telemetry, integration usage, or conscious-external-boundary as this record. Do not treat the event as GitHub bağlantısı, Test Handoff, or Dış yürütme devri (24 / ADR-0015).
- **One seam.** Product Gaps and Tool Escapes — create/list/status gap, append escape event, derived repeat count, dogfooding filters, previewed follow-up İş, high-impact close with evidence binding. GitHub Integration, External Execution Handoff, and Test Handoff are adapters not called here.
- **Lifecycle.** Status catalog is closed and maps PRD 02 Turkish values to English UI: `Açık` → `Open`, `Değerlendiriliyor` → `Evaluating`, `Karşılandı` → `Met`, `Bilinçli sınır` → `Conscious boundary`. Founder closes or reclassifies; repeat count never writes status. Gap is not an İş. Optional `Create follow-up work` / Feature relation uses the shared preview-before-write pattern; nothing auto-converts. Gaps follow normal search, relation, history, and import/export; sharing is closed-world.
- **Escape event.** Required fields match PRD 04: occurred-at, source project/record context, intended job, external tool, one or more closed reasons (`Eksik yetenek` → `Missing capability`, `Daha hızlı` → `Faster`, `Daha güvenilir` → `More reliable`, `Kullanılabilirlik` → `Usability`, `Alışkanlık` → `Habit`), optional note. Phase-context and PRD 02 “etki” is dated context carried by that event (the work that left Cantiara and why), not a stored severity/`High-impact` enum. High-impact class is judged only at close using the PRD 01 definition. No copy of external content. No background observation of usage, history, focus, or clipboard. Action copy: PRD `Ürün boşluğu kaydet` → `Record Product Gap`.
- **High-impact close.** High-impact is the PRD 01 definition (canonical truth moved out, or a lasting parallel source of truth), applied when closing that escape — not a founder-set severity flag and not a shortcut of gap status `Conscious boundary`. Close is refused unless all of: the same real workflow succeeded on the current Ürün sürüm adayı; affected current truth is in usable product records (manual recreate or supported import); the external copy is not an active parallel source of truth; evidence is bound to those exact records. Close evidence is visible. No numeric threshold. An escape that never held parallel truth does not use this four-condition close. `Conscious boundary` on the gap does not waive four-condition close if the escape was high-impact. This is not account closure or External Surface revoke.
- **English UI labels.** `Record Product Gap` (`Ürün boşluğu kaydet`), `Product Gap`, `Tool Escape`, `Open`, `Evaluating`, `Met`, `Conscious boundary`, `Missing capability`, `Faster`, `More reliable`, `Usability`, `Habit`. Add missing labels to the PRD term table in the same change that first shows them.

## Testing Decisions

- **What a good test is.** Tests observe Product Gaps and Tool Escapes: record action, attach-to-existing vs new gap, status matrix, event fields, derived count opening exact events, refused high-impact close without proof, accepted close with bound evidence, no telemetry side effects. They do not scrape a fake "other app" or assert GitHub/Handoff writes.
- **Seam (one).** Product Gaps and Tool Escapes.
- **Modules under test.** This seam only. Dogfooding journey uses a real project; close mechanics may use fixtures for the four close predicates.
- **Required counterparts.** Auto-merge of similar titles absent; repeat count does not rank; escape is not a GitHub/Handoff/External Execution write; high-impact close rejected on missing parallel-source-closed proof; high-impact is not a stored severity flag; `Conscious boundary` does not waive high-impact close.

## Out of Scope

- Dış yürütme devri paket/uzlaştırma — 24.
- GitHub App, issue eşitleme, PR — 61.
- Test Handoff'u — 53.
- Özellik isteği kuyruğu, otomatik öncelik, telemetry, tarayıcı/pencere izleme.
- Hesap kapatma veya Dış yüzey iptali.
- Ürün Boşluğunu Test Açığı veya Risk sayma.

## Further Notes

- **Orient.** Glossary: Ürün Boşluğu, Dış Araca Kaçış, Dış Araca Kaçış kapanışı. Owning PRD: `docs/prd/04-workspace-and-projects.md` `#dış-araca-kaçış-günlüğü`; dogfooding kapısı `docs/prd/01-product-vision-and-scope.md`. ADRs in play: none owning; 0015 distinguishes External Execution Handoff. Related: PRD 02 (kayıt), PRD 16 (Dogfooding), PRD 19 (otomatik izleme yok).
- **Acceptance.** Bind to [Dogfooding](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): closed high-impact escapes with product flow complete and parallel external source closed; no duration/count quota. Negative: not telemetry, not GitHub, not External Execution Handoff.
