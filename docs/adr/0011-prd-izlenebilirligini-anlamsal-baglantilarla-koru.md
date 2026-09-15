# PRD izlenebilirliğini anlamsal bağlantılarla koru

Eski `REQ-*`, `CLM-*`, `AC-*` ve `R0`–`R3` sınıflandırmaları okuyucuya dönük başlık ve kapsam anlatımından kaldırılır. Ürün davranışları anlamlı başlıklar altında korunur; her bağımsız ve gözlenebilir kabul koşulu doğal adlı Markdown maddesi veya tablo satırı olarak yaşar ve okuyucu yüzeyine ayrı bir sıra kodu geri getirilmez.

Kabulün birimi tek tek vaat değil, Ürün Kabulü belgesindeki uçtan uca yolculuktur. Manifest anahtarı yolculuğun adıdır; yolculuk hangi normatif kaynakları kapsadığını ve kanıtının gerçek proje mi sentetik fixture mı gerektirdiğini kendi satırında taşır. Kabul manifesti bütün etkin yolculukları exact-build kanıtına eşler; adsız, yinelenen, geçmeyen veya doğrulanabilir kanıtı bulunmayan yolculuk Ürün sürüm adayını bloklar.

Bu izlenebilirlik başlangıçta sürümlü bir referans envanteri ve onu üreten bir doğrulayıcıyla korunuyordu. O mekanizma kaldırıldı: envanter her metin düzenlemesinde yeniden üretilmesi gereken 250 KB'lık üretilmiş bir dosyaydı, hiçbir ürün kodu onu tüketmiyordu ve manifest ile kapsama doğrulama yolları hiç çalıştırılmamıştı. Karşılığında kabul edilen bedel açıktır: bir bölümün içindeki tek bir vaadin kanıtsız kalması artık mekanik olarak yakalanmaz ve kapsamın eksiksizliği yolculuk tablosunun elle gözden geçirilmesine bağlıdır. Yeni veya değişen normatif bölüm aynı değişiklikte ilgili yolculuğa bağlanır.

İlk sürümün çekirdek davranışları aşamalara bölünmez: tamamı tek ürün kapsamı ve tek tamamlanma kapısıdır. Ticari genişleme, kanıt bekleyen gelecek yönleri ve açık kapsam dışı hükümler ayrı kapsam anlamlarını korur.

`CORE`, `ACCEPTANCE`, `COMMITTED-NEXT`, `EVIDENCE-GATED` ve `OUT` etiketleri de güncel okuyucu yüzeyinden kaldırılır. Bunların yerine sırasıyla ilk ürünün zorunlu kapsamı, ürün tamamlanma kanıtı, kanıt bekleyen ticari gelecek, kanıt oluşursa değerlendirilecek yönler ve bu ürün kapsamında bulunmayanlar doğal dili kullanılır.

Ürün alanı belgesi davranış ve kısıtın, kabul belgesi test yöntemi ve kanıtın, ürün kapsamı belgesi ise bütün çekirdek davranışlarla kabul koşullarının tamamlanma kapısının tek sahibidir. Kabul belgesi kaynak davranışı yeniden tanımlamaz.

Yeniden adlandırmada repo içindeki bütün bağlantılar açık kararlı anchor'lara taşınır. Eski kapsam kodu anchor'ları veya eski dosya shim'leri bırakılmaz; tarihsel PRD snapshot'ı güncel sözleşmeye karıştırılmaz.
