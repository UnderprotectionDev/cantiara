# Önceliklendirme

Kaynak: [`docs/workflow/20-priority/phase-context.md`](../../workflow/20-priority/phase-context.md)

## Problem Statement

Kurucu bir Projede İşleri çok eksenli karşılaştırmak, haritada görmek ve oturum içinde sıralamak ister; tek otomatik puan veya WSJF istemez. Haritanın Backlog sırası yazması, oturum sonucunun bütün Projeye kalıcı zorunlu sıra olması veya evrensel öncelik alanı bu ihtiyacı bozar. İş kaydında skaler `öncelik` alanı yoktur.

## Solution

Kurucu Proje içinde isteğe bağlı öncelik ölçütleri tanımlar: ad, kısa açıklama ve beş sabit kademe (`Very low` … `Very high`) için Proje bazında düzenlenebilir açıklamalar. Sistem kademeleri toplamaz, ağırlıklandırmaz veya tek skora çevirmez. Öncelik Haritası iki ölçütü eksen seçer; konum sıra gerçeği değildir. Önceliklendirme Oturumu seçili kapsam için tarihli, görünüm-yerel manuel sıra tutar; Backlog sırası, ölçüt değerleri ve durum yazılmaz. Görüşlü Başlangıç yapılandırması varsayılan kapalı `Evidence strength` ölçütü sunabilir; kurucu onu etkinleştirir ve kademeyi eliyle seçer.

## User Stories

1. As a founder, I want optional Project-scoped priority criteria, so that comparison axes live on the Project rather than a Workspace schema.
2. As a founder, I want each criterion to have a name, a short description, and editable descriptions for five fixed ranks (`Very low`, `Low`, `Medium`, `High`, `Very high`), so that the closed level contract cannot become a free numeric formula.
3. As a founder, I want empty/not-yet-evaluated to stay outside those five ranks, so that missing is not a fake `Medium`.
4. As a founder, I want same-named criteria in two Projects to stay different identities, so that there is no Workspace-wide priority schema.
5. As a founder, I want criterion values shown separately on Work detail, List, Backlog, filters, and the map, so that I see axes rather than a rollup.
6. As a founder, I do not want the product to sum, weight, formula, or auto-sort from ranks, so that I still choose priority.
7. As a founder using a Starter Configuration, I want a prepared `Evidence strength` criterion default-off, so that I enable and pick the rank myself.
8. As a founder, I want `Evidence strength` never auto-filled from Feedback, Contact/Company counts, or Sources, so that a criterion is not a computed score.
9. As a founder, I want a criterion not to be a Work field or a custom field, so that evaluation axes stay their own configuration.
10. As a founder, I want a Priority Map with two ordered criteria as axes, so that I can see relative stance.
11. As a founder, I want Work missing an axis value to sit in `Unevaluated`, so that empty is visible.
12. As a founder, I want an optional evidence signal beside a point showing Feedback record and unique Contact/Company counts as context only, so that the map does not become a popularity score.
13. As a founder, I want the map not to combine criteria, mint a score, auto-rank, or impose quadrant decision labels, so that position is not Backlog order or status.
14. As a founder, I want changing a value on the map to be an explicit edit of that criterion field, so that the map is not a second store.
15. As a founder, I want saving the map not to create a second ranking truth, so that the map is a comparison, not a plan.
16. As a founder, I want `Create Prioritization Session` to make a named Project decision view with a selected Work scope and view-local manual order, so that ranking is a dated working window.
17. As a founder, I want that session order not to write Backlog order, criterion values, roadmap horizon, status, or another view's order, so that session rank ≠ Backlog order.
18. As a founder, I want session cards to show title, criterion values, due date, Risk and evidence counts live from Work, so that the session is not a snapshot of fields except its own order.
19. As a founder reordering in the session, I want only the session order to change, so that adding/removing scope is not a status or Backlog membership write.
20. As a founder, I want to compare session order next to Backlog order without an implicit sync either way, so that I choose if anything should move later, by hand, elsewhere.
21. As a founder closing a session, I want the scope and last order kept as dated read-only decision context, so that a new session does not erase the old.
22. As a founder, I want archive/delete of a session not to touch Work or Backlog order, so that cleanup is safe.
23. As a founder, I do not want a session score, automatic winner, Decision record, status change, or second Work-priority truth, so that the session stays local.
24. As a founder, I do not want the session to be Daily Focus or a Focus Period, so that those windows stay other features.
25. As a founder, I do not want a scalar `priority` field on Work, WSJF automation, or a universal priority field, so that 19/PRD stay closed.
26. As a founder, I want criteria, map, and sessions to follow configuration trash rules, so that a trashed definition is ineffective.
27. As a founder, I want English UI for `Priority Map`, `Create Prioritization Session`, `Unevaluated`, `Evidence strength`, and the five rank labels, so that the product language stays English.
28. As a founder using only a keyboard, I want to set ranks, open the map, and reorder a session, so that günlük planlama can include this comparison.
29. As a founder copying Project structure, I want criterion definitions to copy as independent identities in the target, so that there is still no Workspace-wide schema.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [Öncelik ölçütleri](../../prd/06-work-management-and-planning.md#öncelik-ölçütleri), [Öncelik Haritası](../../prd/06-work-management-and-planning.md#öncelik-haritası), and [Önceliklendirme oturumları](../../prd/06-work-management-and-planning.md#önceliklendirme-oturumları). Configuration records: [ana kayıt türleri](../../prd/02-domain-model-and-lifecycle.md#ana-kayıt-türleri-ve-asgari-sözleşmeler). Backlog order is the Backlog feature. Work Context Priority Foundations (16) are not this scoring surface — they must remain unscored. No new ADR.
- **Glossary.** Use İş, Backlog, Önceliklendirme oturumu (PRD 02 row), Başlangıç yapılandırması. Avoid: scalar priority, WSJF, universal priority field, map-as-Backlog, session-as-Focus-Period.
- **Criteria.** Optional, Project-scoped. Name, short description, five fixed ranks with Project-editable explanations. Empty is distinct. Same names across Projects are not shared identity. Values display separately; no sum/weight/formula/single score/auto-sort/final verdict. Not a Work field or custom field. Starter Configurations may include default-off `Evidence strength`; founder enables and picks the rank; Feedback/Contact/Source never auto-write it. Structure copy mints independent criterion definitions in the target ([PRD 04](../../prd/04-workspace-and-projects.md#proje-yapısını-kopyalama)).
- **Map.** Two ordered criteria as axes. Missing values in `Unevaluated`. Optional evidence counts beside points are context, not score. Map does not combine axes, auto-rank, impose quadrant labels, or change the founder's priority. Value edits on the map are explicit writes to the same criterion field. Saving the map is not a second ranking truth. Map is not an analytics dashboard or publish score.
- **Session.** Only explicit `Create Prioritization Session` creates a named Project decision view. Stores selected Work scope and view-local manual order. That order does not write Backlog order, criterion values, roadmap horizon, status, or other views' order. Normal Smart Collection/List/Kanban/Roadmap views do not carry independent manual rank; this is the exception. Cards live-read Work fields. Reorder updates only session order; add/remove scope is not a commitment. Founder may compare session order with Backlog order; no implicit sync. Close keeps dated read-only context; reorder after close needs a new session or explicit reopen. Archive/delete does not affect Work or Backlog. No session score, automatic winner, Decision record, status change, or second priority truth. Not Daily Focus or Focus Period.
- **Trash.** Criteria, named views, and sessions follow configuration trash (PRD 13). This feature does not build global trash UI.
- **English UI labels.** `Very low`, `Low`, `Medium`, `High`, `Very high`, `Evidence strength`, `Priority Map`, `Unevaluated`, `Create Prioritization Session`. Add missing labels to the term table in the same change.
- **Stack.** Existing table/board patterns. No charting library beyond the map presentation already allowed by the web stack. No WSJF engine.

## Testing Decisions

- **What a good test is.** Tests observe Prioritization through its public interface: criterion CRUD and ranks, map placement including Unevaluated, session order versus Backlog, and negatives (no score, no auto-fill Evidence strength, no implicit sync). They do not assert numeric rollups that the product must not have.
- **Seam (one).** Prioritization — the product-facing criteria, map, and session interface. Backlog and Daily Focus are counterparts. Playwright for günlük planlama comparison is this seam through the UI.
- **Modules under test.** Prioritization only.
- **Prior art.** Contract tests at this seam. Evidence binds to [günlük planlama](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) and [İş yaşam döngüsü](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) as relevant; Roadmap journey already forbids filters from writing criterion values.
- **Required counterparts.** No scalar priority field; map reorder of points without explicit edit does not write; session order ≠ Backlog; Evidence strength not auto-computed; close session does not delete prior session.

## Out of Scope

- Tek skor, WSJF otomasyonu veya evrensel öncelik alanı.
- Haritayı Backlog sırası veya Kanban durumu yapmak.
- Oturum sonucunu bütün Projeye kalıcı zorunlu sıra olarak yazma.
- İş Bağlam Kartı Öncelik dayanaklarını skor motoruna çevirme (16).
- Daily Focus / Odak Dönemi / Roadmap ufku yazımı.

## Further Notes

- **Orient.** Glossary: İş, Backlog, Önceliklendirme oturumu. Owning PRD: `docs/prd/06-work-management-and-planning.md` (`#öncelik-ölçütleri`, `#öncelik-haritası`, `#önceliklendirme-oturumları`). ADRs: none owning. Related: PRD 02 session row, PRD 04 structure copy, PRD 16 günlük planlama / İş yaşam döngüsü, PRD 19 (no velocity, no scoring matrix).
- **Acceptance.** Bind to [günlük planlama](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) for map/session not writing Kanban status, and to lifecycle for criterion values as optional Work context. Roadmap already tests that horizon filters do not write criterion values — do not duplicate Roadmap here.
