# İş Bağımlılıkları ve Blokajlar

Kaynak: [`docs/workflow/19-blockers/phase-context.md`](../../workflow/19-blockers/phase-context.md)

## Problem Statement

Kurucu bir İşin başka bir İş, Karar veya Açık Soru tarafından bekletildiğini açık ilişki ve geçmişle görmek ister. Kaynak kaydın kapanması engeli sessizce çözmemelidir. Sütun rengi, etiket veya öncelik puanı bu gerçeğin yerine geçmez. `Blokaj` dikkat sinyali her süre tikinde basılmamalı; merkez ve Özellik/Odak Dönemi `Dependencies` görünümü bu kartın feature'ı değildir.

## Solution

Her engelleme ilişkisi `Active` veya `Resolved` taşır. Aktif ilişkiler engellenen İşi planlama yüzeylerinde ayırt eder; çözülenler aktif sinyalden çıkar fakat tarihsel kalır. `Mark blocker resolved` çözüm tarihi ve isteğe bağlı not kaydeder; ilişki yeniden `Active` yapılabilir. Kaynağı kapatmak ilişkiyi çözmez, yalnız görünür bir çözüm önerisi üretebilir. `Blokaj` (`work-blocked`) yalnız yeni `Active` kurulumunda ve çözülmüş ilişkinin yeniden `Active` yapılmasında üretilir. Özellik ve Odak Dönemi tüketicileri salt-okunur `Dependencies` türetebilir; bu feature o görünümü inşa etmez.

## User Stories

1. As a founder, I want a Work to be blocked by another Work, a Decision, or an Open Question, so that the obstacle is an explicit relation rather than a status color.
2. As a founder, I want each blocking relation to be `Active` or `Resolved`, so that I can tell current wait from history.
3. As a founder looking at planning surfaces, I want Active blockers to distinguish the blocked Work, so that I can see wait without a Kanban-owned column meaning.
4. As a founder, I want Resolved relations to leave Active blocker signals but remain as history, so that I can read when the wait ended.
5. As a founder, I want `Mark blocker resolved` to record a resolution date and optional note, so that resolution is a visible act.
6. As a founder, I want to reactivate a resolved relation, so that a returned wait is the same relation rather than a silent new fact.
7. As a founder closing the source Work, Decision, or Open Question, I want the blocking relation to stay Active, so that close cannot quietly clear the wait.
8. As a founder in that situation, I want a visible suggestion to resolve, so that I can choose — not an automatic write.
9. As a founder, I want `Remove relation` reserved for a mistakenly created link, so that I do not use delete as fake resolution history.
10. As a founder, I want `work-blocked` emitted only when a new Active blocking relation is created on the blocked Work, or a resolved one is made Active again, so that duration, source status, cycle detection, or resolve do not spam.
11. As a founder, I want that signal to carry the blocked Work, the source, and the relation time, so that the notification center can group it later.
12. As a founder, I want the signal listed under `Needs Action` in the closed registry (`work-blocked`), so that this feature does not invent an unregistered id.
13. As a founder, I do not want this feature to build the Unified Notification Center, so that display and grouping stay workflow 71.
14. As a founder on Feature or Focus Period detail, I want consumers to be able to derive a read-only `Dependencies` view from these relations, so that those surfaces can show direction, Active/Resolved, and explainable cycles without this feature owning the view.
15. As a founder, I want that derived view not to create relations, a Mermaid source, manual node layout, or a second planning dataset, so that the graph stays a projection.
16. As a founder, I do not want Workspace-wide editable dependency graphs, cross-team resource planning, automatic rescheduling, or critical path, so that 19 stays closed.
17. As a founder, I do not want a blocker to be a Kanban column, a tag, or a priority score, so that those models stay distinct.
18. As a founder, I do not want GitHub PR merge or automation to silently resolve a blocker, so that only `Mark blocker resolved` (or explicit reactivate) changes relation life.
19. As a founder, I do not want adding a blocking relation to auto-set Work status to `Blocked`, so that workflow status stays a separate user (or later automation) choice.
20. As a founder, I want English UI for `Active`, `Resolved`, `Mark blocker resolved`, `Remove relation`, and `Dependencies` as a consumer label, so that the product language stays English.
21. As a founder using only a keyboard, I want to add, resolve, and reactivate a blocker, so that the Blokaj journey is possible.
22. As a founder, I want creating a blocker to be an idempotent user command, so that double submit does not mint two Active waits for the same pair.
23. As a founder, I want Roadmap's compact blocker badge to be able to read Active relations from this seam, so that Roadmap (29) can highlight source and blocked Work without owning the relation.
24. As a founder, I want a cycle that can be safely detected to be explainable to consumers without becoming a signal, so that a loop is data, not spam.
25. As a founder, I do not want blocking to write priority criteria, Backlog order, or roadmap horizon, so that wait is not a ranking.
26. As a founder, I want history of Active→Resolved→Active to remain on the same relation, so that I can read the wait's life rather than a pile of deleted links.
27. As a founder, I do not want `Blocked` workflow status to be removed from the product because relations exist, so that status and relation stay independent knobs.
28. As a founder, I want Decision or Open Question as source to use the same Active/Resolved contract as Work-to-Work, so that completing the feature is possible with Work-to-Work and consistent when those records exist.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [İş bağımlılıkları ve blokajlar](../../prd/06-work-management-and-planning.md#iş-bağımlılıkları-ve-blokajlar). Relation type is [`Engeller` / `Engellenir`](../../prd/02-domain-model-and-lifecycle.md#standart-ilişki-türleri). Signal id `work-blocked` is registered in [dikkat sinyali kayıtları](../../prd/04-workspace-and-projects.md#dikkat-sinyali-kayitlari); the center is 71. Journey: [Blokaj](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). No new ADR.
- **Glossary.** Use İş, Karar, Açık Soru, Birleşik Bildirim Merkezi. Avoid: Kanban column as blocker, tag-as-blocker, priority score, auto-resolve on close, critical path.
- **Relation life.** A Work may be blocked by Work, Decision, or Open Question. Each relation is `Active` or `Resolved`. Active distinguishes the blocked Work on planning surfaces (consumers read this; Kanban feature is not rewritten here). Resolved drops out of Active signals but remains historical.
- **Resolve and remove.** `Mark blocker resolved` records resolution date and optional note. The relation may be re-activated. Closing the source does not auto-resolve; it may offer a visible resolve suggestion only. `Remove relation` is for mistaken links, not a substitute for resolution history.
- **Status independence.** Adding a blocking relation does not by itself write Work workflow status `Blocked`. Distinguishing on planning surfaces is not a status write. (PRD 02's "blokaj exception" is this relation's own Active/Resolved life, not an implicit Work status change.)
- **Signal.** Emit `work-blocked` only for: new Active relation on the blocked Work; Resolved → Active again. Payload: blocked Work, source, relation time. Show later in the center under Needs Action, grouped by source. Do not emit on duration, source status change, cycle detection, or transition to Resolved. This feature owns emission contract; 71 owns the inbox UI.
- **Dependencies projection.** Feature and Focus Period may open an optional read-only `Dependencies` view derived only from existing Active and Resolved relations in that scope. Nodes open main records. Active/Resolved, direction, and safely detected cycles are explainable and not color-only. The view does not create relations, a separate Mermaid source, manual node positions, or second planning data. This spec defines the derivation contract; those details UIs are not delivered in this workflow.
- **Out.** No Workspace-wide editable graphs, cross-team resource planning, automatic reschedule, critical path. GitHub merge is not silent resolve.
- **English UI labels.** `Active`, `Resolved`, `Mark blocker resolved`, `Remove relation`. Consumer label `Dependencies`. Add missing labels to the term table in the same change.
- **Stack.** Existing relation persistence. No graph-database or auto-layout product.

## Testing Decisions

- **What a good test is.** Tests observe Work Blockers through its public interface: create Active relation, resolve, reactivate, close-source-without-resolve, remove-versus-resolve, and signal emission matrix. They assert history and the two emission events — not notification-center DOM.
- **Seam (one).** Work Blockers — the product-facing blocking-relation and `work-blocked` emission interface. The center and Feature/Focus Period views are adapters/consumers. Playwright for Blokaj is this seam through Work detail.
- **Modules under test.** Work Blockers only. Notification center, Kanban, GitHub, Prioritization, and Focus Period UI are counterparts.
- **Prior art.** Contract tests at this seam. Evidence: [Blokaj](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (`Gerçek proje`; relation lifecycle; source close does not auto-resolve).
- **Required counterparts.** Source close leaves relation Active; resolve is a distinct act; signals only on new Active and re-Active; GitHub merge does not resolve; Work status not auto-Blocked; no unregistered signal id.

## Out of Scope

- Blokajı Kanban sütunu, etiket veya öncelik puanı sayma.
- Üst İş kapanınca alt engelleri otomatik çözme; kaynak kapanınca sessiz çözüm.
- GitHub PR birleşmesini sessiz blokaj çözümü yapmak.
- Dikkat merkezini (71) veya `Dependencies` görünümünü bu kartın feature'ı sayma.
- Workspace-geneli düzenlenebilir bağımlılık grafiği, kritik yol, otomatik yeniden zamanlama.

## Further Notes

- **Orient.** Glossary: İş, Karar, Açık Soru, Birleşik Bildirim Merkezi. Owning PRD: `docs/prd/06-work-management-and-planning.md` (`#iş-bağımlılıkları-ve-blokajlar`). ADRs: none owning. Related: PRD 02 relation table, PRD 04 signal registry, PRD 16 Blokaj, PRD 19 (no critical path / cross-team graphs).
- **Acceptance.** Bind to [Blokaj](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). Signal appearance in the center is 71's journey (`Dikkat sinyalleri`) consuming this emission.
- **Work-to-Work is enough** to complete the feature; Decision and Open Question sources use the same contract and should be in the same tests when those records exist.
