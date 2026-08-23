# Proje Kapanış Özeti

Kaynak: [`docs/workflow/70-project-closure-summary/phase-context.md`](../../workflow/70-project-closure-summary/phase-context.md)

## Problem Statement

Kurucu tamamlanan veya vazgeçilen bir Proje için tarafsız bir kapanış yazısı ister. Boş bir Belge ile başlamak kaynakları kaybettirir; sistemin başarı anlatısı, retrospektifi veya kapanış ana kaydı yazması ise gerçeği çarpıtır. Başlangıç iskeleti (Persona / Retrospective / Launch Plan) bu iş değildir: o yeni Proje boş başlıklarıdır. Taslağın kaydedilmeden kalıcı Belge sayılması da yanlıştır.

## Solution

Kurucu seçtiği Karar, Risk, Proje Sürümü, Belge, Üretim Olayı ve tamamlanmış İş kayıtlarından yalnız bölüm başlıkları ve okunabilir kaynak bağlantıları içeren düzenlenebilir bir Kapanış özeti taslağı üretir. Sistem yorum, sonuç, başarı hükmü veya özet metni yazmaz. Taslak kullanıcı düzenleyip açıkça kaydedene kadar kalıcı Belge değildir. Kayıt, türü `General` olan sürümlü bir Proje Belgesidir; başlık varsayılanı `Project Closure Summary`'dir; kaynak Projeye köken bağı taşır. Özet projeyi kilitlemez ve zorunlu değildir.

## User Stories

1. As a founder completing or abandoning a Proje, I want an optional closure summary, so that closing does not require a blank page or a generated boast.
2. As a founder, I want to select Karar, Risk, Proje Sürümü, Belge, Üretim Olayı, and completed İş records as sources, so that the draft is mine to scope.
3. As a founder, I want the draft to contain only section headings and readable source links from those records, so that the product does not write my conclusions.
4. As a founder, I want a preview of which sources will land under which heading, so that I can adjust selection before generating.
5. As a founder, I want the system not to produce commentary, result, success judgment, rationale, or summary prose, so that neutrality holds.
6. As a founder who has not saved, I want the draft not to be a persistent Belge, so that abandoning the editor leaves no ghost record.
7. As a founder who saves, I want a versioned Proje Belge of type `General` titled `Project Closure Summary` by default, so that the summary is an ordinary document afterwards.
8. As a founder, I want that Belge to carry a Kökeni link to the source Proje, so that provenance is visible.
9. As a founder, I want the saved summary not to change Proje status and not to lock the Proje, so that writing remains optional.
10. As a founder, I want the saved Belge not to replace the source Karar, Risk, İş, or other ana kayıtlar, so that closure writing is not a second canon.
11. As a founder, I want an optional neutral comparison of planned due-date history versus completion/closure events, so that slipped or on-time dates are visible without a performance score.
12. As a founder, I want that comparison not to mint a new actual-date field, health judgment, or score, so that it stays a reading of existing history.
13. As a founder, I want reusable learnings copyable to a Kişisel Wiki Belge with Proje and period origin preserved, so that memory can leave the Proje without becoming a second canon.
14. As a founder, I do not want this draft confused with a Başlangıç iskeleti, so that new-Proje empty headings stay in 07/31.
15. As a founder, I do not want an automatic retrospective or a closure ana kayıt type, so that the summary remains a Belge.
16. As a founder, I want English UI copy, so that the product language stays English.
17. As a founder using only a keyboard or a screen reader, I want to select sources, preview, edit, and save, so that Dogfooding and Belge bütünlüğü can include closure writing.
18. As a founder, I want the saved Belge to use normal Belge versioning afterwards, so that later edits are document history, not a special closure store.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [Proje kapanış özeti](../../prd/06-work-management-and-planning.md#proje-kapanış-özeti). Kapanış özeti taslağı is the glossary term. Belge types and versioning are [Markdown Belge yönetimi](../../prd/07-documents-and-knowledge.md#uygulama-içi-markdown-belge-yönetimi). Başlangıç iskeleti is [görüşlü başlangıç](../../prd/04-workspace-and-projects.md#görüşlü-başlangıç-yapılandırmaları) and lives in 07/31 once instantiated. Automatic narrative is forbidden by [19](../../prd/19-out-of-scope.md#ai-otomasyon-ve-programatik-erişim). No new ADR.
- **Glossary.** Use Kapanış özeti taslağı, Belge, Proje, Kökeni, Kişisel Wiki, Başlangıç iskeleti. Do not introduce closure ana kayıt, automatic retrospective, success narrative, or starter-skeleton alias. Do not call the unsaved draft a Belge.
- **Draft is ephemeral.** Generating a Kapanış özeti taslağı from selected headings and links does not persist a Belge. Closing the editor without save leaves no ana kayıt. Save is an explicit action that creates the versioned Belge.
- **Saved shape.** Belge türü `General` (`Genel`). Default title `Project Closure Summary` (`Proje kapanış özeti`). Kökeni to the source Proje. After save it is a normal sürümlü Belge; it does not replace the source Karar, Risk, İş, or other ana kayıtlar, does not change Proje yaşam durumu, and is not required to close.
- **Content rule.** Selected Karar, Risk, Proje Sürümü, Belge, Üretim Olayı, and completed İş records contribute only section headings plus readable source links. Preview shows which sources go to which heading. No commentary, result, success judgment, rationale, or generated summary text.
- **Optional date comparison.** Planned due-date history versus existing completion/closure events may render as a neutral comparison (moved, before/on/after target, or still open). No new actual-date field, health judgment, or performance score.
- **Wiki copy.** Reusable learnings may be copied to an independent Kişisel Wiki Belge with Proje and period origin preserved. Copy is explicit; it does not make Wiki the Proje canon.
- **Not starter skeleton.** `Persona`, `Retrospective`, and `Launch Plan` empty heading catalogs stay in project shell + documents. This draft is not that catalog and is not created at Proje start.
- **English UI labels.** First user-visible copy uses: `Project Closure Summary`, `Closure Summary Draft`, `General`. Missing labels go to the term table in the same change that first shows them.

## Testing Decisions

- **What a good test is.** Tests observe Project Closure Summary through its public interface: source selection, preview of heading/link mapping, unsaved draft is not a Belge, save creates type `General` with Kökeni, source ana kayıtlar unchanged, no generated success prose, optional date comparison is neutral. They do not parse private markdown builders or assert Prisma. Expected values are product rules (headings+links only, persist-on-save-only).
- **Seam (one).** Project Closure Summary — the product-facing draft-and-save interface on a completing or abandoned Proje. Belge versioning after save is the documents module as collaborator.
- **Modules under test.** Project Closure Summary only. Başlangıç iskeleti, Manuel Proje Güncellemesi, and sürüm notu are counterparts.
- **Prior art.** No Vitest/Playwright suite yet. Contract tests at this seam. Evidence binds to [Dogfooding](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) and [Belge bütünlüğü](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
- **Required counterparts.** Unsaved draft absent from search/export; no success sentences in generated output; source ana kayıtlar unchanged by save; not a `Retrospective` starter skeleton; Proje status unchanged by save.

## Out of Scope

- Özeti otomatik retrospektif veya kapanış ana kaydı sayma.
- Taslağı kaydetmeden kalıcı Belge yapmak.
- Başlangıç iskeleti (`Persona`, `Retrospective`, `Launch Plan`) ile kapanış taslağını karıştırma.
- Başarı anlatısı, gerekçe veya özet cümlesi üretme.
- Proje durumunu kilitleme veya kapanışı özet zorunluluğuna bağlama.
- Manuel Proje Güncellemesi veya sürüm notunu kapanış sayma.

## Further Notes

- **Orient.** Glossary: Kapanış özeti taslağı, Belge, Kökeni, Kişisel Wiki, Başlangıç iskeleti. Owning PRD: `docs/prd/06-work-management-and-planning.md` (Proje kapanış özeti). ADRs in play: none. Related: PRD 07 (Belge), PRD 04 (iskelet), PRD 16 (Dogfooding, Belge bütünlüğü), PRD 19 (no automatic narrative).
- **Acceptance.** Bind to [Dogfooding](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (real Cantiara Proje close-or-learn writing) and [Belge bütünlüğü](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (the saved artifact is a Belge). Accessibility rides those journeys’ document editing paths.
- **Consumers.** 31-documents owns later versioning of the saved Belge. 32-personal-wiki owns the destination of an explicit learning copy. 07-project-shell / 31 keep starter skeletons.
