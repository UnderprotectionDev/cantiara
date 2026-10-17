# Implement spec

`/implement-spec` ile bir spec'in tüm ticket'larını tek Conductor workspace'inde uygularken bu rehberi oku. Tek issue'dan açılmış workspace bu rehberi kullanmaz; [issue akışı](issue-tracker.md#selected-issue-in-a-conductor-workspace) geçerlidir.

## Girdi

Spec yolu ve GitHub ticket numaraları kullanıcıdan gelir. Her ticket'ı `gh issue view <number> --comments` ile oku; `ready-for-agent` etiketini ve native `blocked_by` kenarlarını doğrula. Frontier, açık blocker'ı olmayan ticket'lardır. Spec'in Implementation Decisions bölümü önceki teslimleri (ör. `#329`) listeleyebilir; mevcut dosya ve testleri yeniden yazmadan genişlet.

Başlamadan önce workspace temiz olmalıdır: bu rehber ve `AGENTS.md` değişiklikleri commit'lidir, çünkü subagent worktree'leri HEAD'den açılır.

**Done when** her ticket için etiket, blocker ve owning spec yolu doğrulanmış, frontier yazılmış ve `git status` temizdir.

## Branch ve worktree

- Workspace'in mevcut branch'i integration branch'tir. Yeni integration branch açma, workspace branch'ini yeniden adlandırma.
- Her implementer kendi branch'inde ayrı worktree'de çalışır ve integration branch tip'ini kendi branch'ine merge ederek bitirir.
- Integration branch workspace dizininde checkout'ludur; merger subagent merge'ü bu dizinde yapar, başka worktree'de değil.
- Yeni worktree'de ilk iş `bun install`. `apps/server/.env.local` gitignored olduğu için gelmez; DB gerektirmeyen işte gerekmez, DB gerektiren komutlar yalnız workspace dizininde çalışır.
- Keşif notları workspace'in `.context/` dizinine mutlak yolla yazılır; subagent'lar aynı yolu okur.
- Her implementer `AGENTS.md` sürecini izler (Orient, Name, Stack, Change, Close) ve ticket'ın owning spec'ini okur.
- İş bitince `git worktree list` yalnız workspace dizinini gösterir; kalan subagent worktree ve branch'leri kaldırılır.

**Done when** integration branch'te tüm ticket'lar birleşmiş ve `git worktree list` tek satırdır.

## Veritabanı

Şemaya dokunan ticket'lar sırayla çalışır: bir migration üretilip incelenip birleştirilmeden bir sonraki şema ticket'ı başlamaz. Şemaya dokunmayan ticket'lar paralel çalışır. Ticket'ın şemaya dokunup dokunmadığını subagent başlatmadan önce ticket gövdesinden ve owning spec'ten belirle.

Subagent'lar ortak Neon hedefine yazmaz; yalnız migration SQL'ini üretir ve DB gerektirmeyen testleri çalıştırır. Migration, `bun run db:prepare`, `bun run db:doctor` ve DB seam testleri [ortak geliştirme veritabanları rehberine](workspace-databases.md) göre workspace dizininde, tüm ticket'lar birleştikten sonra bir kez çalışır.

**Done when** integration branch'in migration zinciri tek ve çakışmasızdır, `db:prepare` ile sonraki `db:doctor` başarılıdır.

## Pull request

Skill draft PR'ı `gh pr create --base main --draft` ile ilk birleşmeden sonra açar. Conductor'ın `Create PR` eylemi seçili issue bulamayınca `Closes` satırlarını siler; bu yüzden PR'ı skill açar ve gövdeyi Conductor `create_pr` yapısıyla yazar: İngilizce Conventional Commits başlığı, `## Summary`, `## Product contract`, `## Testing`, `## Manual verification`, `## Risks`.

`## Summary` maddelerinden sonra, `## Product contract` öncesinde her ticket için bağımsız satır bulunur: `Closes #360`. Spec yolu `## Product contract` altında yer alır. PR açıldıktan sonra gövdeyi ve GitHub closing metadata'sını `gh pr view --json body,closingIssuesReferences` ile oku.

**Done when** `closingIssuesReferences` spec'in tüm ticket'larını listeler.

## Close-out

[`implement-close-out.md`](implement-close-out.md) tek rapor olarak spec için uygulanır:

- **Ne eklendi** ticket başına bir alt başlık taşır.
- **İnceleme** integration branch üzerindeki tek `/code-review` çıktısıdır.
- **Nasıl test edilir** spec'in kullanıcı yolculuğunu baştan sona anlatır; ticket sırası bağımlılık sırasıdır.
