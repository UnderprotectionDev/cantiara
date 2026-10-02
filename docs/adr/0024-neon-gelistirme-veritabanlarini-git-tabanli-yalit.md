# Neon geliştirme veritabanlarını Git tabanlı yalıt

## Bağlam

Paralel Conductor workspace'leri ortak DB'ye henüz merge edilmemiş migration uyguladığında başka dalın geçerli `ahead` denetimi gelişimi durdurur. Doctor veya hash kontrolünü gevşetmek yanlış şemada çalışmayı gizler. Güncel herhangi bir DB'yi kopyalamak aynı hatayı yeni dala taşır; production verisini kopyalamak ayrıca veri erişimi riski oluşturur.

## Karar

Geliştirme DB sahipliği issue numarasına değil Conductor workspace kimliğine bağlıdır. Workspace açılışı yalnız bağımlılık kurar; issue attachment'ı DB ihtiyacını belirlemez. Workspace DB bağlantısı gerektiğinde açık `bun run db:workspace:setup` ile iki izole dal etkinleştirilir; DB gerektirmeyen işler Neon kaynağı oluşturmaz. Run kaynak oluşturmaz veya migration uygulamaz; DB'siz Archive kaynak silmeden döner. Bu ihtiyaç-temelli aktivasyon mevcut owned dalları, kimlik doğrulamasını ve merge/readiness koşullu silme sınırını değiştirmez. [ADR-0019](0019-guvenlik-olay-gunlugunu-ve-ust-anahtari-ayri-guven-alaninda-tut.md) gereği birincil ve güvenlik olayları ayrı projelerde kalır. İlk kanonik kurulum production'a yazmadan schema-only köklerde yeni boş mantıksal DB'ler oluşturur ve Git migration zincirini uygular; miras alınmış tablolara sahte başarı kayıtları eklenmez.

Workspace kimliği script ve agent ortamlarında aynı doğrulanmış Git worktree konumundan çözülür; yalnız agent oturumunda bulunabilen native `CONDUCTOR_WORKSPACE_ID` zorunlu lifecycle girdisi değildir. Private kaydın konum bağı başka workspace'e kopyalanamaz. Eski native-ID kaydı yalnız orijinal kimlik doğrulanınca konuma bağlanır; mevcut Neon dal kimliği, adı ve nonce'i korunur. Display name veya Git dal adından kimlik üretilmez. Worktree'nin başka konuma taşınması otomatik sahiplik devri değildir ve kontrollü kurtarma gerektirir; bu ödünleşme kopyalanmış state'in sessizce kabul edilmesini önler. İşletim ve test karşılığı aynı teknoloji yığını ve workspace rehberindedir.

Başarılı main CI yalnız kanonik **geliştirme** DB'lerini günceller. SQL/journal/snapshot içeriğinin SHA-256'sıyla adlandırılan doğrulanmış tabanlar korunur. Workspace, Git merge-base'inin tabanından iki dal alır. Tabanlar normal uygulama veya migration hedefi olmaz; platformdaki `protected` bayrağının SQL yazısını engellediği varsayılmaz. Doctor, sıra/hash ve oturum kilitleri korunur.

Neon dalı Git gibi merge edilmez: workspace test verisi veya DB restore'u ana hedefe taşınmaz. Archive ancak PR merge ve canonical readiness doğrulanınca owned workspace dallarını siler; bilinçli terk etme ayrı `--discard` seçeneğidir. Otomatik reset, eski taban temizliği veya expiration yoktur.

Konum bağı worktree Git dizininin fiziksel yaşamını da içerir; aynı ad ve yolda yeniden açılan workspace eski DB state'ini kendiliğinden sahiplenmez. Dosya sistemi veya Git yönetim dizini yeniden yaratılırsa otomatik devam yerine kontrollü kurtarma gerekir.

## Sonuçlar

- Workspace DDL'si diğer workspace'in migration geçmişini değiştirmez; gerçek kod bağımlılıkları ve migration sırası çatışmaları Git'te çözülür.
- İki projedeki promotion tek atomik transaction değildir. Kısmi başarıda hazır ortam ilan edilmez; kanonik komutla kontrollü tekrar gerekir.
- Eski tabanlar geçmiş workspace'leri korur; branch/compute/storage maliyeti ve yönetim anahtarı işletimi artar.
- Eksik anahtar veya yayınlanmamış taban açık aktivasyon engelidir; shared URL'ye dönerek gizlenmez. Production dağıtımı ayrıdır.
- Yaşam döngüsü, aktivasyon ve Testing Decisions sahibi [teknoloji yığını](../tech-stack.md) ile [işletim rehberidir](../agents/workspace-databases.md).
