# Ortak geliştirme veritabanları

Backend çalıştırma, DB kullanan testler, hedef seçimi ve migration öncesinde bu rehberi oku. Teknik sözleşme ve test seam'i [teknoloji yığınındaki Migration hazırlığı — Testing Decisions](../tech-stack.md#migration-hazırlığı--testing-decisions) bölümüdür. Conductor workspace'i üründeki Çalışma Alanı değildir.

## Hedefler

Tüm geliştirme workspace'leri açıkça yapılandırılmış ortak Neon geliştirme veritabanlarını kullanır:

| Sınır | Uygulama bağlantısı | İsteğe bağlı direct bağlantı |
| --- | --- | --- |
| Birincil | `DATABASE_URL` | `DATABASE_URL_UNPOOLED` |
| Güvenlik olayları | `SECURITY_EVENT_DATABASE_URL` | `SECURITY_EVENT_DATABASE_URL_UNPOOLED` |

Güvenlik olayları [ADR-0019](../adr/0019-guvenlik-olay-gunlugunu-ve-ust-anahtari-ayri-guven-alaninda-tut.md) gereği ayrı güven alanında kalır. Geliştirme hedefleri production değildir; bir bağlantı eksikse production'a veya başka workspace'ten bulunmuş bir URL'ye geçme. Ortak geliştirme hedefini operatörün yapılandırması belirler. Secret'ları Git'e, terminal çıktısına veya rapora yazma.

Direct override uygulama bağlantısıyla aynı endpoint, port, veritabanı ve rolü göstermelidir. Pooler sonekinin kaldırılması yeni bir veritabanı seçmez. Eksik veya uyuşmayan hedefte denetim durur.

## Conductor ve Run

Setup yalnız `bun install` çalıştırır. Backend yapılandırılmış geliştirme bağlantılarını kullanır. Run `scripts/local-dev.ts` üzerinden Turbo görevlerini başlatır; kök başlatıcı DB doctor çalıştırmaz. API oturumu `scripts/dev-server.ts` üzerinden iki hedefte salt okunur `db:doctor --development` uyumluluğunu ortak danışma kilidi altında doğrular ve oturum boyunca kilidi tutar. Böylece DB uyumsuzsa API başlamaz, DB gerektirmeyen diğer Run görevleri başlayabilir. Geçmişin eşleşen öneki ve derin fiziksel şema kontrolü geçen `ahead`, API başlangıcı için engel değildir; migration yazması ve hazır issue teslimi için varsayılan doctor/prepare kuralları korunur. Başlangıç denetimi başarısız olduğunda ayrıntılı hata için `bun run db:doctor` elle çalıştırılır; API başarısızlık yolunda aynı derin denetimi yinelemez. Migration hazırlığı issue teslim akışında tamamlanır. Uyumlu dosya değişiminde API güncel kaynakları yeniden denetleyip oturumu sürdürür. `--help`, `-h` ve `--version` DB bağlantısı istemez.

Workspace açılışı ve Archive, ortak geliştirme veritabanlarının yaşam döngüsünü yönetmez.

Mac'teki repository kökünün `.conductor/settings.local.toml` dosyası shared ayarlardan önceliklidir. Yerel Setup yalnız bağımlılık kurmalıdır. İlgisiz Run ayarlarını ve uygulama secret'larını koru. Shared ayarların diğer workspace'lere yayılması remote default branch'e merge gerektirir.

## Migration ve hazırlık

1. Şema değişikliği aynı görevde Drizzle Kit ile üretilmiş sürümlü SQL, journal ve snapshot taşır. `bun run db:check` DB'ye bağlanmadan kaynak şema ve migration zincirini doğrular.
2. `bun run db:doctor` birincil ve güvenlik hedeflerini ayrı denetler. `pending`, `ahead`, `history-mismatch`, `schema-drift`, `target-mismatch`, `connection`, `permission`, `repository` ve `migration-running` durumları hazır değildir. İkisi de `ready` olmadan manuel teste hazır ilan etme.
3. Bekleyen SQL'i inceleyip ortak hedefi kullanan geliştirme API'lerini durdurduktan sonra `bun run db:prepare` çalıştır. Komut kaynakları ve iki hedefi derin kontrol eder; yalnız `ready` veya `pending` sonuçlarıyla devam eder. Bekleyen zincirleri sırayla `bun run db:migrate` ve `bun run db:security:migrate` üzerinden mevcut özel danışma kilidi altında uygular, ilk başarısızlıkta durur ve uygulama sonrasında iki hedefi derin doğrular. Hazır hedefin migration komutunu çalıştırmaz. İki DB tek transaction değildir; ikinci hedef başarısızsa ilkinde uygulanmış değişiklikler kalır. Kilit atlanmaz; `db:push` yalnız disposable yerel deneme içindir.
4. Ortak DB Git dalından ilerideyse uygulanmış SQL/journal/snapshot geçmişini sahip ürün kodu ve şemasıyla birlikte güvenilir Git geçmişinden bütünleştir. Uygulanmış dosyaları yeniden üretme, sahte başarı kaydı ekleme veya ortak DB'yi sıfırlama. Geçmişler ayrışıyorsa DB'ye yazmayı durdur; bağımsız kaynak kod çalışmasına devam et.
5. Her DB kullanan issue tesliminde doğru geliştirme hedeflerinde `db:prepare`, etkilenen DB seam testleri ve testlerden sonra `db:doctor` gerekir. Hazırlık komutu derin denetimi içerir; yalnız şema değiştiğinde migration üretilir. Kontrol başarısızsa veya atlandıysa hazır handoff yapma.
6. Production migration yalnız incelenmiş dağıtım bağlantısıyla açık `db:migrate:deploy` veya `db:security:migrate:deploy` komutundan geçer. Geliştirme başlangıcı dağıtım izni taşımaz.

## Implement sırasında DB engelleri

Backend çalıştırma için `db:doctor --development` uyumluluğu, migration hazırlığı ve hazır teslim için varsayılan `db:doctor` ve `db:prepare` sözleşmesi geçerlidir. DB kullanan issue testleri hazır teslimden önce bu sözleşmeyi tamamlar. İlk `db:doctor` başarısız olduğunda issue'nun bağımsız kodunu ve DB gerektirmeyen testlerini tamamlamaya devam et; DB'ye bağlı adımları neden çözülene kadar beklet. DB sorunu issue'nun kendisiyse ilgili kaynak kod teşhisini ve düzeltmesini sürdür. Bir engel, yalnız gerçekten bağlı olduğu adımı durdurur.

| Sonuç | Agent'ın yapacağı iş |
| --- | --- |
| `pending` | Bekleyen kanonik SQL'i incele. Geliştirme hedefi doğrulanmış, kaynak kontrolü başarılı ve hedefler kullanılmıyorsa `db:prepare` ile hazırlığı tamamla; migration işini kullanıcıya devretme. |
| `ahead` | Backend gerekiyorsa `db:doctor --development` ile uyumluluğu denetle; başarılıysa çalıştırma sürdürülebilir. Migration yazması ve hazır teslim için eksik uygulanmış geçmişin güvenilir Git kaynağını belirle; gereken geçmişi sahip kodu ve şemasıyla birlikte bütünleştir. Kaynak veya kapsam belirsizse bunu kaydet ve bağımsız implementasyonla devam et. |
| `history-mismatch`, `schema-drift`, `repository`, `target-mismatch` | Geçmiş, şema veya yapılandırma nedenini incele; doğrulanmış kaynakla uzlaştırılana kadar ortak DB'ye yazmayı beklet. Uygulanmış geçmişi değiştirme. |
| `connection`, `permission` | Mevcut geliştirme bağlantısını ve erişimi kontrol et. Eksik erişimi bildirirken yapılabilecek bağımsız kod işini tamamla. |
| `migration-running` veya çalışan API kilidi | Hedefin kullanım sırasını koordine et; başka workspace'in API'sini kendiliğinden kapatma. Beklerken bağımsız kod işini sürdür. |

Bağımsız işler tamamlandığında çözülemeyen engeli, hangi backend/test/teslim adımını etkilediğini ve gereken erişim veya kanonik kaynak bilgisini somut olarak raporla. Yalnız `pending` sonucu alınması, kullanıcıdan işi yeniden başlatmasını isteme nedeni değildir. Hazırlık ve etkilenen testler tamamlanana kadar teslimi “manuel teste hazır” olarak sunma.

## Issue teslim akışı

1. DB kullanan issue'da `bun run db:doctor` ile hedefleri ve geçmiş durumunu öğren. Başarısız sonuçta [implement sırasında DB engelleri](#implement-sırasında-db-engelleri) bölümüne göre bağımsız çalışmayı sürdür ve DB nedenini ele al.
2. Issue'nun şema değişikliği varsa migration'ını üret ve SQL'i incele. Diğer issue'nun uygulanmış geçmişi eksikse sahip kodu ve şemasıyla birlikte bütünleştir. Kod geliştirme paralel devam eder; ortak DB hazırlığı ve manuel test için sıra koordine edilir.
3. Kendi geliştirme API'lerini durdur. Başka workspace'in çalışan API'sini kendiliğinden kapatma; ortak hedefi değiştirmek için kullanım sırasını koordine et. Operatörün açıkça geliştirme için yapılandırdığı hedeflerde `bun run db:prepare` çalıştır. Komut deployment ortamını reddeder; Neon endpoint'inin production olup olmadığını keşfetmez.
4. Owning spec'in etkilenen DB seam testlerini çalıştır. Manuel testte kullanılacak kayıtları hazırla ve doğrula veya tarayıcıda kayıt oluşturmanın tüm adımlarını kapanıştaki `Veri hazırlığı` bölümünde yaz.
5. Testlerden sonra `bun run db:doctor` çalıştır. Kaynak şema veya migration geçmişi değiştiyse hazırlığı ve etkilenen testleri tekrarla. Hazırlık sonucu denetim anı için geçerlidir; başka issue'nun sonradan uyguladığı değişiklikler yeni kontrol gerektirir. Run içindeki API görevi başlangıçta, oturum kilidini alırken yeni salt okunur uyumluluk denetimi yapar; Run'ın kök başlatıcısı bu denetimi yinelemez.
6. Kapanışta hazırlık sonucunu, uygulanmış veya zaten güncel migration'ları, gerçekten çalıştırılmış testleri ve kalan engelleri belirt. Kullanıcıya verilen tarayıcı adımları migration komutu içermez; kullanıcı Run ile uygulamayı açıp açıklanan akışı dener.

## Yerel test sınırı

Repository DB entegrasyon testleri disposable yerel PostgreSQL kullanır. `MIGRATION_TEST_DATABASE_URL` yalnız loopback host ve `cantiara_migration_test*` isimli boş fixture DB'leri gösterebilir; testler remote Neon'a yazmaz. `NEON_LOCAL=true` ve `scripts/neon-local-proxy.ts` taşıma sınırı korunur. Yerel test başarısı canlı geliştirme hedefinin hazır olduğunun kanıtı değildir.

Bu rehberin hedef, başlangıç, kilit, geçmiş ve handoff kuralları teknoloji yığınındaki aynı Testing Decisions seam'ine bağlıdır; `packages/db/scripts/doctor.test.ts`, `packages/db/scripts/migrations.integration.test.ts`, `packages/db/scripts/prepare.test.ts`, `packages/db/scripts/prepare.integration.test.ts` ve `scripts/local-dev.test.ts` karşılıkları korur.
