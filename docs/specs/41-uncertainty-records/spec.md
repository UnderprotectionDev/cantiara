# Varsayımlar ve Açık Sorular

Kaynak: [`docs/workflow/41-uncertainty-records/phase-context.md`](../../workflow/41-uncertainty-records/phase-context.md)

## Problem Statement

Kurucu doğrulanmamış önermeyi yanıt bekleyen sorudan ayırarak tutmak ister. Tek kayıt türü onları karıştırır; sonuç otomatik İş, Risk veya Karar olursa belirsizlik gizlenir. Çürütülen Varsayım inceleme kuyruğu gelecek yönüdür (PRD 18 / ADR-0013), ilk ürün davranışı değildir. Deney kaydı ve araştırma oturumu yöntem veya görüşme tutar, önerme değildir.

## Solution

Varsayım ve Açık Soru ayrı Proje ana kayıtlarıdır. Varsayım `Open`, `Confirmed`, `Refuted`, `No longer applicable`. `Confirmed` ve `Refuted` geçişinde isteğe bağlı kesin kanıt veya gerekçe; eksik kanıt geçişi engellemez fakat görünür kalır. `No longer applicable` yeni kanıt gerektirmez ve mevcut kanıt bağlamını silmez. Açık Soru `Open`, `Answered`, `No longer applicable`; `Answered` geçişinde isteğe bağlı kanıt veya gerekçe, yanıt ve varsa kanıt tarihsel kalır, soru silinmez. Sonuçlar kullanıcı eylemi olmadan İşe, Riske veya Karara dönüşmez. `Based on` / `Refuted Assumption Review` ilk üründe yoktur.

## User Stories

1. As a founder, I want an Assumption as an unverified proposition with statement, rationale, and evidence relations, so that a claim is not a question.
2. As a founder, I want Assumption life `Open`, `Confirmed`, `Refuted`, or `No longer applicable`.
3. As a founder, I want an Open Question as a question waiting for an answer, with context, so that uncertainty is not forced into a proposition.
4. As a founder, I want Open Question life `Open`, `Answered`, or `No longer applicable`.
5. As a founder, I want Confirmed, Refuted, and Answered transitions to accept optional exact evidence or rationale, with missing evidence visible but not blocking the transition.
6. As a founder, I want Confirmed, Refuted, and No longer applicable to keep any evidence already on the Assumption, so that the outcome is stored with that context and `No longer applicable` does not wipe history.
7. As a founder, I want an Answered or No longer applicable Open Question to keep the question, any answer, and any evidence historically, without deleting the question or requiring new evidence for `No longer applicable`.
8. As a founder, I want these records not to become Work, Risk, or Decision without my explicit create flow, so that a result is not a silent type change.
9. As a founder, I want status change not to write related records’ lives, so that refuting an Assumption does not close Decisions.
10. As a founder, I want Assumption and Open Question to stay two types, so that I cannot file one record as both.
11. As a founder, I want no `Based on` / `Basis for` relation and no `Refuted Assumption Review` list, so that PRD 18 stays out of first product (ADR-0013).
12. As a founder, I want an Assumption not to be a Validation Record or Research Session, so that method and interview stay elsewhere.
13. As a founder, I want an Open Question not to be a research note or Feedback, so that project uncertainty is not an inbox message.
14. As a founder, I want English UI `Assumption`, `Open Question`, `Open`, `Confirmed`, `Refuted`, `Answered`, `No longer applicable`.
15. As a founder using only a keyboard or a screen reader, I want to create both types and record outcomes.
16. As a founder, I do not want this feature to auto-create follow-up Work from a refutation or to score “unknowns”.
17. As a consuming Validation Record, I want to link method/result to these records without writing their status automatically.

## Implementation Decisions

- **Owning documents.** [Varsayım ve açık soru takibi](../../prd/09-discovery-decisions-and-design.md#varsayım-ve-açık-soru-takibi). Two ana kayıt rows in [PRD 02](../../prd/02-domain-model-and-lifecycle.md#ana-kayıt-türleri-ve-asgari-sözleşmeler). Future queue: [PRD 18](../../prd/18-future-directions.md#çürütülen-varsayım-inceleme-kuyruğu), [ADR-0013](../../adr/0013-gelecek-yonlerini-cekirdek-kabulden-ayir.md), [PRD 19](../../prd/19-out-of-scope.md). `Dayanır` is not in the first-product relation table. No new ADR.
- **Glossary.** Use Varsayım, Açık Soru, Kanıt bağı. Çürütülen Varsayım İnceleme Kuyruğu and Dayanır / Dayanağıdır are glossary terms marked future — do not ship. Avoid single uncertainty type, auto Decision, auto Work.
- **Two modules, one seam.** Uncertainty Records exposes Assumption and Open Question as distinct types with distinct lives. Optional exact evidence or rationale is on `Confirmed`, `Refuted`, and `Answered` only (PRD); missing evidence is visible and does not block. `No longer applicable` on either type does not require new evidence and does not strip existing Kanıt bağı rows or the record’s statement/question. No auto conversion. No Based on relation. No review queue UI.
- **English UI labels.** `Assumption`, `Open Question`, `Open`, `Confirmed`, `Refuted`, `Answered`, `No longer applicable`. Add when first shown. Do not show `Refuted Assumption Review` or `Based on`.
- **Consumers.** 42 may link as method/result context without writing these lives. 38/40 do not auto-close from refutation.

## Testing Decisions

- **What a good test is.** Tests observe Uncertainty Records through create, distinct types, transitions, optional evidence visibility, and counterparts: no auto Work/Risk/Decision, no Based on, no review queue route.
- **Seam (one).** Uncertainty Records — both types behind one product interface used by Project Discovery/Decisions area.
- **Prior art.** Bind to [Karar ve belirsizlik](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). 19-class: Refuted Assumption Review absent.
- **Required counterparts.** One type cannot be both; result does not auto-spawn Work/Risk/Decision; related Decision stays Valid; Based on relation absent; Confirmed/Refuted/Answered missing evidence is visible; `No longer applicable` on Assumption and on Open Question does not strip existing evidence or the record text.

## Out of Scope

- Çürütülen Varsayım İnceleme Kuyruğu ve `Based on` / `Basis for` (PRD 18, ADR-0013).
- Deney/Doğrulama kaydı (42), araştırma oturumu (43), Geri Bildirim (47).
- Sonuçtan otomatik Karar, Risk veya İş.
- Tek belirsizlik kayıt türü.

## Further Notes

- **Orient.** Glossary: Varsayım, Açık Soru, Çürütülen Varsayım İnceleme Kuyruğu (future). Owning PRD: `docs/prd/09-discovery-decisions-and-design.md`. ADRs: 0013. Journey: Karar ve belirsizlik.
- **Acceptance.** Bind to [Karar ve belirsizlik](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). Negative bound: review queue absent (19 / 18).
