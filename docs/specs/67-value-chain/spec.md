# Değer Zinciri

Kaynak: [`docs/workflow/67-value-chain/phase-context.md`](../../workflow/67-value-chain/phase-context.md)

## Problem Statement

Kurucu seçilen Proje Hedefinden problem, kanıt, Karar, İş, test, Proje Sürümü ve gözlenen sonuca uzanan hattı kopukluklarıyla okumak ister. Bugün zincir ana kayıt, sağlık skoru veya tahminî tamamlanmış izlenebilirlik belgesi gibi durur; hedefsiz parçalar gizlenir; Karar/kanıt/test genel `Related` ile Hedefe katkı sayılır. Proje Hedefi sahipliği 37'dedir; bu kart hedef yazmaz.

## Solution

Kurucu bir Proje Hedefini çapa seçer. Değer Zinciri yalnız mevcut kesin kayıtlar ve kullanıcının kurduğu ilişkilerden türetilir: problem/fırsat ve kanıt, Karar, kapsam, İş, desteklenen GitHub gerçeği, test, Proje Sürümü, tarihli Erişim ve Sonuç gözlemleri. Yeni kayıt, ilişki, özet metni veya ikinci doğruluk kaynağı yazılmaz. Hedefe bağlanmamış ilgili parçalar `Not linked to goal` bölümünde kaynaklarına açılır; sistem hedef tahmin etmez. Eksik veya çözülemeyen adım içerik sızdırmadan görünür; boşluktan mevcut kayıt seçme veya normal oluşturma akışı önerisi ilişkiyi kendiliğinden yazmaz. Kopukluk Bildirim Merkezi sinyali veya sağlık puanı değildir. `Contributes to Goal` yalnız İş, Kilometre Taşı veya Proje Sürümü uçlarıdır.

## User Stories

1. As a founder, I want a derived `Value Chain` view on a Proje, so that I am not maintaining a second traceability document.
2. As a founder, I want to pick a Proje Hedefi as the anchor and inspect multiple branches or Proje Sürümü records serving that goal together.
3. As a founder, I want the chain to use only explicit existing relations, so that the product never infers missing links.
4. As a founder, I want unlinked but related İş, Karar, evidence, tests, and releases visible in `Not linked to goal`, opening their sources, so that hiding is not a health trick.
5. As a founder, I want each node to explain why it is shown and which exact relation bound it.
6. As a founder, I want a missing or unresolvable step shown without leaking private content (tombstone / silinmiş hedef işareti).
7. As a founder, I want a gap action to offer pick-existing or start-normal-create without auto-writing the relation or changing another record's status, and without becoming a publish gate.
8. As a founder, I do not want a disconnect to emit a Notification Center signal or a health score by itself (except 65's already-defined Action-needed on an in-progress reassessment round).
9. As a founder, I do not want this view to create or edit Proje Hedefi records — 37 owns Goals.
10. As a founder, I do not want Karar, evidence, or tests bound with general `Related` to count as `Contributes to Goal`.
11. As a founder, I want GitHub facts and tests to appear only through their real relations (Work/Release chain), not as goal children.
12. As a founder, I want English UI `Value Chain`, `Not linked to goal`.
13. As a founder, I want broken/inaccessible ends to stay visible in the E2E from PRD 16.

## Implementation Decisions

- **Owning documents.** [Değer Zinciri](../../prd/04-workspace-and-projects.md#değer-zinciri). Relation types: [standart ilişki türleri](../../prd/02-domain-model-and-lifecycle.md#standart-ilişki-türleri) (`Hedefe katkı` / `Contributes to Goal`). Why-chain on Work is PRD 06 / 16 and is a compact cousin, not this view. Goals: workflow 37. 19: disconnects are not impact analysis. No new ADR.
- **Glossary.** Değer Zinciri, Proje Hedefi, Hedefe katkı. Avoid: Value Chain record, health score, treating Related as contribution, Goals as this card's sub-work.
- **One seam.** Value Chain — read-only derived graph for a selected Goal. May call 37/38/45/09/63/65 **read** APIs; must not write Goal, Decision, evidence, or Work. Gap "create" is navigation into those features' create commands after preview that no relation was written yet.
- **English UI.** `Value Chain`, `Not linked to goal`, `Contributes to Goal` (already in term table). Add missing labels with first display.

## Testing Decisions

- **What a good test is.** Value Chain: multi-branch goal, unlinked records visible, broken/inaccessible ends, gap action writes nothing until the owning feature commits, Related-to-Goal does not count as contribution, no health field, Goal CRUD absent.
- **Seam (one).** Value Chain. Journey **Değer Zinciri** real project.
- **Required counterparts.** No auto-complete of missing links; no health; Goals owned by 37; Related is not contribution; GitHub/tests are not Goal children; this view is not the Work `Neden bu işi yapıyorum?` compact chain.

## Out of Scope

- Proje Hedefi CRUD ve katkı üyeliği yazımı — 37.
- Karar / kanıt / test / Proje Sürümü yazımı — ilgili feature'lar.
- Zinciri ana kayıt veya elle güncellenen izlenebilirlik belgesi sayma.
- Hedefi bu görünümün alt işi yapmak.
- Karar, kanıt veya testi Hedefe genel `Related` ile bağlayıp katkı sayma.
- İş `Neden bu işi yapıyorum?` kompakt zinciri — 16 (okunabilir akraba; bu görünüm Proje Hedefi çapalıdır).
- Sağlık skoru, yayın kapısı, dikkat sinyali olarak kopukluk (65'in tur sinyali hariç).
- 18 Üretim Olayı Önleme Zinciri.

## Further Notes

- **Orient.** Glossary: Değer Zinciri, Proje Hedefi, Hedefe katkı. Owning PRD: 04 `#değer-zinciri`. ADR: none. Journey: **Değer Zinciri**. Related: PRD 02 relations, PRD 16 E2E, PRD 19, workflow 37.
- **Acceptance.** [Değer Zinciri](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): explicit relations only; unlinked visible; no new records/health.
