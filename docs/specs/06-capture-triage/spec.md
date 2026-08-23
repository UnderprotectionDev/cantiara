# Yakalama ve Triage

Kaynak: [`docs/workflow/06-capture-triage/phase-context.md`](../../workflow/06-capture-triage/phase-context.md)

## Problem Statement

Kurucu belirsiz girdiyi kaybetmeden geçici Yakalama Gelen Kutusuna almak ve her öğeyi üç açık çıkıştan tam biriyle tüketmek ister. Bugün iskelette Gelen Kutusu, mini şablon, triage, sıralı/toplu görünüm, staging ek ve tarayıcı uzantısı yoktur; girdi ya kaybolur ya da yanlışlıkla İş/Taslak/bookmark sayılır. Tamamlanmamış İş Taslağı, Belge yazarlığı, Dosya Eki yaşamı ve tarayıcının kalıcı clip arşivi bu sorunun parçası değildir.

## Solution

Hızlı yakalama serbest metni veya isteğe bağlı mini şablonu Yakalama Gelen Kutusuna koyar; kalıcı ana kayıt henüz oluşmaz. Proje ve tür kesinse `Create Bug` (veya eşdeğer tür) doğrudan bir İş oluşturma komutunu çağırır ve Gelen Kutusu öğesi bırakmaz. Triage her öğeyi tam olarak üç çıkıştan birine götürür: yeni kalıcı kayda dönüşüm (ilgili kayıt feature’ına el verir), mevcut kayda köken veya kanıt olarak bağlama, ya da silme. `Sequential triage` yalnız açık çözümle ilerler. `Bulk sense-making` geçici görsel kümeler kurar; küme kalıcı sınıflandırma değildir. Yakalama eki şifreli staging’dir. Eşlenmiş WXT uzantısı web bağlamını idempotent gönderir; çevrimdışı kuyruk tutmaz.

## User Stories

1. As a founder, I want to capture freeform text into the Capture Inbox without creating a Work, so that a thought is safe before I know what it is.
2. As a founder, I want optional mini templates `Bug Capture`, `Feedback Capture`, and `Research Fragment`, so that I can add guiding fields without a required form.
3. As a founder using a mini template, I want every guiding field optional, so that saving a capture is never blocked on a field.
4. As a founder, I do not want a mini template to create a Bug, Geri Bildirim, Kaynak, or other main record by itself, so that capture stays staging.
5. As a founder who already knows Project and type, I want `Create Bug` (or the equivalent type action) to create one Work directly, so that I am not forced through the Inbox when I am sure.
6. As a founder using that direct create, I want no Capture Inbox item left behind, so that the same input does not live as both a note and a Work.
7. As a founder who knows the Project but not the type, I want the item in that Project’s Capture Inbox, so that triage still happens.
8. As a founder who does not know the Project, I want the item in the Workspace Capture Inbox, so that I can file it later.
9. As a founder, I do not want a capture to be a Work, a Draft, a bookmark, a search hit, a share item, or an export row, so that temporary input cannot leak into planning.
10. As a founder, I do not want a capture to expire because time passed, so that `temporary` does not mean a hidden SLA.
11. As a founder triaging, I want exactly three exits — convert to one new main record, attach to an existing record as origin or evidence, or delete — so that there is no fourth implicit state.
12. As a founder converting, I want the product to create exactly one new main record per confirmation and hand that create to the owning record feature, so that this feature does not finish a Work or Document.
13. As a founder, I do not want the system to guess a type and create a record, so that automatic triage never happens.
14. As a founder, I want optional similar-record suggestions with a visible basis, so that I can merge or skip with my eyes open.
15. As a founder, I do not want a suggestion to merge, relate, or retarget without my confirmation, so that similarity is not auto-linking.
16. As a founder attaching a capture to another Project’s record, I want the target Project and the relation previewed first, so that cross-Project bind is never silent.
17. As a founder converting or merging, I want original message, link, attachment, capture time, and origin preserved, so that provenance survives.
18. As a founder, I want a capture consumed by triage so the same input does not remain an Inbox item, so that I do not plan a ghost note.
19. As a founder in `Sequential triage`, I want focus on one item and advance only after one of the three exits, so that looking or editing fields is not progress.
20. As a founder in Sequential triage, I want to go back to the previous item or to the list, so that the mode is not a trap.
21. As a founder, I do not want Sequential triage to create a new queue, SLA, or auto-resolve, so that it stays an optional focus mode.
22. As a founder in `Bulk sense-making`, I want several captures side by side with temporary visual clusters, so that I can group meaning before I decide.
23. As a founder, I do not want a cluster to become a tag, relation, or lasting classification, so that layout metadata dies when the item is resolved.
24. As a founder, I want cluster names and positions kept as view metadata until resolve, and removed when the item exits, so that Bulk is durable for the session without becoming a record.
25. As a founder, I do not want that metadata in search, planning, sharing, publishing, or export, so that a pile of cards cannot leak.
26. As a founder attaching a file to a capture, I want an encrypted staging object owned only by that item, so that it is not a Dosya Eki yet.
27. As a founder, I do not want a capture attachment in search, share, publish, or export, so that staging cannot leak.
28. As a founder converting with a staging object, I want the target scope shown and promotion to Dosya Eki left to the File Attachment feature’s atomic finalize, so that failure leaves no visible attachment.
29. As a founder deleting a capture, I want its staging object deleted, so that Inbox delete is not an orphan blob.
30. As a founder with a paired browser extension, I want URL, selected text, selected image, or a user-started screenshot sent to the Inbox, so that Web Yakalama is an explicit clip.
31. As a founder, I do not want the extension to scan pages in the background, read history, or create a main record directly, so that the clipper is not a crawler.
32. As a founder, I want a preview of content, origin URL, and target Inbox before send, so that I can see the scope and risk.
33. As a founder, I want pairing via a five-minute one-time code from the product, so that an unmatched client cannot write the Inbox.
34. As a founder, I want extension links listed with device, browser, and last use, and revocable one by one, so that a lost browser stops writing.
35. As a founder, I want a send to carry an idempotency key and content fingerprint, so that retry does not duplicate an item.
36. As a founder, I do not want an offline extension queue, so that Online-only çalışma holds in the browser too.
37. As a founder on Safari, I do not want a first-product Web Clipper, so that the supported browsers stay Chromium family and Firefox.
38. As a founder whose connection drops while capturing, I want last successful save time and unsaved risk with no local queue, so that capture follows the client shell.
39. As a founder using only a keyboard or a screen reader, I want to capture, triage with three exits, run Sequential triage, and delete, so that the Yakalama journey is possible.
40. As a founder, I want English UI for Inbox, templates, exits, Sequential triage, and Bulk sense-making, so that product language stays English.
41. As a founder, I do not want email, Slack, Siri, or other out-of-app capture channels, so that the first product stays in-app plus the narrow clipper.
42. As a founder, I do not want this feature to own Work keys, Document bodies, or Dosya Eki versions, so that those journeys remain their features.
43. As a founder using Web Yakalama, I do not want the send to become a live copy of the page or a Kaynak record, so that the clip is not a live page mirror.
44. As a founder, I do not want the extension to keep an external clip archive beside the Capture Inbox, so that the browser is not a second store.
45. As a founder undoing a confirmed merge of a capture into an existing record, I want a preview of the original Inbox fields that will return and of only the binds this merge wrote, so that unrelated later edits on the target are not rewound.
46. As a founder converting, I want original text, link, or screenshot compared with the proposed record, and mini-template field mappings previewed, so that I confirm one new main record before the owning feature creates it.
47. As a founder seeing similar-record suggestions, I want same-Project matches first and other-Project matches in a named secondary group, so that a cross-Project bind cannot look like a local hit.
48. As a founder sending Web Yakalama, I want to search every authorized Project Inbox, so that the target is not limited to recently opened Projects.
49. As a founder whose extension pairing sits unused for 30 days, I want re-authorization before the next write, so that a stale browser cannot keep an Inbox grant.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [hızlı yakalama](../../prd/05-capture-and-intake.md#hızlı-yakalama) and [tarayıcı uzantısıyla web yakalama](../../prd/05-capture-and-intake.md#tarayıcı-uzantısıyla-web-yakalama). Temporary vs main-record is [ana kayıt türleri](../../prd/02-domain-model-and-lifecycle.md#ana-kayıt-türleri-ve-asgari-sözleşmeler). Multi-step convert/promote uses [ADR-0004](../../adr/0004-atomik-idempotent-kesinlestirme.md) via Mutation Contract (workflow 04), not a second protocol. No new ADR.
- **Glossary.** Use Yakalama Gelen Kutusu öğesi, Yakalama mini şablonu, Sıralı triage (`Sequential triage`), Toplu Anlamlandırma (`Bulk sense-making`), Yakalama eki, Web Yakalama, Taslak (must not be this), İş (must not be this), Dosya Eki (must not be the staging object). Do not introduce bookmark, SLA queue, or auto-triage.
- **Capture Inbox module.** Workspace Inbox and per-Project Inbox. Items are temporary: no main identity, lasting relation, archive, search, share, publish, or export. They do not auto-delete on a timer. Human writes use Mutation Contract. Direct `Create Bug` (when Project and type are known) calls Work create and writes no Inbox item — this module does not assign Work keys.
- **Conflict note.** Phase-context emphasizes Inbox-only intake. PRD also requires direct `Create Bug` (or equivalent) when Project and type are known. PRD wins: that path calls Work create and leaves no Inbox item. Work identity stays workflow 09. Triage’s three exits apply only to Inbox items; they are not a second path for the direct-create case.
- **Mini templates.** Closed catalog: `Bug Capture` (`Observed Behavior`, `Expected Behavior`, `Reproduction Context`); `Feedback Capture` (`Feedback`, `Channel`, optional `Contact`); `Research Fragment` (`Note or Excerpt`, `Source Context`). All fields optional. Template formats the Inbox item only.
- **Triage exits.** Exactly three: convert to one new main record (hand off to the owning feature; Markdown Document is one allowed target; no multi-record recipe); bind/merge to an existing record as origin or evidence (evidence *link type* remains workflow 45’s specialist; this feature may attach origin and must preview); delete. Consume the Inbox item. Origin trace is derived later on the record; this feature preserves origin fields. Convert preview shows original text/link/screenshot beside the proposed record and, for mini templates, field mappings before apply. Same-Project similar suggestions are primary; other-Project matches are a named secondary group with Project names; bind still requires target+relation preview. Merge undo uses Mutation Contract: preview restores the original Inbox item (message, link, attachment, capture time, origin) and removes only binds/fields this merge wrote; later unrelated target edits stay.
- **Sequential triage / Bulk sense-making.** Sequential advances only after an explicit exit. Bulk clusters are view metadata (name, position) until resolve; then removed; never tags/relations/search/export.
- **Capture attachment.** Encrypted staging object owned by the item; outside search/share/publish/export. On convert, show target scope; Dosya Eki promotion is File Attachment’s atomic finalize; failure leaves no visible attachment. Delete capture deletes staging.
- **Extension.** WXT React extension. Chromium family (Chrome, Edge, Brave, Arc) and Firefox; not Safari. Pairing: in-app five-minute one-time code; list device/browser/last use; revoke one; unused 30 days requires re-auth; Hesap close will revoke all (close feature consumes this list). Target Inbox is any authorized Project or Workspace Inbox (searchable), not only recently opened Projects. Sensitive/wide read permission shows scope and risk before the action; a declined permission does not silently widen the clip. The pairing token is not injected into page content, logs, or the capture payload. Narrowest permission on explicit clip. Idempotency key + fingerprint; cancelled pairing before finalize writes nothing. No offline queue. No whole-site persistent read. Web Yakalama is not a Kaynak, not a live page mirror, and not an external clip archive; the send is an Inbox item.
- **English UI labels.** First user-visible copy uses: `Capture Inbox`, `Sequential triage`, `Bulk sense-making`, `Bug Capture`, `Feedback Capture`, `Research Fragment`, `Create Bug`, `Convert`, `Attach to existing`, `Delete`. Sequential triage and Bulk sense-making are already glossary UI; add the others to the PRD term table in the same change that first shows them.
- **Stack.** Web app + Hono/oRPC + Prisma + R2 for staging blobs with envelope encryption; WXT extension; Uppy only if upload reuse fits without becoming Dosya Eki. Do not add an offline extension queue or a second clip archive.

## Testing Decisions

- **What a good test is.** Tests observe Capture Inbox through its public interface: freeform and mini-template save without a main record; `Create Bug` when Project+type known creates no Inbox item; three exits consume the item; convert preview before apply; merge undo restores Inbox fields without rewinding later target edits; Sequential does not advance on view/edit; Bulk cluster is not a tag and disappears on resolve; staging object absent from search/export; extension retry is idempotent; unpaired or 30-day-stale client cannot write; disconnect creates no queue. They do not assert R2 keys, WXT boilerplate, or Prisma shapes. Expected values are product rules (three exits, optional fields, no timer delete, no Safari requirement).
- **Seam (one).** Capture Inbox — the product-facing capture/triage/extension interface. Work/Document/File Attachment creates are adapters behind convert (test double until those features exist). Playwright Chromium and Firefox for the Yakalama journey observe the same seam. Mutation Contract is how writes finalize, not a second module under test here.
- **Modules under test.** Capture Inbox only (including the extension adapter behind the same interface).
- **Prior art.** Almost no Vitest/Playwright yet. First contract tests live at this seam. Evidence: [Yakalama](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (real project; Chromium and Firefox E2E; schema; counterparts; time-advance that the item is not deleted).
- **Required counterparts.** Capture is not in Universal Search, not a Draft, and not a saved bookmark; no auto-triage; no fourth exit; no offline queue; Safari not claimed; staging is not Dosya Eki and not a shared library; suggestion cannot merge without confirm; merge undo does not rewind unrelated later target edits; email/Slack capture absent; extension send is not a Kaynak, not a live page mirror, and not an external clip archive; unused pairing past 30 days cannot write until re-auth.

## Out of Scope

- Yakalamayı İş, Taslak veya kaydedilmiş bookmark sayma.
- Otomatik triage, zorunlu form, kullanıcı tanımlı yakalama formu.
- Sıralı triage / Toplu Anlamlandırmayı kuyruk, etiket veya kalıcı küme sayma.
- Yakalama ekini Dosya Eki veya paylaşılmış medya kütüphanesi sayma (workflow 14).
- Tarayıcı yakalamasını harici clip arşivi, canlı sayfa aynası veya Kaynak kaydı yapmak (workflow 44).
- İş Taslağı (workflow 11), Belge yazarlığı (31).
- Safari Web Clipper, e-posta/Slack/Siri yakalama.
- Kanıt bağı uzmanlığı (workflow 45) ve GitHub bağlantısı (61).

## Further Notes

- **Orient.** Glossary: Yakalama Gelen Kutusu öğesi, Yakalama mini şablonu, Sıralı triage, Toplu Anlamlandırma, Yakalama eki, Web Yakalama. Owning PRD: `docs/prd/05-capture-and-intake.md` (hızlı yakalama, tarayıcı uzantısı). ADRs in play: 0004 (consumed for convert/promote/extension finalize). Related but not owning: PRD 02 (temporary entity), PRD 03 (online-only), PRD 16 (Yakalama), PRD 19 (no extra capture channels, no Safari clipper as first product, no auto-linking).
- **Acceptance.** Bind to [Yakalama](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): Bug Capture / Feedback Capture / Research Fragment optional fields; three exits preserve origin; extension always writes Inbox not a main record; no timer delete; not in search/share/publish/export. Time-advance counterpart is required. Negative bounds (no email/Slack capture, no auto-triage) are 19-class counterparts.
- **Consumers.** Workflow 09 (Work create, including direct `Create Bug`), 31 (Document convert target), 14 (Dosya Eki promotion), 11 (must not treat capture as Draft), 45 (evidence link semantics after bind). Client shell (03) owns empty-state chrome; capture must not add a queue.
