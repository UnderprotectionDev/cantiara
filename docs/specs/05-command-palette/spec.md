# Komut Paleti

Kaynak: [`docs/workflow/05-command-palette/phase-context.md`](../../workflow/05-command-palette/phase-context.md)

## Problem Statement

Kurucu arama, Proje değiştirme, kayıt oluşturma ve desteklenen ortak eylemlere klavyeyle her bağlamdan ulaşmak ister. Bugün iskelette palet yoktur; fareye gitmeden işine dönemaz, kapsam dışı komutun açıkça başarısız olacağı bir yüzey yoktur ve ziyaretçi sayfası kurucu paletini açabilecek bir boşluk taşır. Evrensel Arama sonuç listesi, otomasyon kuralı ve yeniden eşlenebilir kısayol profili bu sorunun parçası değildir.

## Solution

Komut Paleti uygulamanın kurucu yüzeylerinin her yerinden klavyeyle açılır. Palet komut ve gezinmeyi taşır: içerik arama, kayıt oluşturma, Projeler arasında geçiş ve sık işlemler. Her palet komutunun görünür menü karşılığı vardır; kısayollar sabittir. Kapsam dışı veya desteklenmeyen komut sessiz no-op olmaz. Palet Evrensel Arama değildir. Ziyaretçi Dış yüzeylerinde kurucu paleti yoktur. Görünür olma bütçesi p95 150 ms / p99 300 ms’tir.

## User Stories

1. As a founder, I want to open the Command Palette from every authorized product context with the keyboard, so that I can keep my hands off the mouse.
2. As a founder, I want the palette to become visible within the p95 150 ms / p99 300 ms budget, so that keyboard use feels immediate.
3. As a founder, I want to search accessible content from the palette, so that I can jump to a record I am allowed to see.
4. As a founder, I want palette search to show only records in my authorized scope, so that another Çalışma Alanı or unshared record cannot appear.
5. As a founder, I do not want the palette to be Universal Search, so that command/navigation and the dedicated Search surface stay distinct.
6. As a founder, I want to create a supported record type from the palette, so that creation is available from any context.
7. As a founder, I want to switch Project from the palette, so that I can change working context without hunting navigation.
8. As a founder, I want frequent supported actions (open, create, switch, documented common commands) to run from the palette, so that the keyboard path matches the visible menus.
9. As a founder, I want every palette command to have a visible UI counterpart, so that a command is not a hidden power-user-only path.
10. As a founder, I want shortcut hints to be visible, so that I can learn the fixed shortcuts.
11. As a founder, I do not want a user-remappable shortcut profile, so that the first product keeps one documented map.
12. As a founder, I want the command’s scope, target, and affected selection count shown before it runs, so that I do not fire a bulk action blind.
13. As a founder running a reversible command from the palette, I want it to use the Mutation Contract’s safe undo, so that palette is not a second write protocol.
14. As a founder invoking a command I cannot run in this context, I want an explicit failure, so that a hidden no-op cannot look like success.
15. As a founder, I do not want an out-of-scope command swallowed, so that I know why nothing happened.
16. As a visitor on a Dış yüzey, I do not want the founder Command Palette, so that a public page cannot search or mutate the Workspace.
17. As a founder on a visitor preview I am not using as founder chrome, I still do not want the founder palette mounted on the public template, so that a leaked bundle cannot offer Workspace commands to an anonymous reader.
18. As a founder, I want English UI copy `Command Palette` and documented command names, so that product language stays English.
19. As a founder using only a keyboard or a screen reader, I want to open the palette, filter commands, run one, and dismiss it, so that the Komut Paleti journey and the closed “Proje gezinme ve arama” journey are possible.
20. As a founder, I do not want the palette to be an IDE command marketplace, plugin host, or script runner, so that it stays product commands.
21. As a founder, I do not want the palette to create automation rules, so that automation stays its own feature.
22. As a founder, I want create/switch/search in the palette to remain available while Configuration Mode is off, so that the palette is not a settings-only tool.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [Komut Paleti ve klavye odaklı kullanım](../../prd/04-workspace-and-projects.md#komut-paleti-ve-klavye-odaklı-kullanım). Latency is [performans bütçesi](../../prd/15-product-quality.md#performans-butcesi). Undo of reversible commands is [güvenli geri alma](../../prd/02-domain-model-and-lifecycle.md#değişiklik-geçmişi-aktör-ve-geri-alma), consumed not reimplemented. No ADR.
- **Glossary.** Use Komut Paleti vs Evrensel Arama (`Search`). Do not call the palette Search, Universal Search, or a marketplace. Do not introduce remappable shortcut profiles. Visitor Paylaşım erişim oturumu is not a founder context.
- **Command Palette module.** One product-facing palette: open/close, command list, scope/target/selection preview, run, explicit failure. Content search inside the palette is a jump command over authorized main records; it is not the Universal Search surface (later workflow) and must not rank with AI or click-learning. Create and Project switch call those features’ commands; this module does not own Work identity or Project shell.
- **Commands.** Closed set of product commands that already have visible menu counterparts. Fixed documented shortcuts. Show scope, target, and affected selection count. Reversible commands go through Mutation Contract.
- **Failure.** Unsupported or out-of-scope commands fail visibly (reason + no write). Never a silent no-op.
- **Visitor.** Founder palette is not mounted on Dış yüzey templates or Paylaşım erişim oturumu. Public pages have no Workspace command list.
- **English UI labels.** First user-visible copy uses: `Command Palette`, `Switch Project`, `Create`, `No matching command`, `Can’t run this here`. Add missing labels to the PRD term table in the same change that first shows them. `Search` remains the Universal Search label and is not reused as the palette’s title.
- **Stack.** React, shadcn/ui / Base UI, TanStack Router. Do not add an IDE command-marketplace dependency or a user keymap editor. No i18n.

## Testing Decisions

- **What a good test is.** Tests observe Command Palette through its public interface: open from multiple founder routes within budget, search/create/switch only authorized scope, visible counterpart exists, out-of-scope command fails with no write, visitor template has no palette, keyboard-only complete. They do not assert component library internals or key-map JSON. Expected values are product rules (p95 150 ms visible, no silent no-op, no visitor palette).
- **Seam (one).** Command Palette — the product-facing command interface. Universal Search, Project Shell, and Work create are adapters behind “run this command”; this suite uses fakes/stubs for records that do not exist yet, plus a counterpart that a visitor document does not mount the palette. Playwright for Komut Paleti and “Proje gezinme ve arama” is the same seam through the UI.
- **Modules under test.** Command Palette only.
- **Prior art.** Almost no Vitest/Playwright yet. First contract tests live at this seam. Evidence: [Komut Paleti](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (real project for the journey; budget measurement on the reference workspace size when measuring p95).
- **Required counterparts.** Silent no-op absent; visitor/public surface has no founder palette; unauthorized Workspace/record absent from palette search; remappable shortcuts absent; palette title is not `Search`.

## Out of Scope

- Evrensel Arama sonuç listesi, operatör dili, Akıllı Koleksiyon kaydetme (workflow 33/34).
- Yeniden eşlenebilir kısayol profili.
- Otomasyon kuralı, script, plugin pazarı.
- Kapsam dışı komutu sessizce yutma.
- Ziyaretçi yüzeyinde kurucu paleti.
- İş kimliği, Proje kabuğu ve mutasyon protokolünün kendisi — palet onları çağırır.

## Further Notes

- **Orient.** Glossary: Evrensel Arama (not this), Hesap, Çalışma Alanı, Proje, Güvenli geri alma. Owning PRD: `docs/prd/04-workspace-and-projects.md` (Komut Paleti). ADRs in play: none. Related but not owning: PRD 08 (Universal Search), PRD 15 (p95 150 ms, accessibility), PRD 16 (Komut Paleti journey), PRD 19 (no remappable shortcuts, no command marketplace), PRD 14 (visitor surfaces).
- **Acceptance.** Bind to [Komut Paleti](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (keyboard open, budget, authorized search/create/switch, unsupported action fails visibly, keyboard-only). Closed journey **Proje gezinme ve arama** uses this palette plus later Search; this feature proves the palette half. Negative bounds (no visitor palette, no marketplace, no silent no-op) are 19-class counterparts.
- **Consumers.** Later features register visible commands; they do not open a second palette. Universal Search remains a distinct surface. Mutation Contract undoes reversible palette commands.
