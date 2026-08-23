# Contact ve Company Kimliği

Kaynak: [`docs/workflow/46-contact-and-company/phase-context.md`](../../workflow/46-contact-and-company/phase-context.md)

## Problem Statement

Kurucu aynı kişiyi Geri Bildirimler boyunca tanımak ve kanıt geçmişini o kimlikten okumak ister. Bugün kimlik defteri yoktur; kopya Contact'lar dağılır, birleştirme ilişkili Geri Bildirimleri kaybettirebilir veya Kanıt Rolü ile önceliği sessizce yeniden yazabilir. Contact/Company bir CRM pipeline, ticari hesap veya kişisel veri silme yüzeyi değildir; silme 81'dir. Geri Bildirim kaydı ve feed 47'dedir.

## Solution

Kurucu Çalışma Alanı kapsamında Contact ve isteğe bağlı Company tutar. Contact geri bildirimi veren kişiyi kararlı iç kimlikle tanır; Company birden fazla Contact ve Geri Bildirimi ortak kuruluş bağlamında gruplar, kullanımı zorunlu değildir. Kopyalar yalnız kullanıcı başlatmalı birleştirmeyle çözülür: ana kayıt ve çatışmalar önizlenir, otomatik birleştirme yoktur. Birleştirme ilişkili Geri Bildirimleri, Company ve Persona bağlarını kaybettirmez; Kanıt Rolü veya öncelik ölçütü yazmaz. Emekli kimlik içeriksiz yönlendirmedir.

## User Stories

1. As a founder, I want a Workspace-scoped Contact with a stable internal identity, so that the same person is recognizable across Feedback without becoming a User Account.
2. As a founder, I want display name and email to be optional, so that I can keep an identity when I only know the person from a message.
3. As a founder, I want normalized email addresses stored as identity aliases, so that the same inbox can be recognized without treating email as the primary key.
4. As a founder, I want an optional Company that groups Contacts and Feedback under a shared organization context, so that company is available when useful and never required.
5. As a founder, I want a Contact to have at most one current Company via `Belongs to Company`, so that current affiliation is unambiguous while past changes remain in history.
6. As a founder, I want a Contact profile to open related Feedback, Company, and Persona Document links at their source, so that the identity book is a hub rather than a copied dossier.
7. As a founder, I want Persona to remain a Document template relation rather than a Contact subtype, so that the product does not grow a second person model or persona score.
8. As a founder, I want the product never to auto-assign a Contact to a Persona, so that that link stays an explicit relation.
9. As a founder, I do not want plan, subscription, ARR/MRR, revenue, contract, sales stage, geo segment, or commercial value score on Contact or Company, so that the identity book cannot become a CRM.
10. As a founder seeing two Contacts with the same normalized email, I want a strong duplicate candidate, so that obvious copies are visible without being merged for me.
11. As a founder seeing similar names or Company affiliation, I want only a weak suggestion, so that resemblance is not treated as identity.
12. As a founder, I want no automatic merge in any case, so that identity consolidation is always my action.
13. As a founder starting a merge, I want to choose the surviving Contact and preview conflicting fields, email aliases, Feedback history, Company, and Persona relations, so that I know what will be rewritten before I confirm.
14. As a founder confirming a merge, I want atomic consolidation onto one surviving master record, so that copies do not remain as separate `Merged` live records.
15. As a founder after a merge, I want the retired identity to redirect old links and keys with visible origin, so that bookmarks and relations keep resolving.
16. As a founder, I want a retired identity never to be reused as a new Contact key or a separate search hit, so that the old id cannot fork into a second person.
17. As a founder, I want merge history to keep original records and actor attribution, so that I can later explain who was combined.
18. As a founder, I want merge not to rewrite Kanıt Rolü on related evidence links, so that identity cleanup cannot change how a Feedback supports or contradicts Work.
19. As a founder, I want merge not to write priority-criterion values or any priority ranking, so that consolidating people is not a planning mutation.
20. As a founder, I want related Feedback to remain reachable after merge, so that evidence history is not lost when copies collapse.
21. As a founder undoing a merge, I want the retired identity restored as a master record with only merge-attributed values and relations split back, so that later unrelated edits are not silently rewound.
22. As a founder undoing a merge after redaction or permanent delete, I want the preview to show what cannot come back, so that undo does not promise a full restore.
23. As a founder, I want Contact and Company to follow active/archive/trash like other master records, so that identity is not a second lifecycle.
24. As a founder, I want Contact email classified as hassas kişisel veri, so that it never enters search, export, share, or publish as a Secret-free public field.
25. As a founder, I want English UI `Contact`, `Company`, `Merge Contacts`, and `Merge Preview`, so that labels match the term table.
26. As a founder using only a keyboard or a screen reader, I want to create, open, archive, and merge Contacts, so that identity work is possible without a pointer.
27. As a founder, I do not want this feature to erase personal data, export a person package, or host `Confirm GitHub Identity`, so that those journeys stay in 81 while this book remains the identity they act on.
28. As a founder, I do not want Feedback capture, Feed, or Kanıt Akışı to live in this feature, so that the identity book does not swallow the evidence record.
29. As a founder, I do not want Company-to-Company merge, Invoice customer, or commercial Account, so that only Work and Contact remain merge-supported master types.
30. As a founder, I want Table and Universal Search to find Contact and Company in Workspace scope, so that the identity book is reachable from record discovery without becoming a CRM index.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [Contact ve Company kimliği](../../prd/08-search-relations-and-evidence.md#contact-ve-company-kimliği). Ownership and lifecycle are [kapsam ve sahiplik](../../prd/02-domain-model-and-lifecycle.md#kapsam-ve-sahiplik) and [ana kayıt türleri](../../prd/02-domain-model-and-lifecycle.md#ana-kayıt-türleri-ve-asgari-sözleşmeler). Merge, retired identity, and undo are [değişiklik geçmişi, aktör ve geri alma](../../prd/02-domain-model-and-lifecycle.md#değişiklik-geçmişi-aktör-ve-geri-alma). Relations `Şirkete ait` and `Katılımcısı` are [standart ilişki türleri](../../prd/02-domain-model-and-lifecycle.md#standart-ilişki-türleri). Personal-data class is [database-first güvenlik tabanı](../../prd/13-data-security-and-portability.md#database-first-guvenlik-tabani). CRM and survey expansion stay in [19](../../prd/19-out-of-scope.md). No new ADR: merge and identity scope are already decided.
- **Glossary.** Use Contact, Company, Kayıt birleştirme, Birleştirmeyi geri alma, Emekli kayıt kimliği, Geri Bildirim, Persona (Document, not a master type), Kanıt bağı, İş. Do not introduce User Account, customer record, CRM account, commercial Account, Invoice customer, persona score, or a second person model. Contact and Company are Workspace-scoped; they are not Project records and not Hesap identity.
- **Identity book.** Contact is the stable internal identity of the person who gave Feedback. Display name and email are optional. Normalized emails are aliases, not the immutable id. Company is a light master record with a name; it groups Contacts and Feedback when the founder links them. Company is never required. A Contact has at most one current Company; affiliation history is kept on change.
- **Profile as hub.** Contact profile opens related Feedback and Company/Persona links at source via `Open Source Record`. It does not copy Feedback bodies, commercial fields, or a CRM timeline into the Contact card.
- **Persona.** Persona remains a Markdown Document from the prepared template, related through the standard catalog. This feature stores the Contact–Persona and Company–Persona relations; it does not create a Persona master type, auto-assign, or score.
- **No CRM.** Contact and Company must not grow plan, subscription tier, ARR/MRR, revenue, contract, sales stage, geo segment, or commercial value score. Table/search for these types is record discovery, not a pipeline.
- **Duplicate candidates.** Same normalized email is a strong copy candidate. Name or Company similarity is a weak suggestion. Candidates never merge themselves. Unknown Feedback senders must not be forced into Contact creation (that rule is enforced at Feedback write in 47; this module must not require a Contact to exist).
- **Merge preview.** User-initiated merge only. Preview names the survivor, field conflicts, email aliases, Feedback history, Company, and Persona relations that will be rewritten. Confirming consolidates onto one surviving master in one atomic write. Copies end as a contentless retired-identity redirect, not a live `Merged` record. Retired ids are not reused and are not separate search hits.
- **Merge must not rewrite meaning.** The merge rewrite set is identity fields, aliases, and relation endpoints onto the survivor. It must not write Kanıt Rolü, kullanıcı yorumu, Kanıt niteliği, İş priority-criterion values, Backlog rank, or Work status. Related Feedback stays reachable; evidence role on each Work–Feedback link stays as the founder set it.
- **Undo.** Merge undo restores the original retired id as a master and splits only values/relations attributed to that merge event. Later unrelated edits are not rewound; conflicting later values stop for a user decision. Redacted or permanently deleted content is shown as unrestorable in the undo preview.
- **Classification.** Contact email, and private Feedback reached through the profile, are hassas kişisel veri. They are not Secret tokens, but they are not public fields. This feature does not implement `Export personal data` / `Erase personal data`; 81 consumes the same Contact identity.
- **English UI labels.** First user-visible copy uses: `Contact`, `Company`, `Merge Contacts`, `Merge Preview`, `Belongs to Company`, `Open Source Record`. Missing labels are added to the PRD term table in the same change that first shows them. No Turkish UI. Locale/time-zone stay in account preferences.
- **Observability.** Merge, undo, and identity-field changes are Denetim kaydı events with aliased identities and no raw email in logs. Failed merge leaves no partial survivor rewrite.

## Testing Decisions

- **What a good test is.** Tests observe Contact and Company through the public identity-book interface: create/update Contact and Company, optional Company affiliation, duplicate candidate listing, merge preview, merge commit, retired-id resolve, merge undo, and whether related Feedback remains reachable. They do not assert Prisma row shapes or mock private collaborators. Expected values are product rules (no auto-merge, survivor choice, role/priority unchanged, retired id not searchable), not recomputed implementation.
- **Seam (one).** Contact and Company — the product-facing identity-book interface used by Feedback, search, and later personal-data erase. Merge persistence is behind that interface (real versus test double). Playwright for create/open/merge is the same seam observed through the UI.
- **Modules under test.** Contact and Company only. Feedback write, Kanıt Akışı, personal-data package, CRM fields, and Account identity are not in this suite except as “this field/action is absent / this relation survived merge” counterparts.
- **Prior art.** Contract tests follow the Account Access pattern at one seam. Synthetic fixture supports [Kanıt akışı](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) identity context and the identity-book side of [Hesap ve kişisel veri](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). Cloud tests must not use production Contacts, emails, or private Feedback bodies.
- **Required counterparts.** Auto-merge absent; CRM fields absent; Feedback record/feed not hosted on the identity book; merge does not change Kanıt Rolü or priority-criterion values; retired id redirects and is not a search hit; undo does not rewind unrelated edits; Company-to-Company merge absent; personal-data erase UI absent.

## Out of Scope

- Geri Bildirim kaydı, feed, Hızlı Yakalama ve Kanıt Akışı yüzeyi.
- `Kişisel veriyi dışa aktar` / `Kişisel veriyi sil`, `Confirm GitHub Identity`, Hesap kapatma.
- Company-to-Company birleştirme; İş birleştirmesi.
- CRM, gelir, sözleşme, satış aşaması, abonelik, ticari değer skoru; Invoice müşterisi.
- Persona ana kayıt türü, persona skoru, Contact'ı personaya otomatik atama.
- Anket aracı, herkese açık form, requester portalı.

## Further Notes

- **Orient.** Glossary: Contact, Company, Kayıt birleştirme, Birleştirmeyi geri alma, Emekli kayıt kimliği. Owning PRD: `docs/prd/08-search-relations-and-evidence.md` (Contact ve Company kimliği). ADRs in play: none. Related but not owning: PRD 02 (merge contract, Workspace scope, `Şirkete ait`), PRD 13 (personal-data class; erase is 81), PRD 16 (Kanıt akışı; Hesap ve kişisel veri identity book), PRD 19 (no CRM).
- **Acceptance.** Bind to [Kanıt akışı](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (identity is recognizable across Feedback; merge does not invent Kanıt bağı or rewrite role) and to the identity-book half of [Hesap ve kişisel veri](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (Contact exists so later export/erase has a target). Erase/export UI is 81. Negative bounds (no CRM, no auto-merge, no Company-to-Company merge) are 19-class counterparts on those journeys.
- **Consumers.** Workflows `47-feedback` relate optional Contact/Company; `45-evidence` must not treat same Contact as automatic evidence; `81-personal-data` erases this identity; `12-relations` owns the generic relation catalog this feature uses for `Şirkete ait` and Persona links.
