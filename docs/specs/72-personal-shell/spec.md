# Kişisel Erişim Kabuğu

Kaynak: [`docs/workflow/72-personal-shell/phase-context.md`](../../workflow/72-personal-shell/phase-context.md)

## Problem Statement

Kurucu Günlük Odak, Favoriler, Birleşik Bildirim Merkezi ve zamanı gelen Yeniden bak öğelerine, açık Proje ve kayıt konumunu kaybetmeden ulaşmak ister. Bugün bu yüzeyler ya ikinci bir workspace/dashboard olur ya da üyelik, planlama ve bildirim kaydını kabuğun kendisi yazmaya kalkar. Oturumluk çalışma seti kalıcı Favori veya Odak'a dönüşür; panel konumu recent-context olarak geri yüklenir; büyük canvas viewport'u da buraya yığılır. Kabuk bunların sahibi değildir.

## Solution

Kişisel erişim kabuğu Günlük Odak, Favoriler, Bildirim Merkezi ve Yeniden bak bağlamlarını kaynak görünümünü kaybetmeden açar. Yüzeyler varsayılan geçici paneldir; gerektiğinde `Open full page` vardır. Kabuk üyelik, planlama gerçeği veya bildirim kaydı üretmez. Favoriler listesini açar; favori üyeliğini yönetmez. Aktif Çalışma Seti yalnız açık oturumda yaşar. Panel, panel içi gezinme, scroll ve kaynak görünüm konumu oturumlar arasında geri yüklenmez. Canvas viewport ilgili tuval feature'ındadır.

## User Stories

1. As a founder anywhere in the app, I want to open Günlük Odak without losing my current Proje, record, and source-view position, so that personal attention does not hijack the working context.
2. As a founder, I want the same for Favoriler, Birleşik Bildirim Merkezi, and due `Look again` items, so that those four surfaces share one shell behavior.
3. As a founder, I want those surfaces to open in a temporary panel by default, so that the current record stays underneath.
4. As a founder, I want `Open full page` when I need it, so that the panel is not a trap.
5. As a founder, I want choosing an item to return me to that item’s own source context, so that the shell is not a copy of the record.
6. As a founder, I want shell ordering not to become planning order, so that a panel sort cannot rewrite Backlog or Odak Dönemi.
7. As a founder, I want Favorites membership add/remove to stay in the Favorites feature, so that the shell only opens the list.
8. As a founder, I want Daily Focus membership to stay in Daily Focus, so that opening today does not add or remove Work.
9. As a founder, I want notification membership and read state to stay in Attention Signals, so that the shell is not a second inbox writer.
10. As a founder, I want `Look again` due items to open their source records, so that the reminder feature keeps the membership.
11. As a founder, I want an `Active Working Set` of İş and Belge I am holding, so that I can collapse and reopen them in one action without losing source-view context.
12. As a founder, I want that set to live only for the open app session and not restore after the session ends, so that it never becomes a plan.
13. As a founder, I want adding or removing a set member not to change the source record or any planning surface, so that the set is not Favori, Günlük Odak, bookmark, or Backlog.
14. As a founder, I want the set not to carry its own sort, date, notification, or durable history semantics, so that it stays a session selection.
15. As a founder, I want unsaved edits to keep using their normal autosave/Taslak contracts, so that the set is not a second durability mechanism.
16. As a founder, I want the set not to restore a closed session’s editing context as recent-context, so that 19’s recent-context ban holds.
17. As a founder, I want the set not to be shared and not to mint a Dış yüzey, so that a personal session cannot leak.
18. As a founder, I do not want open panel, in-panel navigation, scroll, or source-view position restored across sessions, so that the shell does not become recent-context.
19. As a founder, I do not want this feature to store Proje Duvarı / Kullanıcı Akışı / Wireframe / Moodboard / Teknik Diyagram viewport, zoom, or collapse, so that canvas location stays on those features.
20. As a founder, I do not want the shell to be a workspace dashboard, second Backlog, or Smart Collection, so that those remain their modules.
21. As a founder, I want English UI copy, so that the product language stays English.
22. As a founder using only a keyboard or a screen reader, I want to open the shell, switch the four surfaces, open full page, and toggle Active Working Set, so that kişisel bağlam is accessible.

## Implementation Decisions

- **Owning documents.** Shell and set: [kişisel erişim kabuğu](../../prd/04-workspace-and-projects.md#bağlamı-koruyan-kişisel-erişim-kabuğu), [Aktif Çalışma Seti](../../prd/04-workspace-and-projects.md#oturumluk-aktif-çalışma-seti). Canvas exception is [büyük canvas](../../prd/04-workspace-and-projects.md#büyük-canvaslarda-kişisel-çalışma-konumu) — out of this feature. Favorites: [Favoriler](../../prd/04-workspace-and-projects.md#favoriler). Journey: [kişisel bağlam](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). Recent-context ban: [19](../../prd/19-out-of-scope.md#iş-modeli-ve-üretkenlik). No new ADR.
- **Glossary.** Use Kişisel erişim kabuğu, Aktif Çalışma Seti, Günlük Odak, Favori, Birleşik Bildirim Merkezi, Yeniden bak, Dış yüzey, Taslak. Do not introduce dashboard, second Backlog, bookmark queue, or session restore. Do not call the set Odak Dönemi or Günlük Odak.
- **Open, do not own.** The shell is an access surface. Membership writers: 27 (Daily Focus), 39 (Favorites), 71 (Notification Center), 35 (`Look again`). Opening the shell, switching its four surfaces, or using `Open full page` does not add/remove Favori, Günlük Odak, notification, or Yeniden bak membership and does not mark notifications read. When those features’ own lists are shown inside the panel, their add/remove/read actions remain theirs — this module does not reimplement them and does not freeze them. Tests here assert the shell chrome is not a membership writer.
- **Panel default.** Temporary panel; `Open full page` is explicit. The shell does not mandate a particular visual bar layout; the invariant is not losing current Proje/record/source-view position.
- **No recent-context.** Open panel, in-panel navigation, scroll, and source-view position are not restored across sessions. Working Set is not restored after session end. Unsaved edits are not this module’s durability path.
- **Active Working Set.** Session-only selection of İş and Belge. Reopen is one action without losing source-view context. Not Favori, Günlük Odak, priority, status, planning membership, bookmark queue, ana kayıt, or another truth. Not shared. Does not create Dış yüzey.
- **Canvas viewport.** Not here. Proje Duvarı, Kullanıcı Akışı, Wireframe, Moodboard, Teknik Diyagram keep their own viewport/zoom/collapse. This feature must not persist those values.
- **English UI labels.** First user-visible copy uses: `Daily Focus`, `Favorites`, `Notification Center`, `Look again`, `Open full page`, `Active Working Set`, `More`. Missing labels go to the term table in the same change that first shows them.

## Testing Decisions

- **What a good test is.** Tests observe Personal Shell through its public interface: open each of the four surfaces without losing current context, panel vs full page, Working Set add/reopen/session-end drop, membership non-writes, no panel restore after new session. They do not assert layout coordinates. Expected values are product rules (session-only set, open ≠ membership write).
- **Seam (one).** Personal Shell — the product-facing personal access interface. Daily Focus, Favorites, Attention Signals, and reminders are collaborators whose membership APIs this suite must not call except as “unchanged” oracles.
- **Modules under test.** Personal Shell only.
- **Prior art.** No Vitest/Playwright suite yet. Contract tests at this seam. Evidence binds to [kişisel bağlam](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (session close/open E2E; Favorites add/remove remains a counterpart owned by 39).
- **Required counterparts.** Set gone after session end; opening Favorites does not favorite; hosted Favorites/Daily Focus/center actions remain their owners; panel state absent on next session; canvas viewport APIs not written here; no Dış yüzey from the set.

## Out of Scope

- Kişisel paneli workspace, dashboard veya ikinci Backlog sayma.
- Aktif Çalışma Setini Günlük Odak, Favori veya Odak Dönemi kapsamı yapmak.
- Canvas viewport, zoom veya daraltmayı bu kabuğun feature'ı sayma.
- Favori, Günlük Odak, bildirim veya Yeniden bak üyeliğini kabuğun feature'ı sayma.
- Panel veya kaynak görünüm konumunu oturumlar arası recent-context olarak geri yükleme.
- Çalışmaya Dön özeti (36) bu kartta değildir.

## Further Notes

- **Orient.** Glossary: Kişisel erişim kabuğu, Aktif Çalışma Seti, Günlük Odak, Favori, Birleşik Bildirim Merkezi. Owning PRD: `docs/prd/04-workspace-and-projects.md`. ADRs in play: none. Related: PRD 16 kişisel bağlam, PRD 19 recent-context ban, workflows 27/35/39/71/36/51.
- **Acceptance.** Bind to [kişisel bağlam](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). Journey says the session set is not durable planning and only defined canvas position returns — canvas return is *not* this feature’s ticket; this feature’s counterpart is that it does not restore panels.
- **Consumers.** 05-command-palette may later jump to the same surfaces; it must not fork membership. 15-workspace-overview remains the workspace horizon, not this shell.
