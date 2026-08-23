# Sürüm İletişimi ve Sonuç Öğrenimi

Kaynak: [`docs/workflow/65-release-communication/phase-context.md`](../../workflow/65-release-communication/phase-context.md)

## Problem Statement

Kurucu Proje Sürümü notunu ve değişiklik günlüğünü kaynak kapsama bağlayarak hazırlamak, yayımdan sonra hedef kitleye erişim ile gözlenen sonucu ayrı tarihli turlarda yeniden ele almak ister. Bugün not GitHub Release metniyle tek gerçek sanılır; erişim ve sonuç tek skora ezilir; yeni tur eski turu siler. Build in Public ve manuel Proje Güncellemesi bu kartın işi değildir.

## Solution

Kurucu tek Proje Sürümü kapsamındaki İşlere dayanan sürüm notlarını ve sürekli changelog görünümünü hazırlar. Anlatı kaynak kapsama ve isteğe bağlı `Why was this done?` izine bağlanır; kapsamsız pazarlama paragrafı değildir. Not 64 kanıt paketinin yerine geçmez. Yayın kapanış önizlemesi (14 güvenlik sözleşmesi) onaylanmadan herkese açık snapshot yazılmaz; yayın eylemi iç İş/Sürüm durumunu kendiliğinden değiştirmez. Atlanabilir `Reassess impact` turu `Access observation` ile `Outcome observation` alanlarını ayrı tutar; her tur tarihli sahipli bileşendir; sonraki tur öncekini silmez. `Could not learn` tamamlanmış değerlendirmedir.

## User Stories

1. As a founder, I want release notes prepared from İş in this Proje Sürümü's scope, so that the narrative is bound to scope and rationale.
2. As a founder, I want published notes to assemble into a visitor-facing changelog across Proje Sürümü records, using existing Markdown and tags — not a second tag system.
3. As a founder, I want an optional compact `Why was this done?` trail of individually selected records and separately approved public field snapshots, so that selecting a record does not publish related private fields.
4. As a founder, I want a notes draft to stay private until publish approval, so that there is no authenticated private changelog audience.
5. As a founder, I want a publish-close preview of internal statuses, proposed public labels, changelog links, Why-trail snapshots, and Build-in-Public events in one place, so that I approve scope explicitly.
6. As a founder, I want that publish action not to complete İş, write Proje Sürümü terminal status (63), or change public labels that I did not approve.
7. As a founder, I do not want this changelog to be a Build in Public feed or Wiki publish (75/74).
8. As a founder, I want a skippable `Reassess impact` after publish that places Goal, hypothesis, expected vs observed on Features/İş, and previous dated observations side by side, opening sources.
9. As a founder, I want each round to have independent `Access observation` and `Outcome observation` fields I can fill together, separately, or later.
10. As a founder, I want each observation to carry `Observed` / `Partially observed` / `Not observed` / `Could not learn`, free text, time, author, and evidence binds that belong only to that observation — not merged into the Proje Sürümü's general evidence.
11. As a founder, I want access observation not to imply the product behavior happened, and outcome observation not to imply enough users were reached; the product must not combine them into success.
12. As a founder, I want multiple dated rounds; a new round must not rewrite the previous; edits keep author, time, and previous value in normal history.
13. As a founder, I want reassessment optional: it does not block Feature or Proje Sürümü close, and it does not mint a scorecard, auto measurement, fixed cadence, or follow-up İş.
14. As a founder, I want an optional `Look again` reminder on a date I pick; firing is only a reminder signal, not a new round.
15. As a founder who started a round, I want Action-needed until both fields are explicitly judged or I `Close assessment`; `Could not learn` counts as judged; merely publishing or filling one field does not close the signal.
16. As a founder, I want English UI for notes, changelog, `Reassess impact`, `Access observation`, `Outcome observation`.
17. As a founder, I want the closed accessibility path for **yayın önizleme ve iptal** to include this preview.

## Implementation Decisions

- **Owning documents.** [Proje Sürümü iletişimi](../../prd/12-github-and-project-releases.md#proje-sürümü-iletişimi). Owned components: Erişim gözlemi, Sonuç gözlemi in PRD 02. Preview security: PRD 14. 63 owns terminal status; this publish must not write it. 69 is Manual Proje Güncellemesi — different record. No new ADR.
- **Glossary.** Proje Sürümü, Erişim gözlemi, Sonuç gözlemi, Sürüm iletişim iskeleti (not auto narrative). Avoid: GitHub Release as the notes source of truth, health score, Build in Public confusion, independent impact-assessment main record (19).
- **One seam.** Release Communication — notes/changelog bound to scope, publish preview (calling 14 snapshot apply only for approved items), dated access/outcome rounds. `Reassess impact` places Goal, release hypothesis, Feature/İş expected vs observed, and previous dated observations side by side and opens sources; Access and Outcome stay separate owned components. A round is not a Üretim Olayı or Manuel Proje Güncellemesi. Does not host 64 pack or 63 status machine.
- **English UI.** `Release notes`, `Changelog`, `Why was this done?`, `Reassess impact`, `Access observation`, `Outcome observation`, `Observed`, `Partially observed`, `Not observed`, `Could not learn`, `Close assessment`. Add missing labels with first display.

## Testing Decisions

- **What a good test is.** Release Communication: notes require scope binds; GitHub Release text is not auto-copied as truth; two dated rounds with conflicting vs consistent observations; single-field in-progress; observation-only evidence; `Could not learn`; explicit close; skipped reassessment; publish does not complete İş or 63 terminal.
- **Seam (one).** Release Communication. Journey **Sürüm erişimi ve sonucu**. A11y **yayın önizleme ve iptal**.
- **Required counterparts.** Access+outcome not a single score; new round does not delete old; not Build in Public; skipped reassessment allowed; `Look again` is not a new round; `Reassess impact` shows Goal/hypothesis/expected-vs-observed/previous observations side by side.

## Out of Scope

- Sürüm Kanıt Paketi — 64.
- Proje Sürümü terminal durumu — 63.
- Build in Public snapshot akışı — 75.
- Manuel Proje Güncellemesi — 69.
- Wiki yayını — 74.
- Sabit 7/14/30 gün kadans veya bağımsız etki ana kaydı — 19.
- Otomatik dönemsel herkese açık anlatı — 19.

## Further Notes

- **Orient.** Glossary: Erişim gözlemi, Sonuç gözlemi, Proje Sürümü. Owning PRD: 12 `#proje-sürümü-iletişimi`. Journey: **Sürüm erişimi ve sonucu**. Related: PRD 14 preview, PRD 16 E2E (two rounds, `Öğrenilemedi`, open close).
- **Acceptance.** [Sürüm erişimi ve sonucu](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) communication half.
