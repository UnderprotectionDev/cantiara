# Seçili Kayıt Dışa Aktarma

Kaynak: [`docs/workflow/79-data-export/phase-context.md`](../../workflow/79-data-export/phase-context.md)

## Problem Statement

Kurucu seçili Belge ve yapılandırılmış kayıtları açık biçimlerde, neyin çıktığını şaşırtmadan dışarı almak ister. Bugün tam Çalışma Alanı çıkışı, canlı senkron, secret sızıntısı veya formül çalıştıran CSV bu işi taklit edebilir. Dışa aktarma Avrupa Birliği veri bölgesindeki canlı yerleşimi taşımaz; yedek ürünü veya tek Belge Markdown/PDF yolu (31) değildir.

## Solution

Kurucu tek kayıt türü ve tek seçili kapsamda, kapalı dünya önizlemesi ve kaynak manifestiyle dışa aktarır. JSON kanonik kayıpsız round-trip biçimidir (açık şema sürümü). CSV düz, kayıplı, elektronik tablo güvenli kolaylık çıktısıdır. Secret, paylaşım token'ı ve bağlantı parolası hiçbir çıktıya girmez. İşlem başına en fazla 10.000 satır veya 25 MB. Çıktı Çalışma Alanı çıkış paketi (82) değildir. Tek Belge Markdown/PDF 31'dedir.

## User Stories

1. As a founder, I want a closed-world preview of every record, field, identity, and relation about to leave, so that export cannot surprise me with extra rows or hidden columns.
2. As a founder, I want a source manifest in every output stating schema version, scope, filters, visible fields, and production time, so that later import or audit knows what this file is.
3. As a founder, I want JSON to carry current field values, stable identities, Work-key history, selected-scope custom field definitions, origin, and relations whose both ends are selected — not ordinary record history — so that round-trip is possible without dumping history.
4. As a founder, I want that JSON to carry an explicit schema version, so that unknown future versions can be refused on import without writing.
5. As a founder, I want CSV to be a flat, lossy convenience of the current view, with lost relations, types, or identities reported before download, so that I do not treat CSV as lossless.
6. As a founder, I want cells that look like spreadsheet formulas (`=`, `+`, `-`, `@`, tab, CR) escaped as data and the transformation reported, so that opening the file cannot execute user text.
7. As a founder, I want JSON to keep the raw value unescaped, so that lossless and spreadsheet-safe remain two formats.
8. As a founder, I want secrets, sharing tokens, and link passwords never present in any output, so that portability cannot leak Secret class data.
9. As a founder, I want export limited to records and fields I can access, so that closed-world is not bypassed by an export command.
10. As a founder, I want one record family and one selected scope per operation, with a 10,000-row or 25 MB cap (whichever first), so that a silent unbounded job cannot run.
11. As a founder, I want the closed first-product JSON/CSV family to be Work (`Feature`, `Bug`, `Task`, `Research`, `Improvement`), planning (Proje Hedefi, Kilometre Taşı), decision/uncertainty (Karar, Risk, Varsayım, Açık Soru), intake (Geri Bildirim, Contact, Company), learning (Ürün Boşluğu, Kullanıcı Araştırması Oturumu, Deney/Doğrulama), Source metadata only, and operations (Proje Sürümü, Üretim Olayı), so that unlisted types cannot sneak out as structured round-trip.
12. As a founder, I want Documents excluded from that general CSV catalog, so that single-document Markdown/PDF stays workflow 31.
13. As a founder, I want Technical Diagram JSON to be export-only (not importable as create/update/restore), so that ADR-0005's round-trip promise is not inherited by diagrams.
14. As a founder exporting a Work JSON, I want owned Dış yürütme devri components inside the owner — never as a standalone type — with secret/inaccessible fields still forbidden.
15. As a founder exporting a Project Release JSON, I want owned Erişim and Sonuç gözlemi components inside the owner the same way.
16. As a founder, I want this file not to move live Workspace data residency out of the EU region, so that download is not a region transfer.
17. As a founder, I want this action clearly not a Workspace Exit Package, live sync, or second source of truth, so that I do not treat the file as backup or restore.
18. As a founder, I want exact-view CSV or readable PDF snapshots of supported Work lists, Smart Collections, and cross-project lists to capture the on-screen scope without creating a named view or live subscription.
19. As a founder, I want XLS and Atom formats absent, so that first-product export stays CSV/JSON/PDF-as-snapshot.
20. As a founder, I want Word export absent, so that 19 holds.
21. As a founder, I want English UI `Export` with format choices `JSON` and `CSV`, so that the product language stays English.
22. As a founder using only a keyboard or a screen reader, I want to complete preview and download, so that the Taşınabilirlik journey includes this surface.
23. As a founder, if concurrent export capacity is exceeded, I want a visible refusal rather than a silent long job, so that the product stays honest.
24. As Account Closure (84), I want selected Markdown/JSON/CSV exports to remain available during freeze in addition to the Exit Package, so that this seam is reusable rather than forked.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [standart biçimlerde seçili kayıt dışa aktarma](../../prd/13-data-security-and-portability.md#standart-biçimlerde-seçili-kayıt-dışa-aktarma). Round-trip JSON is [ADR-0005](../../adr/0005-json-tasinabilirlik-sozlesmesi.md). Single Document Markdown/PDF is [tek belge dışa aktarma](../../prd/07-documents-and-knowledge.md#tek-belge-dışa-aktarma) — workflow 31. Workspace Exit Package is 82 / [ADR-0023](../../adr/0023-sifreli-calisma-alani-cikis-paketini-restore-olmadan-sun.md). EU residency is [ADR-0009](../../adr/0009-ab-veri-siniri.md): export files do not move the live region. Envelope-encryption of export staging uses the export key scope (tech stack; PRD 13). Papa Parse is the CSV library. No new ADR.
- **Glossary.** Use JSON dışa aktarma şeması, Elektronik tablo güvenli CSV, Aşamalı import (80's counterpart, not this), Çalışma Alanı çıkış paketi (must not be this), Secret. Do not introduce backup, restore-point, live sync, or lossless CSV.
- **Selected Export module.** One product-facing interface: closed-world preview, manifest, produce JSON or spreadsheet-safe CSV (and allowed convenience snapshots). Callers (views, closure freeze) pass record family, scope, and selection; they do not invent a second exporter for secrets or manifest.
- **Conflict note.** Phase-context Tamamlanma mentions selected Documents; PRD 13 excludes Documents from this general CSV/JSON catalog and [tek belge dışa aktarma](../../prd/07-documents-and-knowledge.md#tek-belge-dışa-aktarma) (workflow 31) owns single-document Markdown/PDF. During Hesap kapanma dondurması, [Hesap kapatma](../../prd/03-account-platform-operations.md#hesap-kapatma) keeps this seam available on the frozen set alongside 82; PRD 13's sentence that selected Markdown/JSON/CSV export stops during freeze does not apply.
- **Closed catalog.** First-product structured CSV/JSON families are exactly the PRD 13 table. Documents are not in that catalog. Planlı/bildirilen test data is not this catalog (`test-report/1` is 54). File attachments export in original bytes as a selected-file path, not as structured JSON identity resurrection. Technical Diagram JSON is export-only. Screen/Wireframe, User Flow, Project Wall, Moodboard are not general CSV/JSON import/export records; their PNG/PDF region snapshots may use this seam's secret-exclusion and "not a live link" preview when those surfaces exist, without becoming round-trip. GitHub dış kaydı cannot be created from a file as GitHub truth (80); this export may include local historical metadata only if the catalog allows — it does not. Project, External Surface, automation, Starter Configuration are not general import-created and are not this round-trip catalog.
- **Limits and staging.** 10,000 rows or 25 MB per operation. Export staging uses the export key scope, never logs secrets, and is not a restore-point library. Exceeded concurrency fails visibly.
- **CSV vs JSON.** CSV reports loss (relations, types, identities) in preview. Formula-like prefixes are escaped as data and reported; JSON keeps raw values. Re-import (80) may strip only product-proven export origin escapes, never a user's ordinary apostrophe text.
- **Secrets.** Session tokens, integration tokens, sharing tokens, link passwords never enter output. Inaccessible fields are omitted, not toasted as empty secrets.
- **English UI labels.** `Export`, `CSV`, `JSON`, plus manifest field labels in English. Added to the term table when first shown. No Turkish UI. PDF snapshot accessibility limit (not tagged-PDF/WCAG) is explained with a Markdown alternative, per PRD 13 — view/PDF convenience, not 31's single Document path, still carries that warning if this seam emits PDF snapshots.
- **Residency.** Producing a downloadable file does not change Neon/Railway/R2 region. Preview states that EU live data stays; the file is the founder's copy.

## Testing Decisions

- **What a good test is.** Tests observe Selected Export through preview + bytes/manifest: catalog membership, closed-world (unselected relation omitted), secret absence, CSV escape vs JSON raw, schema version present, limit refusal, not-an-exit-package (no sessions/secrets/full history dump required of 82). They do not parse private serializers.
- **Seam (one).** Selected Export. Search index, object storage, and Document-31 exporter are not this module. Playwright for Taşınabilirlik is this seam through the UI.
- **Modules under test.** Selected Export only. Workspace Exit Package, single Document MD/PDF, test-report envelope, operator backup are counterparts (absent or different manifest).
- **Prior art.** Papa Parse at the CSV adapter. ADR-0005 schema version on the JSON adapter. Synthetic + real-project [Taşınabilirlik](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). `Kişisel veri` dataset is 81, not this (Contact may appear in the catalog without becoming a rights package). Cloud tests must not use production content.
- **Required counterparts.** Secret/token/password absent; unlisted family refused; Document MD/PDF not produced here; XLS/Atom/Word absent; formula cells escaped in CSV only; exact-view list snapshot is not a named view or live subscription; EU region unchanged; file is not Workspace Exit Package; Hesap kapanma dondurması does not disable this seam (PRD 03).

## Out of Scope

- Tek Belge Markdown/PDF — 31.
- Çalışma Alanı çıkış paketi, parola zarfı, kapanışta zorunlu tam arşiv — 82.
- Standart dosyalardan içe aktarma — 80.
- `test-report/1` — 54.
- Operatör yedeği — 85.
- Kişisel veri hak paketi — 81.
- Teknik SQL/DDL — 60. Diyagram PNG/SVG/PDF — 59. Duvar/Moodboard bölge snapshot — 50/51.
- Canlı senkron, Notion/Jira sihirbazı, macro Excel, herkese açık site paketi, Roadmap PNG/Gantt (19).
- Bölge seçici.

## Further Notes

- **Orient.** Glossary: JSON dışa aktarma şeması, Elektronik tablo güvenli CSV. Owning PRD: `docs/prd/13-data-security-and-portability.md` (`#standart-biçimlerde-seçili-kayıt-dışa-aktarma`). ADR: 0005. Related: 0009 (residency stays), 0023 (not this package), PRD 07 (31), PRD 16 Taşınabilirlik, PRD 19 (XLS/Atom/Word/live sync).
- **Acceptance.** [Taşınabilirlik](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): allowed-family fixtures, forbidden-family counterparts, secret absence, CSV vs JSON, not restore, not exit package.
- **Consumers.** 80 imports this JSON. 84 keeps this seam available during freeze (PRD 03; PRD 13 stop-export wording does not apply). 82 is a different archive.
- **Grant rule.** This feature does not consume `Confirm GitHub Identity`.
