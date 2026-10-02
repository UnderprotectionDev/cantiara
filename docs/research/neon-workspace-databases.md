# Neon workspace geliştirme yalıtımı araştırması

Araştırma tarihi: **2 Ekim 2026**. Kaynaklar bu oturumda resmi HTTP içeriklerinden okundu; ayrı salt-okuma araştırmacı geçmiş uygulamayı ve riskleri bağımsız değerlendirdi. Neon yönetim metadata'sı ayrıca salt okunur kontrol edildi. Bu belge tasarım kanıtıdır; operasyon sözleşmesinin sahibi [`docs/tech-stack.md`](../tech-stack.md) ve [`workspace-databases.md`](../agents/workspace-databases.md)'dir.

## Bulgular ve seçimler

| Resmi kaynak bulgusu | Bu projedeki seçim |
| --- | --- |
| Child branch copy-on-write kopyadır; parent ve child yazıları bağımsızdır. Varsayılan parent güncel/default dal olabilir. [Branching](https://neon.com/docs/introduction/branching), [Manage branches](https://neon.com/docs/manage/branches) | Parent her istekte açık ID'dir; Git migration içeriğine bağlı doğrulanmış tabandan kopyalanır. |
| Normal kopya veriyi de taşır. Schema-only yapı veriyi taşımaz. [Schema-only branches](https://neon.com/docs/guides/branching-schema-only) | Bootstrap schema-only bağımsız kök kullanır; içinde yeni boş mantıksal DB'ye Git migration zinciri uygulanır. Ledger uydurulmaz; ürün verisi kopyalanmaz. |
| Create branch compute/operation sonuçları taşır; bağlantı read-write endpoint ister. URI branch/endpoint/database/role seçer. [OpenAPI](https://neon.com/api_spec/release/v2.json), [Create branch](https://api-docs.neon.tech/reference/createprojectbranch), [Connection URI](https://api-docs.neon.tech/reference/getconnectionuri) | Bun native fetch adaptörü, timeout, operation polling, endpoint/role/database doğrulaması. POST timeout'ta kör tekrar yok; önceden kaydedilmiş nonce ve server kimliğiyle uzlaştırma. |
| PgBouncer transaction kipindedir; session advisory lock desteklenmez. [Connection pooling](https://neon.com/docs/connect/connection-pooling) | Yerel development uygulaması, migration, doctor ve lease aynı direct URL'yi kullanır. |
| Project-scoped key yalnız o projeyi yönetir ama içindeki kaynakları değiştirme/silme yetkisi vardır. [API keys](https://neon.com/docs/manage/api-keys) | İki proje için iki anahtar; uygulama child process'lerinden çıkarılır. Branch-scoped güvenlik garantisi değildir; production/default/protection/sahiplik ayrıca kontrol edilir. |
| Protected branch yönetim işlemlerini sınırlar; kendi başına SQL read-only rolü değildir. [Protected branches](https://neon.com/docs/guides/protected-branches) | Tabanlara normal çalışma komutları yazamaz; deep denetim korunur. Yetkili harici DDL'nin imkânsız olduğu iddia edilmez. |
| Expiration OpenAPI'de EAP; schema-only rehberinde Beta/CLI hakkında çelişkili açıklamalar var. [OpenAPI](https://neon.com/api_spec/release/v2.json), [Schema-only branches](https://neon.com/docs/guides/branching-schema-only) | TTL/CLI desteğine dayanılmaz. Schema-only API başarısızsa veri taşıyan normal kopyaya fallback yapılmaz. |
| `workflow_run` secret taşıyabilir; güvenilmeyen PR kodu çalıştırmak tehlikelidir. Concurrency FIFO garantisi taşımaz. [Workflow events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run), [Concurrency](https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency) | Yalnız aynı repository'nin başarılı main push entegrasyon koşusu, exact SHA checkout, `neon-development` environment ve iptal etmeyen concurrency. Superseded commit atlanır; PostgreSQL promotion kilidi ek korumadır. |
| Conductor Setup/Archive lifecycle komutlarıdır; `nonconcurrent` ortak kaynakları korur. [Scripts](https://conductor.build/docs/reference/scripts), [Environment](https://conductor.build/docs/reference/environment-variables), [Settings schema](https://conductor.build/schemas/settings.repo.schema.json) | Setup iki DB dalı açar, Run salt okunur readiness yapar, Archive owned dalları siler. Sabit portlar nedeniyle aynı anda bir Run kısıtı korunur. |

## Repository ve canlı bulgu

- `62e3d38b` / PR #216: eski workspace yalıtımı, sahiplik nonce'ı, çift proje, secure state, taban kontrolleri. Örnekler `scripts/workspace-neon.ts` ve `scripts/conductor-workspace.ts`.
- `e493d6cd` / PR #228: ortak hedeflere dönüş. Commit'in açıklamadığı motivasyon varsayılmadı.
- `70cf2b24` / PR #256: güncel doctor/readiness/lease. Bunlar gevşetilmedi; eski Run otomatik migration davranışı geri getirilmedi.
- Salt-okuma Neon metadata kontrolünde birincil projede yalnız production/default dalı görüldü; eski primary base ID yok. Güvenlik projesinde default main ve eski tabanlar var; mevcut Git zincirine uygun oldukları varsayılmadı.
- Bu workspace ortamında yönetim API anahtarları yok. Canlı bootstrap/pilot ve GitHub environment secret kurulumu **aktivasyon işi** olarak kaldı; production'a yazılmadı.

## Uygulama planı

1. Sahiplik/state/URL sınırını test-first kur; eksik/copied state'te fail closed.
2. HTTP adaptörü ve çift proje lifecycle'ını ekle; yarım işlemi aynı kimlikle sürdür, protected/yanlış hedefi değiştirme.
3. Git fingerprint'i ile salt-okunur baseline deep denetimini bağla; Run/doctor/migration aynı hedefi kullanmalı.
4. Production'a yazmayan bootstrap ve başarılı main CI sonrasında sıralı development promotion'ını ekle; iki-proje atomiklik sınırını belirt.
5. DB seam'ini gerçek disposable PostgreSQL'de, lifecycle'ı HTTP fixture'larında ve guard'ları CLI smoke testlerinde doğrula; canlı aktivasyonla karıştırma.

Yeni dependency yok: Bun/native fetch, Drizzle araçları, PostgreSQL advisory lock, Zod ve Vitest mevcut yığındır. Ürün spec'i/glossary sahibi `none`; altyapı sahibi `docs/tech-stack.md`, sınırlar ADR 0019/0009 ve yeni ADR 0024'tür. Testing Decisions teknoloji yığınında; activation pilot işletim rehberindedir.

## Review'da netleştirilen sağlayıcı sınırı

İki bağımsız reviewer, create isteğindeki `parent_id` alanını sonuç dalının parent ilişkisiyle karıştırdı. Resmi schema-only rehberinin API bölümünde bu alan açıkça şeması kopyalanacak kaynak dal için istenir; aynı rehber bağımsız sonuç kökünün parent'ı olmadığını belirtir. OpenAPI `BranchCreateRequest.properties.branch.properties.init_source` aynı ayrımı doğrular. İstek alanı kaldırılmadı; parametre `sourceBranchId` olarak adlandırıldı, sonuçta parent yokluğu kontrolü korundu ve HTTP fixture eklendi. Bu, gerçek Neon pilotunun çalıştırıldığı anlamına gelmez.

## Uygulama doğrulaması ve aktivasyon sınırı

- Ayrı, atılabilir PostgreSQL 16 kümesinde `bun run db:test -- --no-file-parallelism`: **15 dosya, 95 test başarılı**. Migration uygulama/tekrar, veri koruma, salt-okunur baseline denetimi, schema drift, promotion kilidi ve bağlantı kaybı testleri bu koşuya dahildir. HTTP lifecycle testleri fixture kullanır; Neon API'ye canlı yazı değildir.
- `bun run db:check`: birincil **90**, güvenlik **4** migration dosyası, snapshot zinciri ve kaynak şema doğrulandı. Aynı yerel fixture hedeflerinde `bun run db:doctor -- --deep` iki DB için `ready` döndü.
- `bun run check-types`, değişen **22** TypeScript/JSON dosyasının Ultracite denetimi ve `git diff --check` başarılı. CLI reddetme yolları ve workflow/settings yapılandırması ayrıca kontrol edildi.
- Ürün şeması veya sürümlü SQL değiştirilmedi. Canlı production/shared veritabanına yazılmadı; commit/push yapılmadı. Tarayıcı/E2E, GitHub'da workflow çalıştırma ve iki canlı Neon workspace'in uçtan uca pilotu yapılmadı.
- `NEON_API_KEY` ve `NEON_SECURITY_API_KEY` ortamda bulunmadığından gerçek bootstrap ve development ID yayını tamamlanmadı. `.conductor/neon.json` development ID'leri bilinçli olarak `null` kaldı. GitHub `neon-development` environment secret/protection kurulumu ve işletim rehberindeki canlı kabul adımları tamamlanmadan sistem aktif veya manuel teste hazır sayılmaz.
