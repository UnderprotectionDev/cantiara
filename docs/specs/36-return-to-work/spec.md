# Çalışmaya Dön

Kaynak: [`docs/workflow/36-return-to-work/phase-context.md`](../../workflow/36-return-to-work/phase-context.md)

## Problem Statement

Kurucu ara verdiği Proje veya İşe dönerken bağlamı kaybetmek istemez. Bugün son açık sekme, filtre, sıralama, scroll veya yan panel geri yüklenirse planlama gerçeği gibi durur; eski snapshot güncel kayıt yerine geçebilir; hatırlatma yığını çalışma özeti sayılabilir. Canvas viewport’u tuval feature’ındadır. Kişisel hatırlatma, Günlük Odak ve Aktif Çalışma Seti bu özet değildir.

## Solution

`Return to Work` güncel kayıtlardan az sayıda geri dönüş kartı seçer; her kart neden gösterildiğini açıklar ve ana kaynağa götürür. İsteğe bağlı `Next concrete step` ilgili Proje veya İşin alanıdır, ikinci liste değildir. `Since you last looked` Hesap işaretinden sonraki tanımlı olayları konu gruplarında gösterir, analytics üretmez. Desteklenen görsel hedeflerde kurucu `Tour the visual changes` ile aynı olay kümesini gezer; kayıp hedef sessizce kaymaz. Durum yaşı eşiği nötr `Long in the same status` adayı üretir, bildirim veya sağlık hükmü değildir.

## User Stories

1. As a founder returning to a Project or Work, I want a short Return to Work summary built from current records, so that I resume without a second working list.
2. As a founder, I want a few cards chosen from recently edited, recently viewed, upcoming-dated, open-risk, or pending GitHub development-signal records, so that the set is explainable rather than a feed dump.
3. As a founder, I want each card to say why it is shown and to open the source record, so that the summary is not the source of truth.
4. As a founder leaving a Project or Work, I want to save one optional `Next concrete step` text on that record, so that the next action travels with the source.
5. As a founder, I want that field not to be Work, a checklist item, Daily Focus membership, a reminder, or a second list, so that it cannot fork planning.
6. As a founder, I want a new value to replace the active hint while previous values stay in normal change history, so that I can see what I used to intend.
7. As a founder, I want Return to Work to show the active next step with source, last-updated time, and `Open source record`, so that I can jump without copying text.
8. As a founder, I want the field to stay put when status, priority, date, planning membership, or stage changes, so that the product does not invent a new step from events.
9. As a founder, I want `Since you last looked` to group defined events after my last successful visible open of that Project or supported Work, in work, decision, risk, document, GitHub, and publish groups, so that I can scan what changed.
10. As a founder, I want the last-visit mark to live on the Hesap, one timestamp per Project and per supported Work context, so that it is not analytics, duration, view history, or an audit event.
11. As a founder, I want the mark deleted when the record is deleted and never opened on an external surface, so that visit time is not published.
12. As a founder, I want every Since-you-last-looked row to show event time and the source record, so that grouping is not an AI summary or a new summary record.
13. As a founder, I want `Tour the visual changes` on supported events that have a Project Wall, User Flow, Screen Wireframe, Moodboard, or Roadmap target, so that I can walk the same event set visually.
14. As a founder, I want the tour to highlight the source card or exact visual target, move the view there, and explain time and why-shown, so that motion is grounded in the event.
15. As a founder, I want a Roadmap tour to resolve the event’s exact Work or Milestone target in the current view without creating roadmap history, audit, snapshot, or importance score.
16. As a founder, I want a deleted, inaccessible, or unplaceable target skipped with a reason rather than silently aimed at another object.
17. As a founder, I want to close the tour at any time and restore the start viewport when it still resolves, or fit visible content when it does not, so that canvas ownership stays with the canvas feature.
18. As a founder, I want a stated cap on huge event sets and an action to open the rest in the normal list, so that the tour cannot become an unbounded movie.
19. As a founder, I want a project status-age threshold to mark active Work that exceeds it as `Long in the same status` return candidates and to show them in a prepared Smart Collection, so that staleness is a reason, not a score.
20. As a founder, I want that candidate not to be a default notification, a “stuck” verdict, or a health/performance score, and not to write Work status or planning membership.
21. As a founder, I do not want last-open record, tab, filter, sort, scroll, or side panel restored, so that Return to Work is not recent-context.
22. As a founder, I do not want this summary to become a directed session, mandatory agenda, timer, or a flow that writes record status.
23. As a founder, I do not want an old snapshot shown in place of the current record.
24. As a founder using only a keyboard or a screen reader, I want to open cards, the next-step field, Since-you-last-looked rows, and (where a canvas outline exists) skip or close the tour, so that return is not pointer-only.
25. As a founder, I want English UI `Return to Work`, `Next concrete step`, `Since you last looked`, `Tour the visual changes`, `Long in the same status`, and `Open source record`.
26. As a consuming canvas feature, I want viewport, zoom, and collapse metadata to remain mine; the tour may move and restore them for its duration only.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [Çalışmaya Dön özeti](../../prd/04-workspace-and-projects.md#çalışmaya-dön-özeti). Last-visit mark is the helper [Son ziyaret işareti](../../prd/02-domain-model-and-lifecycle.md#ana-kayıt-türleri-ve-asgari-sözleşmeler). Canvas viewport ownership is [büyük canvas’larda kişisel çalışma konumu](../../prd/04-workspace-and-projects.md#büyük-canvaslarda-kişisel-çalışma-konumu) plus the canvas features; this card must not take that ownership. Recent-context restore is forbidden by [PRD 19](../../prd/19-out-of-scope.md). No new ADR.
- **Glossary.** Use Çalışmaya Dön, Son ziyaret işareti, Proje Hedefi (out), Favori (out), Aktif Çalışma Seti (out), Günlük Odak (out), Hatırlatma (out), Akıllı Koleksiyon (prepared long-status membership only), Dikkat sinyali (long-status is not a default signal). Do not introduce recent-tabs, second working list, session agenda, stuck verdict, or analytics visit stream.
- **Return module.** Summary is a derived view over current records, not a stored snapshot of cards. Selection is from the PRD’s closed reasons: last edited, last viewed, upcoming dates, open Risk, pending GitHub development signal. Count stays small and each card carries why-shown plus `Open source record`.
- **Next concrete step.** Optional text field on the Project or Work source. One active value; replacements go through normal record history. Not a record type. No auto-clear or auto-rewrite from status, priority, date, planning membership, or stage. Search/import/export use the same field. Link-share and public publish show it only when closed-world preview separately includes it (sharing features own that preview).
- **Since you last looked.** Hesap-scoped last successful visible-open timestamp per Project and per supported Work context. Not view history, duration, analytics, or Denetim kaydı. Delete record → delete mark. Never on Dış yüzey. Rows are defined existing history events grouped into work, decision, risk, document, GitHub, publish; no AI summary, no importance rank, no new summary record.
- **Visual tour.** Explicit action. Input set is exactly the current Since-you-last-looked events that have a Project Wall, User Flow, Screen Wireframe, Moodboard, or Roadmap target. Highlight, pan to, explain. Roadmap resolves exact Work/Milestone in the current roadmap view; no new roadmap history. Skip unplaceable targets with reason. Closable; restore start viewport if still meaningful else fit visible content. Stated cap plus “open remainder in the list”. Tour does not create records, routes, or a second list. Viewport persistence across sessions stays on canvas features (48/49/50/51/29).
- **Long in the same status.** Optional Project threshold. Active Work past threshold is a neutral return-card reason and a prepared Smart Collection membership. This feature owns the threshold and the reason; Smart Collections (34) evaluates membership. No default notification, no stuck/health/performance score, no status or planning write.
- **English UI labels.** `Return to Work`, `Next concrete step`, `Since you last looked`, `Tour the visual changes`, `Long in the same status`, `Open source record`. Add missing labels to the term table when first shown.
- **Consumers.** Canvas features keep viewport. 34 hosts the prepared collection. 35/27/72 stay separate personal surfaces.

## Testing Decisions

- **What a good test is.** Tests observe Return to Work through its public interface: card set and why-shown, next-step read/write, last-visit mark, event groups, tour skip/restore, long-status candidates. They do not assert tab/filter/scroll restore (those must stay unrestored), canvas persistence internals, or Smart Collection engine internals beyond membership of the prepared reason.
- **Seam (one).** Return to Work — the product-facing summary for a Project or Work context. Last-visit store, event read model, and tour driver are adapters. Canvas move/restore is called through the canvas’s public viewport API, not copied.
- **Modules under test.** Return to Work only. Reminders, Daily Focus, Active Working Set, notification center, and canvas session persistence are counterparts.
- **Prior art.** No suite yet. Bind to [kişisel bağlam](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). Negative: no recent-context restore (19), no snapshot-instead-of-current, no stuck verdict.
- **Required counterparts.** Cards use current records; next step does not auto-rewrite; last-visit is not analytics and not on Dış yüzey; tour does not retarget; long-status does not notify by default; tabs/filters/scroll unrestored.

## Out of Scope

- Son açık sekme, filtre, sıralama, scroll, yan panel geri yükleme.
- Canvas viewport/zoom/collapse sahipliğini bu karta alma (48, 49, 50, 51, 29, 11-technical-diagrams).
- Kişisel hatırlatma, Günlük Odak, Aktif Çalışma Seti, Bildirim Merkezi.
- Yönlendirilmiş seans, zorunlu gündem, zamanlayıcı, durum yazan ilerleme akışı.
- Eski snapshot’ı güncel kayıt yerine gösterme; AI özeti.

## Further Notes

- **Orient.** Glossary: Çalışmaya Dön, Son ziyaret işareti, Akıllı Koleksiyon. Owning PRD: `docs/prd/04-workspace-and-projects.md` (Çalışmaya Dön özeti). ADRs in play: none owning. Related: PRD 02 (last-visit helper), PRD 16 (kişisel bağlam), PRD 19 (recent-context).
- **Acceptance.** Bind to [kişisel bağlam](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): session set is not this summary; only defined canvas location returns, and that return is not this feature.
- **Consumers.** Canvas features, Smart Collections prepared long-status view.
