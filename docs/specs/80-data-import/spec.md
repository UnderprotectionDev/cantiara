# Standart Dosyalardan İçe Aktarma

Kaynak: [`docs/workflow/80-data-import/phase-context.md`](../../workflow/80-data-import/phase-context.md)

## Problem Statement

Kurucu desteklenen Markdown, JSON ve CSV dosyalarını şaşırtmadan içeri almak ister. Bugün kısmi satır yazma, silinmiş kimliği diriltme, test-raporu zarfını Belge sayma veya yedekten restore bu işi taklit edebilir. Dış dosya canlı bağlantı değildir. Mapping ve fark görünmeden yazmak mevcut Çalışma Alanını bozar.

## Solution

Kurucu tekil Markdown'ı Proje veya Wiki Belgesi; Cantiara sürümlü Belge JSON'unu aynı aile; tekil CSV/JSON'u kapalı katalogdan dosya başına tek tür ve tek kapsam olarak alır. Eşleme ve fark önizlemesi ana kayıt yazmaz. `Apply Import` atomik ve idempotent kesinleştirir: ya hepsi bir kez yazılır ya hiçbiri. Kalıcı silinmiş kimlik yeni kimlik üretir; emekli kimlik emekli kalır. Test-report/1 (54) ve operatör restore (85) bu seam değildir.

## User Stories

1. As a founder, I want to import a single Markdown file as a Project or Wiki Document after mapping preview, so that a note becomes a Document without a live file link.
2. As a founder, I want to import Cantiara-published versioned Document JSON as the same record family, so that first-party Document JSON round-trips without using the general CSV catalog.
3. As a founder, I want to import a single CSV or JSON file for one catalog type and one selected scope, so that a mixed bag cannot silently map to the wrong records.
4. As a founder, I want a 10,000-row or 25 MB cap (whichever first), so that larger data is explicitly split rather than partially applied.
5. As a founder, I want folder, ZIP, multi-file Markdown, and whole-Workspace import absent, so that first product stays one file, one type, one scope.
6. As a founder, I want mapping of source columns to product fields and project-scoped custom fields, plus losses and conflicts, shown before any write, so that Apply is informed.
7. As a founder, I want every invalid row corrected or explicitly dropped from the final set before Apply, so that the committed set is the set I saw.
8. As a founder, I want that final set atomic: all records and relations written once or none, so that there is no row-level partial success.
9. As a founder, I want the encrypted server staging area to hold the max-size file at most 24 hours without mutating primary records, so that preview is not a write.
10. As a founder, I want a separate `Apply Import` confirmation after I see the exact diff, so that preview and commit stay two steps.
11. As a founder, I want Apply to run with an idempotency key and base revisions, yielding a durable receipt reopenable after a dropped connection, so that retry is safe.
12. As a founder, I want cancel possible only before the atomic commit barrier; after it, status `Finalizing` until full commit or full rollback, so that I cannot fake Cancel into a partial world (ADR-0004).
13. As a founder, when source data carries a stable origin key, I want that origin kept with provider/file scope — not as authority to resurrect a product id.
14. As a founder re-importing the same source set onto a living record with exact origin match, I want preview of `update existing`, `skip`, or `resolve conflict`, so that duplicates are a choice.
15. As a founder when a permanently deleted product id reappears, I want a new product id and key with the previous origin visible, so that identity is not resurrected and retired ids stay retired.
16. As a founder when relations are mapped, I want them attached to the new ids by explicit mapping, so that old edges do not secretly revive.
17. As a founder when source has no stable identity, I want that limit stated and no guessed matching without my approval.
18. As a founder, I want unknown future JSON schema versions refused with no write, so that ADR-0005 holds.
19. As a founder, I want Technical Diagram JSON, DDL/DBML, Draw.io/Visio, and AI reconstruct refused as editable import, so that 19 and the Mermaid-in-Document path stay the only first-product diagram conversion (not this seam).
20. As a founder, I want a structured test-report Markdown/JSON to hit the test-report/1 validator (54), never this Document/Work importer, so that a failed test accept leaves no partial write here either.
21. As a founder, I want this not to be operator backup restore, GitHub sync, or a Notion/Jira wizard, so that Standard Import stays a file-to-records finalize.
22. As a founder, I want English UI `Import` and `Apply Import`, so that the product language stays English.
23. As a founder using only a keyboard or a screen reader, I want to complete preview and Apply, so that the closed accessibility journey **import önizleme ve commit** is possible.
24. As a founder, I want paste-from-table and create-Work-from-list to use this same preview contract when those UIs exist, so that there is not a second partial-write path.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [standart dosyalardan içe aktarma](../../prd/13-data-security-and-portability.md#standart-dosyalardan-içe-aktarma). Finalize is [ADR-0004](../../adr/0004-atomik-idempotent-kesinlestirme.md) and [ortak kimlik](../../prd/02-domain-model-and-lifecycle.md#ortak-kimlik) (import finalize is not a fake human base revision; it uses verified source id, stable event/delivery id, payload fingerprint). JSON schema versions are [ADR-0005](../../adr/0005-json-tasinabilirlik-sozlesmesi.md). Test-report files are [güvenli atomik kabul](../../prd/10-testing-and-validation.md#güvenli-atomik-ve-idempotent-kabul) — workflow 54. Mermaid-to-diagram is documents/diagrams, not this. Operator restore is 85. No new ADR.
- **Glossary.** Use Aşamalı import, JSON dışa aktarma şeması, Elektronik tablo güvenli CSV (strip only product-proven export escapes), Emekli kayıt kimliği, Güvenli geri alma (Apply after barrier is not undo-as-cancel). Do not introduce identity resurrection, partial success, backup restore, or live file link.
- **Standard Import module.** One product-facing interface: accept one file, mapping+diff preview (no primary writes), `Apply Import` atomic finalize, receipt. Staging is encrypted, ≤24h, export/import key scope, not searchable. Papa Parse for CSV; Zod for JSON schema.
- **Catalog.** CSV/JSON positive families (one type per file, one selected scope): Work (`Feature`, `Bug`, `Task`, `Research`, `Improvement`); Project Goal; Milestone; Decision; Risk; Assumption; Open Question; Feedback; Contact; Company; Product Gap; User Research Session; Experiment/Validation; Source metadata only; Project Release; Production Incident. Markdown → Document in Project or Wiki. First-party Document JSON → Document family. Not: ZIP, folder, workspace import, Project create, External Surface, automation, Starter Configuration, GitHub-as-truth, Technical Diagram editable JSON, Screen/Wall/Moodboard, test-report envelope as Work/Document.
- **Identity.** Origin key + provider/file scope is provenance, not product-id authority. Permanently deleted id → new id; retired merge id stays retired. Relations to new ids only via explicit mapping shown in preview.
- **CSV escape.** Re-import removes formula-escape only when the file's origin proves it was this product's export escape; ordinary leading apostrophe text is unchanged.
- **English UI labels.** `Import`, `Apply Import`, `Finalizing`. Added to the term table when first shown. Status `Finalizing` is the PRD `Sonlandırılıyor` UI. No Turkish UI.
- **Grant.** This feature does not consume `Confirm GitHub Identity`.

## Testing Decisions

- **What a good test is.** Tests observe Standard Import through preview (no rows in primary stores) then Apply (all-or-nothing, same idempotency key returns receipt, different payload conflicts, deleted id gets a new id, unknown schema writes nothing). They do not assert staging blob internals except "primary unchanged during preview".
- **Seam (one).** Standard Import. Test-report validator is a counterpart adapter: a `test-report/1` payload is rejected here or handed to 54 without Work writes. Backup restore is not callable. Playwright for **import önizleme ve commit** is this seam through the UI.
- **Modules under test.** Standard Import only. Selected Export (79) is the happy-path producer, not this suite except as fixture bytes. Workspace Exit Package restore is absent.
- **Prior art.** Papa Parse / Zod as adapters. ADR-0004 finalize style matches mutation/import origins on workflow 04. Synthetic + real-project [Taşınabilirlik](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
- **Required counterparts.** Partial row success impossible; identity resurrection impossible; ZIP/workspace import absent; diagram JSON create refused; GitHub file-create refused; 54 envelope not a Document; paste/list-create has no second partial-write path.

## Out of Scope

- Test raporu zarfı — 54.
- Operatör yedek restore — 85.
- Çalışma Alanı çıkış paketini ürüne restore — 18 gelecek yönü / 19.
- Mermaid'den Teknik Diyagram — ilgili belge/diyagram feature'ı.
- Notion/Jira/Linear sihirbazı, çok dosyalı paket, klasör, ZIP.
- GitHub senkronu — 61.

## Further Notes

- **Orient.** Glossary: Aşamalı import. Owning PRD: 13 `#standart-dosyalardan-içe-aktarma`. ADRs: 0004, 0005. Related: PRD 02 identity, PRD 10/54 test envelope, PRD 16 Taşınabilirlik, PRD 19 wizards/ZIP/restore.
- **Acceptance.** [Taşınabilirlik](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): allowed types, forbidden families, atomicity, no identity resurrection. A11y journey **import önizleme ve commit**.
- **Consumers.** 79 JSON is the happy-path input. 84 `Closing`/freeze rejects new imports; this feature does not special-case freeze.
- **Grant rule.** Does not consume the Account Access grant.
