# Bitiriş efektlerini özgün birinci taraf katalogla sınırla

Bitiriş efektleri yalnız ürünün oluşturduğu özgün ve sessiz görsel tema kataloğundan seçilir. Ürün, lisanslı karakter veya kurgu evreni içeriği sunmaz ve kullanıcının görsel, animasyon ya da ses yükleyebileceği bir efekt yolu açmaz. Böylece tanınmış fikrî mülkiyetin hazır duygusal gücünden ve sınırsız kullanıcı kişiselleştirmesinden vazgeçilir; karşılığında dağıtımın lisans kapsamına bağımlı olması ile kullanıcı içeriğinin hak beyanı, dosya güvenliği, depolama, kaldırma ve dışa aktarma yükümlülükleri ürün mimarisine girmez. Bu sınırı değiştirmek mevcut katalog genişlemesi değil, bu ADR'nin açıkça yerine geçirilmesini gerektiren yeni bir ürün ve güven modeli kararıdır.

Efektin erişilebilirlik, performans ve doğru başarı geri bildirimi bağlayıcı release koşuludur. Algılanan tatmin ve tekrar yorgunluğu ise kesin build, katılımcı bağlamı, sorular, gözlemler ve takip kararını taşıyan kaynak bağlantılı Decision kaydıyla izlenen nitel araştırma sinyalidir; release'i otomatik geçirmez veya durdurmaz ve özelliği otomatik kaldırmaz.

## Considered Options

- **Özgün birinci taraf katalog — seçildi:** Ürün görsel dilini, erişilebilirlik ve performans bütçesini uçtan uca denetler.
- **Lisanslı içerik — reddedildi:** Açık hak ve dağıtım sözleşmesine rağmen ürünü üçüncü taraf marka, bölge, süre ve platform koşullarına bağlar.
- **Kullanıcı tarafından sağlanan içerik — reddedildi:** Kişiselleştirmeyi büyütür fakat kalıcı asset kabulü, güvenlik, hak, saklama, kaldırma ve taşınabilirlik sistemi gerektirir.

## Karar dayanağı

Mevcut macOS dağıtımı [GitHub Releases](../tech-stack.md) üzerinden yapıldığı için Apple App Review bugün ürünün yayın kapısı değildir. İleride App Store dağıtımı ayrıca seçilirse Apple'ın güncel [App Review Guidelines 5.2](https://developer.apple.com/app-store/review/guidelines/#intellectual-property) bölümü uygulamanın yalnız geliştiricinin oluşturduğu veya kullanma lisansına sahip olduğu içeriği kapsamasını ister. ABD Copyright Office ise genel fikirlerin korunmadığını, fakat önceden var olan bir eserin yeniden biçimlendirilmiş veya uyarlanmış ifadesinin türev eser olabileceğini açıklar ([17 U.S.C. §§ 101–103](https://www.copyright.gov/title17/92chap1.html)). Bu kaynaklar tek başına ürün kararını zorunlu kılmaz; üçüncü taraf ifadeye yaklaşmanın hak ve dağıtım incelemesini ortadan kaldırmadığını doğrular.
