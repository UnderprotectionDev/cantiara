# Bağlantıyla Sınırlı Paylaşım

Kurucu seçili kaydı salt okunur bearer bağlantısı, isteğe bağlı parola ve süre sınırıyla paylaşır. Yeniden etkinleştirme ve terminal iptal birbirinden ayrılır.

Bağlantı Hesap vermez. Ziyaretçi içeriğin varlığını sızdırmayan kapılardan geçer; süre dolumu ile iptal karışmaz.

Bu feature bağlantıyla sınırlı paylaşımı tamamlar. Wiki yayını, build in public ve dış erişim kapısı ortak güvenliği kullanır ama yaşam ayrıdır.

## Alt Fazlar

### Paylaşım önizlemesi

Paylaşım önizlemesi kesin içerik ve desteklenen canlı alanları bağlantı oluşmadan önce onaylatır. Kapalı dünya kümesi nettir.

Kurucu neyin gideceğini görür. Onaysız bağlantı üretilmez.

Bu alt faz herkese açık Wiki veya Proje snapshot'ı değildir. Sınırlı bearer paylaşımıdır.

### Ziyaretçi erişimi

Ziyaretçi erişimi bearer, parola, süre ve hız sınırını içerik varlığını sızdırmadan uygular. Yanlış parola kayıt varmış gibi konuşmaz.

Oturum kurucu oturumu değildir. Yazma, palet ve arama kapalıdır.

Hız sınırı destek S1 veya işletim sinyali değildir. Dış yüzey korumasıdır.

### Paylaşım yaşam döngüsü

Süre dolumu, yeniden etkinleştirme ve terminal iptal ayrı sonuçlardır. Dolmuş bağlantı sessizce sonsuz yaşamaz.

Kurucu iptalin geri dönülmez olduğunu görür. Yeniden etkinleştirme yeni onaylı revizyon gerektirebilir.

Yaşam döngüsü hesap kapatma penceresi değildir. Yalnız o Dış yüzeyindir.

## Tamamlanma Ölçütleri

- Kesin içerik ve desteklenen canlı alanlar bağlantı oluşturulmadan önce onaylanır.
- Bearer, parola, süre ve hız sınırı içerik varlığını sızdırmadan uygulanır.
- Süre dolumu, yeniden etkinleştirme ve terminal iptal güvenli biçimde ayrılır.

## Kapsam Sınırları

- Bağlantıyı Hesap daveti veya yazma yetkisi sayma.
- Süre dolumunu terminal iptal sayma.
- Ziyaretçiye kurucu paleti veya arama açma.
