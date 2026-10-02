# Workspace veritabanları

Conductor DB setup, hedef seçimi, migration, main promotion ve archive için bu rehberi oku. Teknik sözleşme/test seam'leri [`docs/tech-stack.md`](../tech-stack.md), mimari sınır [ADR-0024](../adr/0024-neon-gelistirme-veritabanlarini-git-tabanli-yalit.md), kaynaklar [araştırma notudur](../research/neon-workspace-databases.md). Üründeki Workspace ile Conductor workspace kimliği farklıdır.

## Hedefler

DB gerektiren workspace birincil ve güvenlik projesinde kendi Neon dalını kullanır; diğer workspace'ler Neon kaynağı oluşturmaz. `.conductor/neon.json` yalnız non-secret project/production/development/database/role bilgisi taşır. `.context/neon-workspace.json` private `0600` sahiplik ve direct bağlantı kaydıdır; Git'e ekleme veya başka workspace'e kopyalama.

Kanonik geliştirme DB'si production değildir. `cantiara-base-<fingerprint>` tabanları SQL, journal ve snapshot **baytlarının** hash'ine bağlıdır; tam ledger ve deep denetim ister. Baseline Git merge-base'e bağlıdır. “Neon'daki en yeni şema”, henüz merge edilmemiş başka özelliğin DDL'sini içerebilir; onu bağımsız göreve taşıma.

### Workspace açılışı ve ihtiyaç halinde aktivasyon

Conductor Setup yalnız `bun install` çalıştırır. Yeni workspace açılması, Git dalı adı veya `.context/attachments/` içindeki GitHub issue dosyaları DB ihtiyacı değildir; bunlar otomatik Neon kurulumu tetiklemez. Dokümantasyon, kod incelemesi, statik kontroller ve açık disposable yerel DB testleri için Neon aktivasyonu yapma. Workspace açılışı management key veya doğrulanmış DB tabanı gerektirmez; mevcut private DB kaydını da değiştirmez.

Backend'i başlatmadan veya workspace DB bağlantısı gerektiren komut/test çalıştırmadan önce owned state'i kontrol et. Kayıt yoksa `bun run db:workspace:setup` ile iki izole dalı açıkça etkinleştir. Mevcut tamamlanmış kayıt aynı hedefleri kullanır; yarım kurulumu aynı komut ve state ile sürdür. Aktivasyon öncesi Run kurulum komutuna yönlendirerek durur; kaynak oluşturmaz, migration uygulamaz ve kopyalanmış URL'ye geçmez. DB'siz Archive identity, anahtar veya merged PR istemeden kaynak silmeden döner. Otomatik workspace Setup'ı yeniden çalıştırmak DB'yi etkinleştirmez veya mevcut dalları temizlemez.

Mac'te repository kökündeki `.conductor/settings.local.toml`, shared `.conductor/settings.toml` değerlerinden önceliklidir. Yeni workspace hâlâ otomatik DB kurulumu yapıyorsa önce bu yerel Setup override'ını kontrol et; yalnız `bun install` çalıştırmalı, DB kaydı olmayan Archive ise Keychain erişimi istememelidir. Yerel dosyadaki secret'ları veya diğer Run ayarlarını değiştirme ve dosyayı Git'e ekleme. Shared politika ve lifecycle kodunun başka workspace'lere yayılması remote default branch'e merge gerektirir. Setup ve DB'siz Archive kontrolünü gerçek etkin komutla aynı fixture/stub sınırında yap; bu kontrol canlı kaynak hazırlığı kanıtı değildir.

Bu politikanın test seam'i teknoloji yığınındaki `Migration hazırlığı — Testing Decisions` bölümüdür; issue var/yok, local/cloud Setup, mevcut state'i koruma, DB'siz Run ve Archive ayrı karşılıklarla doğrulanır.

Run'da root readiness başarılı olup API `target-mismatch` ile duruyorsa Turbo alt sürecinin ortam aktarımını kontrol et. `dev` görevi doğrulanmış worktree kimliği/yollarını ve owned direct URL override'larını strict modda korumalıdır; aksi halde backend'in `.env.local` dosyasındaki eski override geri gelebilir. Aktarım sözleşmesini `turbo.json` ve aynı Testing Decisions seam'i korur; hatayı shared URL, loose ortam veya sahiplik kontrolünü kaldırarak aşma.

### DB kurulumu, Run ve Archive kimliği

`CONDUCTOR_WORKSPACE_ID` agent oturumunda bulunabilir ama Setup/Run/Archive script ortamının zorunlu girdisi değildir. Üç akış `scripts/workspace-database.ts` içindeki ortak resolver'ı kullanır. Belgelenmiş `CONDUCTOR_ROOT_PATH` ve `CONDUCTOR_WORKSPACE_PATH` gerçek dosya yollarına çözülür; script'in kendi repository köküyle, ayrı Git worktree köküyle ve ortak Git diziniyle eşleşmeleri gerekir. Kimlik ortak Git dizini, workspace yolu ve worktree Git dizininden türetilir. Display name, Git dal adı ve issue numarası kimlik değildir; symlink aynı kimliğe, başka worktree ayrı kimliğe çözülür. Hatalı veya yarım yol ortamı varsa native ID'ye kaçış yapılmaz. Yol ortamı hiç yoksa geçerli native ID eski oturumlar için kullanılabilir; ikisi de yoksa remote komut durur. Açık `NEON_LOCAL=true` bu kimliği gerektirmez ve Neon kaynağı oluşturmaz.

Yeni private state `workspaceLocation` bağını saklar. Bağlı state başka workspace'e kopyalanırsa native ID eşleşse bile reddedilir. Eski native-ID state'inin ilk geçişi yalnız orijinal ID'nin mevcut olduğu agent oturumunda `bun run db:workspace:setup` ile yapılır; resolver doğrulanmış konumu kayda bağlar, mevcut dal ID'lerini, adlarını ve nonce'i değiştirmez. Sonraki Setup/Run/Archive native ID olmadan aynı kaydı kullanır. Orijinal kimlik doğrulanamıyorsa JSON'u elle değiştirerek veya state'i silerek sahiplik kontrolünü aşma.

Kimlik hatası düzeldikten sonra `Verified canonical baseline is unavailable` görülürse eksik fingerprint tabanını ayrı aktivasyon engeli olarak ele al. Güncel main promotion sonucunu ve iki projedeki beklenen tabanları salt okunur incele; başarılı eski bir CI koşusu kaynağın hâlâ var olduğunu kanıtlamaz. Eksik tabanı doğrulanmış kanonik promotion üzerinden yeniden yayımlamak gerekir; Setup güncel herhangi bir DB'yi kopyalayamaz. Bu sözleşmenin test karşılığı teknoloji yığınındaki `Migration hazırlığı — Testing Decisions` bölümüdür.

Konum kimliği worktree Git dizininin dosya sistemi aygıtı, inode'u ve doğum zamanını da içerir. Aynı yol yeni bir Git worktree için tekrar kullanıldığında eski state sahipliği geçerli olmaz; bu karşılık `scripts/workspace-database.test.ts` ile doğrulanır. Aktif workspace dizinini veya Git yönetim dizinini yeniden oluşturarak otomatik sahiplik devri yapma.

## Bir defalık aktivasyon

1. Her proje için ayrı management key oluştur; destekleniyorsa project-scoped kullan. `NEON_API_KEY` birincil, `NEON_SECURITY_API_KEY` güvenlik projesini yönetir. Key'i chat'e, Git'e veya tracked config'e yazma; açık DB kurulum komutunun devraldığı güvenli ortamda sağla. Yalnız bağımlılık kuran Conductor Setup bunları gerektirmez. Project-scoped key'in production kaynaklarını da yönetebildiğini unutma.
2. `.conductor/neon.json` project/production/role bilgilerini metadata ile doğrula. İlk development ID'leri `null`; `databaseName` production'da kullanılmayan yeni DB adı olmalı.
3. Kanonik `origin/main` migration'larıyla `bun run db:development:bootstrap` çalıştır. Bu **açık** komut schema-only bağımsız dallar ve yeni mantıksal DB'ler oluşturup bunlarda Git zincirini uygular. Production/ortak DB sıfırlanmaz; miras alınmış tabloya ledger uydurulmaz. Schema-only erişimi yoksa dur; normal data kopyasına dönme.
4. Bootstrap iki hedefin migration/deep denetimi ve taban yayını bitmeden tracked development ID'lerini yazmaz. Hata olursa `.context/neon-development-bootstrap.json` kimliklerini koru; aynı komut/state güvenle devam eder. Başarıdan sonra yazılan non-secret ID'leri config review'ına dahil et. Hedefler zaten ayarlıysa bootstrap yeniden kaynak üretmez; mevcut hedef için promotion gerekir.
5. GitHub'da `neon-development` environment oluştur; yalnız main üzerinden dağıtıma izin ver ve uygun protection/approval ayarla. İki key'i aynı adlı environment secret'larına kaydet. PR testleri management secret taşımamalı.
6. Main merge sonrası `Integration tests` ve `Development database promotion` koşularını kontrol et. Conductor shared ayarları default branch'ten okur; yalnız yerel TOML değişikliği bütün workspace'leri aktive etmez.

Anahtarlar/DB tabanları/CI secret'ları hazır değilse canlı aktivasyon tamamlandı deme. Fixture testi gerçek Neon hazırlığı değildir; eksiklik açık aktivasyon engelidir.

## Görev akışı

1. Conductor Setup yalnız bağımlılıkları kurar. DB gerektirmeyen görev için sonraki DB adımlarını çalıştırma; issue dosyasına göre aktivasyon kararı verme.
2. Workspace DB'sine ihtiyaç doğduğunda `bun run db:workspace:setup` ile çift dalı oluştur veya mevcut kurulumu sürdür. ID/nonce ilk API yazısından önce kaydedilir. İkinci proje başarısızsa ilk başarılı dal korunur; aynı state'ten tekrar devam et, yeni nonce üretme.
3. İlk kopya Git baseline'ına karşı salt okunur/deep doğrulanır. DB kurulumu feature migration uygulamaz. Eksik tabanda main promotion'ı kontrol et; production/default/rasgele ahead DB'ye fallback yapma.
4. Uygulama secret'ları `.env.local` içinde kalabilir; DB URL'leri Run, doctor ve migration'da owned state'ten gelir. Copied URL bu seçimi ezemez. Conductor kimliği yoksa remote geliştirme komutları durur; standalone terminalde shared URL'ye düşmez. Generate/Studio workspace wrapper'ını kullanır. Management key'ler yerel fixture kipinde de uygulama süreçlerine verilmez. `NEON_LOCAL=true` yalnız açık disposable PostgreSQL sınırıdır.
5. Şema değişikliğinde aynı görevde SQL üret, incele, `bun run db:check` çalıştır. İlgili Run'u durdur; `bun run db:migrate` ve gerekirse `bun run db:security:migrate` uygula. Uygulanmış canonical SQL/journal/snapshot değiştirme.
6. `bun run db:doctor`, şema değişikliğinde `bun run db:doctor -- --deep` ve owning DB seam testini geçir. Run salt okunur readiness/session lease kullanır; eksik migration'ı uygulamaz. İki target hazır değilse manuel teste hazır handoff verme.

Sabit API/web/docs portları korunur; Run `nonconcurrent` kalır. DB izolasyonu aynı portta iki geliştirme sunucusu çalıştırmaz. Bootstrap production'daki aynı adlı mantıksal DB'yi salt okunur kontrolle reddeder; schema-only kökte yeni DB'ye Git zinciri uygulanır. Tabanlar bu kanonik DB'nin **ledger dahil** kopyalarıdır; schema-only kopya ledger satırlarını kaybedeceği için taban yayını `parent-data` kullanır. Taban ayrıca uygulama seed'i üretmez, ancak migration'ın oluşturduğu referans/backfill verisini taşır. Kanonik DB'yi uygulama veya manuel test hedefi yapma; workspace kaydını normal ürün akışında oluştur.

## Merge ve ana geliştirme DB'si

Başarılı **main push** integration koşusu exact SHA promotion tetikler; PR veya farklı repository kodu yönetim secret'ıyla çalışamaz. Başlangıçta superseded commit atlanır; bitişte main tekrar kontrol edilir. Main arada ilerlerse eski şemadaki başarılı SQL geri alınmaz, fakat latest main hazır ilan edilmez; yeni SHA'nın başarılı CI'si beklenir. İptal etmeyen concurrency ve primary canonical DB'deki ayrı session promotion kilidi iki-hedef akışını korur; kilit bağlantısı koparsa çalışan migration alt süreci durdurulur. Mevcut migration/doctor kilitleri ayrıca kalır.

Merged SQL yalnız configured **canonical development** hedeflerine uygulanır. İki history/deep kontrolü geçmeden başarı ilan edilmez; ardından fingerprint tabanları oluşturulup bağımsız kopyalarda doğrulanır. Workspace test verisi, DB restore veya child DB “merge” edilmez. Production dağıtımı ayrı explicit deploy sınırıdır.

İki projede tek atomik transaction yoktur. İlk migration uygulanıp ikinci başarısızsa SQL geri alınmış sayılmaz. Logları/canonical readiness'i incele; düzeltilmiş, başarıyla doğrulanmış main koşusu idempotent devam eder. Eski kırmızı koşuyu kör rerun etme; SHA'nın latest main olduğu kontrol edilir. Failure/approval bekleniyorsa canonical DB güncel deme.

Rebase/merge migration sırası çatıştırabilir. Kanonik DB'ye uygulanmamış aday yalnız disposable workspace yeniden kurulacaksa güncel zincirde yeniden üretilebilir. Aktif DB ledger'ını değiştirme, aktif dalı otomatik resetleme. Uygulanmış canonical geçmiş ve owning code birlikte entegre edilir. Gerçek ürün bağımlılıkları ayrıca çözülür.

## Archive ve kurtarma

DB kaydı yoksa veya zaten archived ise `bun run db:workspace:archive` kaynak silmeden döner; identity, management key veya merged PR istemez. Aktif DB kaydı varsa temiz Git ağacı, current HEAD'i taşıyan merged PR ve güncel origin/main için canonical readiness ister. Squash merge PR `headRefOid` ile doğrulanır. Conductor Archive aynı komutu kullanır; doğrulama yoksa kaynaklar korunur. Bilinçli terk etmede **açık** `bun run db:workspace:archive --discard` merge/readiness beklemez; yalnız owned workspace test verisini geri döndürülemez siler.

Her iki kayıt silmeden önce server metadata ile doğrulanır. Yanlış project/branch/parent/name/nonce/endpoint veya default/primary/protected dalda dur. Production/canonical/taban dalları archive olamaz. Kısmi silmede state tutulur; 404 ilk dal yeniden yaratılmaz, ikinci silme devam eder. Başarılı archive bağlantıları state'ten kaldırır. Eski tabanlar tutulur; toplu silme/TTL yoktur, maliyeti izle.

`.context/neon-workspace.lock` setup/archive yarışını engeller. Öldürülmüş process'in stale lock'unu yalnız PID'nin bitişini ve uzaktaki operation sonucunu kontrol ettikten sonra kaldır. POST timeout'ta aynı nonce/server kimliğini uzlaştır; yeni state üretme. Malformed/copied state'i secret göstermeden incele; silerek shared URL'ye dönme.

Management API `default` ve `protected` alanlarını zorunlu doğrular; deprecated `primary` alanı gelirse ayrıca kontrol edilir. Schema-only kanonik hedef bağımsız köktür (`parent_id` yoktur), production child'ı gibi doğrulanmaz. Bekleyen branch/operation güvenli timeout ile beklenir; hata veya eksik metadata'da yeni kaynakla kaçış yapılmaz. Setup/Archive uzaktaki sahipliği doğrular; normal uygulama süreci private kayda ve SQL readiness lease'ine dayanır, her istekte management API sorgulamaz. Yetkili dış yöneticinin endpoint reassignment/DDL işlemleri için sürekli platform güvenlik garantisi vermez.

Schema-only **create isteğinde** `parent_id`, Neon API'nin istediği açık **şema kaynak** ID'sidir; sonuç dalının parent ilişkisi değildir. Sonuç metadata'sında `parent_id` bulunmamalıdır. Bootstrap receipt'indeki `parentId` de yalnız bu kaynak provenance'ıdır; workspace receipt'indeki `parentId` ise gerçek fingerprint tabanını belirtir. Bu iki kullanımın eşit olduğu varsayılmaz. HTTP fixture bu istek/sonuç farkını doğrular; kaynak [schema-only rehberindeki API örneğidir](https://neon.com/docs/guides/branching-schema-only).

### Bağımsız kök sınırında bootstrap kurtarma

Neon bağımsız kök sınırına ulaşıldığında bootstrap yeni kaynak oluşturmaya devam etmez. Kullanılmayan mevcut bir schema-only kökü sahiplenmek yalnız elle yapılan, kayıtlı bir kurtarma işlemidir. Önce default/production/protected olmadığını, child dalının bulunmadığını ve aktif workspace/config referansı taşımadığını doğrula; mevcut DB verisini ve bağlantılarını salt okunur incele. Eski mantıksal DB'yi koru. Yeni `cantiara_development` DB adının production ve kurtarma hedefinde bulunmadığını doğrula; dalı aynı bootstrap nonce'iyle adlandırıp ID/endpoint/şema kaynak provenance'ını private receipt'e kaydet. Otomatik bootstrap bu receipt üzerinden devam eder. Boş hedeflerde baseline yalnız güncel kanonik Git zincirine bağlanabilir; uygulanmış history yeniden yazılamaz. Dal silme, reset veya paylaşılan URL'ye geçiş bu kurtarmanın parçası değildir.

## Doğrulama

Testing Decisions teknoloji yığınındadır. Otomatik DB suite yalnız açık yerel `cantiara_migration_test*` fixture'larına yazar. Canlı kabul ayrıca iki workspace setup, yalnız birinde migration, diğerinin değişmeyen doctor sonucu, merged SQL'in successful CI ile canonical DB'ye gelmesi ve owned archive'ı içerir. Gerçekten koşmadan bu kabulü tamamlandı yazma.
