# Spec Değişikliği İnceleme Kuyruğu

Kaynak: [`docs/workflow/52-spec-change-review/phase-context.md`](../../workflow/52-spec-change-review/phase-context.md)

## Problem Statement

Kurucu bir Özelliğin Birincil spec Belgesinde yeni kesin sürüm kaydedildiğinde neyin etkilenebileceğini görmek ister. Bugün fark serbest metin karşılaştırmasına, adaylar başlık benzerliğine veya AI tahminine kayabilir; inceleme sonucu hedef İşe, plana veya sürüme örtük yazılabilir; kuyruk satırı kendiliğinden İş olabilir. Çürütülen Varsayım İnceleme Kuyruğu gelecek yönüdür (18) ve bu kuyruk değildir. Test açıkları 55'tedir.

## Solution

Kurucu önceki ve yeni Belge sürümünü değişen bölüm bağlamıyla inceler. Adaylar yalnız kayıtlı bağlardan türetilir: Birincil spec bağı, kararlı bölüm referansı, satır içi referans, canlı içerik kullanımı, sürüme sabit kanıt ve diğer açık ilişkiler. Her aday `Bekliyor` (`Waiting`), `Gözden geçirildi` (`Reviewed`) veya `Etkilenmedi` (`Not affected`) üstverisi ve isteğe bağlı not taşır; bu değerler hedef kaydı yazmaz ve İş/Geri Bildirim durumu değildir. Yeni spec sürümü önceki açık incelemeyi ezmez. `Create Follow-up Work` yalnız önizlemeyle tam olarak bir İş açar; inceleme sonucu kendiliğinden kapanmaz.

## User Stories

1. As a founder, when a Feature's `Primary spec` Document saves a new version, I want a Spec Change Review queue of that exact version pair, so that I can see what changed with candidates in one place.
2. As a founder, I want the diff tied to Document versions, not a free-text compare, so that I read the change inside the section that moved.
3. As a founder, I want the diff record not to replace the spec Document, so that review metadata is not a second spec.
4. As a founder, I want candidates found only from recorded links (Primary spec bind, stable section ref, inline ref, live content use, version-pinned evidence, other explicit relations), so that the queue cannot invent impact from prose.
5. As a founder, I do not want semantic-impact prediction, AI, or title/text similarity as a candidate source.
6. As a founder, I want each candidate to show the changed section, previous and new Document versions, the candidate record, and why it is a candidate.
7. As a founder, I want records bound to the whole Document without an exact section bind marked `Document-level candidate`, not presented as hit by a particular text change.
8. As a founder, I want to mark each candidate `Bekliyor` (`Waiting`), `Gözden geçirildi` (`Reviewed`), or `Etkilenmedi` (`Not affected`), with an optional short note.
9. As a founder, I want those values to be review metadata between that exact spec-version pair and the candidate only, so that they do not write the candidate's status, body, priority, relations, or planning membership.
10. As a founder, I want a new spec version not to overwrite previous open reviews; each change keeps its own version pair, candidates, and results.
11. As a founder, I do not want a bulk “all affected” write, so that evaluation stays per candidate.
12. As a founder using `Create Follow-up Work` on a candidate, I want a preview of the one Work, target Project, starting status, changed spec versions, and the candidate source relation before confirm.
13. As a founder confirming, I want exactly one Work created, visibly bound to those spec versions, and the review result not auto-closed.
14. As a founder, I want the queue row never to become Work by itself, so that review is not a backdoor Work factory.
15. As a founder, I do not want the queue to be a required approval gate, automatic field updater, or bulk follow-up generator.
16. As a founder, I do not want this queue to be Refuted Assumption Review, a Test Gap, or an automation rule.
17. As a founder, I want English UI `Spec Change Review`, `Primary spec`, `Waiting`, `Reviewed`, `Not affected`, `Document-level candidate`, `Create Follow-up Work` for PRD terms `Bekliyor` / `Gözden geçirildi` / `Etkilenmedi`.
18. As a founder using only a keyboard or a screen reader, I want to walk the diff, mark a candidate, and preview follow-up Work.
19. As a founder, I want jsdiff used as the version-compare engine behind the product diff, not as a Git hosting UI.
20. As a founder, I do not want Git diff, GitHub review, or an external review tool to be this queue.
21. As a founder, I want a Feature without a Primary spec to create no queue, so that review cannot run on an arbitrary Document.
22. As a founder, I want candidates that I cannot access to use the shared broken-reference presentation without leaking title or body, so that the queue cannot enumerate another Workspace.
23. As a founder, I want marking `Not affected` with a note to keep that note on the version pair, so that a later spec version does not reuse it as if it applied to new text.
24. As a founder, I want this queue not to file a Test Gap or spawn automation, so that impact review is not a test or rules engine.
25. As a founder, I want undo of a mistaken follow-up Work to go through the Work lifecycle, not to rewrite the review metadata as if the Work never existed.

## Implementation Decisions

- **Owning documents.** [Spec değişikliği inceleme kuyruğu](../../prd/07-documents-and-knowledge.md#spec-değişikliği-inceleme-kuyruğu). Document versions [Belge sürüm geçmişi](../../prd/07-documents-and-knowledge.md#belge-sürüm-geçmişi). Candidate sources are recorded links in [PRD 02](../../prd/02-domain-model-and-lifecycle.md) and [PRD 08](../../prd/08-search-relations-and-evidence.md) — this feature does not invent a new relation type. Follow-up Work preview matches the common create-Work-from-source pattern (origin to the spec versions and candidate). `diff` (jsdiff) is the tech-stack compare library; Git is not the document store (ADR-0021 content-in-database). Çürütülen Varsayım İnceleme Kuyruğu is PRD 18 / glossary future direction. No new ADR.
- **Glossary.** Use Belge, Özellik, İş, Spec Change Review as UI, Çürütülen Varsayım İnceleme Kuyruğu (must not be this), Test Açığı (out). Do not introduce impact-analysis engine, approval gate, or Git review.
- **Exact spec diff.** Queue opens on save of a new version of a Feature's Primary spec Document. Shows previous vs new version with changed-section context. Diff is version-backed, not a working-tree Git diff. The review record is not the spec.
- **Candidates.** Deterministic from recorded links only: Primary spec bind, stable Document section reference, inline reference, live content use, version-pinned evidence, other explicit relations. No AI, no embedding similarity, no title match. Document-level candidates are labeled as such and not attributed to a particular span.
- **Metadata.** Per candidate per exact version pair: closed catalog `Bekliyor` (`Waiting`) / `Gözden geçirildi` (`Reviewed`) / `Etkilenmedi` (`Not affected`) plus optional note. These are Spec Change Review metadata on that version pair, not İş akışı durumu and not Feedback `İncelendi`. Does not write candidate status, content, priority, relations, or planning. New spec version creates a new pair; previous open reviews remain. No bulk implicit write.
- **Follow-up Work.** Explicit action. Preview: one Work, Project, starting status, changed spec versions, candidate source relation. Confirm creates one Work bound to those spec versions. Review result does not auto-close. Deleting or abandoning that Work later does not rewrite review metadata. Not an automation rule, not a Test Gap, not a required gate.
- **Trigger.** Queue exists only for a Feature’s bound Primary spec Document version save. Other Documents may have version history (31) without opening this queue.
- **Access.** Inaccessible candidates are broken-reference safe; no title leak. Notes stay on their version pair.
- **English UI.** Labels in stories; missing terms join the PRD table in the same change. No Turkish UI. `diff` (jsdiff) compares version bodies in the database, not a Git working tree.

## Testing Decisions

- **What a good test is.** Tests observe Spec Change Review through the public interface: version-backed section diff, candidate set equals recorded-link closure, similarity/AI absent, metadata does not write target Work, follow-up preview creates one Work, new spec version does not clobber prior review pair. Not jsdiff snapshot strings as product truth.
- **Seam (one).** Spec Change Review — the product-facing queue, candidate, and follow-up-Work preview interface. Document storage is owned by Documents; this seam consumes versions.
- **Modules under test.** Spec Change Review only. Refuted Assumption Review, Test Gaps, GitHub review, generic Document diff UI beyond Primary spec are counterparts.
- **Prior art.** Bind to [Belge bütünlüğü](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (live vs pinned stays distinct; this queue is the impact-review of a new Primary spec version).
- **Required counterparts.** Unrecorded guess candidates absent; queue opens only on a Feature’s bound Primary spec version save; each candidate carries exactly one of `Waiting` / `Reviewed` / `Not affected` (`Bekliyor` / `Gözden geçirildi` / `Etkilenmedi`); review metadata does not change Work status/priority; follow-up without preview creates nothing; Refuted Assumption Review absent; Git diff not used as the document source.

## Out of Scope

- Çürütülen Varsayım İnceleme Kuyruğu (18).
- Test Açığı üretimi (55).
- Git/GitHub review, harici diff aracı.
- Anlamsal etki tahmini, AI, başlık benzerliği.
- Zorunlu approval kapısı, otomatik alan güncellemesi, toplu takip İşi.

## Further Notes

- **Orient.** Glossary: Belge, Özellik, İş, Çürütülen Varsayım İnceleme Kuyruğu (avoid). Owning PRD: `docs/prd/07-documents-and-knowledge.md` (`#spec-değişikliği-inceleme-kuyruğu`). ADRs: 0021 (content in DB; not Git as spec store). Related: PRD 16 Belge bütünlüğü, PRD 18 future Refuted Assumption Review.
- **Acceptance.** [Belge bütünlüğü](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): version pair, recorded-link candidates, metadata isolation, follow-up preview.
- **Consumers.** `31-documents` owns version save that opens this queue; `09-work-lifecycle` owns the Work that follow-up creates; `18` future review must not share this queue.
