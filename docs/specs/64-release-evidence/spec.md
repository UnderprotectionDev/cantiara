# Sürüm Kanıt Paketi

Kaynak: [`docs/workflow/64-release-evidence/phase-context.md`](../../workflow/64-release-evidence/phase-context.md)

## Problem Statement

Kurucu bir Proje Sürümünün kapsam, PR/check, Karar, Risk, test, Test Açığı ve yayın farkını tek değerlendirme yüzeyinde kaynaklarına açarak görmek ister. Bugün bu kanıt dağılır veya paket skor/kapı/`publish` der. Düzeltmeler pakette ikinci form olur. Test özeti (57), PR kartı (61) ve sürüm planlama (63) kendi kayıtlarını taşır; paket onların yerine geçmez. ADR-0007: bildirilen Test Oturumu tek başına sürüm kabul kanıtı değildir.

## Solution

Kurucu Proje Sürümü detayındaki Sürüm Kanıt Paketinde tamamlanan ve açık kapsamı, gerekli ve bağlamsal PR'ları, bekleyen/başarısız check'leri, İş–PR tutarsızlıklarını, Karar ve açık Riskleri, beklenen sonuçları, ilişkili senaryo/Handoff/oturum/maddeleri, açık Test Açığı kayıtlarını, son Test değerlendirmesini, kontrol listesi durumunu ve changelog ile onaylı dış snapshot arasındaki yayın farkını kaynaklarından bir araya getirir. Sistem yayın skoru, readiness hükmü veya otomatik kapı üretmez. Her satır ana kaydını ve gösterilme nedenini açar; düzeltme özgün kayıt yüzeyine gider. Paket kaynak alanları düzenleyen karma form değildir.

## User Stories

1. As a founder, I want one evaluation surface on a Proje Sürümü that opens scope, PRs/checks, Karar, Risk, tests, gaps, and publish diff from their sources, so that release evidence is not scattered.
2. As a founder, I want each row to explain why it is shown and to open the owning record, so that I never edit a copy on the pack.
3. As a founder, I want the pack not to change İş, test, PR, Risk, Karar, or Proje Sürümü status, so that it is not a mutation console.
4. As a founder, I want Oturum Testi rows to keep raw report, normalized result, source session, and technical/time context, so that a `Passed` label is not Cantiara acceptance (ADR-0007).
5. As a founder, I want GitHub checks shown as their source states, not converted to Test Oturumu.
6. As a founder, I want missing related tests, required PR/check, expected result, or other structured pack context; spec/commit/build context change; negative or inconclusive results; unreviewed reports; open Risk or Test Açığı; or new context after the last Test değerlendirmesi to appear as source-linked neutral attention, not as a score, notification-as-gate, or required field.
7. As a founder, I do not want elapsed time alone to mark a test stale.
8. As a founder, I do not want the pack to say "publish", compute ready/not-ready, or run CI/deploy.
9. As a founder, I want the publish-diff row to open 14's approved snapshot contract rather than invent a second checklist.
10. As a founder, I want an optional release checklist I manage, that still does not gate publish.
11. As a founder, when a Proje Sürümü is published with open İş still in scope, I want a deduped closeable Notification Center signal that does not block publish or change statuses.
12. As a founder using a keyboard or screen reader, I want the pack fully usable, matching PRD 15 for Release Evidence Pack.
13. As a founder, I want English UI `Release Evidence Pack` and source-open actions.

## Implementation Decisions

- **Owning documents.** [Sürüm Kanıt Paketi ve yayın hazırlığı](../../prd/12-github-and-project-releases.md#sürüm-kanıt-paketi-ve-yayın-hazırlığı). [ADR-0007](../../adr/0007-surum-kaniti-guven-modeli.md). Publish diff security: PRD 14. Neutral summary vs this pack: PRD 10 (57). No new ADR.
- **Glossary.** Proje Sürümü, Test Oturumu (historical, not acceptance), Test Açığı, Test değerlendirmesi, GitHub dış kaydı. Avoid: quality score, ready/not-ready, pack as release notes (65), pack as closure summary.
- **One seam.** Release Evidence Pack — derived evaluation view + checklist state that does not mutate domain records. Reads 63 scope, 61 PR/check, 57 test records, 56 latest assessment, 55 open gaps, 14 snapshot diff. Fixes happen by navigating to those records' own commands.
- **No score/gate.** No aggregate pass rate as a decision. Counts open exact sets (same rule as 57). A missing required source (scope item, required PR/check, expected result, related test, open Risk/Gap, or publish diff) appears as a visible source-linked attention row — it is never silently omitted. The pack does not say “publish”, is not release notes (65), and is not a kapanış özeti.
- **English UI.** `Release Evidence Pack`, `Open source record`. Add missing labels with first display.

## Testing Decisions

- **What a good test is.** Release Evidence Pack: every section opens source, mutations refused on the pack, missing/conflicting context is attention not a gate, checks not sessions, elapsed time not stale, published-with-open-work signal does not block. Real-project E2E from PRD 16.
- **Seam (one).** Release Evidence Pack. Playwright/a11y: pack keyboard path (PRD 15).
- **Required counterparts.** Pack ≠ 57 summary; pack ≠ 61 PR Context Card; pack ≠ 65 notes; pack ≠ kapanış özeti; no publish command; missing source not omitted; ADR-0007: session `Passed` is not candidate evidence.

## Out of Scope

- Proje Sürümü durum makinesi — 63.
- Sürüm notu / gözlem turları — 65.
- Test inceleme yazımı — 57.
- GitHub merge/review — 61/19.
- Onaylı snapshot üretimi — 14.
- Eksik kaynağı sessizce yok sayma.
- Paketi sürüm notu veya kapanış özeti yapmak.
- Ürün sürüm adayı kanıt manifesti (Cantiara'nın kendi PRD 16 paketi) — bu kullanıcı yüzeyi değil.

## Further Notes

- **Orient.** Glossary: Proje Sürümü, Test Oturumu. Owning PRD: 12 `#sürüm-kanıt-paketi-ve-yayın-hazırlığı`. ADR 0007. Journey: **Sürüm Kanıt Paketi**.
- **Acceptance.** [Sürüm Kanıt Paketi](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): source drill-down, missing/conflicting context, publish diff, no score/gate/auto mutation.
