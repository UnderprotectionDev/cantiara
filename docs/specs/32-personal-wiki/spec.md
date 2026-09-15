# Kişisel Wiki

Kaynak: [`docs/workflow/32-personal-wiki/phase-context.md`](../../workflow/32-personal-wiki/phase-context.md)

## Problem Statement

Kurucu herhangi bir Projeye ait olmak zorunda olmayan kalıcı bilgiyi—kalıplar, yaklaşımlar, hata çözümleri, öğrenimler—kaybetmeden tutmak ister. Bugün bu bilgi yanlışlıkla bir Projeye yazılır veya ikinci bir belge sistemi / paralel doğruluk kaynağı olur. Belge yazarlığı yetenekleri 31’dedir; tekil Wiki yayını 74’tedir. Bu feature sahiplik sınırıdır.

## Solution

Kişisel Wiki, Çalışma Alanındaki ayrı sahiplik kapsamıdır. Wiki Belgeleri 31’in aynı editör, sürüm, şablon, hiyerarşi, arşiv, referans ve dışa aktarma yeteneklerini kullanır; ikinci belge türü veya ikinci doğruluk kaynağı açılmaz. Wiki, kişisel erişim kabuğunda birinci sınıf hedeftir ve Proje seçmeden belge oluşturmayı destekler. `Tüm Belgeler` ve Evrensel Arama kapsam rozetiyle Proje belgelerinden ayırır; geçici görünüm onları aynı yere aitmiş gibi göstermez. Proje belgesinden Wiki’ye `Move` veya `Copy` 31’in kimlik kurallarını kullanır. Yayın 74’tür. Hiç yayımlanmamış Wiki Belgesinin ziyaretçi URL’si yoktur; canlı Wiki herkese açık kopya değildir. Unpublish `410 Gone` leak-nothing 74’ün Dış yüzey sözleşmesidir; bu kabuk canlı herkese açık kopya tutmaz.

## User Stories

1. As a founder, I want a `Personal Wiki` ownership scope for Documents that do not have to belong to a Project, so that durable personal software knowledge has a home.
2. As a founder writing there, I want the same Document capabilities as Project Documents—editor, versions, templates, hierarchy, archive, references, export—so that Wiki is not a second editor.
3. As a founder, I do not want a second Document type or a parallel source of truth beside Project Documents, so that one fact is not maintained twice by accident.
4. As a founder, I want to create a Wiki Document without selecting a Project, so that personal knowledge is not forced into a product.
5. As a founder, I want the Wiki as a first-class target in the personal access shell, so that I can open it without entering a Project.
6. As a founder using `All Documents` or `Search`, I want scope badges that distinguish Project Documents from Wiki Documents, so that a mixed result list is not a mixed ownership.
7. As a founder, I do not want a temporary view to present them as if they lived in one place, so that badge-less mixing is forbidden.
8. As a founder moving lasting knowledge out of a Project, I want `Move` into the Wiki with relations preserved under 31’s move rules, so that identity can follow the knowledge.
9. As a founder needing the same text in both contexts, I want `Copy` to create a new identity, so that two independent lives are explicit.
10. As a founder, I do not want Wiki content to auto-become a Project template, Work, or other structured record, so that personal notes stay Documents until I convert them.
11. As a founder, I want the first-product Wiki to stay personal—no team invite, collection ACL, page roles, multi-user comments, or co-editing—so that 19’s team ban holds while the data model stays collaboration-ready.
12. As a founder, I do not want a Wiki Document to be treated as the canonical product spec across all Projects, so that Project Documents remain the product’s specs.
13. As a founder, I do not want this feature to publish a Wiki page, so that 74 owns the public snapshot.
14. As a founder, I want a never-published Wiki Document to have no visitor URL, so that personal knowledge is not public until I publish through 74.
15. As a visitor (or an attacker guessing a path), I want unauthenticated reads of a live Wiki Document and its attachments from this shell to leak nothing, so that Wiki ownership stays closed-world.
16. As a founder after 74 unpublishes, I want this shell not to keep a live public copy, so that unpublish `410 Gone` leak-nothing (empty body, `noindex`, no private redirect) stays 74’s Dış yüzey contract and ADR-0002 rather than a second HTML copy here.
17. As a founder, I want English UI copy for `Personal Wiki`, so that the product language stays English.
18. As a founder using only a keyboard or a screen reader, I want to open the Wiki, create a Document without a Project, and move or copy from a Project, so that dogfooding wiki evidence is possible.
19. As a founder, I do not want this feature to reimplement Tiptap, Conflict Draft, or export; those stay Documents.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [Kişisel Wiki](../../prd/07-documents-and-knowledge.md#kişisel-wiki) and [kapsam ve sahiplik](../../prd/02-domain-model-and-lifecycle.md#kapsam-ve-sahiplik). Document capabilities are PRD 07 / workflow 31. Publishing is [tekil Wiki yayını](../../prd/14-sharing-and-public-publishing.md#tekil-wiki-belgesi-yayınlama) / workflow 74. Unpublish leak-nothing is the [ortak snapshot ve dış görünürlük güvenliği](../../prd/14-sharing-and-public-publishing.md#ortak-snapshot-ve-dis-gorunurluk-guvenligi) contract plus [ADR-0002](../../adr/0002-dis-erisim-guvenlik-siniri.md); this feature does not own the Dış yüzey response. Search badges are consumed from Record Discovery without this feature owning the index. No new ADR.
- **Glossary.** Use Kişisel Wiki (`Personal Wiki`), Belge, Çalışma Alanı, Proje. Do not introduce second document system, team wiki, or live public wiki copy. Wiki Belgesi is a Document in Wiki scope, not a new main-record type.
- **Ownership.** Closed list already includes Personal Wiki. Every Wiki Document has exactly that scope. File Attachments under a Wiki Document are Wiki-scoped (14). This feature provides the Wiki shell: entry without Project, create-in-wiki, and refusing to treat Wiki as a Project.
- **Reuse.** All authoring commands call the Documents seam with Wiki scope. Templates, hierarchy, archive, Conflict Draft, and single-document export work here because 31 already allows Project or Wiki scope. This feature’s tests prove the boundary, not a second editor.
- **Discovery honesty.** `All Documents` and Search may return both; each row carries a scope badge. UI must not collapse them into one implied home.
- **Move/copy.** Delegate to 31’s `Move`/`Copy`. Wiki is a valid target scope. Auto-conversion to Work/template is forbidden.
- **Not publishing.** No External Surface, snapshot, public slug, or visitor HTML here. A never-published Wiki Document has no visitor URL. Live Wiki is not a public copy. Unpublish `410 Gone` (empty body, `noindex`, no private redirect, no URL reuse) is workflow 74 and ADR-0002. This feature’s counterpart: founder-session reads only; this shell must not serve Wiki body or attachment bytes to an unauthenticated GET, must not keep a live public copy after 74 revokes, and must not reopen a revoked URL.
- **English UI labels.** `Personal Wiki`. Missing labels join the PRD term table in the same change that first shows them. No Turkish UI.

## Testing Decisions

- **What a good test is.** Tests observe Personal Wiki through its public interface: create without Project, scope badge distinction, move/copy into Wiki, same Documents capabilities available in Wiki scope, no second type, no publish command, never-published Wiki has no visitor URL, unauthenticated GET from this shell leaks nothing. They do not re-test Tiptap internals or 74’s `410 Gone` HTML. Expected values are product rules (Wiki ≠ Project; one capability module; not a parallel spec; live Wiki is not a public copy).
- **Seam (one).** Personal Wiki — the ownership-boundary and Wiki-shell interface that calls Documents. Documents, Record Discovery, and Wiki publishing are counterparts, not this module.
- **Modules under test.** Personal Wiki only. Publishing, team ACL, and Project Document authoring internals are out except as counterparts.
- **Prior art.** Contract tests at this seam using the Documents test double. Evidence environment for [Dogfooding](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) wiki evidence (real personal software knowledge, not Cantiara PRDs) and [Belge bütünlüğü](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) move/archive in Wiki scope. Cloud tests must not use production content.
- **Required counterparts.** Create-without-Project does not assign a Project; mixed lists always badge; Wiki Document is not a new type; publish/unpublish action absent; never-published Wiki has no visitor URL; unauthenticated GET of live Wiki from this shell leaks nothing; this shell keeps no live public copy after 74 unpublish; Wiki text is not auto-canonical for all Projects; team invite, page roles, and co-editing absent.

## Out of Scope

- Kişisel Wiki’yi proje belgeleri veya ikinci belge sistemi sayma.
- Wiki kaydını bütün Projelerde kanonik ürün spec’i yapmak.
- Tekil Wiki yayınını canlı Wiki kopyası sayma; yayın 74.
- Unpublish `410 Gone` yanıtını burada yeniden kartlaştırma; leak-nothing Dış yüzey 74’tedir.
- Ekip daveti, sayfa rolü, ortak düzenleme.
- Tiptap, Conflict Draft, Dosya Eki yükleme veya evrensel arama indeksini burada yeniden kurma.

## Further Notes

- **Orient.** Glossary: Kişisel Wiki. Owning PRD: `docs/prd/07-documents-and-knowledge.md` (Kişisel Wiki) and PRD 02 ownership. ADRs in play: 0002 (unauthenticated Wiki GET is not a visitor surface from this shell; the `410 Gone` response itself is 74). 0021 already via Documents. Related but not owning: workflow 31 (capabilities), 33 (search badges), 72 (shell entry), 74 (publish and unpublish `410 Gone`), PRD 14 (ortak snapshot), PRD 16 (Dogfooding wiki evidence, Belge bütünlüğü), PRD 19 (team wiki yok).
- **Acceptance.** Bind to [Dogfooding](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (real personal software-knowledge Wiki: folder, hierarchy, template, archive restore, version compare, relation/attachment, export) and [Belge bütünlüğü](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) for Wiki-scoped move. Publishing is not this journey. Live-Wiki-is-not-public and never-published leak-nothing are 19-class counterparts on Dogfooding; unpublish `410 Gone` empty-body is [Herkese açık yayın](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) via 74.
- **Consumers.** Workflow `31-documents` supplies capabilities. Workflow `74-wiki-publishing` publishes one Wiki Document later. Workflow `33-record-discovery` must badge scope, not merge homes.
