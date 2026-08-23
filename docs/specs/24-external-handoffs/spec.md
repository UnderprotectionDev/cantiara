# Dış Yürütme Devirleri

Kaynak: [`docs/workflow/24-external-handoffs/phase-context.md`](../../workflow/24-external-handoffs/phase-context.md)

## Problem Statement

Kurucu test-dışı kodlama veya başka yürütmeyi bir AI ajanına ya da harici araca götürüp dönen sonucu İş gerçeğine bağlamak ister. Bugün gidiş bağlamı ayrı bir Handoff ana kaydına, GitHub PR metnine veya formel Test Handoff paketine kayar; dönüş ise kaynak alanları sessizce ezer ya da hiç uzlaştırılmaz. Formel test, Dış Araca Kaçış olayı ve GitHub PR bu sorunun parçası değildir.

## Solution

Her kesin gidiş İşe ait, bağımsız yaşayamayan tarihsel bir Dış yürütme devrinde durur. Paket kullanıcının seçtiği kesin kaynak sürümlerinden tarihli ve sürümlü okunabilir Markdown’dır; canlı senkron veya repository kopyası değildir. Dönen içerik fark önizlemesiyle incelenir; yalnız `Reconcile` veya gerekçeli `Cancel Handoff` terminaldir. Ürün dış aracı başlatmaz, sorgulamaz, izlemez veya iptal etmez. Commit, PR veya İş durumu değişimi devri kendiliğinden kapatmaz.

## User Stories

1. As a founder on a Work item, I want to start an `External Execution Handoff` for coding or other non-test work, so that the exact going context stays on that Work instead of becoming a second Handoff record.
2. As a founder starting a handoff, I want to name the purpose, expected output or acceptance expectation, the executor’s visible name, and the constraints, so that the outside run is explainable later.
3. As a founder starting a handoff, I want to select exact Work, Document, Decision, Risk, Open Question, and Source versions plus permitted GitHub context, so that the package contains only what I chose.
4. As a founder, I want the going package to be readable Markdown produced only from that selected version manifest, so that the executor sees a closed copy of the current context rather than a live sync.
5. As a founder looking at a package, I want it to carry production time, the Work key, the handoff identity, and `Source of truth is in the app`, so that later readers know the app remains canonical.
6. As a founder, I want the package to omit secrets, inaccessible fields, and records I did not select, so that a handoff cannot widen access.
7. As a founder whose source records change after send, I want the already-sent package to stay frozen, so that I create a new package version or a new handoff instead of silently rewriting what left.
8. As a founder running a second coding pass on the same Work, I want a new handoff that does not overwrite the previous going or return context, so that repeated outside work is history, not a single slot.
9. As a founder when outside work returns, I want to record the executor summary, changed assumptions, produced evidence or permitted external links, and still-open questions on that same handoff, so that the return is part of the same historical component.
10. As a founder with a recorded return, I want the handoff status to become `Result returned`, so that unreconciled work is visible without pretending the Work is done.
11. As a founder reconciling, I want a diff preview of the exact relations that will be created and any follow-up Work that will be created, so that I know what writing I am authorizing.
12. As a founder reconciling, I want to accept, reject, or choose parts of that preview, so that partial writing is explicit rather than hidden.
13. As a founder confirming reconcile, I want the result and chosen bindings stored as a historical `Reconcile` decision at `Reconciled`, so that the close is a user decision, not an import merge.
14. As a founder, I do not want handoff prose itself to mint a Decision, Risk, Work, relation, or evidence record until I confirm the preview, so that text from an executor is not product truth.
15. As a founder who no longer wants the outside run, I want `Cancel Handoff` with a recorded reason to move the handoff to `Canceled`, so that cancel is an explicit terminal without deleting history.
16. As a founder restarting the same kind of work after cancel, I want a new handoff instead of reopening the canceled one, so that the canceled run stays a closed historical pass.
17. As a founder whose GitHub commit or pull request is linked, I want that link not to close the handoff, so that development events are not a silent reconcile.
18. As a founder whose Work workflow status changes, I want the handoff to stay in its current status, so that Kanban or close Work is not an external-run close.
19. As a founder with a `Result returned` handoff that is not yet reconciled, I want a single `Action needed` attention signal `external-run-returned` bound to that handoff, so that I am asked to inspect the return.
20. As a founder who reconciles or cancels, I want that signal to close, so that a terminal handoff stops asking for action.
21. As a founder with an `Open` handoff that has not returned, I want no time-based handoff signal unless I separately set a target date or `Review later` reminder, so that an unfinished outside run is not spam.
22. As a founder, I want start, export, return, reconcile, and cancel events to remain on the Work’s ordinary change history with actor and time, so that the handoff is not a second audit log.
23. As a founder, I want the product not to launch, query, monitor, or cancel an external agent, IDE, terminal, repository, or CI/CD from this handoff, so that Cantiara stays the context owner rather than a remote runner.
24. As a founder doing planned or formal testing, I want that work to stay on Test Handoff and Test Session, so that this component does not become a second test history.
25. As a founder whose coding executor mentions tests in free text, I want that text to remain handoff return until I record a supported Test Session separately, so that informal notes are not official test history.
26. As a founder escaping to another tool because Cantiara cannot do the job, I want that to remain a Dış Araca Kaçış event, so that a conscious product-gap log is not this handoff.
27. As a founder, I want English UI copy for `External Execution Handoff`, `Start Handoff`, `Reconcile`, and `Cancel Handoff`, so that the product language stays English.
28. As a founder using only a keyboard or a screen reader, I want to start a handoff, inspect the package, record a return, reconcile, and cancel, so that the journey is possible without a pointer-only diff.
29. As a founder, I do not want an independent Handoff main record that can be searched, shared, moved, or given its own lifecycle apart from the Work, so that ADR-0015’s owned-component boundary holds.
30. As a founder, I do not want this feature to create GitHub pull requests, merge them, or treat a PR as reconcile, so that GitHub remains a later development-truth feature.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [Dış yürütme devirleri](../../prd/06-work-management-and-planning.md#dış-yürütme-devirleri) and the owned-component row in [ana kayıt türleri](../../prd/02-domain-model-and-lifecycle.md#ana-kayıt-türleri-ve-asgari-sözleşmeler). The surprising identity (owned component on Work, not a second Handoff main record; formal test stays on Test Handoff) is [ADR-0015](../../adr/0015-dis-yurutme-devrini-ise-ait-bilesen-olarak-tut.md). Atomic confirm of reconcile writes follows the existing [ADR-0004](../../adr/0004-atomik-idempotent-kesinlestirme.md) contract; this feature does not reopen that decision. Attention display is [Birleşik Bildirim Merkezi](../../prd/04-workspace-and-projects.md#birleşik-bildirim-merkezi); this feature only produces registered `external-run-returned`. No new ADR.
- **Glossary.** Use Dış yürütme devri (`External Execution Handoff`), Dış yürütme uzlaştırması (`Reconcile`), İş, Test Handoff’u (must not be this component), Dış Araca Kaçış (must not be this component), Dikkat sinyali, Ana kayıt vs sahipli bileşen. Do not introduce Coding session, agent task, independent Handoff main record, “commit arrived”, or automatic Work completed. Status English UI: `Open`, `Result returned`, `Reconciled`, `Canceled`.
- **Owned component.** The handoff cannot be searched, shared, moved, or given a lifecycle apart from its Work. Listing and opening a handoff is always through that Work. A Work may hold many handoffs in chronological order; a new handoff never overwrites an earlier going or return.
- **Going package.** Markdown is generated only from the user-selected exact version manifest. It includes production time, Work key, handoff identity, and `Source of truth is in the app`. Secrets, inaccessible fields, and unselected related records are omitted. After send, later source edits do not mutate the sent bytes; the founder creates a new package version on the same handoff or starts a new handoff.
- **Return and reconcile.** Recording a return sets `Result returned` and does not write project records. `Reconcile` shows the exact relations and follow-up Work that would be created. Confirm writes only the chosen subset, stores the historical reconcile decision, and sets `Reconciled`. Rejecting the preview writes nothing. This is not an import wizard and not a Git merge.
- **Cancel.** `Cancel Handoff` requires a reason, sets `Canceled`, keeps history, and does not reopen. Restarting the work creates a new handoff. Commit/PR binding, “external result arrived” telemetry, and Work workflow-status changes are not terminal events.
- **Signals.** `Result returned` and not yet terminal produces one `external-run-returned` `Action needed` signal whose source is that handoff. `Reconciled` and `Canceled` produce no result, reconcile, or time signal, and they close earlier handoff signals. An `Open` handoff with no return does not mint a time signal; if the founder separately set a target date or `Review later`, that reminder feature owns `due-date` / `review-later`. Canceled handoff and “still open, no return, only time passed” are negative cases for this production rule.
- **Non-runners.** This module does not start, poll, stream, or cancel an external agent, IDE, terminal, repository, or CI/CD. Permitted GitHub context in the package is selected identifiers the founder already may see; GitHub App install, issue write, and PR create stay in the GitHub bağlantısı feature.
- **Not Test Handoff.** Planned or formal test execution, structured results, and Test Session history stay on Test Handoff. Free-text test notes in a coding return remain handoff text until the founder records a supported Test Session elsewhere.
- **Not Dış Araca Kaçış.** A conscious “Cantiara cannot do this, I left” event stays the product-gap feature. This handoff is a chosen outside execution of Work the founder still owns in Cantiara.
- **English UI labels.** First user-visible copy uses: `External Execution Handoff`, `Start Handoff`, `Reconcile`, `Cancel Handoff`, `Open`, `Result returned`, `Reconciled`, `Canceled`, `Source of truth is in the app`. Missing labels are added to the PRD term table in the same change that first shows them. No Turkish UI.
- **History.** Start, package export, return, reconcile, and cancel are ordinary Work change-history events with actor and time. They are not a second Denetim kaydı class. Tokens and package secrets never enter logs.

## Testing Decisions

- **What a good test is.** Tests observe External Execution Handoff through its public interface: start on a Work, package bytes from a selected version manifest, record return, reconcile preview/confirm, cancel with reason, and whether `external-run-returned` is produced or closed. They do not assert Prisma row shapes, Markdown template internals, or mock private collaborators. Expected values are product rules (owned component, frozen package, terminals only `Reconciled`/`Canceled`, no silent field overwrite).
- **Seam (one).** External Execution Handoff — the Work-owned going/return/reconcile interface used by the Work detail surface. GitHub, Test Handoff, Dış Araca Kaçış, and the notification center are adapters or counterparts behind or beside that interface, not a second product module in this suite.
- **Modules under test.** External Execution Handoff only. Test Handoff, GitHub PR write, product-gap escape, Kanban status, and the notification-center shell are not in this suite except as “this command is unauthorized / this signal is absent / this status did not change” counterparts.
- **Prior art.** First contract tests live at this seam with a package-renderer test double and a signal-sink test double. Evidence environment for [Dış yürütme devri](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) is the founder’s real project; synthetic counterparts cover cancel-after-return, package freeze, and Test Handoff separation. Cloud tests must not use production tokens or private user content.
- **Required counterparts.** No independent Handoff main record; second handoff does not overwrite the first; sent package does not update when sources change; return text does not mint records before confirm; commit/PR/Work status do not terminal the handoff; cancel keeps history and new work is a new handoff; `Open` without return does not emit `external-run-returned`; reconcile/cancel closes that signal; Test Handoff package is not produced here; Dış Araca Kaçış is not written here; product does not call an external runner.

## Out of Scope

- Test Handoff’u, Test Oturumu, planlı senaryo paketi, CI koşturma veya resmî test geçmişi.
- Dış Araca Kaçış olayı, Ürün Boşluğu ve kaçış kapanış kanıtı.
- GitHub App kurulumu, issue yazma, PR oluşturma/birleştirme veya PR’yi uzlaştırma sayma.
- Harici ajan, IDE, terminal, repository veya CI/CD başlatma, sorgulama, izleme, iptal veya otomatik telemetry.
- Dış insana inceleme veya görev verme.
- İçe aktarma sihirbazı, Git birleştirmesi, yayın artefaktı veya canlı senkron paket.
- Dönen dosyayı önizlemesiz ana gerçek yapmak.
- Birleşik Bildirim Merkezi kabuğu; bu feature yalnız kayıtlı `external-run-returned` üretimidir.
- İş kapatma, Bitiriş efekti veya Kanban durum yazımı.

## Further Notes

- **Orient.** Glossary: Dış yürütme devri, Dış yürütme uzlaştırması. Owning PRD: `docs/prd/06-work-management-and-planning.md` (Dış yürütme devirleri). ADRs in play: 0015 (owned component on Work), 0004 (atomic reconcile confirm). Related but not owning: PRD 02 (sahipli bileşen), PRD 04 (sinyal kaydı ve merkez), PRD 10 (Test Handoff’u), PRD 12 (GitHub PR), PRD 04/19 (Dış Araca Kaçış), PRD 16 (journey), PRD 19 (ajan kontrolü yok).
- **Acceptance.** Bind this feature to [Dış yürütme devri](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (real project: two repeated coding handoffs, late return, reasoned cancel then new handoff, reconcile, signal close, Test Handoff separation) and to the negative matrix on [Dikkat sinyalleri](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) for canceled handoff and time-only open handoff. Negative bounds (no independent Handoff record, no external runner, no silent overwrite) are 19-class counterparts on that journey.
- **Consumers.** Workflow `71-attention-signals` displays `external-run-returned`; it does not redefine the production rule. Workflow `53-test-plan-and-handoff` remains the formal-test package. Workflow `61-github-integration` may later bind commits/PRs; those bindings must not terminal this handoff. Workflow `58-product-gaps` owns Dış Araca Kaçış.
