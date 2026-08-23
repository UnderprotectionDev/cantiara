# Riskler

Kaynak: [`docs/workflow/40-risks/phase-context.md`](../../workflow/40-risks/phase-context.md)

## Problem Statement

Kurucu etki, olasılık, yanıt ve durumla belirsiz zararları izlemek ister. Kabul etmek İşleri kapatırsa veya gerçekleşmek sürümü başarısız ilan ederse Risk ikinci bir workflow olur. Bug, Test Açığı ve Üretim Olayı Risk değildir. Öncelik puanı olasılıktan üretilmemelidir.

## Solution

Risk Proje ana kaydıdır; başlık, açıklama, etki, olasılık, yanıt/azaltma ve `Open`, `Mitigating`, `Occurred`, `Resolved`, `Accepted`. Durum yalnız açık kullanıcı eylemiyledir. Kabul, ortadan kalkma değil bilinçli kabuldür. Gerçekleşme veya çözüm ilişkili İş, Proje Sürümü veya Projeyi otomatik değiştirmez. `open-risk` sinyal üretimi buradadır; merkez 71’dedir.

## User Stories

1. As a founder, I want a Risk with title, description, impact, probability, and response/mitigation, so that uncertainty of harm is a record.
2. As a founder, I want life `Open`, `Mitigating`, `Occurred`, `Resolved`, or `Accepted`, changed only by my explicit action.
3. As a founder, I want `Accepted` to mean I keep a known Risk with rationale, not that it vanished.
4. As a founder, I want Occurred or Resolved not to close related Work, fail a Project Release, or change Project life, so that Risk is not a workflow engine.
5. As a founder, I want Accept not to be a publish gate or a Work-close action.
6. As a founder, I want Risk not to be a Bug, Test Gap, or Production Incident, so that learning, verification holes, and runtime events stay their types.
7. As a founder, I want no automatic priority score from probability or impact, so that Priority stays its own feature.
8. As a founder, I want Risks visible in Project Overview, Manual Project Updates, planning, and release-prep context as live source, not as a copied score.
9. As a founder, I want `open-risk` produced only when a Risk becomes `Open`, or when an `Open` Risk is related to a Project Release in publish prep or to an active Focus Period, so that time passing or high probability is not a signal.
10. As a founder, I want `Mitigating`, high impact/probability alone, or merely existing on a Project not to emit `open-risk`.
11. As a founder, I want that signal to carry source event, impact, and probability, grouped by source in the center (71), without this feature building the center.
12. As a founder, I want the product not to create a follow-up Work or a project health verdict from the signal.
13. As a founder, I want English UI `Risk`, `Open`, `Mitigating`, `Occurred`, `Resolved`, `Accepted`.
14. As a founder using only a keyboard or a screen reader, I want to create a Risk and change its status.
15. As a founder, I do not want this feature to own Bug, Test Gap, Production Incident, or Priority Map.
16. As a consuming release evidence pack, I want to read open Risks from source; I must not treat Accept as a release gate.

## Implementation Decisions

- **Owning documents.** [Risk takibi](../../prd/09-discovery-decisions-and-design.md#risk-takibi). Lives in [PRD 02](../../prd/02-domain-model-and-lifecycle.md#ana-kayıt-türleri-ve-asgari-sözleşmeler). Signal `open-risk` in [PRD 04 registry](../../prd/04-workspace-and-projects.md#dikkat-sinyali-kayitlari); production rules stay here (71 presents). No new ADR.
- **Glossary.** Use Risk, Dikkat sinyali (`open-risk`). Avoid Bug, Test Açığı, Üretim Olayı, priority score, publish gate, auto Work close.
- **Risk module.** Project-scoped. Status only via explicit action. Accept/Occur/Resolve/Mitigate do not write Work, Project Release, or Project life. No probability→priority function.
- **open-risk production.** Exactly two deterministic events: (1) Risk enters `Open`; (2) an `Open` Risk is related to a publish-prep Project Release or an active Focus Period. Not time, not Mitigating, not high scores, not Project-only presence. No auto follow-up Work, no health verdict.
- **English UI labels.** `Risk`, `Open`, `Mitigating`, `Occurred`, `Resolved`, `Accepted`. Add when first shown.
- **Consumers.** 71 presents. 08/12 overview and release evidence read source Risks. 66 Production Incident is a different type.

## Testing Decisions

- **What a good test is.** Tests observe Risks through create, status transitions, and counterparts: related Work still open, Release not failed, `open-risk` only on the two events.
- **Seam (one).** Risks — record and signal-production interface. Center UI is out.
- **Prior art.** Bind to [Karar ve belirsizlik](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): related records’ status does not change implicitly.
- **Required counterparts.** Accept is not a publish gate; Occur does not close Work; not Bug/Test Gap/Incident; no auto priority; signal negatives (time, Mitigating, high probability).

## Out of Scope

- Bug, Test Açığı, Üretim Olayı kayıtları; öncelik haritası.
- Bildirim Merkezi sunumu (71).
- Yayın kapısı, otomatik İş kapanışı, olasılıktan öncelik puanı.
- Proje sağlık hükmü.

## Further Notes

- **Orient.** Glossary: Risk, Dikkat sinyali. Owning PRD: `docs/prd/09-discovery-decisions-and-design.md` (Risk takibi). ADRs: none owning. Journey: Karar ve belirsizlik.
- **Acceptance.** Bind to [Karar ve belirsizlik](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
