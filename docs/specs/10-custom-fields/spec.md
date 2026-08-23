# Proje Bazlı Özel Alanlar

Kaynak: [`docs/workflow/10-custom-fields/phase-context.md`](../../workflow/10-custom-fields/phase-context.md)

## Problem Statement

Kurucu yalnız bir Projede yaşayan Metin, Sayı, Boolean, Tarih, tek seçim veya çoklu seçim alanlarıyla yapılandırılmış sınıflandırma kurmak ister. Bugün iskelette Proje şeması yoktur; etiket hiyerarşisi veya Lookup/Formula ikinci doğruluk kaynağına kayabilir. Yapılandırma modunun kabuğu, etiketler, Akıllı Koleksiyon koşulları ve İş Bağlam Kartı düzeni bu sorunun parçası değildir.

## Solution

Proje bazlı özel alan tanımları yalnız kendi Projesinde yaşar. Desteklenen türler `Text`, `Number`, `Boolean`, `Date`, `Single select`, `Multi select`’tir. Lookup ve Formula yoktur. Her alan seçilen kayıt türlerinin oluşturma, düzenleme, arama ve filtreleme yüzeylerinde görünür. Markdown gövdesi ve ham ekler forma dönüşmez. Tarihsel Oturum Testi ve Test değerlendirmesi kullanıcı tanımlı özel alan taşımaz. Tanım Yapılandırma modunda açılır; kabuk şemayı sahiplenmez.

## User Stories

1. As a founder, I want to define custom fields on one Project, so that classification stays Project-local.
2. As a founder, I want types `Text`, `Number`, `Boolean`, `Date`, `Single select`, and `Multi select`, so that I can model structured values without a spreadsheet.
3. As a founder, I do not want Lookup or Formula fields, so that derived truth cannot hide in a field.
4. As a founder, I want to bind a field to one or more supported record types, so that it does not appear on every kind.
5. As a founder, I want bound types to show the field on create, edit, search, and filter, so that the schema is usable not decorative.
6. As a founder, I do not want a Markdown body or raw attachment to become a custom-field form, so that documents stay documents.
7. As a founder, I do not want Session Tests or Test assessments to grow user-defined fields, so that historical test shape stays the executor’s.
8. As a founder, I want two Projects with the same field name to stay independent definitions, so that there is no Workspace-wide field identity.
9. As a founder, I want Configuration Mode to open this editor, so that field schema is away from daily editing.
10. As a founder, I do not want Project Shell to own the schema, so that 07 remains create/configure/copy of structure references.
11. As a founder copying Project structure, I want field definitions copied as independent clones, so that copy structure (07) has something real to copy without this feature becoming a Workspace dictionary.
12. As a founder, I do not want a parent/child tag hierarchy dressed as a field, so that Tags stay flat (workflow 13 owns atomic rename of one identity; two-tag merge is not first product).
13. As a founder, I want field values to use Mutation Contract (base revision + idempotency), so that stale overwrites cannot silently eat a Number.
14. As a founder, I want empty or unset to be distinct from a Boolean false or a select value, so that “not evaluated” is visible.
15. As a founder using only a keyboard or a screen reader, I want to add a field, set a value on Work, and filter by it, so that Arama ve ilişki’s field matrix is possible.
16. As a founder, I want English UI for field types and the editor, so that product language stays English.
17. As a founder, I do not want this feature to build Smart Collection rule UI, so that 34 consumes field values later.
18. As a founder, I do not want this feature to lay out the Work Context Card, so that 16 consumes fields as modules later.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [proje bazlı özel alanlar](../../prd/08-search-relations-and-evidence.md#proje-bazlı-özel-alanlar). Configuration Mode is the presentation host from [yapılandırma modu](../../prd/04-workspace-and-projects.md#yapılandırma-modu) (workflow 07), not the schema owner. Copy of definitions is listed under [proje yapısını kopyalama](../../prd/04-workspace-and-projects.md#proje-yapısını-kopyalama) and consumed here as the definition model. Tags stay [Etiketler](../../prd/08-search-relations-and-evidence.md#etiketler) (workflow 13): first product atomically renames one identity; two-tag merge is [gelişmiş etiket bakımı](../../prd/18-future-directions.md#gelismis-etiket-bakimi). No ADR.
- **Glossary.** Use Proje bazlı özel alan. Avoid Lookup, Formula, Workspace-wide schema, tag hierarchy. Supported record types for values: Work, Geri Bildirim, Kullanıcı Araştırması Oturumu, Risk, Varsayım, Karar, Test Handoff, Test Oturumu, Planlı Test Senaryosu, Test Açığı, Üretim Olayı, Kilometre Taşı, Proje Sürümü. Not: Oturum Testi, Test değerlendirmesi, Markdown body, raw files. Select options are not Etiket; atomic tag rename lives in workflow 13.
- **Project Custom Fields module.** Definition CRUD in Configuration Mode; per-type binding; values on create/edit; visibility on search/filter APIs. Values are not a second main record. Writes use Mutation Contract.
- **Types.** Closed six. Single/Multi select options are Project-local on the definition. Number is a number, not a formula result. Date uses Hesap locale for display, stored as a date value (not rewritten by time zone changes except display — timestamps vs dates: Date fields are dates; do not silently convert to zoned instants that shift the calendar day).
- **Delete and unbind fate.** Moving a definition to configuration trash does not delete record values without an impact preview. While the definition is in trash it is not active (values do not appear on create/edit/search/filter). Restore restores the definition and the stored values. Permanent delete of a definition removes its values. Unbinding a type hides the field on that type without deleting stored values; rebinding shows them again. Deleting a select option previews affected records; stored values that used that option become empty (unset), not a ghost label.
- **English UI labels.** First user-visible copy uses: `Custom field`, `Text`, `Number`, `Boolean`, `Date`, `Single select`, `Multi select`. Add missing labels to the PRD term table in the same change that first shows them.
- **Stack.** Prisma definition+value, Zod validation, TanStack Form, React DayPicker for Date. No formula engine.

## Testing Decisions

- **What a good test is.** Tests observe Project Custom Fields through its public interface: create each type; bind to Work (and a second supported type); value round-trip; empty distinct from Boolean false; field absent on unbound type; Lookup/Formula rejected; Session Test rejects definition; two Projects same name stay independent; Markdown body not converted; tag rename/merge absent. They do not assert column names. Expected values are the closed type catalog and bindings.
- **Seam (one).** Project Custom Fields — the product-facing definition/value interface. Configuration Mode is a host. Search/filter may be a thin API used later by Universal Search; this suite asserts the field is offered to search, not the full Search ranking. Playwright for Arama ve ilişki’s field matrix is this seam through the UI.
- **Modules under test.** Project Custom Fields only.
- **Prior art.** Almost no Vitest/Playwright yet. First tests live at this seam. Evidence: [Arama ve ilişki](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (custom field type matrix; not Lookup/Formula; only selected types).
- **Required counterparts.** No Workspace-wide schema; no Lookup/Formula; no Session Test fields; no tag hierarchy; select options are not Workspace tags and this feature does not rename or merge tags (13).

## Out of Scope

- Çalışma Alanı ortak özel alan sözlüğü.
- Lookup, Formula, spreadsheet.
- Etiket hiyerarşisi; etiket yeniden adlandırma/birleştirme (13).
- Yapılandırma modu kabuğu (07).
- Akıllı Koleksiyon UI (34), İş Bağlam Kartı düzeni (16).

## Further Notes

- **Orient.** Glossary: Proje bazlı özel alan. Owning PRD: `docs/prd/08-search-relations-and-evidence.md`. ADRs in play: none. Related: PRD 04 (mode, copy structure), PRD 16 (Arama ve ilişki), PRD 19 (no Lookup/Formula, no Workspace-wide field identity).
- **Acceptance.** Bind to [Arama ve ilişki](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) field matrix. Negative bounds are 19-class counterparts.
- **Tags boundary.** Workflow 13 owns the Workspace Etiket namespace. First product atomically renames one identity; two-tag merge is out (PRD 18). This feature must not implement tag rename/merge or treat select options as tags.
- **Consumers.** 07 copy structure clones definitions. 11 Draft form may display bound Work fields without defining them. 08/33/34 read values. This feature does not implement those UIs.
