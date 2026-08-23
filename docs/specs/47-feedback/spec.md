# Geri Bildirim Kaydı ve Feed

Kaynak: [`docs/workflow/47-feedback/phase-context.md`](../../workflow/47-feedback/phase-context.md)

## Problem Statement

Kurucu gelen özgün mesajı kanal, zaman ve kimlik bağlamıyla kaybetmeden tutmak ve uzun içeriği yoğun okumak ister. Bugün Geri Bildirim Kaynak alt türüne, özellik isteğine veya destek ticket'ına kayabilir; özet aslının yerine geçebilir; İşe dönüşüm kaydı silebilir; feed Bildirim Merkezi veya sosyal yaşam döngüsü gibi davranabilir. Contact birleştirme ve kişisel veri silme bu kartın işi değildir. Kaynak tazeliği 44'tedir.

## Solution

Kurucu Geri Bildirimi ayrı uzman ana kayıt olarak tutar: özgün mesaj, kanal, zaman, isteğe bağlı bağlantı ve ekler, isteğe bağlı Contact/Company, ve proje/İş/Karar bağları. Özet veya Kanıt niteliği aslının yerine geçmez. Kayıt özellik isteği, İş veya sosyal gönderi değildir. Kurucu mesajı önizlemeyle tam olarak bir İşe dönüştürebilir; Geri Bildirim silinmez. Feed aynı ana kayıtlardan yoğun okuma yüzeyidir; beğeni, yorum dizisi veya sosyal yaşam yoktur ve Kaynak kaydının sürüm sözleşmesini yeniden tanımlamaz.

## User Stories

1. As a founder, I want Feedback as its own expert master record, so that an incoming message is not a Source subtype and does not inherit URL recheck or snapshot life.
2. As a founder, I want the original message, channel, time, optional link, and attachments preserved, so that later summary cannot replace what was said.
3. As a founder, I want optional Contact and Company on Feedback, so that identity is available when I know the sender and not invented when I do not.
4. As a founder capturing Feedback from an unknown sender, I want the product not to force Contact creation, so that identity stays honest.
5. As a founder, I want multiple Feedback records to bind to the same Work as separate origins, so that several messages do not collapse into one vote.
6. As a founder, I want Feedback never to be a vote, automatic priority, or roadmap instruction, so that a message cannot steer planning by count.
7. As a founder converting Feedback to Work, I want a preview of the one Work to create, starting title/body mapping, and the `Kökeni` relation, so that nothing is born until I confirm.
8. As a founder after that conversion, I want the Feedback record to remain, so that converting is not deleting the original.
9. As a founder, I want conversion to create exactly one master record and never a batch of hidden records, so that one message is not silently exploded.
10. As a founder, I want Feedback statuses `New`, `Reviewed`, and `Archived` not to change related Work status, so that reading a message is not a planning mutation.
11. As a founder attaching Kanıt niteliği on a Work–Feedback link, I want reported problem, suggested solution, workaround, impact, frequency, independence, and audience fit kept as separate optional fields, so that missing values do not block the relation.
12. As a founder, I want severity, frequency, independence, or audience fit that were not in the source labeled as my interpretation with author and time, so that commentary is not presented as the original message.
13. As a founder, I want the product never to extract those fields from the message or declare campaign siblings as unique evidence, so that independence stays a human judgment.
14. As a founder, I want Kanıt niteliği on one Work–Feedback link not to copy silently onto another Work, so that the same message can mean different context per target.
15. As a founder, I want Kanıt Rolü on that link to stay a separate field from Kanıt niteliği, so that direction of use is not derived from impact fields and forms no combined score.
16. As a founder, I want optional follow-up `Follow up`, `Followed up`, or `Outcome verified` on the evidence link only, so that tracker intent does not become Feedback or Work lifecycle or a requester CRM.
17. As a founder in the first product, I want Feedback created from in-app Quick Capture and existing sources, so that there is no public form, comment, vote, or two-way requester thread.
18. As a founder, I want a dense Feed of Feedback and long-body Source records showing identity or channel, time, attachments, project, and related Work/Decision, so that I can scan originals without a second record type.
19. As a founder, I want a Feed row not to be a social post, comment thread, vote, or second status lifecycle, so that sorting the Feed cannot change Source or Feedback status or priority.
20. As a founder opening a Feed row, I want `Open Source Record` to the same master record, so that the Feed is a reading surface rather than a copy.
21. As a founder, I want the Feed to reuse Smart Collection filter and sort conditions, so that scanning does not invent a second query language.
22. As a founder, I do not want the Feed to be the Unified Notification Center, inbox product, or customer-support tool, so that attention signals stay in their own feature.
23. As a founder, I do not want the Feed to redefine Source versioning or recheck, so that freshness stays in the Source feature.
24. As a founder, I want English UI `Feedback`, `Feed`, `Convert to Work`, and `Open Source Record`, so that labels match the term table.
25. As a founder using only a keyboard or a screen reader, I want to record Feedback, convert with preview, and scan the Feed, so that the evidence journey is possible without a pointer.
26. As a founder, I do not want likes, comment threads, or social lifecycle on Feedback, so that the first product stays an identity-and-evidence book.
27. As a founder, I do not want this feature to merge Contacts or erase personal data, so that 46 and 81 stay the owners of those actions.
28. As a founder, I do not want Feedback to be treated as a Source, özellik isteği, Work record, support ticket, social post, or CRM opportunity, so that the glossary Avoid list holds.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [Geri Bildirim Kaydı](../../prd/08-search-relations-and-evidence.md#geri-bildirim-kaydı) and [Geri Bildirim ve Kaynak Feed görünümü](../../prd/08-search-relations-and-evidence.md#geri-bildirim-ve-kaynak-feed-görünümü). Lifecycle is [ana kayıt türleri](../../prd/02-domain-model-and-lifecycle.md#ana-kayıt-türleri-ve-asgari-sözleşmeler) (`Yeni` / `İncelendi` / `Arşivlendi`). Origin and participant relations are [standart ilişki türleri](../../prd/02-domain-model-and-lifecycle.md#standart-ilişki-türleri). Kanıt Rolü as a field on the link is defined in [Kanıt Rolü](../../prd/08-search-relations-and-evidence.md#kanit-rolu-ve-iliski-ustverisi) and rendered in Kanıt Akışı by 45; this feature stores Feedback-specific niteliği and follow-up on the Work–Feedback link and must not build Kanıt Akışı. Capture channels are [Yakalama](../../prd/05-capture-and-intake.md). No new ADR.
- **Glossary.** Use Geri Bildirim, Contact, Company, Kaynak, İş, Kanıt bağı, Kökeni, Kanıt niteliği, Kanıt Rolü, Birleşik Bildirim Merkezi (must not be this Feed). Do not introduce Source-record subtype, social post, support ticket, CRM opportunity, inbox product, or a second Feed record.
- **Master record.** Feedback is a Project-scoped expert master record. It keeps original message, channel, time, optional URL, attachments, optional Contact (`Katılımcısı`) and Company, and relations to Project, Work, and Decision. It does not inherit Source URL recheck, candidate snapshot, or version life. Creating Feedback from Quick Capture or an existing Source copies origin; it does not turn Feedback into that Source.
- **Unknown sender.** Contact is optional. Write paths must not require creating a Contact to save Feedback.
- **Not a vote.** Many Feedback records may origin-link to one Work. Count, uniqueness, or independence is never an automatic priority or roadmap instruction. Unique Contact/Company counts shown on Work priority supports (PRD 06) are context, not this feature's scoring engine.
- **Convert to Work.** `Convert to Work` previews exactly one Work, target Project, starting title/body from the original message, and the `Kökeni` relation. Confirm creates that Work; the Feedback record is not deleted or archived by conversion. No AI, no multi-record spawn, no skipping Work field rules. This is not Test Handoff and not a support ticket close.
- **Niteliği vs original.** Work–Feedback evidence may carry optional Kanıt niteliği fields, each blank or `Unknown`. Values not explicit in the source are labeled as founder interpretation with author and time. The original message is shown as a separate text. The product does not extract fields from the message. The same Feedback may carry different niteliği per Work; one link does not copy onto another. Kanıt Rolü on the same link is a separate optional field; neither is derived from the other; they form no score. Optional `Follow up` / `Followed up` / `Outcome verified` is link-local tracker intent only.
- **Statuses.** Feedback `New` / `Reviewed` / `Archived` do not write Work status, priority, or Kanban membership.
- **Feed.** Feed is a dense reading view over the same Feedback and long-body Source master records, with identity or channel, time, attachments, project, and related Work/Decision. It may reuse Smart Collection filter/sort. A row is not a record, not a social post, not a thread, not a vote, and not a second lifecycle. Order does not write source status or priority. Detail opens via `Open Source Record`. Feed is not Unified Notification Center, not universal search, and not an inbox product. It does not redefine Source versioning (44).
- **First-product intake.** In-app Quick Capture and existing sources only. No public form, comments, votes, or two-way requester conversation.
- **English UI labels.** `Feedback`, `Feed`, `Convert to Work`, `Open Source Record`, `New`, `Reviewed`, `Archived`, `Follow up`, `Followed up`, `Outcome verified`. Missing labels join the PRD term table in the same change. No Turkish UI.
- **Classification.** Private Feedback bodies are hassas kişisel veri. Original message is not replaced by summary in export or share previews this feature might show; sharing itself is 73.

## Testing Decisions

- **What a good test is.** Tests observe Feedback through the public record-and-feed interface: create Feedback with original message/channel/time, optional Contact, convert-to-Work preview/commit, status independence from Work, niteliği vs original, Feed listing the same ids, Feed sort not writing status. They do not assert Prisma shapes. Expected values are product rules (record remains after convert, unknown sender allowed, no social actions).
- **Seam (one).** Feedback — the product-facing Feedback record and Feed reading surface. Capture intake and Source storage are adapters/counterparts, not a second module under test.
- **Modules under test.** Feedback only. Contact merge, personal-data erase, Kanıt Akışı, Notification Center, and Source recheck are counterparts (“absent / not redefined”).
- **Prior art.** Same single-seam contract style as Account Access. Bind to [Kanıt akışı](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). Cloud tests must not use production message bodies.
- **Required counterparts.** Source-subtype behavior absent; Feedback is not a feature request, Work record, or social post; convert does not delete Feedback; Feed row is not a notification or universal-search hit type; likes/comments absent; Contact not required; Kanıt Rolü not derived from niteliği; Feed does not write Source version; Contact merge and personal-data erase absent.

## Out of Scope

- Geri Bildirimi özellik isteği, İş veya sosyal gönderi sayma.
- Contact birleştirme, kişisel veri silme, Kaynak yeniden kontrol / sürüm yaşamı.
- Kanıt Akışı yüzeyi ve genel Kanıt Rolü editörü (45).
- Birleşik Bildirim Merkezi, evrensel arama, inbox veya destek aracı.
- Herkese açık form, yorum, oy, çift yönlü requester konuşması, e-posta senkronu.
- Sosyal gönderi yaşam döngüsü, beğeni, yorum dizisi.

## Further Notes

- **Orient.** Glossary: Geri Bildirim, Contact, Company, Kaynak, Kökeni, Kanıt niteliği. Owning PRD: `docs/prd/08-search-relations-and-evidence.md` (Geri Bildirim Kaydı; Feed). ADRs in play: none. Related: PRD 02 (lifecycle, `Katılımcısı`), PRD 05 (Quick Capture), PRD 06 (priority supports consume counts, do not score here), PRD 16 (Kanıt akışı), PRD 19 (no CRM/social).
- **Acceptance.** Bind to [Kanıt akışı](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): original message remains the record; convert preview; Feed is the same masters. Negative: not a Source, not Notification Center, not social lifecycle.
- **Consumers.** `45-evidence` owns Kanıt Rolü UI and Kanıt Akışı; this feature owns Kanıt niteliği fields and the Feed. `46-contact-and-company` is optional identity; `44-sources-and-freshness` owns Source versioning the Feed must not redefine; `71-attention-signals` owns Notification Center.
