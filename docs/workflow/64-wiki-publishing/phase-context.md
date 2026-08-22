# Tekil Wiki Yayını

Kurucu tek bir Wiki Belgesini seçili gömülü içerikle bağımsız ve herkese açık snapshot olarak yayımlar. Proje yayınına veya canlı Wiki kopyasına dönüşmez. Yayın yalnız kullanıcının gözden geçirip onayladığı kapalı dünya snapshotını gösterir.

Tek sayfa kamuoyuna çıkabilir. Gömüler onaylı kümeye dahildir; Kişisel Wiki'nin geri kalanı sızmaz. Önizlenen küme ile onaylı revizyon aynıdır; iptal, redaksiyon ve asset erişimi cache sonucundan önce fail-closed doğrulanır. Çözülmemiş `{{alan_adı}}` yer tutucuları yayın önizlemesinde kaynak kayıt, alan ve metin bağlamıyla listelenir.

Bu feature tekil wiki yayınını tamamlar. Build in Public ve bağlantı paylaşımı ayrı yüzeylerdir.

## Alt Fazlar

### Kapalı dünya önizlemesi

Kapalı dünya önizlemesi dışarı çıkacak kesin kayıt, sürüm, alan, gömü ve dosyaları kullanıcıya gösterir. Görünmeyen ilişki sızmaz. Seçilmemiş gömüler örtük açılmaz.

Kurucu onaylamadan yüzey oluşmaz. Önizleme ziyaretçi oturumu değildir. Secret, paylaşım token'ı ve bağlantı parolası kapsama girmez.

Çözülmemiş yer tutucu yalnız `{{alan_adı}}` söz dizimidir. Kod bloğu ve satır içi kod içindeki eşleşmeler uyarı üretmez. Kurucu içeriğe dönüp yer tutucuyu çözebilir veya ayrı `Yine de yayımla/paylaş` onayıyla işlemi sürdürebilir. Ürün normal cümlelerden eksiklik tahmin etmez, AI kullanmaz ve yer tutucuyu kendiliğinden doldurmaz.

### Onaylı snapshot revizyonu

Onaylı snapshot revizyonu değişmez içerik manifestidir. Dış yüzey yalnız bu revizyonu gösterir. Yayın Proje yayınına veya canlı Wiki kopyasına dönüşmez.

Kurucu yeni revizyon onaylamadan canlı kayıtlar dışarı akmaz. Eski revizyon tarihsel kalır.

Revizyon Git tag veya Dosya Eki sürümü değildir. Dış yüzey sözleşmesidir.

### Anlık dış erişim kapısı

Anlık dış erişim kapısı her HTML ve asset isteğini güncel yüzey durumuna göre kabul veya reddeder. İptal ve redaksiyon cache'den önce gelir.

Ziyaretçi eski bağlantıyla kapanmış içeriği görmez. Varlık sızdıran 404 davranışı kontrollüdür. Onaylı YouTube kartı tıklanınca yüklenir; sayfa açılışı üçüncü tarafa istek göndermez.

Kapı analitik, rate limit ürünü veya WAF panosu değildir. Fail-closed erişimdir.

## Tamamlanma Ölçütleri

- Tek Wiki Belgesi seçili gömülü içerikle bağımsız herkese açık snapshot olarak yayımlanır.
- Yayın Proje yayınına veya canlı Wiki kopyasına dönüşmez.
- Dışarı çıkacak kesin kayıt, sürüm, alan ve dosyalar kullanıcıya gösterilir.
- Secret, paylaşım token'ı ve bağlantı parolası yayın kapsamına girmez.
- Dış yüzey yalnız değişmez ve onaylı içerik manifestini gösterir.
- Çözülmemiş `{{alan_adı}}` yer tutucuları önizlemede listelenir; kurucu çözer veya ayrı `Yine de yayımla/paylaş` onayı verir.
- Her HTML ve asset isteği güncel yüzey durumuna göre güvenle kabul veya reddedilir.

## Kapsam Sınırları

- Tekil yayını Proje Build in Public sayma.
- Canlı Wiki'yi public kopya gibi eşleme.
- Seçilmemiş gömüleri örtük açma.
- Canlı kayıtları onaylı snapshot olmadan dışarı açma.
- Cache veya CDN'in iptali ezmesine izin verme.
- Redaksiyonu istemci gizleme sayma.
- Yer tutucu kontrolünü genel zorunlu alan veya AI doldurma sayma.
