# Proje Sürümü Planlama

Kaynak: [`docs/workflow/63-release-planning/phase-context.md`](../../workflow/63-release-planning/phase-context.md)

## Problem Statement

Kurucu yayımlanacak kapsamı Proje Sürümünde yönetmek ister. Bugün sürüm Kilometre Taşı, Odak Dönemi veya GitHub Release etiketiyle karışır; dış yayın Cantiara sonucunu örtük tamamlar. Sürüm kanıtı, iletişim ve paylaşım yüzeyleri bu sorunun parçası değildir.

## Solution

Kurucu tam olarak bir Projeye ait Proje Sürümü ana kaydında yayımlanacak İş kapsamını, isteğe bağlı çok-repo tag/GitHub Release/ortam bağlarını ve isteğe bağlı erişim/sonuç hipotezini yönetir. Durum `Draft` ve `Preparing` arasında serbesttir; `Published` ve `Cancelled` terminaldir ve yalnız açık kullanıcı eylemiyle oluşur. GitHub Release bağlantısı, changelog yayını veya Dış yüzey onayı durumu örtük yazmaz; kanıt veya öneri üretebilir. İlk ürün yerleşik hedef/gerçek yayın tarihi alanı eklemez; GitHub Release zamanı dış gerçektir. Proje Sürümü Kilometre Taşı veya Odak Dönemi değildir.

## User Stories

1. As a founder, I want a Proje Sürümü to belong to exactly one Proje, so that there is no workspace-wide or cross-project release in the first product.
2. As a founder, I want to gather İş records as the publishable scope, so that the record is yayımlanacak kapsam, not a sprint window or milestone result.
3. As a founder, I want to attach related tags, GitHub Release records, and environment links from the Proje's repositories onto that one Proje Sürümü, so that a multi-repo product still has one Cantiara release.
4. As a founder, I want status `Draft` ↔ `Preparing` freely, with `Published` and `Cancelled` terminal only via explicit action, so that a GitHub Release cannot close the Cantiara result.
5. As a founder, I want GitHub Release, changelog publish, or External Surface approval to at most suggest, never to write terminal status.
6. As a founder, I want an optional access vs outcome hypothesis with audience (free text and optional Persona/Contact/Company), one primary access path, evidence that access was observed, intended behavior/outcome, and evidence for that outcome, kept as separate fields and not as a gate.
7. As a founder, I do not want built-in planned or actual publish date fields on the Proje Sürümü; GitHub Release time stays on the GitHub dış kaydı.
8. As a founder, I want a scannable Proje Sürümleri area, with the Sürüm Kanıt Paketi living on the detail as a later feature (64), so that planning is not the pack.
9. As a founder, I do not want automatic scope fill or a score gate.
10. As a founder, I want English UI: `Project Release`, `Draft`, `Preparing`, `Published`, `Cancelled`.
11. As a founder, I want creating a Proje Sürümü not to be confused with `Milestone` or `Focus Period` records.

## Implementation Decisions

- **Owning documents.** [Proje Sürümü planlama](../../prd/12-github-and-project-releases.md#proje-sürümü-planlama). Term split: [PRD 02 terim sözlüğü](../../prd/02-domain-model-and-lifecycle.md#terim-sözlüğü). Lifecycle table in PRD 02. GitHub Release is a GitHub dış kaydı from 61, not this record. No new ADR.
- **Glossary.** Proje Sürümü, Kilometre Taşı, Odak Dönemi, Ürün sürüm adayı (must not be this record), Erişim gözlemi / Sonuç gözlemi (owned components live on 65; hypothesis fields are planning). Avoid: treating GitHub Release as Cantiara close, Milestone/Focus Period aliases, auto scope.
- **One seam.** Project Release Planning — CRUD Proje Sürümü, scope membership, hypothesis fields, explicit terminal transitions, refuse implicit close from GitHub Release. 64 pack and 65 notes consume this record.
- **Terminal only explicit.** Commands from 61 (GitHub Release upsert), 14 (surface approval), or 65 (changelog publish) must not call terminal status. This seam may expose a suggestion, not a write.
- **English UI.** `Project Release`, `Draft`, `Preparing`, `Published`, `Cancelled`. Add missing labels with first display.

## Testing Decisions

- **What a good test is.** Tests observe Project Release Planning through create, scope membership, status matrix, and hypothesis fields. They go red if a GitHub Release upsert writes `Published`/`Cancelled`, if the type is a Milestone or Focus Period, or if hypothesis fields act as a gate. They do not assert GitHub API internals.
- **Seam (one).** Project Release Planning — CRUD Proje Sürümü, scope, explicit terminals. 64 pack and 65 notes consume this record.
- **Modules under test.** Project Release Planning only.
- **Prior art.** First contract tests at this seam. Journeys **Sürüm Kanıt Paketi** (record exists) and **Sürüm erişimi ve sonucu** (hypothesis + later 65 observations).
- **Required counterparts.** Implicit terminal from GitHub Release absent; type ≠ Milestone/Focus Period; no built-in publish-date column; access hypothesis and outcome hypothesis stay separate and are not gates.

## Out of Scope

- Sürüm Kanıt Paketi değerlendirme yüzeyi — 64.
- Sürüm notu, changelog, Erişim/Sonuç gözlem turları — 65.
- Paylaşım/Dış yüzey — 14.
- Kilometre Taşı ve Odak Dönemi semantiği — 29/30.
- Ürün sürüm adayı kabulü — PRD 16.

## Further Notes

- **Orient.** Glossary: Proje Sürümü. Owning PRD: 12 `#proje-sürümü-planlama`. ADR: none owning. Related: PRD 02 terms, PRD 16 Sürüm erişimi (planning half), PRD 19 no cross-project release.
- **Acceptance.** Planning half of [Sürüm erişimi ve sonucu](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): hypothesis fields exist and are not gates; terminal status not closed by GitHub Release (counterpart on GitHub journey too).
