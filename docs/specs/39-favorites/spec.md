# Favoriler

Kaynak: [`docs/workflow/39-favorites/phase-context.md`](../../workflow/39-favorites/phase-context.md)

## Problem Statement

Kurucu sık açtığı Proje, Belge, İş, Karar ve Akıllı Koleksiyonlara kişisel listeden dönmek ister. Favori olmak kaydın Projesini, türünü veya durumunu değiştirirse planlama bozulur; kabuk üyeliği sahiplenirsa ikinci bir Backlog doğar. Bookmark kuyruğu, Aktif Çalışma Seti ve Günlük Odak bu liste değildir.

## Solution

Favori, desteklenen kayda Hesap/Çalışma Alanı kişisel işaretidir. Ekleme ve çıkarma kaynak kaydı kopyalamaz; Proje, tür ve yaşam yazmaz. Liste kaynaktan `Open source record` ile açılır. Kişisel kabuk (72) listeyi açar, üyeliği yönetmez.

## User Stories

1. As a founder, I want to add a Project, Document, Work, Decision, or Smart Collection to Favorites, so that frequent records are one step away.
2. As a founder, I want adding a Favorite not to change that record’s Project, type, or status, so that a star is not a move or a close.
3. As a founder, I want to remove a Favorite without deleting or archiving the source, so that membership is only the star.
4. As a founder, I want the list to open the source record rather than a copied second record, so that I always edit the original.
5. As a founder, I want Favorites not to be Backlog, Focus Period, Daily Focus, Active Working Set, or a Smart Collection, so that personal access stays distinct from planning and derived views.
6. As a founder, I want the personal shell to open this list without owning add/remove, so that 72 does not become the membership source.
7. As a founder, I want Favorite membership not to write planning order or Project scope, so that starring cannot reshuffle work.
8. As a founder, I want a deleted or inaccessible source to show a broken-reference row rather than a silent drop to another record.
9. As a founder, I want English UI `Favorites`, `Add to Favorites`, `Remove from Favorites`, `Open source record`.
10. As a founder using only a keyboard or a screen reader, I want to add, remove, and open Favorites.
11. As a founder, I do not want Favorites on an external surface by default; starring is personal, not a publish.
12. As a consuming shell, I want a read API to open the list in a transient panel; I must not add a second membership store.

## Implementation Decisions

- **Owning documents.** [Favoriler](../../prd/04-workspace-and-projects.md#favoriler). Shell: [kişisel erişim kabuğu](../../prd/04-workspace-and-projects.md#bağlamı-koruyan-kişisel-erişim-kabuğu) — opens Favorites, does not own membership (72). Active Working Set is neighboring and out. No new ADR.
- **Glossary.** Use Favori, Kişisel erişim kabuğu, Akıllı Koleksiyon (may be starred; starring does not make Favorites a collection). Avoid bookmark queue, Active Working Set, planning membership, second copy.
- **Favorites module.** Personal membership of exactly Project, Document, Work, Decision, Smart Collection. Membership does not write Project, type, status, backlog order, or scope. Open is `Open source record`. No copied record. Broken source uses common broken-reference presentation.
- **Shell boundary.** 72 may open the list in a default transient panel and optional full page; add/remove stay here.
- **English UI labels.** `Favorites`, `Add to Favorites`, `Remove from Favorites`. Add to the term table when first shown.
- **Acceptance journey.** [kişisel bağlam](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): Favorite does not change Project, type, or status.

## Testing Decisions

- **What a good test is.** Tests observe Favorites through add, remove, list, open-source, and the counterpart that source Project/type/status/planning did not change. They do not assert shell chrome or Prisma membership rows.
- **Seam (one).** Favorites — membership and list interface. Shell is a consumer.
- **Modules under test.** Favorites only.
- **Prior art.** First contract tests at this seam. Evidence: [kişisel bağlam](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) Favorite add/remove counterpart.
- **Required counterparts.** Add/remove does not write Project/type/status; no second copy; shell has no separate membership store; not Backlog/Focus Period.

## Out of Scope

- Kişisel kabuk paneli, Tam sayfa aç, Aktif Çalışma Seti (72).
- Günlük Odak, Bildirim Merkezi, Backlog, Odak Dönemi, Akıllı Koleksiyon motoru (34).
- Favoriden ikinci kayıt kopyası, dış yüzey varsayılan yayını.

## Further Notes

- **Orient.** Glossary: Favori, Kişisel erişim kabuğu. Owning PRD: `docs/prd/04-workspace-and-projects.md` (Favoriler). ADRs: none. Journey: kişisel bağlam. Consumers: 72 opens, does not own.
