# İçeriği yalnız veritabanında tut

Belgeler, Teknik Diyagramların yapısal modelleri, yapılandırılmış kayıtlar ve ilişkiler yalnız veritabanında yaşar ve yalnız uygulama içinde düzenlenir. Bilgisayarda uygulamayla canlı eşzamanlanan proje klasörü, fiziksel Markdown doğruluk kaynağı veya diagram-as-code kaynağı tutulmaz; VS Code ve Obsidian gibi harici editörlerle canlı düzenleme desteklenmez. Bir bilgi çalışma aracı için beklenen tersidir — çoğu benzer araç dosya senkronu sunar — bu yüzden kararın açıkça kaydedilmesi gerekir.

Alternatif, içeriği dosya sisteminde tutup uygulamayı bir görüntüleyici yapmak ya da iki yönlü senkron kurmaktı. Reddedildi çünkü ürünün bütün değeri tek doğruluk kaynağına bağlı: ilişkiler, kesin sürüme sabitlenmiş kanıt, kullanım bağları, idempotent mutasyon sözleşmesi, kapalı dünya paylaşım snapshot'ı ve denetlenebilir değişiklik geçmişi ancak içerik tek yerde yaşarsa tutarlı kalır. İki eş canlı kaynak, PRD'nin yasakladığı paralel doğruluk kaynağını mimarinin merkezine koyardı.

Bedeli, kullanıcının alışkın olduğu editörleri kaybetmesi ve taşınabilirliğin senkron yerine açık dışa aktarmaya dayanmasıdır. Bu telafi bilinçli olarak sınırlıdır: ürün seçili içeriği standart Markdown, JSON ve CSV biçimlerinde dışa aktarır fakat tam çalışma alanı yedeği veya geri yüklenebilir ürün paketi sunmaz.
