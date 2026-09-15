# Tekil Wiki Yayını

Kurucu tek bir Wiki Belgesini seçili gömülü içerikle bağımsız ve herkese açık snapshot olarak yayımlar. Proje yayınına veya canlı Wiki kopyasına dönüşmez. Yayın yalnız kullanıcının gözden geçirip onayladığı kapalı dünya snapshotını gösterir.

Tek sayfa kamuoyuna çıkabilir. Gömüler onaylı kümeye dahildir; Kişisel Wiki'nin geri kalanı sızmaz. Önizlenen küme ile onaylı revizyon aynıdır. İptal, redaksiyon ve asset erişimi cache sonucundan önce fail-closed doğrulanır; bu erişim kuralı ayrı teslim kartı değildir. Çözülmemiş yer tutucular önizlemede listelenir; kural ayrı faz değildir.

Bu feature tekil wiki yayınını tamamlar. Build in Public ve bağlantı paylaşımı ayrı yüzeylerdir.

## Alt Fazlar

### Kapalı dünya önizlemesi

Kapalı dünya önizlemesi dışarı çıkacak kesin kayıt, sürüm, alan, gömü ve dosyaları kullanıcıya gösterir. Görünmeyen ilişki sızmaz. Seçilmemiş gömüler örtük açılmaz.

Kurucu onaylamadan yüzey oluşmaz. Önizleme ziyaretçi oturumu değildir. Secret, paylaşım token'ı ve bağlantı parolası kapsama girmez.

Çözülmemiş yer tutucu yalnız `{{alan_adı}}` söz dizimidir. Kod bloğu ve satır içi kod içindeki eşleşmeler uyarı üretmez. Kurucu içeriğe dönüp yer tutucuyu çözebilir veya ayrı `Yine de yayımla/paylaş` onayıyla işlemi sürdürebilir. Ürün normal cümlelerden eksiklik tahmin etmez, AI kullanmaz ve yer tutucuyu kendiliğinden doldurmaz.

### Onaylı snapshot revizyonu

Onaylı snapshot revizyonu değişmez içerik manifestidir. Dış yüzey yalnız bu revizyonu gösterir. Yayın Proje yayınına veya canlı Wiki kopyasına dönüşmez.

Kurucu yeni revizyon onaylamadan canlı kayıtlar dışarı akmaz. Eski revizyon tarihsel kalır. Her HTML ve asset isteği güncel yüzey durumuna göre kabul veya reddedilir; iptal ve redaksiyon cache'den önce gelir.

Revizyon Git tag veya Dosya Eki sürümü değildir. Dış yüzey sözleşmesidir.

## Tamamlanma Ölçütleri

- Tek Wiki Belgesi seçili gömülü içerikle bağımsız herkese açık snapshot olarak yayımlanır.
- Dışarı çıkacak kesin kayıt, sürüm, alan ve dosyalar kullanıcıya gösterilir.
- Secret, paylaşım token'ı ve bağlantı parolası yayın kapsamına girmez.
- Çözülmemiş yer tutucular önizlemede listelenir; kurucu çözer veya ayrı onay verir.

## Kapsam Sınırları

- Tekil yayını Proje Build in Public sayma.
- Canlı Wiki'yi public kopya gibi eşleme.
- Anlık erişim kapısını veya yer tutucu kontrolünü ayrı teslim kartı sayma.
- Cache veya CDN'in iptali ezmesine izin verme.
