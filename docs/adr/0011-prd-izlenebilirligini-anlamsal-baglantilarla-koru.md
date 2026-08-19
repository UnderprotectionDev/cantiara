# PRD izlenebilirliğini anlamsal bağlantılarla koru

Eski `REQ-*`, `CLM-*`, `AC-*` ve `R0`–`R3` sınıflandırmaları okuyucuya dönük başlık ve kapsam anlatımından kaldırılır. Ürün davranışları anlamlı başlıklar altında korunur; her bağımsız ve gözlenebilir kabul koşulu doğal adlı Markdown maddesi veya tablo satırı olarak yaşar. Manifest anahtarı, koşulun kaynak dosyası ile kararlı bölüm kimliğinden ve doğal adından oluşan anlamsal referanstır; okuyucu yüzeyine ayrı bir sıra kodu geri getirilmez. Kabul geçmişinin metin ve başlık düzeltmelerinde sessizce kopmaması sentetik kimlikle değil, sürümlü referans envanteriyle korunur: envanter repository'de tutulur, her PRD değişikliğinde yeniden üretilir ve otomatik kontrol eklenen ile kaybolan referansları açıkça raporlar. Kabul manifesti bütün etkin referansları exact-build kanıtına eşler; adsız, aynı bölümde yinelenen, envanterde bulunmayan veya sonuçsuz koşul engellenir.

İlk sürümün çekirdek davranışları aşamalara bölünmez: tamamı tek ürün kapsamı ve tek tamamlanma kapısıdır. Ticari genişleme, kanıt bekleyen gelecek yönleri ve açık kapsam dışı hükümler ayrı kapsam anlamlarını korur.

`CORE`, `ACCEPTANCE`, `COMMITTED-NEXT`, `EVIDENCE-GATED` ve `OUT` etiketleri de güncel okuyucu yüzeyinden kaldırılır. Bunların yerine sırasıyla ilk ürünün zorunlu kapsamı, ürün tamamlanma kanıtı, kararlaştırılmış ticari genişleme, kanıt oluşursa değerlendirilecek yönler ve bu ürün kapsamında bulunmayanlar doğal dili kullanılır.

Ürün alanı belgesi davranış ve kısıtın, kabul belgesi test yöntemi ve kanıtın, ürün kapsamı belgesi ise bütün çekirdek davranışlarla kabul koşullarının tamamlanma kapısının tek sahibidir. Kabul belgesi kaynak davranışı yeniden tanımlamaz.

Yeniden adlandırmada repo içindeki bütün bağlantılar açık kararlı anchor'lara taşınır. Eski kapsam kodu anchor'ları veya eski dosya shim'leri bırakılmaz; referans envanteri yalnız değişikliği görünür kılan denetim aracıdır ve eski davranışı güncel sözleşmeye taşıyan uyumluluk tablosu değildir. Sıfır kırık dosya ve fragment bağlantısı doğrulanır; tarihsel PRD snapshot'ı güncel sözleşmeye karıştırılmaz.
