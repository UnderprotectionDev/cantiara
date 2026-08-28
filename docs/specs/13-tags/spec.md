# Etiketler

Kaynak: [`docs/workflow/13-tags/phase-context.md`](../../workflow/13-tags/phase-context.md)

## Problem Statement

Kurucu içerikleri Proje alanından bağımsız sınıflandırıp aynı kimlikle süzmek, aramak ve taşımak ister. Bugün Çalışma Alanı genelinde tek etiket ad alanı yoktur; görünen ada göre ikinci sözlük, Proje-yerel etiket veya Belge içi `#etiket` tokenı ayrı bir sözlük gibi davranabilir. Yeniden adlandırma kullanımları atomik güncellemezse filtre, Akıllı Koleksiyon koşulu ve export sessizce ayrışır. Klasör, Akıllı Koleksiyon, ilişki türü ve Kanıt bağı bu sınıflandırmanın yerine geçmez.

## Solution

Kurucu tek Çalışma Alanı etiket ad alanında düz etiket oluşturur, kayıtlara uygular ve kaldırır. Etiket kimliği sınıflandırmayı taşır; içeriği taşımaz. Yeniden adlandırma bütün yapılandırılmış alanları ve aynı kimliğe bağlı inline kullanımları tek atomik işlemde günceller. Proje seçicisi sık kullanılanları önce önerebilir; bu öneri kapsamı değiştirmez. Belge gövdesindeki `#etiket` tokenı Belge feature'ının sözdizimidir; bu feature ikinci bir etiket sözlüğü açmaz.

## User Stories

1. As a founder, I want one workspace-wide tag namespace, so that the same visible name never becomes a second Workspace identity or a Project-local dictionary.
2. As a founder, I want to create a flat tag and apply it to records I can reach, so that classification is independent of Project area and folder location.
3. As a founder, I want to remove a tag from a record without deleting the tag identity, so that untagging is not destruction of the dictionary.
4. As a founder typing in a Project tag picker, I want frequently used tags in that Project suggested first, so that picking is faster without changing the tag's Workspace scope.
5. As a founder, I want filters, search, and Smart Collection conditions to match the same tag identity, so that a renamed tag does not silently split my saved views.
6. As a founder, I want `/` in a tag name to stay literal text, so that I never get a parent/child hierarchy, inherited scope, or nested dictionary.
7. As a founder classifying overlapping meanings, I want to apply several flat tags rather than a tree, so that intersection stays explicit.
8. As a founder who needs Project-only structured classification, I want to use a Project custom field instead of a second tag namespace, so that tags stay the Workspace dictionary.
9. As a founder renaming a tag, I want every structured field use to update in one atomic operation, so that no filter still points at the old display name as a different identity.
10. As a founder renaming a tag, I want inline uses of that same identity in Markdown Documents to update in the same atomic operation and to create a versioned Document change with safe undo, so that the body and the dictionary cannot diverge.
11. As a founder whose rename fails, I want no partial update across records or Document bodies, so that a mid-flight error cannot leave two live names for one identity.
12. As a founder exporting Markdown, I want inline `#etiket` text preserved while the manifest carries the canonical identity mapping, so that portability does not invent copy identities.
13. As a founder importing recognized inline tags, I want an explicit preview that maps them to an existing tag or a new flat candidate, so that import never silently mints a duplicate identity.
14. As a founder filtering Documents by a tag, I want to open the source at the matching location after the Documents feature resolves the token, so that the tag identity is enough without this feature parsing Markdown.
15. As a founder, I want applying a tag not to create a relation type, folder, Smart Collection membership, or evidence link, so that classification stays classification.
16. As a founder, I want a tag identity to survive the record's title or Project name changing, so that classification is not a copy of content.
17. As a founder, I want English UI copy for `Tags`, `Rename Tag`, and the picker, so that the product language stays English.
18. As a founder using only a keyboard or a screen reader, I want to create, apply, remove, filter by, and rename a tag, so that the closed accessibility journey “Proje gezinme ve arama” can use this dictionary.
19. As a founder, I do not want a Project-local tag dictionary or a second Document-local tag system, so that `#etiket` tokens remain the Documents feature's syntax over this same identity.
20. As a founder, I do not want this feature to own Document editor tokenization, fenced-code exceptions, or line-context presentation, so that workflow 31 remains the token owner.
21. As a founder, I do not want two-tag merge, archive, or usage-suggestion maintenance in the first product, so that advanced tag care stays the [future direction](../../prd/18-future-directions.md#gelismis-etiket-bakimi).
22. As a founder, I do not want tags treated as folders, Smart Collections, Kanban order, or Favorites, so that those membership models stay distinct.
23. As a founder, I do not want an evidence role or provenance to be inferred from a shared tag, so that Kanıt bağı remains an explicit relation elsewhere.
24. As a founder, I do not want a public Status Label or a Theme object to be stored as a Workspace tag, so that visitor presentation and design taxonomy cannot hijack this dictionary.
25. As a founder, I do not want this feature to implement Universal Search, Smart Collections, or import/export UI, so that those journeys consume tag identity without relocating this namespace.
26. As a founder attaching a tag to Work, a Document, and a Decision, I want the same identity to apply across record types in the Workspace, so that classification is not type-local.
27. As a founder deleting an unused tag identity, I want that delete to follow Workspace configuration trash rather than a second trash policy, so that tags are not a lifecycle fork.
28. As a founder, I want applying a tag not to change Work status, Archive, or share/publish scope, so that classification is not a hidden mutation of life-cycle or visibility.
29. As a founder, I do not want AI auto-tagging or theme detection from body text, so that 19 stays closed.
30. As a founder, I want rename undo to restore structured and inline uses together when the Document change is still safely invertible, so that undo cannot split the dictionary again.
31. As a founder, I do not want `/` auto-creating parent tags when I type a path-like name, so that a Linear-style hierarchy cannot sneak in.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [Etiketler](../../prd/08-search-relations-and-evidence.md#etiketler). Scope is [kapsam ve sahiplik](../../prd/02-domain-model-and-lifecycle.md#kapsam-ve-sahiplik) (`Çalışma alanı` holds the Workspace-wide Etiket). Project-only structured classification is [Proje bazlı özel alanlar](../../prd/08-search-relations-and-evidence.md#proje-bazlı-özel-alanlar). Advanced merge/archive/suggestions stay in [Gelişmiş etiket bakımı](../../prd/18-future-directions.md#gelismis-etiket-bakimi). No new ADR: the surprising boundary (one Workspace dictionary, not a file-sync taxonomy) is already implied by [ADR-0021](../../adr/0021-icerigi-yalniz-veritabaninda-tut.md) and the search PRD.
- **Glossary.** Use Etiket, Çalışma Alanı, Proje bazlı özel alan, Akıllı Koleksiyon, Belge, Kanıt bağı. Do not introduce tag hierarchy, Project-local tag, Document-local tag, collection, or theme-as-tag. Inline `#etiket` is not a second term; it is the Documents feature's token over this identity.
- **Namespace.** First product has exactly one Workspace-wide primary tag namespace. The same visible name does not mint a second Workspace identity or a Project-local identity. The picker may rank tags used often in the current Project first; ranking is personal suggestion, not scope.
- **Flat names.** Tags stay a flat namespace. `/` does not create parent/child, scope, or inheritance. Overlap is several flat tags. Project-only structured classification uses custom fields, not a second tag dictionary.
- **Identity versus content.** Tag identity carries classification. It does not copy record content, change ownership, or move a record between Projects. Applying or removing a tag is not a relation type, folder membership, Smart Collection membership, Favorite, or evidence link.
- **Apply and remove.** Founder can create a tag, attach it to reachable records, and detach it. Detach does not delete the identity. Delete of an unused identity is ordinary Workspace configuration trash if the product already has that lifecycle for configuration; this feature must not invent a second trash policy.
- **Atomic rename.** Rename updates every structured-field use and every inline use of the same identity in one atomic operation. Affected Documents gain a versioned change with safe undo. Failure leaves no mixed old/new display names. Rename is identity-preserving: the dictionary entry stays one identity; the display name changes. Two-tag consolidation (retire one identity into another) is not first-product.
- **Conflict note.** Phase-context Tamamlanma lists “birleştirme”; [Etiketler](../../prd/08-search-relations-and-evidence.md#etiketler) and [Gelişmiş etiket bakımı](../../prd/18-future-directions.md#gelismis-etiket-bakimi) win: first product atomically updates all uses of one identity (`Rename Tag`). Two-tag consolidation is PRD 18, not this feature.
- **Documents token boundary.** Workflow 31 owns `#etiket` tokenization: paragraph/heading/list versus fenced or inline code, URL fragments, and escaped plain text. This feature does not parse a second dictionary. Rename here still updates those resolved uses because [Etiketler](../../prd/08-search-relations-and-evidence.md#etiketler) requires structured and inline uses to move together. Document filter line-context UI belongs to 31; this feature only guarantees the identity those tokens bind to.
- **Consumers.** Universal Search, Smart Collection conditions, and saved filters match tag identity, not a frozen display string. This feature does not build those surfaces. Markdown export keeps inline `#etiket` text and puts identity mapping in the manifest; import preview maps recognized tokens to an existing tag or a new flat candidate and never silently mints a copy identity. Export/import UI stays in portability features; this feature supplies the mapping contract.
- **English UI labels.** First user-visible copy uses `Tags`, `Rename Tag`, and picker empty/suggestion copy in English. Missing labels are added to the PRD term table in the same change that first shows them. No Turkish UI.
- **Stack.** Persistence is PostgreSQL via Prisma; search consumers may use `pg_trgm` but this feature does not own ranking. No new framework.

## Testing Decisions

- **What a good test is.** Tests observe Tags through its public interface: create, apply, detach, picker suggestion order, atomic rename, identity filter after rename, and import preview mapping. They assert product rules (one Workspace identity per visible name, `/` is not hierarchy, rename is all-or-nothing, Document tokens are not a second dictionary, saved/import consumers match identity not a frozen display name) rather than row shapes or Markdown parser internals.
- **Seam (one).** Tags — the product-facing Workspace tag-namespace interface used by record pickers and by later search, Smart Collection, Document-token, and portability consumers. Playwright for “Proje gezinme ve arama” is the same seam observed through the UI, not a second module.
- **Modules under test.** Tags only. Universal Search, Smart Collections, Documents tokenization, import/export, and custom fields are present only as “this identity is what they would consume / this command is not a second dictionary” counterparts.
- **Prior art.** Contract tests at this seam. Evidence environment is [Arama ve ilişki](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (`Her ikisi`). Cloud tests must not use production content.
- **Required counterparts.** No Project-local tag identity; rename failure leaves mixed names; `/` does not nest; applying a tag does not create a relation or evidence link; `#etiket` editor rules are absent here (31); two-tag merge/archive UI is absent; Universal Search / Smart Collection / import UI are absent; Document line-context UI is absent; import preview never silently mints a copy identity.

## Out of Scope

- Proje-yerel etiket ad alanı; Belge-yerel ikinci sözlük; `#etiket` yazım/ayrıştırma ve satır bağlamı UI'si (31).
- İki etiket kimliğini birleştirme, arşivleme ve kullanım önerileri ([gelişmiş etiket bakımı](../../prd/18-future-directions.md#gelismis-etiket-bakimi)).
- Etiketi klasör, Akıllı Koleksiyon, Favori, Kanban sırası, ilişki türü veya Kanıt bağı sayma.
- Evrensel Arama, Akıllı Koleksiyon, içe/dışa aktarma ve özel alan yüzeylerini burada inşa etme.
- Etiket hiyerarşisi, Theme nesnesi, herkese açık durum etiketi, otomatik sınıflandırma.

## Further Notes

- **Orient.** Glossary: Etiket, Çalışma Alanı, Proje bazlı özel alan, Akıllı Koleksiyon, Belge, Kanıt bağı. Owning PRD: `docs/prd/08-search-relations-and-evidence.md` (`#etiketler`). ADRs in play: none owning; 0021 (no live filesystem taxonomy). Related: PRD 02 (scope), PRD 07 (Documents consume the identity), PRD 13/portability (manifest mapping), PRD 16 (Arama ve ilişki), PRD 18 (merge/archive), PRD 19 (no Belge Koleksiyonu as a fifth membership).
- **Acceptance.** Bind to [Arama ve ilişki](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). Closed a11y journey **Proje gezinme ve arama**. Negative 19-class counterparts: no Project-local dictionary, no hierarchy, no second Document tag system.
- **Workflow 31.** Documents own token syntax. This namespace is the only dictionary those tokens may bind.
