# Deney ve Doğrulama Kayıtları

Kaynak: [`docs/workflow/42-validation-records/phase-context.md`](../../workflow/42-validation-records/phase-context.md)

## Problem Statement

Kurucu ürün dışında yürüttüğü varsayım veya soru doğrulamasının yöntemini, sonucunu ve karar bağlamını kaybetmek istemez. Bu kayıt Test Oturumu, Planlı Test Senaryosu veya araştırma oturumu sayılırsa formal test ve görüşme semantiği bozulur. Sonuç Varsayım durumunu veya Kararı otomatik yazmamalıdır.

## Solution

Deney/Doğrulama Proje ana kaydıdır; yöntem, sonuç ve ilişkili Varsayım/Açık Soru/Karar bağlamını tutar. Formal test yönetiminin yerine geçmez; yayın kapısı değildir. Kullanıcı uygulama dışında denemeyi belgeler; ilk ürün anket, süreli oy veya sürekli geri bildirim döngüsü yürütmez. Sonuç otomatik yaşam yazmaz.

## User Stories

1. As a founder, I want a Validation Record with method, result, and decision context, so that an outside check is not only a chat memory.
2. As a founder, I want to relate it to an Assumption or Open Question I was checking, so that method sits beside the proposition rather than replacing it.
3. As a founder, I want that relation not to auto-set Assumption `Confirmed`/`Refuted` or to mint a Decision, so that I still choose the outcome.
4. As a founder, I want this record not to be a Planned Test Case, Test Session, Session Test, or Test Gap, so that product testing stays PRD 10.
5. As a founder, I want this record not to be a Research Session or Feedback, so that an interview and an inbound message stay their types.
6. As a founder, I want it not to act as a release gate or Test Report acceptance, so that shipping stays a human Release decision.
7. As a founder, I want English UI `Validation Record` (PRD Deney/Doğrulama).
8. As a founder using only a keyboard or a screen reader, I want to create the record and open related Assumption/Question.
9. As a founder, I do not want in-product surveys, timed voting, or a continuous feedback loop in this feature.
10. As a consuming Assumption, I want to keep my life until I explicitly transition, even if a Validation Record result exists.

## Implementation Decisions

- **Owning documents.** [Deney ve doğrulama kayıtları](../../prd/09-discovery-decisions-and-design.md#deney-ve-doğrulama-kayıtları). Ana kayıt [PRD 02](../../prd/02-domain-model-and-lifecycle.md#ana-kayıt-türleri-ve-asgari-sözleşmeler). Test types owned by PRD 10. Research Session owned by neighboring PRD 09 section (43). `Yerine geçer` among Validation Records is allowed by the PRD 02 relation table (same specialist type) if the founder fully replaces a method record; do not use it to overwrite Assumption life. No new ADR.
- **Glossary.** Use Deney/Doğrulama. Avoid Test Oturumu, Planlı Test Senaryosu, Kullanıcı Araştırması Oturumu, auto Assumption status.
- **Validation module.** Project-scoped: method, result, links to Assumption/Open Question/Decision as context (`İlgili` or evidence — not auto life). Active/archive/trash common. No survey runner.
- **English UI labels.** `Validation Record`. Add when first shown.
- **Consumers.** 41/38 remain status owners. 10 does not treat this as a test session.

## Testing Decisions

- **What a good test is.** Tests observe Validation Records through create, relate to Assumption/Open Question/Decision, and read method/result. They do not assert Prisma rows. Expected values: result does not write Assumption or Decision life; the record is not a Test Session, Planned Test Case, or Research Session; it is not a release gate.
- **Seam (one).** Validation Records — the product-facing Deney/Doğrulama interface. Test and research modules appear only as counterparts.
- **Modules under test.** Validation Records only.
- **Prior art.** First contract tests at this seam. Evidence environment is [Karar ve belirsizlik](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
- **Required counterparts.** Creating a result does not write Assumption/Decision life; record is not a Test Session or Research Session; not a release gate.

## Out of Scope

- Test Senaryosu, Test Oturumu, test raporu kabulü (10, 53–57).
- Kullanıcı araştırması oturumu (43), Geri Bildirim (47).
- Sonuçtan otomatik Varsayım/Karar yazma.
- Dış anket, oy, sürekli geri bildirim döngüsü.

## Further Notes

- **Orient.** Glossary: Deney/Doğrulama, Varsayım, Açık Soru. Owning PRD: 09 Deney ve doğrulama. ADRs: none. Journey: Karar ve belirsizlik.
