# Kanıt İlişkileri ve Kanıt Akışı

Kaynak: [`docs/workflow/45-evidence/phase-context.md`](../../workflow/45-evidence/phase-context.md)

## Problem Statement

Kurucu kesin kaynak veya Belge sürümünü bir iddiaya bağlamak ister. `İlgili` kanıt sayılırsa provenance kaybolur; pin yeni sürüme kayarsa alıntı yalan söyler; rol yorumla karışırsa “çelişiyor” bir skor olur. Akış açık bağların dışında satır uydurmamalıdır. Hedefe katkı Karar/kanıt/testi Hedefe doğrudan bağlamaz. Kaynak tazeliği (44) ve araştırma dönüşümü (43) bu bağı kullanır, burada yeniden tanımlamaz.

## Solution

`Kanıtı` / `Kanıt sağlar` açık ilişkidir. Metin aralığı kesin Kaynak, Belge, Diyagram veya Dosya Eki sürümüne pinlenir; yeni sürüm eski pin’i geçersiz kılmaz. Rol `Supporting`, `Contradicting`, `Provides context`, `Inconclusive` veya `Unspecified`; kurucu yorumu rolden ayrıdır. Kanıt Akışı yalnız bu açık bağları zaman sırasıyla gösterir. Sahipli bileşen kökeni `Origin Location` taşır; kırık öğe sessizce kaymaz.

## User Stories

1. As a founder, I want to bind a selected text range as evidence to an existing Work, Decision, Risk, Assumption, or Open Question, with preview of target, exact source version, range, and relation, so that the source text stays in place.
2. As a founder, I want the same range bindable to several targets with different roles, so that one capture can support one claim and contradict another.
3. As a founder, I want the pin to keep version id, range, and limited surrounding text, so that the quote remains readable on that version.
4. As a founder, I want a new source version not to move the pin silently; old evidence stays readable, “newer version exists” is visible, and rebind is an explicit preview.
5. As a founder, I want redaction to close content access while keeping that a historical bind existed and why.
6. As a founder, I want `Convert to new record and bind` from selected text to create exactly one Work, Decision, Risk, Assumption, or Open Question after preview, without AI or multi-create.
7. As a founder, I want optional Kanıt Rolü `Supporting`, `Contradicting`, `Provides context`, or `Inconclusive`, with missing role shown `Unspecified` and not blocking the bind.
8. As a founder, I want role to live on the relation, not on the Source, and not copy to other relations.
9. As a founder, I want only I to set, change, or clear role, with actor and time in history, not as an objective truth score.
10. As a founder, I want the product not to infer role from text, not to reinterpret role on a new Source version, and not to spawn Decision/Risk/Work/notification from `Contradicting`.
11. As a founder, I want optional `Founder interpretation` on the relation, separate from source text, with author/time; edits keep previous values in relation history; not an Insight record.
12. As a founder, I want Feedback’s Kanıt niteliği, interpretation, and role to stay three distinct metadatas that do not derive from each other (47 owns niteliği fields).
13. As a founder, I want a target’s evidence surface to group/filter by role with counts that open the exact accessible relation set, without a majority score or suggested decision.
14. As a founder, I want Evidence Flow on Work, Decision, and Assumption detail to show only explicit `Kanıtı` items in time order, filterable by source type, mixing neither event time, relation time, role, interpretation, nor source life.
15. As a founder, I want each flow row to open the exact source record or version.
16. As a founder, I want `İlgili`, text similarity, same tag, same Contact/Company, or merely sharing a Work context not to put a row in Evidence Flow.
17. As a founder, I want the flow not to invent theme, Insight, summary, relation, Work, Decision, priority, or strength.
18. As a founder, I want sorting/filtering the flow not to write source, relation, or target life, and not to create a stored flow snapshot.
19. As a founder, I want archived sources visible as archived; Trash, permanently deleted, redacted, or inaccessible sources to use safe broken-reference presentation without leaking content.
20. As a founder, I want owned-component origin (checklist item, Wireframe node, Session Test, research note component) to store `Origin Location` (owner id, component id, exact version) that does not silently retarget when the component is gone (`Source element no longer exists`).
21. As a founder, I want `Contributes to Goal` not to treat Decision, evidence, or test as Goal membership (37).
22. As a founder, I want English UI `Evidence Flow`, `Supporting`, `Contradicting`, `Provides context`, `Inconclusive`, `Unspecified`, `Bind as evidence to existing record`, `Convert to new record and bind`, `Origin Location`, `Version-pinned evidence`, `Newer version exists`, `Open source record`, `Source element no longer exists`.
23. As a founder using only a keyboard or a screen reader, I want to bind, set role, and walk Evidence Flow (PRD 15: flow is not visual-only).
24. As a founder, I do not want this feature to own Source recheck (44), Research Session convert UI beyond calling this pin (43), or Feedback feed (47).
25. As a consuming Work Context Card (16), I want to display these relations live without copying bodies.

## Implementation Decisions

- **Owning documents.** Relation and flow: [Kanıt Rolü](../../prd/08-search-relations-and-evidence.md#kanit-rolu-ve-iliski-ustverisi), [Kanıt Akışı](../../prd/08-search-relations-and-evidence.md#kanıt-akışı). Pin: [sürüme sabitlenmiş metin](../../prd/07-documents-and-knowledge.md#sürüme-sabitlenmiş-metin-parçası-kanıtı). Catalog: [standart ilişki türleri](../../prd/02-domain-model-and-lifecycle.md#standart-ilişki-türleri), [Köken konumu](../../prd/02-domain-model-and-lifecycle.md#koken-konumu), [kırık referans](../../prd/02-domain-model-and-lifecycle.md#kirik-referans-sunumu). Accessibility of flow: [PRD 15](../../prd/15-product-quality.md#erisilebilirlik). Journey: [Kanıt akışı](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). No new ADR. ADR-0007 is test-report trust — not this bind.
- **Glossary.** Use Kanıt bağı, Köken konumu, Kökeni, Hedefe katkı (not this relation), İlgili (not evidence). Avoid auto validation, social timeline, notification feed.
- **Evidence module.** Bind-to-existing uses the full PRD 02 `Kanıtı` / `Kanıt sağlar` ends: exact Source/Document/Diagram version, Feedback, Research Session, Validation Record, Session Test, or File Attachment version → Work/Decision/Risk/Assumption/Question/Test/Project Release or Access/Outcome observation. Convert-to-new-record creates exactly one Work, Decision, Risk, Assumption, or Open Question (stories 1 and 6); it does not mint Test, Project Release, or an observation as the new record. Pin API used by 43/44 rebind. Role + interpretation on the relation helper entity.
- **Flow.** Derived view on Work, Decision, Assumption. Closed inclusion: explicit Kanıtı only. Observation-targeted binds stay on that observation, not the parent Release’s general evidence.
- **English UI labels.** As in stories plus `Origin Location` (already in term table). Ticket 01 also shows `Version-pinned evidence`, `Newer version exists`, `Open source record`, and `Source element no longer exists`. Add others when first shown.
- **Consumers.** 16 Work Context displays. 37 must not use this as Contributes to Goal. 44 calls rebind. 43 calls pin+convert.

## Testing Decisions

- **What a good test is.** Tests observe Evidence through bind, pin, role/comment, and Evidence Flow listing. They go red if `İlgili` appears in the flow, if a pin slides to a newer version, if role is inferred, or if Contradicting auto-opens a Decision. Expected roles are the closed catalog, not a classifier score.
- **Seam (one).** Evidence — bind, pin, role/comment, flow listing, origin location. Source fetch and session notes are other seams called here.
- **Modules under test.** Evidence only. Work Context Card, Goals, Sources, and Research Sessions are consumers/counterparts.
- **Prior art.** First contract tests at this seam. Journey: [Kanıt akışı](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) — role matrix, origin ends, Origin Location tombstone, redaction/access counterparts. Hedefe katkı must not bind Decision/evidence/test directly.
- **Required counterparts.** İlgili not in flow; pin stays on exact version; role not inferred; Contradicting does not auto-open Decision; flow does not invent rows; Origin Location does not retarget.

## Out of Scope

- Kaynak yeniden kontrol ve aday snapshot (44).
- Araştırma oturumu izin/not UI (43); yalnız pin/convert API.
- Geri Bildirim niteliği alanları ve feed (47).
- İş Bağlam Kartı düzeni (16), Değer Zinciri (67).
- Bildirim feed’i, sosyal zaman tüneli, otomatik doğrulama.

## Further Notes

- **Orient.** Glossary: Kanıt bağı, Köken konumu, Hedefe katkı. Owning PRD: 08 Kanıt Rolü ve Kanıt Akışı, 07 pin, 02 relations/origin. ADRs: none owning (0007 not this). Journey: Kanıt akışı.
- **Acceptance.** Bind to [Kanıt akışı](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
