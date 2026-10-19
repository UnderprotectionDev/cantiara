# Implement spec

`/implement-spec` ile bir spec'in tüm ticket'larını tek Conductor workspace'inde uygularken bu rehberi oku. Tek issue'dan açılmış workspace bu rehberi kullanmaz; [issue akışı](issue-tracker.md#selected-issue-in-a-conductor-workspace) geçerlidir.

## Girdi

Spec yolu ve GitHub ticket numaraları kullanıcıdan gelir. `docs/specs/<n>/issues/*.md` yalnız kaynaktır; kayıt GitHub issue'dur.

1. Her ticket'ı `gh issue view <number> --comments` ile oku ve `ready-for-agent` etiketini doğrula.
2. Native blocker'ları `gh api repos/UnderprotectionDev/cantiara/issues/<number>/dependencies/blocked_by` ile oku; gövdedeki `Blocked by: #<number>` satırına da uy.
3. Frontier'ı hesapla: blocker'larının hepsi integration branch'e merge edilmiş, kendisi henüz merge edilmemiş ticket'lardır. GitHub'da issue'lar PR merge olana kadar açık kalır; integration branch'e merge edilmiş blocker GitHub'da açık görünse bile çözülmüş sayılır. Bu kural [issue-tracker.md](issue-tracker.md)'deki "her blocker kapalı" kuralının yerine geçer. Her merge'den sonra frontier'ı yeniden hesapla.

Spec'in Implementation Decisions bölümü önceki teslimleri (ör. `#329`) listeleyebilir; mevcut dosya ve testleri yeniden yazmadan genişlet.

Başlamadan önce workspace temiz olmalıdır: bu rehber ve `AGENTS.md` değişiklikleri commit'lidir, çünkü subagent worktree'leri HEAD'den açılır.

**Done when** her ticket için etiket, blocker ve owning spec yolu doğrulanmış, frontier yazılmış ve `git status` temizdir.

## Branch ve worktree

- Workspace'in mevcut branch'i integration branch'tir. Yeni integration branch açma, workspace branch'ini yeniden adlandırma.
- Her implementer kendi branch'inde ayrı worktree'de çalışır ve integration branch tip'ini kendi branch'ine merge ederek bitirir.
- Integration branch workspace dizininde checkout'ludur; merger subagent merge'ü bu dizinde yapar, başka worktree'de değil.
- Yeni worktree'de ilk iş `bun install --frozen-lockfile`. `apps/server/.env.local` gitignored olduğu için gelmez; DB gerektirmeyen işte gerekmez, DB gerektiren komutlar yalnız workspace dizininde çalışır.
- Keşif notları workspace'in `.context/` dizinine mutlak yolla yazılır; subagent'lar aynı yolu okur.
- Her implementer `AGENTS.md` sürecini izler (Orient, Name, Stack, Change, Close) ve ticket'ın owning spec'ini okur.
- İş bitince bu çalışmanın açtığı her implementer worktree'si ve branch'i kaldırılır; `git worktree list` workspace'i ve diğer Conductor workspace'lerini göstermeye devam eder.

**Done when** integration branch'te tüm ticket'lar birleşmiş, integration branch adı değişmemiş ve bu çalışmanın açtığı her implementer worktree'si ve branch'i kaldırılmıştır; `git worktree list` workspace'i ve diğer Conductor workspace'lerini göstermeye devam eder.

## Veritabanı

Şemaya dokunan ticket'lar sırayla çalışır: bir migration üretilip incelenip birleştirilmeden bir sonraki şema ticket'ı başlamaz. Şemaya dokunmayan ticket'lar paralel çalışır. Ticket'ın şemaya dokunup dokunmadığını subagent başlatmadan önce ticket gövdesinden ve owning spec'ten belirle.

Subagent'lar ortak Neon hedefine yazmaz; yalnız migration SQL'ini üretir ve DB gerektirmeyen testleri çalıştırır. Worktree'de `apps/server/.env.local` olmadığından ve `drizzle-kit generate` veritabanına bağlanmadığından subagent migration'ı `DATABASE_URL=postgres://unused@localhost/unused bun run db:generate` ile üretir ve `bun run db:check` ile doğrular. Migration, `bun run db:prepare`, `bun run db:doctor` ve DB seam testleri [ortak geliştirme veritabanları rehberine](workspace-databases.md) göre workspace dizininde, tüm ticket'lar ve `/code-review` fix turu birleştikten sonra bir kez çalışır; böylece fix'ler de DB doğrulamasından geçer.

**Done when** integration branch'in migration zinciri tek ve çakışmasızdır, `db:prepare` ile sonraki `db:doctor` başarılıdır ve hiçbir subagent ortak DB'ye yazmamıştır. Başarısız adım varsa tam engel close-out'a yazılır.

## Pull request

Skill draft PR'ı `gh pr create --base main --draft` ile ilk birleşmeden sonra açar; PR `main`'i hedefler. Close-out kontrolleri geçince `gh pr ready` ile hazır işaretlenir. Conductor'ın `Create PR` eylemi seçili issue bulamayınca `Closes` satırlarını siler; bu yüzden PR'ı skill açar ve gövdeyi Conductor `create_pr` yapısıyla yazar: İngilizce Conventional Commits başlığı, `## Summary`, `## Product contract`, `## Testing`, `## Manual verification`, `## Risks`.

`## Summary` maddelerinden sonra, `## Product contract` öncesinde her ticket için bağımsız satır bulunur: `Closes #360`. Spec yolu `## Product contract` altında yer alır. PR açıldıktan sonra gövdeyi ve GitHub closing metadata'sını `gh pr view --json body,closingIssuesReferences` ile oku.

**Done when** `closingIssuesReferences` spec'in tüm ticket'larını listeler.

## Close-out

[`implement-close-out.md`](implement-close-out.md) tek rapor olarak spec için uygulanır:

- **Ne eklendi** ticket başına bir alt başlık taşır.
- **İnceleme** integration branch üzerindeki tek `/code-review` çıktısıdır. `/code-review` tüm ticket'lar birleştikten sonra bir kez çalışır. Çıktı `## Standards` ve `## Spec` içerir. Bulguların hepsi tek fix turunda düzeltilir; ardından yalnız düzeltilen bulgular için odaklı kontrol yapılır ve ikinci geniş review başlatılmaz.
- **Nasıl test edilir** spec'in kullanıcı yolculuğunu baştan sona anlatır; ticket sırası bağımlılık sırasıdır. Hazırlanan manuel test kayıtlarını veya tam tarayıcı hazırlığını anlatır.
- DB sonucunu ve çalıştırılmayan her kontrolü yaz.

**Done when** rapor üç bölümü de içerir, DB sonucu ile çalıştırılmayan kontroller yazılmıştır ve `gh pr ready` yapılmıştır.
