# Bağlantıyla Sınırlı Paylaşım

Kurucu seçili kaydı salt okunur bearer bağlantısı, isteğe bağlı parola ve süre sınırıyla paylaşır. Yeniden etkinleştirme ve terminal iptal birbirinden ayrılır. Paylaşım yalnız kullanıcının gözden geçirip onayladığı kapalı dünya snapshotını gösterir.

Bağlantı Hesap vermez. Ziyaretçi içeriğin varlığını sızdırmayan kapılardan geçer; süre dolumu ile iptal karışmaz. Önizlenen küme ile onaylı revizyon aynıdır; eski cache iptali aşamaz. Çözülmemiş `{{alan_adı}}` yer tutucuları paylaşım önizlemesinde kaynak kayıt, alan ve metin bağlamıyla listelenir.

Bu yolculuk bağlantıyla sınırlı paylaşımı tamamlar. Wiki yayını ve build in public ayrı yüzeylerdir.

## Alt Fazlar

### Paylaşım önizlemesi

Paylaşım önizlemesi kesin içerik ve desteklenen canlı alanları bağlantı oluşmadan önce onaylatır. Kapalı dünya kümesi nettir: kayıt, sürüm, alan ve dosyalar kullanıcıya gösterilir. Görünmeyen ilişki sızmaz.

Kurucu neyin gideceğini görür. Onaysız bağlantı üretilmez. Onaylı snapshot revizyonu değişmez içerik manifestidir; dış yüzey yalnız bu revizyonu gösterir. Secret, paylaşım token'ı ve bağlantı parolası kapsama girmez. Sınıflandırma kapalı alan ve kayıt türündendir; serbest metinde secret tarama iddia edilmez.

Çözülmemiş yer tutucu yalnız `{{alan_adı}}` söz dizimidir. Kod bloğu ve satır içi kod içindeki eşleşmeler uyarı üretmez. Kurucu içeriğe dönüp yer tutucuyu çözebilir veya ayrı `Yine de yayımla/paylaş` onayıyla işlemi sürdürebilir. Ürün normal cümlelerden eksiklik tahmin etmez, AI kullanmaz ve yer tutucuyu kendiliğinden doldurmaz. Bu kontrol genel zorunlu alan veya belge tamamlama puanı değildir.

Bu alt faz herkese açık Wiki veya Proje snapshot'ı değildir. Sınırlı bearer paylaşımıdır.

### Ziyaretçi erişimi

Ziyaretçi erişimi bearer, parola, süre ve hız sınırını içerik varlığını sızdırmadan uygular. Yanlış parola kayıt varmış gibi konuşmaz.

Oturum kurucu oturumu değildir. Yazma, palet ve arama kapalıdır.

YouTube kartı tıklanınca yüklenir. Oynatıcı sayfa açılışında üçüncü tarafa istek göndermez; ziyaretçi uyarısını görür. Kart kaydı herkese açık yapmaz.

Her HTML ve asset isteği güncel yüzey durumuna göre kabul veya reddedilir. İptal ve redaksiyon cache'den önce gelir. Ziyaretçi eski bağlantıyla kapanmış içeriği görmez.

Hız sınırı destek S1 veya işletim sinyali değildir. Dış yüzey korumasıdır.

### Paylaşım yaşam döngüsü

Süre dolumu, yeniden etkinleştirme ve terminal iptal ayrı sonuçlardır. Dolmuş bağlantı sessizce sonsuz yaşamaz.

Kurucu iptalin geri dönülmez olduğunu görür. Yeniden etkinleştirme yeni onaylı revizyon gerektirebilir. Yeni revizyon onaylanmadan canlı kayıtlar dışarı akmaz; eski revizyon tarihsel kalır.

Yaşam döngüsü hesap kapatma penceresi değildir. Yalnız o Dış yüzeyindir. Cache veya CDN iptali ezmez.

## Tamamlanma Ölçütleri

- Kesin içerik ve desteklenen canlı alanlar bağlantı oluşturulmadan önce onaylanır.
- Dışarı çıkacak kesin kayıt, sürüm, alan ve dosyalar kullanıcıya gösterilir.
- Secret, paylaşım token'ı ve bağlantı parolası paylaşım kapsamına girmez.
- Dış yüzey yalnız değişmez ve onaylı içerik manifestini gösterir.
- Çözülmemiş `{{alan_adı}}` yer tutucuları önizlemede listelenir; kurucu çözer veya ayrı `Yine de yayımla/paylaş` onayı verir.
- Bearer, parola, süre ve hız sınırı içerik varlığını sızdırmadan uygulanır.
- Her HTML ve asset isteği güncel yüzey durumuna göre güvenle kabul veya reddedilir.
- Süre dolumu, yeniden etkinleştirme ve terminal iptal güvenli biçimde ayrılır.

## Kapsam Sınırları

- Bağlantıyı Hesap daveti veya yazma yetkisi sayma.
- Süre dolumunu terminal iptal sayma.
- Ziyaretçiye kurucu paleti veya arama açma.
- Canlı kayıtları onaylı snapshot olmadan dışarı açma.
- Cache veya CDN'in iptali ezmesine izin verme.
- Redaksiyonu istemci gizleme sayma.
- Yer tutucu kontrolünü genel zorunlu alan veya AI doldurma sayma.
- Secret'ı serbest metin taramasıyla bulduğunu iddia etme.
