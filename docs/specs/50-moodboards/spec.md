# Moodboard ve Görsel Yön

Kaynak: [`docs/workflow/50-moodboards/phase-context.md`](../../workflow/50-moodboards/phase-context.md)

## Problem Statement

Kurucu bir özellik veya proje için görsel referans, altyazı, renk örneği ve sunum sırasını kaybetmeden tutmak ister. Bugün yön dağınık klasörde kaybolur; palet Hesap teması veya Bitiriş efektine yazılabilir; kırpma/döndürme özgün Dosya Eki sürümünü mutasyona uğratabilir; snapshot kaynak görselleri değiştirebilir. Moodboard Kullanıcı Akışı, Wireframe veya tasarım sistemi değildir. Hesap görünüm teması ve Dosya Eki işaretleme ayrıdır.

## Solution

Kurucu Moodboard'u Proje tasarım ana kaydı (Tasarım type `Moodboard`) olarak tutar. Her görsel kaynak bağlamı ve isteğe bağlı altyazı taşır; Dosya Eki veya dış bağlantı kökenini kaybetmez. `Color Swatch` ve palet grupları görsel yön anlatır; ürün teması, CSS, production token, Bitiriş paleti veya kalıcı özel alan yazmaz. Kırpma ve 90° döndürme yalnız bu görünüme ait üstveridir. Sunum Kipi ve bölge snapshot'ı kaynak görselleri değiştirmeden tarihli çıktı üretir. Bu tuvaldeki kişisel viewport oturumlar arasında kalır.

## User Stories

1. As a founder, I want a Moodboard that collects visual references and chosen design direction for a Project or Feature, so that direction is not a lost folder of files.
2. As a founder, I want each visual to keep File Attachment or external-link origin plus optional short caption, so that I can read why it was chosen.
3. As a founder, I want that caption not to be a comment thread, reaction, task, mention, or second file-description source of truth.
4. As a founder, I want a reference not to be a production asset or a Screen, so that a picture cannot silently become UI.
5. As a founder, I do not want placing a visual to auto-create a Project Wall card, so that Moodboard editing stays on this canvas.
6. As a founder, I want first-class `Color Swatch` items and palette groups, so that direction includes color without becoming a token system.
7. As a founder, I want to pick color with a picker, eyedrop from an exact Moodboard visual, or HEX/RGB/HSL, plus a short note, so that swatches are explicit.
8. As a founder, I want a palette never to write Account theme, Completion effect, custom CSS, production design tokens, a persistent custom field, or Project Wall card highlight.
9. As a founder, I do not want automatic color suggestion from Moodboard content or a built-in stock-image search in the first product.
10. As a founder, I want view-local crop and 90° rotation that are reversible and bound to the exact File Attachment version, so that presentation can be framed without mutating the original.
11. As a founder, I want that transform not to change the original file, its version chain, or other views that use the same attachment.
12. As a founder exporting Moodboard PNG/PDF, I want the edited presentation used while the original file remains downloadable.
13. As a founder, I want Presentation Mode to hide editing tools and an optional view-local focus order, so that I can narrate direction without a second presentation document or content copy.
14. As a founder taking a selected group or region snapshot, I want dated PNG/PDF that does not mutate source visuals, following the shared visual-region snapshot contract (paging, scope preview, live-source limit).
15. As a founder, I want snapshot preview to say the output carries no live source links and which view-local crop/rotate metadata will apply.
16. As a founder, I do not want snapshot or Presentation Mode to be public publish or an Approved Snapshot Revision; sharing is 73/75.
17. As a founder, I want personal viewport center, zoom, and view-local collapse restored on this canvas; not content, share, export, or another user's view.
18. As a founder, I want `Fit View` to neutral, and a meaningless saved position to fit visible content.
19. As a founder, I do not want selection, inspector, or unsaved ops restored.
20. As a founder, I want a structured outline that can add, select, reorder, group, inspect, and open source records without a pointer.
21. As a founder, I want the 500 visible / 750 link hard scene not to crash or corrupt (links may be sparse on a Moodboard; the budget still holds).
22. As a founder, I want English UI `Moodboard`, `Color Swatch`, `Presentation Mode`, `Fit View`, `Open Source Record`.
23. As a founder using only a keyboard or a screen reader, I want to complete **canvas yapılandırılmış outline** on this surface.
24. As a founder, I do not want Moodboard to be a User Flow, Wireframe, design system, theme engine, or contrast-checker product.
25. As a founder, I do not want File Attachment markup tools owned here; visual/PDF markup stays the attachment feature.

## Implementation Decisions

- **Owning documents.** [Moodboard ve görsel yön](../../prd/09-discovery-decisions-and-design.md#moodboard-ve-görsel-yön). Tasarım type [PRD 02](../../prd/02-domain-model-and-lifecycle.md#ana-kayıt-türleri-ve-asgari-sözleşmeler). Viewport [PRD 04](../../prd/04-workspace-and-projects.md#büyük-canvaslarda-kişisel-çalışma-konumu). Snapshot paging/scope [görsel bölge snapshot](../../prd/13-data-security-and-portability.md#standart-biçimlerde-seçili-kayıt-dışa-aktarma). Completion-effect catalog [ADR-0017](../../adr/0017-bitiris-efektlerini-ozgun-birinci-taraf-katalogla-sinirla.md) must not be written from a palette. Account appearance is PRD 03 preferences. No new ADR. Do not add a new canvas framework; reuse existing React + dnd-kit / existing visual stack. Konva may render crop/preview; it is not a second durable document format.
- **Glossary.** Use Moodboard (Tasarım type), Dosya Eki, Color Swatch as UI, Bitiriş efekti (must not be written), Ekran (not this). Do not introduce design-token record, theme engine, stock search, or live brand-guide sync.
- **References.** Each visual keeps origin (File Attachment version or external link) and optional caption. Caption is not a thread. References are not Screens or production assets. Editing here does not spawn Project Wall cards.
- **Swatches.** First-class items and palette groups. Picker, eyedrop from an exact Moodboard visual, HEX/RGB/HSL, short note. Palette is visual-direction context only: no Account theme, Completion effect, CSS, production tokens, persistent custom field, or Wall card highlight. No auto-suggest, no stock search.
- **View-local transform.** Crop and 90° rotation are reversible metadata on this Moodboard view bound to the exact File Attachment version. Original bytes and other views stay. PNG/PDF export uses the presented view; original remains downloadable.
- **Presentation and snapshot.** Presentation Mode hides tools; optional focus order is view metadata, not a document copy. Group/region snapshot is dated PNG/PDF per PRD 13: PNG as separate images, PDF groups as readable pages, no smash-the-whole-board-to-one-page. Preview states no live links, which moment, which crop/rotate applies. Output does not mutate sources. Not External Surface, not Approved Snapshot Revision.
- **Personal viewport, a11y, perf.** PRD 04 / 15 on this canvas. English labels as in stories; missing terms join the table in the same change.

## Testing Decisions

- **What a good test is.** Tests observe Moodboards through the public interface: add reference with origin+caption, swatch does not write theme/completion, crop/rotate does not mutate attachment bytes or other views, snapshot does not mutate sources, viewport restore, outline tasks, 500/750 scene does not crash. Not Konva JSON equality.
- **Seam (one).** Moodboards — the product-facing Moodboard record, swatch, view-metadata, and snapshot interface.
- **Modules under test.** Moodboards only. Wireframe, User Flow, Account theme, Completion effect, File Attachment markup, sharing publish are counterparts.
- **Prior art.** Bind to [Tasarım bağlamı](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (Moodboard half) and **canvas yapılandırılmış outline**.
- **Required counterparts.** Palette does not write Account theme or Completion effect; snapshot does not change source attachments; stock search absent; auto color suggest absent; Wall cards not auto-created; 500/750 scene does not crash or corrupt.

## Out of Scope

- Kullanıcı Akışı, Wireframe, tasarım sistemi, kontrast denetimi, tema motoru.
- Hesap açık/koyu teması, Bitiriş paleti, production token.
- Dosya Eki işaretleme aracı; stok görsel arama; AI renk önerisi.
- Dış yüzey yayını ve onaylı snapshot (73/75).
- Canlı eşitlenen marka kılavuzu.

## Further Notes

- **Orient.** Glossary: Moodboard as Tasarım type, Dosya Eki, Bitiriş efekti (avoid writing). Owning PRD: `docs/prd/09-discovery-decisions-and-design.md` (`#moodboard-ve-görsel-yön`). ADRs: 0017 (do not write). Related: PRD 04 viewport, PRD 13 snapshot, PRD 16 Tasarım bağlamı, PRD 19 no stock search / no universal canvas.
- **Acceptance.** [Tasarım bağlamı](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): canvas presentation does not mutate sources; snapshot comparison. Sharing stays 73/75.
- **Consumers.** `14-file-attachments` owns bytes; `23-completion-effects` owns the catalog this palette must not write; `02-account-preferences` owns appearance theme; `51-project-wall` must not auto-spawn from Moodboard edits.
