# Kayıt Keşfi

Kaynak: [`docs/workflow/33-record-discovery/phase-context.md`](../../workflow/33-record-discovery/phase-context.md)

## Problem Statement

Kurucu yetkili ana kayıtları, Belgeleri ve Dosya Eki üstverisini deterministik tam metinle, neden bulunduğunu görerek yerinde bulmak ister. Bugün arama AI sıralar, Taslak/yakalama/dış yüzey/secret indekslenir, Komut Paleti ile tek yüzey sanılır, önizleme ikinci kayıt olur, hazır dizin kurulumsuz değildir veya tablo satırı ayrı sistem olur. Akıllı Koleksiyon üyeliği ve palet komutları bu sorunun parçası değildir.

## Solution

Evrensel Arama yetkili ana kayıtları kapalı eşitlik-bozucu sırayla bulur; eşleşme bağlamı görünürdür. Taslak, Yakalama öğesi, Dış yüzey, GitHub dış kaydı ve secret dizinlenmez. Hazır tür dizinleri sıfır kurulumla gezer. Tür-kapsamlı Table, izinli türlerde aynı ana kayda inline yazar. Desteklenen yüzeylerden geçici önizleme kaynak bağlamını korur. Filtrelenmiş aramayı koleksiyon olarak kaydetmek 34’ün oluşturma eylemidir; bu feature komutu açar, üyeliği tanımlamaz.

## User Stories

1. As a founder, I want `Search` to find authorized main records with deterministic full-text order and visible match context, so that I know why a hit appeared.
2. As a founder, I want Document bodies and File Attachment metadata in that same authorized set, so that knowledge is not a separate library.
3. As a founder, I do not want AI, learned, click-history, or semantic ranking, so that the six-step tie-break table is the only order.
4. As a founder, I want title/key matches before body, current Project before others, active before closed, `Completed` before `Abandoned`, then recency, then stable id, so that repeats of the same query are identical.
5. As a founder, I want archived records only with an explicit archive filter, and never Trash or unauthorized records, so that search cannot leak or resurrect.
6. As a founder, I want result badges for type, status, closure outcome if any, and scope, so that I can tell what I found.
7. As a founder, I want a short match snippet, term highlight, and match count from an indexed source I can access, so that badges say what it is and the snippet says why.
8. As a founder opening a hit, I want to land on the match location when the type supports it, so that I am not dumped at the top of a long Document without explanation when location is unsupported.
9. As a founder, I do not want Drafts, Capture Inbox items, External Surfaces, or GitHub external records in Search, so that temporary and visitor surfaces stay on their own screens.
10. As a founder, I do not want secrets, share tokens, or link passwords indexed, so that discovery cannot become a secret oracle.
11. As a founder, I want limited operators that match visible filters, with autocomplete into filter chips, so that power users are not given a hidden query language.
12. As a founder, I want to save a filtered search via `Save as Smart Collection` after a readable preview and a name, so that a temporary search does not become a collection by itself—and membership lives in 34.
13. As a founder, I do not want Search to be the Command Palette, so that commands and records stay two surfaces.
14. As a founder, I want zero-setup indexes such as `All Work`, `All Documents`, `All Decisions`, `All Risks`, `All Research Sessions`, `All Tests`, `All Designs`, `All Technical Diagrams`, `All Project Releases`, `All Sources`, and `All Files`, so that I can browse a type without building a collection.
15. As a founder, I want those indexes to collect existing main records of that type only—no stored query—and to keep each record in its Project or Wiki scope, so that an index is not a new ownership. Document and File Attachment indexes browse by scope, type, folder, and supported metadata on that same prepared surface; folder is not a second library and not a replacement for Search.
16. As a founder, I want `All Files` to show each File Attachment once, with older versions in the attachment’s history, so that indexes are not version spam.
17. As a founder, I want type-scoped `Table` with inline cell edit only for types the closed matrix allows, so that Documents are searchable but not table-edited, and screens/diagrams/attachments are not Smart Collection sources.
18. As a founder pasting multiple rows, I want column mapping and an all-or-nothing apply, so that Table is not a silent spreadsheet sync.
19. As a founder, I want in-context preview from Kanban, Unified Calendar, Roadmap, Scope Tree, Smart Collection, and Notification Center via the same `Open source record` defaulting to a temporary side panel, so that I can read without losing my place.
20. As a founder, I want `Open full page` for deep work, and I do not want the panel or its inner navigation restored as recent-context, so that preview is not a layout.
21. As a founder, I do not want a mandatory side panel on every record type, so that preview stays opt-in per supported surface.
22. As a founder, I want English UI copy for `Search`, the `All …` indexes, `Table`, `Open source record`, and `Open full page`, so that the product language stays English.
23. As a founder using only a keyboard or a screen reader, I want to search, filter, open a hit, use an index, edit an allowed table cell, and preview, so that Arama ve ilişki is possible without a pointer-only palette.
24. As a founder, I do not want this feature to own Smart Collection membership rules, custom-field schemas, or Command Palette actions.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [Evrensel Arama](../../prd/08-search-relations-and-evidence.md#evrensel-arama), [çalışma alanı genelindeki hazır tür dizinleri](../../prd/08-search-relations-and-evidence.md#çalışma-alanı-genelindeki-hazır-tür-dizinleri), [tür-kapsamlı Table görünümü](../../prd/08-search-relations-and-evidence.md#tür-kapsamlı-table-görünümü), and [bağlam içi kayıt önizleme](../../prd/08-search-relations-and-evidence.md#bağlam-içi-kayıt-önizleme). Secret-not-in-search is the security/portability secret rule. Free advanced query language ban is [PRD 19](../../prd/19-out-of-scope.md). Command Palette is [PRD 04](../../prd/04-workspace-and-projects.md#komut-paleti-ve-klavye-odaklı-kullanım) / workflow 05. Stack: `pg_trgm` and TanStack Table as adapters behind this seam, not ranking policy. No new ADR.
- **Glossary.** Use Evrensel Arama (`Search`), Kayıt Keşfi, Taslak, Yakalama Gelen Kutusu öğesi, Dış yüzey, Komut Paleti (not this), Akıllı Koleksiyon (save action hands off to 34), Tablo Görünümü (`Table`). Do not introduce AI search, semantic rank, or a second document library.
- **Ranking.** Apply the PRD’s closed tie-break table in order. No extra signal. User-visible filters may override default order with explicit date/text sorts. Live results as query/filter change; that state is temporary until saved as a collection via 34.
- **Index exclusions.** Not indexed: Capture items, Drafts, External Surfaces, GitHub external records, secrets, share tokens, link passwords, generated SQL bodies (diagrams). Generated Migration Artifact user-facing names may be found via the owning Technical Diagram, not as independent hits.
- **Indexes.** Zero-setup, type selector, not per-type main nav. Archive stays findable with filter; not treated as deleted. `All Tests` and `All Technical Diagrams` distinguish subtypes/authority modes as in the PRD. Document and File Attachment indexes use the same prepared surface with scope, type, folder, and supported metadata; folder is navigation, not ownership, and does not replace Universal Search.
- **Table matrix.** Honor the closed type × surface matrix. Inline edit is not bulk edit (22). Session Test results are not written from the cell except via the test-correction event owned elsewhere.
- **Preview.** Same `Open source record` on Kanban, Calendar, Roadmap, Scope Tree, Smart Collection, Notification Center. Default temporary panel; `Open full page` for deep work. No copy, no persisted panel layout.
- **Save as collection.** Preview conditions + name, then 34 creates the Smart Collection. This feature must not store membership.
- **English UI labels.** `Search`, `All Work`, `All Documents`, `All Decisions`, `All Risks`, `All Research Sessions`, `All Tests`, `All Designs`, `All Technical Diagrams`, `All Project Releases`, `All Sources`, `All Files`, `Table`, `Open source record`, `Open full page`, `Save as Smart Collection`. Missing labels join the PRD term table in the same change that first shows them. No Turkish UI.

## Testing Decisions

- **What a good test is.** Tests observe Record Discovery through its public interface: query order, snippet, exclusions, indexes, table inline apply, preview without copy. They do not assert `pg_trgm` operator names or index DDL. Expected values are product rules (deterministic order, no AI, no secrets, Drafts absent).
- **Seam (one).** Record Discovery — search, prepared type indexes, type-scoped table, and in-context preview. Command Palette, Smart Collection membership, Documents authoring, and tag dictionary are counterparts, not this module.
- **Modules under test.** Record Discovery only. Palette commands, collection condition builder, and custom-field schema are out except as counterparts.
- **Prior art.** Contract tests at this seam with an index fixture that includes authorized and unauthorized records. Evidence environment for [Arama ve ilişki](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) is both real project and synthetic authorization counterparts. Cloud tests must not use production sessions, tokens, or private user content.
- **Required counterparts.** Draft/capture/external/secret absent; unauthorized Workspace cannot see names or counts; ranking ignores click history; Search ≠ Palette; folder browse on Document/File indexes does not replace Search; table disallowed types have no table; inline edit is not bulk edit; preview creates no record and is not a mandatory side panel; save-as-collection does not itself store members.

## Out of Scope

- Anlamsal/AI sıralama veya gizli kişiselleştirme.
- Taslak, Yakalama öğesi, Dış yüzey snapshot'ı veya GitHub dış kaydını dizinleme.
- Secret, paylaşım token'ı veya bağlantı parolasını arama gerçeğine alma.
- Aramayı Komut Paleti ile tek yüzey sayma.
- Belge hiyerarşisini evrensel aramanın yerine koyma.
- Önizlemeyi ikinci kayıt veya düzenleme oturumu sayma.
- Paneli açık bırakıp kalıcı yerleşim kaydetme.
- Bütün kayıt türleri için zorunlu yan panel dayatma.
- Dizini ana menü başına tek tablo veya ayrı sahiplik kapsamı sayma.
- Kurulum gerektiren görünümü hazır dizin yerine koyma.
- Arşiv kayıtlarını dizinden düşürme veya silinmiş sayma.
- Tablo satırını ayrı kayıt veya dış spreadsheet senkronu sayma.
- Inline düzenlemeyi toplu eylemin yerine koyma.
- Türü desteklenmeyen kayıtlara tablo dayatma.
- Akıllı Koleksiyon üyelik koşullarını burada tanımlama; özel alan şeması (10).

## Further Notes

- **Orient.** Glossary: Evrensel Arama, Kayıt Keşfi. Owning PRD: `docs/prd/08-search-relations-and-evidence.md` (arama, dizinler, Table, önizleme). ADRs in play: none. Related but not owning: workflow 05 (palette), 10 (custom fields as filterable values), 13 (tags as filters), 14 (attachment bytes), 31 (Document body), 34 (collections), PRD 16 (Arama ve ilişki), PRD 19 (serbest sorgu dili yok).
- **Acceptance.** Bind to [Arama ve ilişki](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (both: results and counts only from accessible exact sources). Custom-field Lookup/Formula absence is 10’s matrix on the same journey. Palette is a different journey.
- **Consumers.** Workflow `05-command-palette` must not become this index. Workflow `34-smart-collections` receives `Save as Smart Collection`. Workflow `32-personal-wiki` requires scope badges on mixed hits.
