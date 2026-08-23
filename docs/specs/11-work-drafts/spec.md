# Tamamlanmamış İş Taslakları

Kaynak: [`docs/workflow/11-work-drafts/phase-context.md`](../../workflow/11-work-drafts/phase-context.md)

## Problem Statement

Kurucu ayrıntılı İş formunu yarıda bırakınca kaybetmemek ister. Bugün iskelette Taslak yoktur; yarı form ya kaybolur ya da yanlışlıkla İş, Yakalama veya Belge taslağı sayılır. Yakalama Gelen Kutusu, kesinleşmiş İş yaşamı ve Belge taslağı bu sorunun parçası değildir.

## Solution

Bağlantı varken İş oluşturma formundaki değişiklikler kişisel `Draft` olarak otomatik korunur. Taslak ana kayıt, anahtar, arama sonucu, planlama, ilişki ucu, bildirim, paylaşım, yayın veya export değildir. `Drafts` yüzeyinden sürdürülür veya silinir; süreyle silinmez. Açık `Create` tek İş üretir ve taslağı kaldırır. Online-only: son başarılı otomatik kayıt zamanı ve henüz yazılmamış risk görünür; yerel kuyruk yoktur. Proje bazlı özel alanlar 10’dan gelir; Taslak ikinci şema tanımlamaz.

## User Stories

1. As a founder filling a new Work form, I want autosave to a Draft while online, so that a refresh does not wipe the form.
2. As a founder, I want a personal `Drafts` surface to resume or delete, so that unfinished forms are findable without becoming Work.
3. As a founder, I do not want a Draft to appear in Universal Search, Backlog, Kanban, Smart Collections, relations, notifications, sharing, publishing, or export, so that it is not a main record.
4. As a founder, I do not want other records to relate to a Draft, so that a half-form cannot enter the graph.
5. As a founder, I do not want a timer to delete the Draft, so that `temporary` is not an SLA.
6. As a founder completing `Create`, I want exactly one Work and the Draft gone, so that the same form cannot mint two keys.
7. As a founder deleting a Draft, I want no Work affected, so that delete is not close.
8. As a founder, I do not want a Draft to be a Capture Inbox item, so that unclassified clips and unfinished forms stay distinct.
9. As a founder, I do not want a Draft to be a Document draft or conflict draft, so that this feature stays Work-form only.
10. As a founder whose connection drops, I want last successful autosave time and unsaved risk, so that I know what the server has.
11. As a founder, I do not want a local Draft queue, so that Online-only çalışma holds.
12. As a founder reconnecting, I do not want hidden replay of unsaved keystrokes, so that I choose what to keep.
13. As a founder, I want bound Project custom fields on the form without this feature defining them, so that 10 stays the schema owner.
14. As a founder using only a keyboard or a screen reader, I want to leave, resume, create, and delete a Draft, so that Taslak is possible.
15. As a founder, I want English UI `Draft` / `Drafts` / `Create`, so that product language stays English.
16. As a founder, I want Draft writes to use Mutation Contract, so that double autosave is idempotent.
17. As a founder, I do not want a Draft to emit Proje Etkinliği or Work history as if it were a main record, so that unfinished forms stay off the activity surface.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [tamamlanmamış oluşturma taslakları](../../prd/05-capture-and-intake.md#tamamlanmamış-oluşturma-taslakları). Temporary entity rules: [ana kayıt türleri](../../prd/02-domain-model-and-lifecycle.md#ana-kayıt-türleri-ve-asgari-sözleşmeler). Online-only chrome is Client Shell (03); this feature must not add a queue. Finalize calls Work Lifecycle create (09). No ADR.
- **Glossary.** Use Taslak. Avoid Yakalama, İş, Belge taslağı, Çakışma Taslağı as this object. Do not emit Proje Etkinliği until `Create`.
- **Work Drafts module.** Autosave, list, resume, delete, finalize-to-one-Work. Personal to the Hesap. Target Project may be selected on the form; until create, it is not a Work in that Project. Custom field widgets are rendered from 10’s definitions for Work; this module stores values only as form state. Until `Create`, no Work key, no Proje Etkinliği / record-history activity event, and no Capture Inbox item. Reconnect does not replay unsaved keystrokes; the founder chooses what to keep.
- **English UI labels.** First user-visible copy uses: `Draft`, `Drafts`, `Create`, `Last saved`, `Unsaved changes may be lost`. Reuse Client Shell phrasing for the last two when identical. Add missing labels to the PRD term table in the same change that first shows them.
- **Stack.** TanStack Form, TanStack Pacer for autosave cadence (implementation detail of “while connected”), oRPC, Prisma. No local DB, no Yjs.

## Testing Decisions

- **What a good test is.** Tests observe Work Drafts through its public interface: autosave while online; resume; not in search; timer does not delete; no Work activity event before `Create`; `Create` yields one Work and removes the Draft; second create from the same Draft impossible; disconnect shows last save + risk and no queue; reconnect does not hidden-replay; delete Draft does not delete Work. They do not assert debounce milliseconds as a product number (PRD gives no cadence). Expected values: not a main record; one Work per finalize.
- **Seam (one).** Work Drafts — the product-facing Draft interface. Work create is an adapter. Playwright for Taslak is this seam through the UI. Capture Inbox must remain a counterpart (a Draft is not listed there).
- **Modules under test.** Work Drafts only.
- **Prior art.** Almost no Vitest/Playwright yet. First tests live at this seam. Evidence: [Taslak](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (synthetic: disconnect, recovery, time-advance).
- **Required counterparts.** Not in Universal Search; not a Capture item; not two Works from one Draft; no local queue; reconnect does not hidden-replay; no Work activity event before `Create`.

## Out of Scope

- Yakalama (06), İş yaşamı (09) ötesi finalize, Belge taslağı / Çakışma Taslağı (31).
- Evrensel Arama ve Dış yüzey içeriği.
- Özel alan şeması (10).
- Offline kuyruk, cihaz-yerel editör tamponu.

## Further Notes

- **Orient.** Glossary: Taslak, Yakalama Gelen Kutusu öğesi (not this), İş (not until create). Owning PRD: `docs/prd/05-capture-and-intake.md`. ADRs in play: none (0004 via finalize into Work create). Related: PRD 03 online-only, PRD 16 Taslak, PRD 19 no offline.
- **Acceptance.** Bind to [Taslak](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). Negative bounds (no search, no queue) are counterparts.
- **Consumers.** 09 receives finalize. 06 must not write Drafts. 03 supplies empty-state chrome. 10 supplies Work field definitions for the form.
