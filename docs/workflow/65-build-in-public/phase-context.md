# Build in Public

Kurucu Projenin seçili Roadmap, sürüm iletişimi ve gelişim bağlamını onaylı snapshot revizyonlarıyla herkese açık yayımlar. İç durumlar ve özel ilişkiler örtük açılmaz. Yayın yalnız kullanıcının gözden geçirip onayladığı kapalı dünya snapshotını gösterir.

Kamuoyu onaylı anlatıyı görür. Public durum eşlemesi iç Kanban'ı sızdırmaz; gelişim akışı özel bağlam açmaz. Önizlenen küme ile onaylı revizyon aynıdır; iptal, redaksiyon ve asset erişimi cache sonucundan önce fail-closed doğrulanır. Çözülmemiş `{{alan_adı}}` yer tutucuları yayın önizlemesinde kaynak kayıt, alan ve metin bağlamıyla listelenir.

Bu feature build in public'i tamamlar. Wiki yayını, sürüm notu yazımı ve dış yüzey yönetimi ayrıdır.

## Alt Fazlar

### Yayın önizlemesi

Yayın önizlemesi seçili alanları, public durum eşlemelerini ve metadata'yı kesin farkla onaylatır. İç durum adları dışarı sızmaz. Kapalı dünya kümesi nettir: kayıt, sürüm, alan ve dosyalar kullanıcıya gösterilir.

Kurucu eşlemeyi görür. Onaysız alan public olmaz. Secret, paylaşım token'ı ve bağlantı parolası kapsama girmez.

Çözülmemiş yer tutucu yalnız `{{alan_adı}}` söz dizimidir. Kod bloğu ve satır içi kod içindeki eşleşmeler uyarı üretmez. Kurucu içeriğe dönüp yer tutucuyu çözebilir veya ayrı `Yine de yayımla/paylaş` onayıyla işlemi sürdürebilir. Ürün normal cümlelerden eksiklik tahmin etmez, AI kullanmaz ve yer tutucuyu kendiliğinden doldurmaz. Bu kontrol genel zorunlu alan kapısı değildir.

Önizleme ziyaretçi sitesi değildir. Kurucunun onay yüzeyidir.

### Proje snapshotı

Proje snapshot'ı Roadmap, değişiklik günlüğü ve Proje görünümünü aynı onaylı revizyondan sunar. Üçü farklı revizyona kaymaz. Dış yüzey yalnız değişmez içerik manifestini gösterir.

Kurucu hangi revizyonun canlı public olduğunu bilir. Yeni onay eski revizyonu tarihsel bırakır. Yeni revizyon onaylanmadan canlı kayıtlar dışarı akmaz.

Snapshot tekil Wiki sayfası veya bearer bağlantısı değildir. Herkese açık Proje yüzeyidir.

### Gelişim akışı

Gelişim akışı yalnız onaylı tarihsel öğeleri kaynak özel bağlamı açmadan yayımlar. İç yorum, özel ilişki ve taslak yok.

Kurucu hangi olayın public olduğunu seçer. Feed otomatik bütün etkinliği dökmez.

Akış Geri Bildirim feed'i veya Bildirim Merkezi değildir. Kamu anlatısıdır.

### Anlık dış erişim kapısı

Anlık dış erişim kapısı her HTML ve asset isteğini güncel yüzey durumuna göre kabul veya reddeder. İptal ve redaksiyon cache'den önce gelir.

Ziyaretçi eski bağlantıyla kapanmış içeriği görmez. Cache veya CDN iptali ezmez. Onaylı YouTube kartı tıklanınca yüklenir; sayfa açılışı üçüncü tarafa istek göndermez.

Kapı analitik ürünü değildir. Fail-closed erişimdir.

## Tamamlanma Ölçütleri

- Seçili alanlar, public durum eşlemeleri ve metadata kesin farkla onaylanır.
- Roadmap, değişiklik günlüğü ve Proje görünümü aynı onaylı revizyondan sunulur.
- Yalnız onaylı tarihsel öğeler kaynak özel bağlamı açmadan yayımlanır.
- Dışarı çıkacak kesin kayıt, sürüm, alan ve dosyalar kullanıcıya gösterilir.
- Secret, paylaşım token'ı ve bağlantı parolası yayın kapsamına girmez.
- Çözülmemiş `{{alan_adı}}` yer tutucuları önizlemede listelenir; kurucu çözer veya ayrı `Yine de yayımla/paylaş` onayı verir.
- Her HTML ve asset isteği güncel yüzey durumuna göre güvenle kabul veya reddedilir.

## Kapsam Sınırları

- İç durumları ve özel ilişkileri örtük açma.
- Canlı Roadmap'i public kopya sayma.
- Gelişim akışını sosyal ağ veya analitik ürün yapmak.
- Canlı kayıtları onaylı snapshot olmadan dışarı açma.
- Cache veya CDN'in iptali ezmesine izin verme.
- Redaksiyonu istemci gizleme sayma.
- Yer tutucu kontrolünü genel zorunlu alan veya AI doldurma sayma.
