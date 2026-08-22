# Build in Public

Kurucu Projenin seçili Roadmap, sürüm iletişimi ve gelişim bağlamını onaylı snapshot revizyonlarıyla herkese açık yayımlar. İç durumlar ve özel ilişkiler örtük açılmaz. Yayın yalnız kullanıcının gözden geçirip onayladığı kapalı dünya snapshotını gösterir.

Kamuoyu onaylı anlatıyı görür. Public durum eşlemesi iç Kanban'ı sızdırmaz. İptal, redaksiyon ve asset erişimi cache sonucundan önce fail-closed doğrulanır; bu erişim kuralı ayrı teslim kartı değildir. Çözülmemiş yer tutucular önizlemede listelenir; kural ayrı faz değildir.

Bu feature build in public'i tamamlar. Wiki yayını, sürüm notu yazımı ve dış yüzey yönetimi ayrıdır.

## Alt Fazlar

### Yayın önizlemesi

Yayın önizlemesi seçili alanları, public durum eşlemelerini ve metadata'yı kesin farkla onaylatır. İç durum adları dışarı sızmaz. Kapalı dünya kümesi nettir.

Kurucu eşlemeyi görür. Onaysız alan public olmaz. Secret, paylaşım token'ı ve bağlantı parolası kapsama girmez.

Çözülmemiş yer tutucu yalnız `{{alan_adı}}` söz dizimidir. Kod bloğu ve satır içi kod içindeki eşleşmeler uyarı üretmez. Kurucu içeriğe dönüp yer tutucuyu çözebilir veya ayrı `Yine de yayımla/paylaş` onayıyla işlemi sürdürebilir. Ürün yer tutucuyu kendiliğinden doldurmaz. Bu kontrol genel zorunlu alan kapısı değildir.

### Proje snapshotı

Proje snapshot'ı Roadmap, değişiklik günlüğü ve Proje görünümünü aynı onaylı revizyondan sunar. Üçü farklı revizyona kaymaz.

Kurucu hangi revizyonun canlı public olduğunu bilir. Yeni onay eski revizyonu tarihsel bırakır. Her HTML ve asset isteği güncel yüzey durumuna göre kabul veya reddedilir; iptal ve redaksiyon cache'den önce gelir.

Snapshot tekil Wiki sayfası veya bearer bağlantısı değildir. Herkese açık Proje yüzeyidir.

### Gelişim akışı

Gelişim akışı yalnız onaylı tarihsel öğeleri kaynak özel bağlamı açmadan yayımlar. İç yorum, özel ilişki ve taslak yok.

Kurucu hangi olayın public olduğunu seçer. Feed otomatik bütün etkinliği dökmez.

Akış Geri Bildirim feed'i veya Bildirim Merkezi değildir. Kamu anlatısıdır.

## Tamamlanma Ölçütleri

- Seçili alanlar, public durum eşlemeleri ve metadata kesin farkla onaylanır.
- Roadmap, değişiklik günlüğü ve Proje görünümü aynı onaylı revizyondan sunar.
- Yalnız onaylı tarihsel öğeler kaynak özel bağlamı açmadan yayımlanır.
- Çözülmemiş yer tutucular önizlemede listelenir; kurucu çözer veya ayrı onay verir.

## Kapsam Sınırları

- İç durumları ve özel ilişkileri örtük açma.
- Canlı Roadmap'i public kopya sayma.
- Anlık erişim kapısını veya yer tutucu kontrolünü ayrı teslim kartı sayma.
- Cache veya CDN'in iptali ezmesine izin verme.
