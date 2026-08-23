# İlişkiler ve Geri Bağlantılar

Kaynak: [`docs/workflow/12-relations/phase-context.md`](../../workflow/12-relations/phase-context.md)

## Problem Statement

Kurucu ana kayıtları kapalı tür kataloğuyla açıkça bağlamak, gömülü kullanımları ayrı izlemek ve bir kaydın nerede kullanıldığını kaydın kendisinden okumak ister. Bugün iskelette ilişki grafiği yoktur; belirsiz “ilgili” yığını, otomatik grafik çıkarımı veya kullanımın standart ilişki sayılması riski vardır. Kanıt bağı uzmanlığı, GitHub bağlantısı ve kapsam taşıma bu sorunun parçası değildir.

## Solution

Türlenmiş ilişki iki ucu, yönü ve kapalı anlamı ile saklanır. Katalog [standart ilişki türleri](../../prd/02-domain-model-and-lifecycle.md#standart-ilişki-türleri) tablosudur; kullanıcı yeni tür icat etmez. İlişki karşı ucun yaşamını otomatik kapatmaz. Kullanım bağı semantik ilişki değildir; gömülü canlı kart/blok kaynak kimliğini korur. `Used in` standart ilişkilerden türeyen geri bağlantılar ile kullanım bağlarını ayrı listeler. Kırık uç ortak sunumu kullanır; silinmiş başlık sızmaz. Kanıt rolü UI’si 45, GitHub PR bağ UI’si 61 bu seam’e yazar.

## User Stories

1. As a founder, I want to link two main records with a closed typed relation, so that I can see why they are connected.
2. As a founder, I want direction and allowed ends enforced, so that I cannot draw a nonsense edge.
3. As a founder, I do not want to invent a free relation type, so that the catalog stays closed.
4. As a founder, I want `Related` to stay a semantic link without lifecycle effect, so that it does not replace Origin or Evidence.
5. As a founder, I do not want `Related` to stand in for Origin or Evidence, so that provenance and proof stay honest.
6. As a founder, I want adding a relation to leave both records’ statuses unchanged (except where another feature’s explicit blocker/supersede/PR rule applies later), so that a link is not a workflow.
7. As a founder, I want a preview before creating a relation, so that I see the two ends and the type.
8. As a founder, I want safe undo of a relation through Mutation Contract, so that a mistaken link is reversible when deterministic.
9. As a founder, I do not want a relation to auto-close the other end, so that links are not cascading deletes of meaning.
10. As a founder whose other end cannot resolve, I want the shared broken-reference presentation (`Archived`, `In Trash`, `Permanently deleted`, `Redacted for security`, `No access`), so that I know why without seeing stale body.
11. As a founder, I do not want a broken end to show the last known title when I lack access, or any body/preview, so that names do not leak.
12. As a founder, I do not want the product to retarget a broken end to the nearest record, so that merge redirects stay the only alias.
13. As a founder, I want usage links for inline references, live blocks, pinned file/wireframe binds, and flow-to-Screen references, so that embed is tracked without being a typed relation.
14. As a founder, I do not want a usage link to carry Evidence Role or to change status, so that use is not proof.
15. As a founder removing a usage link, I want the embed gone and the source record kept, so that unlink is not delete.
16. As a founder, I want `Used in` on a record to list relation backlinks and usage links in separate groups, so that I do not mix graphs.
17. As a founder, I do not want `Used in` to be a second source of truth or a copied body, so that every row opens the real source.
18. As a founder, I do not want inaccessible records counted or named in `Used in`, so that the list cannot enumerate another Workspace.
19. As a founder, I do not want auto-suggested linking from text similarity, so that PRD 19’s auto-linking ban holds.
20. As a founder, I want JSON export later to read this store’s identity map, so that relations are not Markdown frontmatter.
21. As a founder using only a keyboard or a screen reader, I want to add a `Related` link, see `Used in`, and understand a broken end, so that Arama ve ilişki is possible.
22. As a founder, I want English UI for relation types and `Used in`, so that product language stays English.
23. As a founder, I do not want this feature to implement Evidence Role UI or GitHub install, so that 45 and 61 stay owners while writing through this store.
24. As a founder, I do not want Scope Tree drag or Feature inclusion UI here, so that 09 stays the inclusion editor.
25. As a founder whose origin is an owned component (checklist item, Wireframe node, Oturum Testi), I want Köken konumu on the target rather than a fake main-record end, so that a sahipli bileşen cannot enter the graph as an independent uç.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [içerik ilişkileri ve geri bağlantılar](../../prd/08-search-relations-and-evidence.md#içerik-ilişkileri-ve-geri-bağlantılar), [standart ilişki türleri](../../prd/02-domain-model-and-lifecycle.md#standart-ilişki-türleri), [kullanım bağları](../../prd/02-domain-model-and-lifecycle.md#kullanim-baglari), [kırık referans sunumu](../../prd/02-domain-model-and-lifecycle.md#kirik-referans-sunumu). Content lives in the database: [ADR-0021](../../adr/0021-icerigi-yalniz-veritabaninda-tut.md). Writes use Mutation Contract. No new ADR.
- **Glossary.** Use standart ilişki vs kullanım bağı vs Kanıt bağı (not this UI) vs GitHub bağlantısı (not this UI) vs Silinmiş hedef işareti vs Köken konumu. `Used in` is `Kullanıldığı yerler`. Avoid related-pile, auto graph, usage-as-relation.
- **Relations module.** Typed-relation store (catalog table, cardinality, delete-to-broken), usage-link store (closed usage kinds), derived `Used in`, broken-reference presenter. Specialist features call create/delete on this interface; they do not grow a second graph. `Used in` lists standard-relation backlinks and usage links in separate groups. PRD 08: usage does not produce geri bağlantı and does not enter relation counts. PRD 02: the same `Kullanıldığı yerler` surface still shows usage links as their own group. Compatible: usage rows are not labeled backlinks and do not increment relation counts.
- **Catalog.** Implement the PRD table as the only allowed types. This feature ships the generic create/list/delete UI for types that have no specialist workflow yet (at least `Related` and `Origin`/`Derived`). `Includes` is written by Work Lifecycle. `Evidence` create-with-role is 45. GitHub completion links are 61. `Blocks` is 19. The store still rejects unknown types. Two main-record ends use `Kökeni`; a sahipli bileşen is not an independent end — the target also carries [Köken konumu](../../prd/02-domain-model-and-lifecycle.md#koken-konumu) (owner id, component id, exact source version). Silent retarget to a newer similar item is refused.
- **Broken reference.** Reasons closed: `Archived`, `In Trash`, `Permanently deleted`, `Redacted for security`, `No access`. Show existence, reason, established time; no body/fields/preview. Title only if the founder still may access the target. `Open source record` kept for Archived/Trash targets; hidden for permanent/redacted/no-access. Restored target re-resolves the same id. Broken-target content does not enter search, Smart Collection membership, computed counts, or export. Broken reference does not mint a Dikkat sinyali or follow-up Work.
- **English UI labels.** First user-visible copy uses: `Related`, `Origin`, `Derived`, `Used in`, `Open source record`, `Archived`, `In Trash`, `Permanently deleted`, `Redacted for security`, `No access`. Add missing labels to the PRD term table in the same change that first shows them. `Contributes to Goal` already exists for when Goals land.
- **Stack.** PostgreSQL relations, oRPC, React. React Flow is for later canvases, not required to persist this graph. No neo4j.

## Testing Decisions

- **What a good test is.** Tests observe Relations through its public interface: typed create with direction/ends; unknown type rejected; status unchanged; usage link distinct from `Related` and not counted as a backlink; `Used in` two groups and each row opens the source; broken presentation without body leak; `Open source record` hidden for permanent/redacted/no-access; inaccessible name not listed; undo relation; auto-link absent; Köken konumu for owned-component origin. They do not assert join-table names. Expected values are catalog rules and leak counterparts.
- **Seam (one).** Relations — the product-facing graph interface used by Work, Documents, Evidence, GitHub, and canvases. Those domains are adapters or test doubles. Playwright for Arama ve ilişki’s relation half is this seam through the UI.
- **Modules under test.** Relations only.
- **Prior art.** Almost no Vitest/Playwright yet. First tests live at this seam. Evidence: [Arama ve ilişki](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (both real project and synthetic counterparts for authority/leak).
- **Required counterparts.** No free type; no auto-link; usage ≠ evidence; usage ≠ relation backlink and usage does not increment relation counts; no title leak on no-access; `Open source record` hidden for permanent/redacted/no-access; visitor/other Workspace cannot see ends; sahipli bileşen is not an independent Origin end.

## Out of Scope

- Kanıt rolü / Kanıt Akışı UI (45).
- GitHub App ve PR bağ UI (61).
- Blokaj UI (19), Hedef üyeliği UI (37) — store kabul eder, uzman yüzey orada.
- Belge kapsam taşıma (31), silinmiş hedefi başka kayda çevirme.
- Serbest etiket grafiği, AI ilişki çıkarımı.

## Further Notes

- **Orient.** Glossary: standart ilişki türleri, kullanım bağları, kırık referans / silinmiş hedef işareti, Köken konumu. Owning PRD: `docs/prd/08-search-relations-and-evidence.md` plus PRD 02 sections. ADRs in play: 0021. Related: PRD 16 Arama ve ilişki, PRD 19 no free types / no auto-link.
- **Acceptance.** Bind to [Arama ve ilişki](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). Integrity leak counterparts in PRD 15 (other Workspace name/count/end) are required. Closed journey **Proje gezinme ve arama** uses `Used in` plus later Search.
- **Conflict note.** PRD 08 says usage links do not produce geri bağlantı or enter relation counts. PRD 02 still shows usage on `Kullanıldığı yerler` as a separate group. PRD wins both: two groups on `Used in`; usage is not a backlink and is not counted as a relation.
- **Consumers.** 09 writes `Includes`. 06 convert may write `Origin`. 45/61/19/37 write specialist types through this seam. 08 Overview counts must use the same store. Export (79) reads identity maps from here.
