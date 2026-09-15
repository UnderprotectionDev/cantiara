# İş Şablonları

Kaynak: [`docs/workflow/17-work-templates/phase-context.md`](../../workflow/17-work-templates/phase-context.md)

## Problem Statement

Kurucu tekrar eden İş başlangıç bağlamını her seferinde yeniden yazmadan kullanmak ve bazen mevcut bir İşi şablona dönüştürmeden aynı Projede bir kez kopyalamak ister. Şablona canlı bağlı bir filo, Belge şablonu, Başlangıç yapılandırması veya yakalama mini şablonu bu ihtiyacın yerine geçmez. Şablon güncellemesinin geçmiş İşleri sessizce değiştirmesi güveni kırar.

## Solution

Kurucu Proje bazında yeniden kullanılabilir İş şablonları oluşturur. Şablon tür, açıklama iskeleti, seçili alan varsayılanları, hafif kontrol listesi ve isteğe bağlı göreli planlanan başlangıç/hedef tarihi kuralları taşır. Şablondan oluşan İş bağımsız kimlik ve anahtar kazanır; sonraki şablon değişikliği mevcut İşleri güncellemez. Mevcut İş, şablona dönüşmeden aynı Projede tek seferlik kopyalanabilir. Şablon zorunlu workflow kapısı değildir.

## User Stories

1. As a founder, I want Project-scoped reusable Work templates, so that repeating start context is not retyped.
2. As a founder defining a template, I want to store type, a description skeleton, selected field defaults, a light checklist, and optional relative planned-start/due rules, so that the template is start context rather than a content marketplace.
3. As a founder using relative dates, I want them computed from the day I create Work and shown as resolved real dates before I confirm, so that I never save a hidden formula.
4. As a founder creating Work from a template, I want a new main record with a new key and the Project default start status, so that the Work is independent.
5. As a founder, I want later template edits not to change already created Work, so that history is not rewritten.
6. As a founder, I want the template to refuse to carry working history, relations, an active close outcome, current status, or absolute dates, so that a template cannot clone a living record.
7. As a founder, I want creating from a template to stay optional, so that a template is never a workflow gate.
8. As a founder, I want to one-off copy an existing Work in the same Project without turning it into a template, so that a one-time duplicate is cheaper than a reusable definition.
9. As a founder copying, I want to preview which fields will copy, so that I am not surprised.
10. As a founder, I want the copy to open with a new key and Project default start status, so that it is not an alias of the source.
11. As a founder, I want title, type, description, non-date selected custom fields, and the light checklist to be copyable, so that start context moves.
12. As a founder, I want history, relations, close outcome, current status, planning memberships, and every absolute date including date custom-field values excluded from the copy, so that the duplicate is not a fork of life-cycle.
13. As a founder, I do not want a fleet of Work live-bound to a template, so that updating a template cannot rewrite many records.
14. As a founder, I do not want this Work template to be a Document template, so that Personal Review and placeholder syntax stay workflow 31.
15. As a founder, I do not want this template to be a Starter Configuration or Starter skeleton, so that Project setup stays 07/04.
16. As a founder, I do not want this template to be a capture mini-template, so that Inbox optional fields stay workflow 06.
17. As a founder copying Project structure, I want Work templates not to copy with stages and fields, so that templates are recreated in the target on purpose ([Proje yapısını kopyalama](../../prd/04-workspace-and-projects.md#proje-yapısını-kopyalama)).
18. As a founder, I want templates to use the same configuration trash rules as other configuration, so that a trashed template does not stay effective ([çöp kutusu](../../prd/13-data-security-and-portability.md#cop-kutusu-ve-geri-yukleme)).
19. As a founder, I want English UI for `Work Template`, `Create from template`, and `Duplicate Work`, so that the product language stays English.
20. As a founder using only a keyboard, I want to create a template, instantiate Work, and run a one-off copy, so that İş yaşam döngüsü can include this start path.
21. As a founder, I do not want content-and-history-producing comprehensive Project templates, so that 19 stays closed.
22. As a founder, I do not want a template marketplace or licensed content packs, so that start context stays founder-authored.
23. As a founder, I want applying a template not to set planning membership, GitHub links, or close outcome, so that start context cannot impersonate a living Work.
24. As a founder, I want a template not to carry Feature included-Work, blockers, or GitHub completion links, so that start context cannot impersonate a living graph.
25. As a founder instantiating twice from the same template, I want two Work keys, so that a template is not a singleton factory.
26. As a founder, I want relative dates to fail closed in preview if they cannot resolve, so that I never save an unbound formula.
27. As a founder, I do not want Document placeholder syntax `{{field}}` on Work templates, so that Work start context is not a Document template.
28. As a founder, I want one-off copy to stay in the same Project, so that this path cannot impersonate `Recreate in another Project`.
29. As a founder, I do not want template use to be counted as a required cadence, so that Personal Review-style mandatory rhythm cannot apply to Work.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [İş öğesi şablonları ve tek seferlik kopyalama](../../prd/06-work-management-and-planning.md#iş-öğesi-şablonları-ve-tek-seferlik-kopyalama). Main-record template row is [ana kayıt türleri](../../prd/02-domain-model-and-lifecycle.md#ana-kayıt-türleri-ve-asgari-sözleşmeler) (`Şablon`: produced record gets independent identity). Document templates are [Belge şablonları](../../prd/07-documents-and-knowledge.md#belge-şablonları). Capture mini-templates are [Hızlı yakalama](../../prd/05-capture-and-intake.md#hızlı-yakalama). Starter Configuration is PRD 04. Structure copy does not copy Work templates. No new ADR.
- **Glossary.** Use İş, Şablon (Work template), Başlangıç yapılandırması, Başlangıç iskeleti, Yakalama mini şablonu, Belge. Avoid: live-bound fleet, marketplace, workflow gate, Project fork.
- **Template payload.** Project-scoped. May carry type, description skeleton, selected field defaults, light checklist, optional relative planned-start/due rules. Relative dates resolve from the create day and the resolved dates are shown before apply. Does not carry working history, relations, active close outcome, current status, or absolute dates.
- **Instantiate.** Produced Work is an independent main record with a new key and Project default start status. Later template changes do not update existing Work. Use is optional; not a required workflow gate. Instantiation is a user-initiated command with base revision and idempotency key ([ortak kimlik](../../prd/02-domain-model-and-lifecycle.md#ortak-kimlik)).
- **One-off copy.** Same Project, without converting the source into a template. Preview fields to copy. New Work gets a new key and default start status. Copyable: title, type, description, selected non-date custom fields, light checklist. Not copied: history, relations, close outcome, current status, planning memberships, any absolute date including date custom-field values.
- **Not other templates.** Document template, Starter Configuration/skeleton, capture mini-template, and contentful Project templates are out. No live link from created Work back to template as a data source.
- **Trash.** Templates follow configuration trash: preview dependents, ineffective while in trash, restore keeps identity ([PRD 13](../../prd/13-data-security-and-portability.md#cop-kutusu-ve-geri-yukleme)). This feature does not build the global trash UI.
- **English UI labels.** `Work Template`, `Create from template`, `Duplicate Work`. Add missing labels to the term table in the same change.
- **Stack.** Existing API/web stack. No template-marketplace dependency.

## Testing Decisions

- **What a good test is.** Tests observe Work Templates through its public interface: define, instantiate, edit template after instantiate, one-off copy, and the negative payload exclusions. They assert independent identity and non-rewrite of history — not storage shape of skeleton JSON.
- **Seam (one).** Work Templates — the product-facing template and one-off copy interface. Playwright for İş yaşam döngüsü start paths is this seam through the UI.
- **Modules under test.** Work Templates only. Document templates, Starter Configuration, capture mini-templates, and Project structure copy appear as negatives/counterparts.
- **Prior art.** Contract tests at this seam. Evidence binds to [İş yaşam döngüsü](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) as the start-context package (synthetic for copy exclusions is acceptable alongside the real-project lifecycle journey).
- **Required counterparts.** Template edit does not mutate existing Work; copy excludes dates/history/relations/status; instantiate is optional; Document/capture/starter surfaces are absent.

## Out of Scope

- Şablona canlı bağlı İş filosu.
- İş şablonunu Belge şablonu, Başlangıç yapılandırması/iskeleti veya yakalama mini şablonu sayma.
- Şablonu zorunlu workflow kapısı yapmak.
- İçerik ve geçmiş üreten kapsamlı Proje şablonları, şablon pazarı.
- Proje yapısı kopyalamada şablonları sessiz taşıma.
- Global Çöp Kutusu UI'si.

## Further Notes

- **Orient.** Glossary: İş, Şablon, Başlangıç yapılandırması, Yakalama mini şablonu, Belge. Owning PRD: `docs/prd/06-work-management-and-planning.md` (`#iş-öğesi-şablonları-ve-tek-seferlik-kopyalama`). ADRs: none owning. Related: PRD 02 template row, PRD 04 structure copy, PRD 07 Document templates, PRD 05 capture mini-template, PRD 13 trash, PRD 16 İş yaşam döngüsü, PRD 19 comprehensive Project templates.
- **Acceptance.** Bind to [İş yaşam döngüsü](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) for the independent-identity start path. Document-template journey is a different row (`Belge şablonları`).
