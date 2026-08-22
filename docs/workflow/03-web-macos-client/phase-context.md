# Çevrimiçi Web ve macOS İstemcisi

Kurucu aynı ürünü online-only web uygulamasında ve imzalı macOS paketinde kullanır. Bağlantı kesilince yazma kuyruğa alınmaz; masaüstü ikinci bir yerel doğruluk kaynağı açmaz.

İstemci, Hesap oturumunun durduğu kabuktur. Updater yalnız doğrulanmış imzalı çıktıyı uygular. Kullanıcı hatada secret içermeyen destek referansı görür.

Bu feature çevrimiçi web ve macOS istemcisini tamamlar. Operasyonel yedek, Avrupa veri bölgesi kuralı ve Hesap girişi ayrıdır.

## Alt Fazlar

### Online-only çalışma

Belge okuma, kayıt oluşturma ve planlama değişikliği aktif internet bağlantısı ister. Bağlantı kesildiğinde kurucu son başarılı kayıt zamanını ve yazılmamış değişiklik riskini görür.

Yeniden bağlanma bekleyen yazmayı gizlice tamamlamaz. Yerel çalışma kuyruğu, offline cache veya otomatik eşitleme oluşmaz.

Bu alt faz çevrimdışı ürün, senkron çatışması veya cihaz-yerel veritabanı kurmaz.

### macOS paket ve imza

macOS paketi platform sertifikasıyla imzalanır ve notarization'dan geçer. Web ile aynı backend ve ürün sözleşmesini kullanır.

Kurucu kabul tarihindeki güncel macOS ana sürümü ile önceki iki ana sürümde temiz kurulur. Windows paketi veya self-host kurulumu oluşmaz.

Paket, Tauri backend'ini Rust veri katmanına taşımaz. İkinci doğruluk kaynağı yoktur.

### Tauri Updater

Tauri Updater yalnız imzası doğrulanan çıktıyı uygular. Değiştirilmiş veya geçersiz imzalı paketi reddeder ve önceki çalışan sürümü bozmaz.

Otomatik rollback yoktur. Bir önceki imzalı installer indirilebilir tutulur ve belgelenmiş manuel kurtarma ile kurulabilir.

Backend güncel ve bir önceki imzalı masaüstü API sözleşmesini 30 gün destekler. Süre dışındaki istemci güvenli olmayan yazmadan önce açık güncelleme hatasıyla durur.

### Destek referansı

Başarısız ana akışta kullanıcı anlaşılır hata nedenini, güvenli yeniden deneme sınırını ve verinin yazılıp yazılmadığını görür. Destek referansı secret veya özel içerik taşımaz.

Bu alt faz pager, müşteri destek kuyruğu veya hizmet S1 alarmı değildir. Kullanıcıya görünen hata sözleşmesidir.

## Tamamlanma Ölçütleri

- Bağlantı kesildiğinde offline kuyruk oluşmaz; son başarılı kayıt zamanı ve yazılmamış risk görünür.
- İmzalı ve noterli macOS paketi desteklenen ana sürümlerde kurulur; web ile aynı backend'i kullanır.
- Updater geçersiz imzayı reddeder; önceki çalışan sürümü bozmaz.
- Kullanıcı hatada secret içermeyen destek referansı görür.

## Kapsam Sınırları

- İstemciyi yerel-first veya offline-first ürüne dönüştürme.
- Windows Tauri, self-host veya ikinci yerel veritabanı.
- Operasyonel yedeği veya Avrupa bölgesini bu kartın işi sayma.
- Alarmı pager veya 7/24 nöbet yapmak.
