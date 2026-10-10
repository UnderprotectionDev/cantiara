# Kullanıcı Araştırması Oturumları

Kaynak: [`docs/workflow/43-research-sessions/phase-context.md`](../../workflow/43-research-sessions/phase-context.md)

## Problem Statement

Kurucu bir görüşme veya yönlendirilmiş araştırma temasının amacını, izin bağlamını, türlenmiş notunu ve sürüme sabit kanıtını kişisel veri sınırını bozmadan tutmak ister. İzin yokken atıf, dosya veya paylaşım açılırsa kişisel veri kaçar; ifade, gözlem ve yorum tek paragrafta karışırsa kanıt yalan söyler. Dönüşüm oturum sürümüne bağlanmazsa sonraki not düzenlemesi eski kanıtı sessizce kaydırır. Kişisel veri paketi (81) ve Geri Bildirim (47) bu oturum değildir.

## Solution

Kullanıcı Araştırması Oturumu Proje ana kaydıdır. İzin `Not asked`, `Allowed`, `Not allowed`, `Not applicable` atıf, kişisel not, Dosya Eki ve paylaşım/yayın kapılarını kapatır; sonradan genişleyen paylaşım eski izinsiz içeriği açmaz. Notlar `Participant quote`, `Observation`, `Founder interpretation` olarak ayrılır. Seçilen not önizlemeyle yeni kayda dönüşür ve kesin oturum sürümüne pinlenir; kaynak not silinmez. Ses kaydı, davet, transkript ve katılımcı paneli yoktur.

## User Stories

1. As a founder, I want a Research Session with title, purpose, question guide, optional time/duration, channel, facilitator, scope note, and relations to Research Work, Assumption, Open Question, Feedback, Persona Document, Feature, and Decision.
2. As a founder, I want status `Planned`, `Completed`, or `Cancelled` that is not a calendar invite, attendance CRM, or research score.
3. As a founder, I want to link a known participant to an existing Contact and optional Company, without being forced to create a Contact for an unknown or must-not-store interview.
4. As a founder, I want consent context `Not asked`, `Allowed`, `Not allowed`, or `Not applicable` with optional note, recording user, and time, so that later readers see what was permitted.
5. As a founder, I want `Not allowed` to block participant-attributed quotes, identifying personal notes, file attachments, and share/publish inclusion.
6. As a founder, I want later-widened sharing or a new snapshot not to open previously unconsented content, including via speaker label, counts, or relation hints.
7. As a founder, I want consent not to be framed as legal compliance judgment; I remain responsible for obligations.
8. As a founder, I want typed notes: `Participant quote`, `Observation`, and `Founder interpretation`, visually and in language, so that a mixed paragraph is not the default.
9. As a founder, I want the product never to present my interpretation as the participant’s words, and not to extract sentiment or auto-learnings.
10. As a founder, I want a quote’s optional speaker label not to leak Contact fields outside access rules.
11. As a founder, I want a supported note or quote bound as version-pinned evidence to Feedback, Assumption, Open Question, Work/Feature, or Decision, pinning exact session version and text range.
12. As a founder, I want later note edits not to silently move that old evidence.
13. As a founder, I want `Convert to new record and bind` with preview of target type/project, field mapping, origin, and pin, creating nothing until I confirm.
14. As a founder, I want conversion not to pick a type automatically, not to delete the note, and not to use AI.
15. As a founder, I want no in-app audio/video capture, meeting scheduling, invite/reminder send, auto transcription/summary/theme, or participant panel.
16. As a founder, I want an outside file attachable only as a normal File Attachment under access and consent; presence of a file is not a transcript or evidence bind.
17. As a founder, I want the session to join search, filter, Table, Smart Collection, relations, history, and supported JSON (export UI is 79/81).
18. As a founder, I want share/publish closed-world preview to treat Contact/Company, consent, each note kind, exact evidence, and files as separate items that cannot leak when not allowed.
19. As a founder, I want English UI `Research Session`, `Not asked`, `Allowed`, `Not allowed`, `Not applicable`, `Participant quote`, `Observation`, `Founder interpretation`, `Convert to new record and bind`.
20. As a founder using only a keyboard or a screen reader, I want to set consent, type a quote versus interpretation, and run convert preview.
21. As a founder, I do not want this session to be Feedback, a Test Session, or a Validation Record.
22. As a consuming personal-data feature (81), I want consent and attributed notes in the Kişisel veri fixture; I own export/erase UI.

## Implementation Decisions

- **Owning documents.** [Kullanıcı Araştırması Oturumları](../../prd/09-discovery-decisions-and-design.md#kullanıcı-araştırması-oturumları). Ana kayıt and `Katılımcısı` relation: [PRD 02](../../prd/02-domain-model-and-lifecycle.md). Pinning: [sürüme sabitlenmiş metin](../../prd/07-documents-and-knowledge.md#sürüme-sabitlenmiş-metin-parçası-kanıtı) (45 owns generic evidence; this feature calls it). Share closed world: PRD 14, [ADR-0001](../../adr/0001-dis-yuzey-ve-snapshot-kimligi.md), [ADR-0002](../../adr/0002-dis-erisim-guvenlik-siniri.md). Personal data package: 81 / PRD 13. Out of scope ops: [PRD 19](../../prd/19-out-of-scope.md) research operations. No new ADR.
- **Glossary.** Use Kullanıcı Araştırması Oturumu, Contact, Company, Kanıt bağı, Kökeni, Dosya Eki. Avoid Feedback-as-session, Test Oturumu, auto theme, recruitment CRM.
- **Session module.** Project-scoped. Consent values `Not asked`, `Allowed`, `Not allowed`, `Not applicable`. Workflow: if there is no permission, quote / identifying note / file / share-publish gates close. Bind: `Not asked` and `Not allowed` keep those gates closed (convert uses the same gate). `Allowed` and `Not applicable` leave them open. Widening share or a later `Allowed` cannot reopen bytes that were blocked when captured. Notes are typed; mixed default refused. Convert preview bound to exact session version via Evidence seam.
- **English UI labels.** As in stories. The Consent Context Gates form uses `Research Sessions`, `Create Research Session`, `Research Session`, `Title`, `Purpose`, `Question guide`, `Channel`, `Facilitator`, `Scope note`, `Status`, `Consent`, `Consent note`, `Time`, `Duration`, `Save`, `Edit`, `Cancel`, and `Retry`; optional inputs append `(optional)`, and Duration is in minutes. This form is covered at the Research Sessions seam by the browser journey below.
- **Consent Context Gates delivery (#327).** `projectResearchSessions` and `saveResearchSession` own Project-scoped metadata, status and server-recorded Consent author/time. Mutations reuse the atomic Mutation Contract (ADR-0004), exact revision and idempotency checks; archived Projects are read-only. Protected content captures use current persisted Consent in that same transaction and retain immutable capture-time Consent. `captureResearchSessionContent`, `previewResearchSessionSnapshot`, and `previewResearchSessionConvert` expose authenticated consumer counterparts; previews resolve only the caller’s Project-owned session. The new snapshot and convert-preview counterparts check both current and capture-time Consent; no blocked bytes or hidden relation counts are retained from rejected writes. Participant links retain link-time Consent. Snapshot candidates are detached and explicitly selected; they do not grant external access or mutate approved revisions (ADR-0001/0002). Content remains in PostgreSQL (ADR-0021). Contact identity is a collaborator validated inside the write transaction; until the Contact owner exists, the production adapter rejects unresolved Contact IDs. Typed note editing, real File Attachment upload binding, target-record conversion and external share/publish surfaces remain with their owning follow-up issues. These boundaries are covered at the same Research Sessions seam below.
- **Time entry.** `Time` uses the saved Account `Time zone` (spec 02); opening the editor waits for Preferences. Saving unrelated edits preserves the exact timestamp, including seconds. Newly entered skipped or repeated seasonal clock times are refused with a retained draft; choose another time. Research Sessions browser tests cover account-zone conversion and persistence.
- **Consumers.** 45 for pin/role. 47 is not this note. 81 for person-level export/erase. 46 for Contact identity merge.

## Testing Decisions

- **What a good test is.** Tests observe Research Sessions through consent, typed notes, convert preview, and share closed-world counterparts. They go red if an unconsented quote/file leaks, if interpretation is labeled as a participant quote, or if a pin silently follows a later session edit. They do not assert editor internals.
- **Seam (one).** Research Sessions — session, consent, typed notes, convert preview. Evidence pin is a collaborator interface behind this seam.
- **Modules under test.** Research Sessions only. Feedback, Test Session, and personal-data erase UI are counterparts.
- **Prior art.** First contract tests at this seam. Consent/files/share use the `Kişisel veri` fixture on [Hesap ve kişisel veri](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). Convert/pin is counterpart evidence for [Kanıt akışı](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). Do not bind session authorship to [tasarım bağlamı](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (that journey is Ekran/Wireframe/Moodboard).
- **Consent Context Gates evidence.** `packages/api/src/research-sessions.test.ts` covers all four Consent gates, refused provenance spoofing, legacy blocked capture/link suppression, explicitly selected detached snapshots and convert-preview gating. `apps/server/src/features/research-sessions/server/research-sessions-database.test.ts` observes atomic rejection, metadata persistence, retries, current permission, stale revisions, archived/foreign Project refusal and validated Contact collaborators through Research Sessions. `apps/web/src/features/research-sessions/ui/research-sessions-view.test.tsx` and `apps/web/e2e/research-sessions.e2e.ts` cover the form, all choices, create/edit persistence, cancellation, failed-save draft retention, keyboard retry, account-time-zone entry, unchanged exact timestamps, seasonal clock-change rejection and accessibility. The `personal-data` acceptance fixture seeds the Research Session consent-state subset of `Kişisel veri`; RPC checks exercise capture, snapshot and convert gates plus unauthenticated refusal. Contact/export/erase fixture data remains with its owning features. Local DB tests use disposable PostgreSQL; shared development readiness requires `db:prepare` and a post-test `db:doctor`.
- **Required counterparts.** Not allowed blocks quote/file/share; later share does not leak old content; interpretation not labeled as quote; convert requires preview; pin stays on session version; not Feedback/Test Session.

## Out of Scope

- Ses/video başlatma, toplantı, davet, transkript, tema, katılımcı paneli (19 / 18).
- Geri Bildirim kaydı ve feed (47), Test Oturumu (10), Deney kaydı (42).
- Kişisel veri dışa aktarma/silme UI (81).
- Contact birleştirme (46).

## Further Notes

- **Orient.** Glossary: Kullanıcı Araştırması Oturumu, Contact, Kanıt bağı. Owning PRD: 09. ADRs: 0001, 0002. Journey: [Hesap ve kişisel veri](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) for consent (fixture includes Araştırma izin durumları). Convert/pin counterpart: [Kanıt akışı](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
- **PRD conflict.** PRD 16 discovery package names araştırma, but no journey row lists [Kullanıcı Araştırması Oturumları](../../prd/09-discovery-decisions-and-design.md#kullanıcı-araştırması-oturumları) as a normative source. Do not copy [tasarım bağlamı](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). A PRD 16 fix should add this section to a journey (likely Karar ve belirsizlik or a dedicated research row).
- **Acceptance.** Kişisel veri fixture must include research consent states. Convert is preview-bound; 45 supplies pin mechanics.
