# Dikkat Sinyalleri

Kaynak: [`docs/workflow/71-attention-signals/phase-context.md`](../../workflow/71-attention-signals/phase-context.md)

## Problem Statement

Kurucu, kapalı ve açıklanabilir kaynak olaylarından doğan dikkati tek merkezde görmek ister. Bugün serbest “bir şey oldu” mesajları, e-posta ürünü, Geri Bildirim feed'i ve Proje Etkinliği bu işi taklit eder; okumak kaynağı çözmüş sayılır; kopya olay çoğalır; kayıt dışı tür basılır. Üretici feature'lar (blokaj, koleksiyon, test raporu, GitHub, hatırlatma ve diğerleri) kendi tetiklerini sahiplenir. Bu feature'ın sorunu merkez ve registry'nin delinmesidir, her tetik kuralını yeniden yazmak değil. İşletim pager'ı ve e-posta bu sorunun parçası değildir.

## Solution

Birleşik Bildirim Merkezi yalnız kapalı registrydeki Dikkat sinyallerini `Action Required` ve `Information Flow` olarak toplar. Varsayılan `Action Required` açılır. Okuma veya kapatma kaynak sorunu çözmez. Registry yalnız kayıtlı türlerin kesin olay ve hedef kimliğiyle doğmasına izin verir; kayıtsız sinyal yoktur; aynı kesin olay kimliği çoğalmaz. Sinyal türünün üretim kuralı sahip feature'da biter. Bu feature merkez sunumunu, gruplamayı, registry zorunluluğunu ve isteğe bağlı `public-roadmap-review-due` üretimini tamamlar. `Create Follow-up Work` uygulanmadan önce oluşacak İşi gösterir; bildirimi kapatmaz.

## User Stories

1. As a founder, I want a Birleşik Bildirim Merkezi that shows only registered Dikkat sinyali types, so that free-form “something happened” never appears.
2. As a founder, I want signals split into `Action Required` and `Information Flow`, so that decision-needed items are not mixed with FYI motion.
3. As a founder, I want `Action Required` open by default, so that the first glance is the work that waits on me.
4. As a founder, I want each signal in exactly one section, so that grouping cannot re-file meaning.
5. As a founder, I want signals from the same ana kaynak grouped under one source group inside their section, so that one record’s several reasons stay together without becoming one rewritten notification.
6. As a founder, I want the same kesin Kaynak sürümü change used in several places to appear as one Kaynak group, so that each usage keeps its own review decision.
7. As a founder, I want each signal to keep its own reason, source event, time, and read/closed state, so that grouping is presentation.
8. As a founder, I want reading or closing a notification not to change the source record’s domain outcome, so that attention state is not a silent resolve.
9. As a founder opening a signal, I want the exact source event (comment, change, reminder, or other) in visible context when it can be resolved, so that I do not land on a generic record start.
10. As a founder when that event can no longer be resolved, I want the record to open and the missing target explained, so that the product never silently retargets.
11. As a founder, I want an unregistered producer call to be rejected, so that the registry is closed in depth, not only in documentation.
12. As a founder, I want duplicate events with the same identity not to mint a second signal, so that retries do not stack noise.
13. As a founder, I want the product not to claim it shows everything that needs attention, not to auto-mutate, not to score Proje health, and not to AI-rank importance, so that honesty holds.
14. As a founder of an active public Roadmap record, I want an optional review interval of a whole number of days from 7 to 180, so that stale public snapshots can be suggested only when I asked.
15. As a founder, I want no `public-roadmap-review-due` signal until I set that interval, so that the default is silence.
16. As a founder, I want at most one such signal per interval until a new Onaylı snapshot revizyonu exists, so that nagging does not repeat.
17. As a founder, I want that signal only for active public-labeled records, not completed or closed public records, so that finished public work is not reopened by the clock.
18. As a founder, I want that signal not to change internal status, public label, or the publish snapshot, so that review-due is attention, not mutation.
19. As a founder, I want `Create Follow-up Work` to preview the İş and source relations before apply, so that I see what will be created.
20. As a founder applying that action, I want the new İş origin-linked to the notification and its source records, so that provenance is explicit.
21. As a founder, I want that action not to close the notification and not to change source status, so that follow-up is not a hidden resolve.
22. As a founder, I do not want implicit multiple İşler from one notification, so that one preview is one create.
23. As a founder, I do not want notifications held in a separate Saved/bookmark queue, so that durable fact stays on the source or the story timeline and later action stays in origin-linked İş.
24. As a founder, I do not want the center to be a second record list, a Geri Bildirim feed, or Proje Etkinliği, so that those surfaces keep their jobs.
25. As a producer feature, I want to emit only by registered id with exact event and target identity, so that my rules stay in my PRD and this module only enforces the gate.
26. As a founder, I want English UI copy, so that the product language stays English.
27. As a founder using only a keyboard or a screen reader, I want to open the center, move between sections and groups, open the source event, and run `Create Follow-up Work` preview, so that the Dikkat sinyalleri journey is accessible.
28. As a founder, I want a missing or deleted source to show a safe tombstone rather than leaked content, so that attention cannot resurrect private text.

## Implementation Decisions

- **Owning documents.** Center and closed registry: [Birleşik Bildirim Merkezi](../../prd/04-workspace-and-projects.md#birleşik-bildirim-merkezi), [dikkat sinyali kayıtları](../../prd/04-workspace-and-projects.md#dikkat-sinyali-kayitlari). Signal entity: [Bildirim sinyali](../../prd/02-domain-model-and-lifecycle.md#ana-kayıt-türleri-ve-asgari-sözleşmeler) (Hesap-owned; source id is origin, not a new truth). Navigation to source follows [bağlam içi kayıt önizleme](../../prd/08-search-relations-and-evidence.md#bağlam-içi-kayıt-önizleme). Journey: [Dikkat sinyalleri](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). No new ADR.
- **Glossary.** Use Dikkat sinyali, Birleşik Bildirim Merkezi, İş, Kökeni, Onaylı snapshot revizyonu, Herkese açık durum etiketi. Do not introduce inbox, email product, pager, bookmark queue, health alert, or AI ranking. Do not call Proje Etkinliği or Geri Bildirim feed the center.
- **Closed registry (enforced here).** Only these ids may be minted. Presentation class is part of the row; producers cannot refile it.

| Sinyal kimliği | Sunum | Emission owner (not this feature, except the last noted) |
| --- | --- | --- |
| `due-date` | `Action Required` | kişisel hatırlatmalar (06) |
| `reappear-date` | `Action Required` | yeniden görünme tarihi (06) |
| `personal-reminder` | `Action Required` | kişisel hatırlatmalar (06) |
| `review-later` | `Action Required` | Yeniden bak (06) |
| `open-risk` | `Action Required` | Risk (09) |
| `work-blocked` | `Action Required` | blokaj (06 / workflow 19) |
| `source-version-in-use` | `Action Required` | Kaynak sürüm kullanımı (08) |
| `external-run-returned` | `Action Required` | Dış yürütme devri (06) |
| `release-observation-missing` | `Action Required` | Proje Sürümü iletişimi (12) |
| `github-check-failed` | `Action Required` | GitHub geliştirme kayıtları (12) |
| `work-pr-status-conflict` | `Action Required` | GitHub geliştirme kayıtları (12) |
| `unlinked-open-pr` | `Action Required` | GitHub geliştirme kayıtları (12) |
| `published-release-open-scope` | `Action Required` | Sürüm Kanıt Paketi (12) |
| `automation-failed` | `Action Required` | otomasyon (06) |
| `public-roadmap-review-due` | `Action Required` | **this section** |
| `unreviewed-test-report` | `Action Required` | test raporu kabulü (10 / workflow 54) |
| `test-result-conflict` | `Action Required` | yerine geçen doğrulama (10) |
| `handoff-result-after-cancel` | `Information Flow` | Test Handoff'u (10) |
| `smart-collection-entry` | `Information Flow` | Akıllı Koleksiyon aboneliği (08 / workflow 34) |
| `github-activity` | `Information Flow` | GitHub geliştirme kayıtları (12) |

- **Enforcement versus emission.** This feature owns: reject unregistered ids; require exact source event id + target id; dedupe on that identity; persist read/closed separately from source domain outcome; group by source inside a section; default-open `Action Required`; open exact event or explain missing target. The same kesin Kaynak sürümü change with several usage sites is one Kaynak group; each usage keeps its own review decision and is not collapsed into a single rewritten notification. Producers own trigger, negatives, and close conditions. Tests may use a producer test-double; they must not reimplement producer negatives except `public-roadmap-review-due`.
- **`public-roadmap-review-due`.** Optional per-Proje whole-day interval in `[7, 180]`. No default → no signal. Fires in `Action Required` when the last Onaylı snapshot revizyonu of an *active* public-labeled Roadmap record is older than the interval. At most one signal per interval until a new approved snapshot exists. Does not cover completed/closed public records. Does not mutate internal status, public label, or snapshot.
- **Negatives the journey names (producer-owned, center must not invent).** Ordinary reminder does not start a missing-observation signal. A single observation does not close an open review tour. Cancelled Dış yürütme devri, time-alone without a returned result, ordinary value-chain breaks, and Source age are not signals. Center tests assert unknown ids cannot be used to fake those.
- **`Create Follow-up Work`.** Preview İş + relations before apply. Apply creates one İş with Kökeni to the notification and source records. Does not close the notification, does not change source status, does not implicitly mint multiples. No Saved/bookmark queue.
- **English UI labels.** First user-visible copy uses: `Notification Center`, `Action Required`, `Information Flow`, `Create Follow-up Work`, `Look again` (as the surface name when listing `review-later` sources). Missing labels go to the term table in the same change that first shows them. Registry ids stay wire values as in the PRD table.
- **Honesty.** The product does not claim complete coverage of all risks. No automatic change effect, Proje health judgment, or AI importance ranking.

## Testing Decisions

- **What a good test is.** Tests observe Attention Signals through its public interface: list by section, group by source, same Kaynak sürümü with several usages keeping separate review decisions, mark read/close without source mutation, open exact event, reject unregistered id, dedupe, follow-up preview, `public-roadmap-review-due` matrix. They do not assert queue internals. Expected values are registry rows and PRD negatives, not recomputed producer rules for foreign ids.
- **Seam (one).** Attention Signals — the product-facing center + registry gate. Producers are adapters/test doubles behind emit. Playwright for the Dikkat sinyalleri journey is the same seam through the UI.
- **Modules under test.** Attention Signals only. Producer packages are not in this suite except emit doubles and “source unchanged” counterparts.
- **Prior art.** No Vitest/Playwright suite yet. Contract tests at this seam. Evidence binds to [Dikkat sinyalleri](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (`Gerçek proje` plus the listed positive/negative matrix). Also supports [kanıt tazeliği](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) presentation of `source-version-in-use` without owning its emission.
- **Required counterparts.** Unregistered id rejected; read ≠ resolve; no bookmark queue; `public-roadmap-review-due` silent without interval; completed public records excluded; producer-owned negatives not minted by the center; multiple Source usages keep separate review decisions inside one group.

## Out of Scope

- Okumayı veya kapatmayı kaynak sorunu çözümü sayma.
- Registry dışı serbest bildirim basma.
- Merkezi işletim pager'ı, e-posta ürünü, Geri Bildirim feed'i veya Proje Etkinliği yapmak.
- Sinyal türünü merkezde yeniden tanımlayıp sahip feature'dan koparma.
- Kaydedilenler/bookmark kuyruğu.
- Üreticilerin tetik, negatif ve kapanma kurallarını bu kartta yeniden yazma (`public-roadmap-review-due` hariç).

## Further Notes

- **Orient.** Glossary: Dikkat sinyali, Birleşik Bildirim Merkezi, İş, Kökeni, Onaylı snapshot revizyonu. Owning PRD: `docs/prd/04-workspace-and-projects.md`. ADRs in play: none. Related: PRD 06/08/09/10/12 producers, PRD 16 Dikkat sinyalleri, PRD 19 (no email digest, no time-only staleness as a general product, no health score).
- **Acceptance.** Bind to [Dikkat sinyalleri](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). Journey evidence is the positive/negative matrix, dedupe, partial review, cancel, and source-delete tests. This feature supplies the center/registry half; producer tickets supply emission halves.
- **Producers.** Workflows 19, 34, 54, 35, 61, 65, 44, 24, 40, 62 and the PRD owners in the table emit through this gate. They do not open a second inbox. `due-date` stays in this closed registry because [dikkat sinyali kayıtları](../../prd/04-workspace-and-projects.md#dikkat-sinyali-kayitlari) lists it. [Kişisel hatırlatmalar](../../prd/06-work-management-and-planning.md#kişisel-hatırlatmalar) never defines Target-date production; workflow 35 emits `personal-reminder` and `review-later` only. This center still accepts `due-date` so a later PRD-aligned producer can emit without forking the table; it must not invent `due-date` here.
- **Consumers.** 72-personal-shell opens the center without owning membership. 35’s Hatırlatma opens the source via `personal-reminder` / `review-later`; 69 is Manuel Proje Güncellemesi and does not emit those ids.
