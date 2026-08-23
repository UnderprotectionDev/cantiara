# PostgreSQL Şeması ve Migration Artefaktları

Kaynak: [`docs/workflow/60-schema-artifacts/phase-context.md`](../../workflow/60-schema-artifacts/phase-context.md)

## Problem Statement

Kurucu Veri Modeli Diyagramının kesin sürümünden incelenebilir PostgreSQL DDL ve iki sürüm arasındaki schema-only Migration Artefaktını statik olarak doğrulamak ister. Bugün şema ya yalnız resimdir ya da ürün canlı veritabanına bağlanıp migrate ediyor gibi durur. Güvensiz Down uydurulur; uygulanmışlık checkbox'ı yalan söyler; modelleme bu kartta tekrar edilir. Canlı migrate, Prisma runtime ve veri backfill bu sorunun parçası değildir.

## Solution

Kurucu pinlenmiş Veri Modeli Diyagramı Sürümünden tam PostgreSQL DDL önizler. Artefakt ancak yapısal invariant'lar, izinli extension matrisi ve üretimle aynı pinlenmiş PostgreSQL major'ında Neon disposable veritabanında parse/apply birlikte geçerse `Statically Validated` olur; veritabanı atılır. Ürün kullanıcı credential'ı almaz ve canlı hedefe bağlanmaz. İki kesin sürüm arasındaki Şema Değişiklik Taslağı yıkıcı etkileri gizlemeden önizler. Onaylı Up ve varsa Güvenli Down değişmez Migration Artefaktı ve `Migration Artifact Digest` ile kalır. Down yoksa `Safe Down could not be produced` görünür; güvensiz Down icat edilmez. Uygulanmışlık durumu yoktur. Varlık modelleme 59'da kalır.

## User Stories

1. As a founder, I want to preview and copy full PostgreSQL DDL from an exact Data Model Diyagram Sürümü, so that I can take SQL to my own CLI without the product running it.
2. As a founder, I want that DDL to refuse to show if any closed structural invariant fails, so that I never get partial commented SQL.
3. As a founder, I want static validation to use the same pinned PostgreSQL major and allowed extension matrix as production, on a fresh Neon disposable database that is destroyed after the result, so that `Statically Validated` means catalog checks plus that throwaway parse/apply passed — not that SQL was applied to any user, staging, or production database, and not `Ran` / `Applied` / `Production-ready`.
4. As a founder, I do not want the product to collect database credentials or connect to a live/staging/production target, so that this feature cannot migrate.
5. As a founder, I want named invariant errors with exact element paths for every violation in one report, so that the first error does not hide the rest.
6. As a founder, I want matrix-foreign extensions (`postgis`, `vector`, …) rejected by name, and `CREATE EXTENSION` never generated, so that dogfooding can express `pg_trgm` without pretending the target has it installed.
7. As a founder, I want a Schema Change Draft between two exact Diyagram Sürümü pins, typed through the closed operation catalog with dependency order and destructive warnings, so that a text diff is not the artifact.
8. As a founder, I want destructive operations (drop table/column, type narrowing, …) visible and requiring extra confirmation, so that deletes are not hidden.
9. As a founder, I want to edit Up SQL before confirm, with generator output vs my edits shown separately and the edited text re-validated, so that I cannot sneak data SQL or unsupported ops into the draft.
10. As a founder, I want Down only when every operation is non-destructive and the inverse is fully determined by the two diagram versions (Safe Down criterion), so that an unsafe Down is never invented.
11. As a founder, I want `Safe Down could not be produced` plus which operation failed the criterion in the warning manifest when any one op drops the whole inverse, so that partial Down is forbidden.
12. As a founder confirming, I want an immutable Migration Artifact with source/target versions, generator version, static validation, edit diff, warning manifest, model hashes, and `Migration Artifact Digest` over exact Up/optional Down bytes.
13. As a founder, I want a later correction to mint a new artifact with `Supersedes Migration Artifact` rather than rewrite the old, so that old evidence/PR/test binds are not inherited.
14. As a founder, I do not want `Applied` / `Not applied` or a manual checkbox, so that a commit or PR merge cannot be treated as database appliedness.
15. As a founder, I want `.sql` export with an accompanying manifest (PRD 13 Technical SQL output), so that export is not a backup or repo write.
16. As a founder, I want presentation-only edits on the diagram not to change the model hash, so that a moved box does not invalidate DDL.
17. As a founder using only a keyboard or a screen reader, I want to complete DDL and Migration Artifact preview/export, so that the closed accessibility journey is possible.
18. As a founder, I do not want this feature to redesign tables — modeling stays on the Data Model Diagram in 59.

## Implementation Decisions

- **Owning documents.** [Veri modeli şemaları](../../prd/11-technical-diagrams-and-schema-artifacts.md#veri-modeli-semalari) including invariant catalog, extension matrix, operation catalog, Safe Down criterion, model hash. Export: [Teknik SQL çıktısı](../../prd/13-data-security-and-portability.md#standart-biçimlerde-seçili-kayıt-dışa-aktarma). [ADR-0020](../../adr/0020-semayi-urun-icinde-tasarlayip-dogrulanmis-ddl-uret.md). Neon disposable DBs: [tech-stack](../../tech-stack.md). Atomic confirm: ADR-0004. No new ADR.
- **Glossary.** Tasarlanan şema, PostgreSQL DDL taslağı, Statik olarak doğrulanmış SQL, Şema Değişiklik Taslağı, Migration Artefaktı, Migration Artifact Digest, Supersedes Migration Artifact, Güvenli Down taslağı. Avoid: applied SQL, live migrate, ORM migrate, invented Down, modeling copy of 59.
- **One seam.** Schema Artifacts — DDL preview/validate/export, change draft, confirm artifact. Input is an exact Data Model Diyagram Sürümü from Technical Diagrams (59). Tests may fixture that version at this seam.
- **Neon disposable validation.** Same pinned major + allowed extensions (`pg_trgm` + core). New database per run; destroy after. Not the repo's Vitest Postgres. Label is `Statically Validated` (glossary: Statik olarak doğrulanmış SQL): catalog invariants, dependency order, generator goldens, and disposable parse/apply all passed. The disposable apply is a validation step; destroying that database is required. The label is not production-ready, not a Test Oturumu, not `Çalıştırıldı` / `Uygulandı` / `Applied`, and does not mean the SQL ran on any user/staging/production database.
- **No live migrate.** No credentials, no apply to user DBs, no introspection, no repo write, no appliedness state. Catalog-inexpressible diffs block artifact generation by named element.
- **Unsafe Down not invented.** Safe Down criterion: an operation is reversible only if its class is `Yıkıcı değil` and the inverse is fully determined by the two Diagram Versions. Ineligible ops (`Drop table`, `Drop column`, `Narrow column type`, `Drop primary key`, `Drop foreign key`, `Drop unique constraint`, `Drop check constraint`, `Drop enum value`, `Drop enum type`, `Drop domain constraint`, `Drop domain`, and `Desteklenmiyor`) drop the whole inverse. No partial reverse SQL.
- **Closed catalogs (this package).** Invariants: Unique table name; Unique column name (and unique constraint/index names in a table); Valid identifier; Primary key present; Foreign key end exists; Foreign key type match; Composite column list validity; Index column and method validity; Non-duplicate index definition; Referential action validity (`NO ACTION`/`RESTRICT`/`CASCADE`/`SET NULL`/`SET DEFAULT`); Nullability and default consistency; Enum and domain value validity; Sortable foreign key graph. Extensions: `pg_trgm` allowed; core types/indexes allowed without extension; `postgis`, `vector`, `citext`, `hstore`, `uuid-ossp`, `pgcrypto` and any off-matrix extension rejected; no `CREATE EXTENSION`. Operations and phase order are the PRD 11 closed tables copied into tickets 02 and 03.
- **English UI.** `Statically Validated`, `Schema Change Draft`, `Migration Artifact`, `Safe Down could not be produced`, `Supersedes Migration Artifact`. Add missing labels with first display.

## Testing Decisions

- **What a good test is.** Schema Artifacts public interface: invariant failures block DDL, disposable apply then destroy, destructive preview, Down present/absent, digest byte sensitivity, supersede pointer, no appliedness field, no credential API. PostgreSQL adversarial goldens from PRD 16. Presentation-only edit does not change hash.
- **Seam (one).** Schema Artifacts. Playwright: **PostgreSQL DDL ve Migration Artefaktı önizleme/export'u**.
- **Required counterparts.** Live migrate absent; invented Down absent; modeling commands absent (59); Prisma migrate is the product's own schema story, not this user artifact.

## Out of Scope

- Veri Modeli canvas modelleme — 59.
- Canlı/staging/production migrate, credential, introspection, drift.
- Prisma runtime, veri backfill, `USING` serbest tip, view/function/trigger kataloğu.
- Artefaktı repository'ye yazma veya PR açma — 19.
- Ürünün kendi `prisma migrate` kabulü (PRD 16 migration sınırı); kullanıcı artefaktı ile karıştırılmaz.

## Further Notes

- **Orient.** Glossary: DDL taslağı, Şema Değişiklik Taslağı, Migration Artefaktı, Güvenli Down. Owning PRD: `docs/prd/11-technical-diagrams-and-schema-artifacts.md` `#veri-modeli-semalari`. ADR 0020. Journey: **Teknik Diyagram ve şema** (DDL/migration half). Related: PRD 13 export, PRD 16, PRD 19, tech-stack Neon.
- **Acceptance.** Bind to the schema half of [Teknik Diyagram ve şema](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): static DDL, schema-only Up, unsafe Down blocked, appliedness blocked, Neon disposable, goldens, SQL export manifest.
- **Upstream.** 59 must exist as pinned Data Model versions; this feature does not re-host the canvas.
