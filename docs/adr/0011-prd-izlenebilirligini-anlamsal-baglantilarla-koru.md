# PRD izlenebilirliğini anlamsal bağlantılarla koru

Eski `REQ-*`, `CLM-*`, `AC-*` ve `R0`–`R3` sınıflandırmaları okuyucuya dönük başlık ve kapsam anlatımından kaldırılır. Ürün davranışları anlamlı başlıklar altında korunur; her bağımsız ve gözlenebilir kabul koşulu doğal adlı Markdown maddesi veya tablo satırı olarak yaşar. Kabul geçmişinin metin ve başlık düzeltmelerinde kopmaması için her koşul ayrıca görünür ve değişmez `FP-<dosya>-<sıra>` ya da `CE-<dosya>-<sıra>` kimliği taşır. Doğal ad okunabilir açıklama, kalıcı ID ise manifest anahtarıdır. İlk atamadan sonra ID yeniden numaralanmaz, başka koşula verilmez veya satır numarasından türetilmez; kaldırılan ID sürümlü tombstone envanterinde korunur. Kabul manifesti bütün etkin ID'leri exact-build kanıtına eşler ve otomatik kontrol kimliksiz, eksik, yinelenen, emekli ID'yi yeniden kullanan veya sonuçsuz koşulu engeller.

İlk sürümün çekirdek davranışları aşamalara bölünmez: tamamı tek ürün kapsamı ve tek tamamlanma kapısıdır. Ticari genişleme, kanıt bekleyen gelecek yönleri ve açık kapsam dışı hükümler ayrı kapsam anlamlarını korur.

`CORE`, `ACCEPTANCE`, `COMMITTED-NEXT`, `EVIDENCE-GATED` ve `OUT` etiketleri de güncel okuyucu yüzeyinden kaldırılır. Bunların yerine sırasıyla ilk ürünün zorunlu kapsamı, ürün tamamlanma kanıtı, kararlaştırılmış ticari genişleme, kanıt oluşursa değerlendirilecek yönler ve bu ürün kapsamında bulunmayanlar doğal dili kullanılır.

Ürün alanı belgesi davranış ve kısıtın, kabul belgesi test yöntemi ve kanıtın, ürün kapsamı belgesi ise bütün çekirdek davranışlarla kabul koşullarının tamamlanma kapısının tek sahibidir. Kabul belgesi kaynak davranışı yeniden tanımlamaz.

Yeniden adlandırmada repo içindeki bütün bağlantılar açık kararlı anchor'lara taşınır. Eski kapsam kodu anchor'ları veya eski dosya shim'leri bırakılmaz; koşul-ID tombstone envanteri yalnız yeniden kullanım engelidir ve eski davranışı güncel sözleşmeye taşıyan uyumluluk tablosu değildir. Sıfır kırık dosya ve fragment bağlantısı doğrulanır; tarihsel PRD snapshot'ı güncel sözleşmeye karıştırılmaz.
