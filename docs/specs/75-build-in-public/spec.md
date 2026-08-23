# Build in Public

Kaynak: [`docs/workflow/75-build-in-public/phase-context.md`](../../workflow/75-build-in-public/phase-context.md)

## Problem Statement

Kurucu bir Projenin seçili Roadmap, sürüm iletişimi ve gelişim bağlamını herkese açık göstermek ister. İç Kanban adları, özel ilişkiler ve onaysız canlı Roadmap kopyası sızmamalıdır. Kaynak değişikliği yeni onay olmadan public olmamalıdır. Görüntülenme sayacı, yorum ve abonelik ilk üründe yoktur. Ziyaretçi ilk içerik yavaşsa veya cache iptali ezerse yüzey dürüst değildir.

## Solution

Build in Public Proje bazında isteğe bağlıdır. Kurucu kapalı dünya önizlemesinde alanları, public durum eşlemesini ve metadata farkını onaylar. Roadmap, değişiklik günlüğü ve Proje görünümü aynı Onaylı snapshot revizyonundan sunulur. Varsayılan eşleme `Not Started→Planned`, `In Progress→In Progress`, `Closed+Completed→Completed`'dır; yayımlanmış Proje Sürümü üyeliği `Released` önerebilir; `Blocked` ve `Closed+Abandoned` açık etiket olmadan yayımlanamaz. Gelişim akışı yalnız onaylı tarihsel öğelerdir. Görüntülenme sayacı yoktur. Ziyaretçi kullanılabilir ilk içerik p95 ≤ 2,5 sn / p99 ≤ 4 sn. Erişim ve yer tutucu ortak sözleşmedir, ayrı kart değildir.

## User Stories

1. As a founder, I want to enable Build in Public per Proje, so that public presence is optional.
2. As a founder, I want a preview of selected fields, public status mappings, metadata, attachments, and embeds, so that I see the exact public diff.
3. As a founder, I want internal status names not to leak, so that visitors see Public Status Labels only.
4. As a founder, I want default mapping `Not Started→Planned`, `In Progress→In Progress`, `Closed+Completed→Completed`, so that first publish has an honest visitor vocabulary.
5. As a founder, I want published Proje Sürümü membership to suggest `Released` without applying it until I approve, so that release is a snapshot decision.
6. As a founder, I want `Blocked` and `Closed+Abandoned` to have no default map and to be unpublished until I pick a public label, so that blocked/abandoned work cannot slip out.
7. As a founder, I want internal status changes not to rewrite the public label until a new approved snapshot, so that Kanban motion is not a public mutation.
8. As a founder, I want optional `Public title` and `Public summary` on a Roadmap İş, so that the internal title can stay private.
9. As a founder, I want those public strings not to auto-rewrite when the internal title changes, so that the public narrative stays approved.
10. As a founder, I want Roadmap, changelog, and Proje view to render from the same approved revision, so that the three cannot drift across revisions.
11. As a founder, I want that Proje view to show only approved Roadmap, İş, Belge, design, Karar, and selected Proje Duvarı snapshot members from that revision, so that visitors cannot run live Workspace queries.
12. As a founder adding a Proje Duvarı, I want cards, exact Dosya Eki versions, layout, groups, view text, visual lines, focus order, colors, crop/rotate/markup, and live collection blocks listed as separate preview items, so that omitted private structure cannot leak.
13. As a founder, I want later source edits to show as `Unpublished changes` until I approve a new revision, so that live Roadmap is not the public copy.
14. As a founder, I want the public development feed to include only items I approved, without private comments, relations, or drafts, so that the feed is a public narrative, not Proje Etkinliği.
15. As a founder, I want an optional `Explain the change` when a Roadmap publish would change a visitor’s plan reading, so that I can narrate label/date/membership diffs without the product writing the sentence.
16. As a founder viewing my own public page, I want `Open source record` and `Review publish diff` only for me, so that I can jump home without exposing those controls to visitors.
17. As a founder, I want due-date presentation `Full date`, `Month`, `Quarter`, or `Hidden` derived from the internal date, so that there is no second public date field.
18. As a founder, I want no view counter, last-access time, visitor identity, or analytics, so that 19’s analytics ban holds.
19. As a visitor, I want first usable content within p95 2.5s / p99 4s on the desktop lab and mobile Safari/Chrome matrix, so that the public surface is actually usable.
20. As a visitor, I want YouTube click-to-load if that card was approved, so that paint does not track me.
21. As a founder, I want unresolved `{{alan_adı}}` listed with source record, field, and text context, so that I can fix or give a separate `Publish/share anyway` confirmation.
22. As a founder, I want cache fail-closed on unpublish the same as sharing, so that policy is not forked.
23. As a founder, I want default `noindex` until I enable indexing, so that a known URL is not automatically a search result.
24. As a founder, I want at most one previously approved public Proje Sürümü or Karar featured at the top of the Proje view for a time I set, off by default, so that highlighting is explicit and does not publish private data or mint a notification.
25. As a founder, I want English UI copy, so that the product language stays English.
26. As a founder and visitor using only a keyboard or a screen reader, I want to complete preview, publish, visit, and unpublish, so that “yayın önizleme ve iptal” includes Build in Public.
27. As a founder, I do not want comments, votes, changelog subscription, or a feedback inbox on the public surface, so that publish stays one-way.

## Implementation Decisions

- **Owning documents.** [Build in Public](../../prd/14-sharing-and-public-publishing.md#build-in-public) (all subsections), [ortak sözleşme](../../prd/14-sharing-and-public-publishing.md#ortak-snapshot-ve-dis-gorunurluk-guvenligi), [Herkese açık durum etiketi](../../prd/14-sharing-and-public-publishing.md#iç-durumların-herkese-açık-sunumu), [performans bütçesi](../../prd/15-product-quality.md#performans-butcesi). ADR-0001, ADR-0002. Release-time suggestions of labels/changelog/feed events are owned by [Sürüm Kanıt Paketi](../../prd/12-github-and-project-releases.md#sürüm-kanıt-paketi-ve-yayın-hazırlığı); this feature applies what was approved into the snapshot. No new ADR.
- **Glossary.** Use Dış yüzey, Onaylı snapshot revizyonu, Herkese açık durum etiketi, Proje Sürümü, Roadmap (as the PRD surface; not a new glossary coin). Do not introduce view counter, live Roadmap clone, second public İş, or automatic blog.
- **Same revision trio.** Public Roadmap, changelog, and Proje view are projections of one Onaylı snapshot revizyonu. A visitor must not see Roadmap at rev N and changelog at rev N+1. The Proje view’s members are only approved Roadmap, İş, Belge, design, Karar, and selected Proje Duvarı snapshots from that revision — not live Workspace queries. A selected Wall lists cards, exact Dosya Eki versions, layout, groups, view text, visual lines, focus order, colors, crop/rotate/markup, and live collection blocks as separate preview items; approved live collection blocks freeze as dated read-only snapshots. Public Roadmap/changelog titles may use the Proje profile logo; other chrome stays the product public visual system.
- **Status map.** Defaults: `Not Started→Planned`, `In Progress→In Progress`, `Closed+Completed→Completed`. Published Release membership may suggest `Released`; snapshot changes only on approval. `Blocked` and `Closed+Abandoned` require an explicit public label to publish. Mapping is per-Proje and visible. Internal status change does not auto-change the public label.
- **Public copy fields.** Optional `Public title` / `Public summary` on Roadmap İş; publication title/summary on Proje, Roadmap index, changelog index; Wiki uses Belge title (74). Fields do not inherit across surfaces. Slug unique in the Çalışma Alanı; slug change previews redirect; redirect dies on unpublish and never points at private content.
- **Featured record.** Default off. At most one previously approved public Proje Sürümü or Karar may sit at the top of the Proje view until a founder-set end time. Featuring does not publish private fields, mint content, or emit a Dikkat sinyali. When the window ends the record returns to chronological position.
- **Development feed.** Approved historical items only; private comments/relations/drafts out. Optional `Explain the change` is founder-written, bound to that publish event, not generated, not required, not a second plan truth.
- **Perf.** Visitor first usable content p95 2500 ms / p99 4000 ms for both small and adversarial snapshots, desktop lab and mobile Safari/Chrome matrix (PRD 16). Publish *request accept* budget is separate (p95 1000 ms / p99 2000 ms) and must not be confused with visitor first content. Asset load cannot skip revoke/auth for cache’s sake. Cold app shell 2.5s does not apply to this visitor path.
- **No counters.** No view count, last access, visitor identity, IP profile, device trace. Anonim toplamlar are an 18 candidate.
- **Shared adapter.** Unresolved placeholders are only `{{alan_adı}}`; listed with record, field, and text context; code fences/inline code do not warn; scope approval does not consume the warning; founder returns to content or gives separate `Publish/share anyway`. Fail-closed HTML/asset, YouTube click-to-load, CSP, restore replay of revoke: same as 73/74, observed through this seam, not a third policy.
- **English UI labels.** `Build in Public` (product name), `Planned`, `In Progress`, `Completed`, `Released`, `Public Status Label`, `Public title`, `Public summary`, `Unpublished changes`, `Explain the change`, `Review publish diff`, `Publish/share anyway`. Missing labels go to the term table when first shown. `Public` / `Private` already exist.

## Testing Decisions

- **What a good test is.** Tests observe Build in Public through its public interface: mapping matrix, unpublished-changes diff, same-revision trio, project-view members, featured-record window, placeholder list with resolve-or-confirm, feed membership, no counter, visitor first-content measurement, revoke/range. Expected values are the default map and “source edit unseen until approval.”
- **Seam (one).** Build in Public — product-facing project public snapshot. Access adapter shared with Link Sharing.
- **Modules under test.** Build in Public only. Wiki publish and link-share creates are counterparts. Release communication may supply suggested labels; this suite asserts they do not apply without approval.
- **Prior art.** No Vitest/Playwright suite yet. Perf uses k6/Playwright against the PRD 15 lab definition. Evidence binds to [Herkese açık yayın](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (`Her ikisi`).
- **Required counterparts.** Live Roadmap ≠ public; `Blocked` unpublished without label; view counter absent; cache after unpublish denied with empty-body `410 Gone` + `noindex`; comments/subscriptions absent; Roadmap+changelog+Proje view same revision; unresolved placeholders listed with resolve-or-confirm; featured record default-off and at most one; selected Wall is snapshot members not a live canvas; `Public title`/`Public summary` do not auto-rewrite; slug redirect dies on unpublish.

## Out of Scope

- İç durumları ve özel ilişkileri örtük açma.
- Canlı Roadmap'i public kopya sayma.
- Anlık erişim kapısını veya yer tutucu kontrolünü ayrı teslim kartı sayma.
- Cache veya CDN'in iptali ezmesine izin verme.
- Görüntülenme sayacı, analitik, yorum, oy, abonelik.
- Wiki tekil yayını ve bearer paylaşım oluşturma (74/73).
- Sürüm notu yazarlığı (65); bu kart yalnız onaylanan changelog snapshot'ını sunar.
- Custom domain, embed SDK, scheduled changelog (18).

## Further Notes

- **Orient.** Glossary: Dış yüzey, Onaylı snapshot revizyonu, Herkese açık durum etiketi, Proje Sürümü. Owning PRD: `docs/prd/14-sharing-and-public-publishing.md` (Build in Public). ADRs: 0001, 0002. Related: PRD 12 suggestions, PRD 15 perf, PRD 16 Herkese açık yayın, PRD 19 analytics/comments.
- **Acceptance.** Bind to [Herkese açık yayın](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): mapping matrix, publish diff, visitor first content, old session, asset/range, purge injection.
- **Consumers.** 76 indexes the surface. 71 may emit `public-roadmap-review-due` against the last approved snapshot this feature writes. 29-roadmap-horizon remains the live internal Roadmap.
