# Test Raporu Kabulü

Kurucu manuel form, yapılandırılmış dosya veya dar MCP yoluyla gelen dış test sonucunu aynı tarihsel modele atomik ve idempotent biçimde kabul eder. Bildirilen sonuç doğrulanmış ürün kabulü sayılmaz. Üç yol tek Test Oturumu ve Oturum Testi modeline yazar; kaynağa özel paralel kayıt türü oluşmaz. Yürüten, raporlayan ve giriş yolu ayrı tutulur; giriş yolu güven veya önem puanı üretmez.

Oturum ve madde iki katmandır. Oturum sonucu ile Oturum Testi sonucu ayrıdır; bildirilen ham sonuç normalize `Geçti`/`Kaldı`/`Bloke`/`Atlandı`/`Sonuçsuz`/`Bildirilmedi` değerinden ayrı korunur. Bağsız serbest not Test Oturumu olmaz. Yeni oturum `İncelenmedi` ile başlar; inceleme bildirilen sonucu değiştirmez.

Bozuk zarf hiçbir kayıt bırakmaz; tekrar gönderim çoğalmaz. Dosya veya MCP sürümlü zarfı bütünüyle doğrular; kısmi satır ithali yoktur. Desteklenmeyen `schema_version` sessizce yükseltilmez. İlk sözleşme sürümü `test-report/1`dir. Kabul, inceleme veya yayın kapısı değildir.

Dar MCP yetkili istemcinin yalnız tanımlı test raporu sözleşmesini göndermesine izin verir. Genel kayıt yazımı, senaryo/spec/belge okuma, mevcut kaydı değiştirme, başka kayıt türü oluşturma veya ürün içinde komut başlatma açılmaz. Bu yol gelecek yönlerdeki salt okunur bağlam köprüsü değildir; harici araca verilecek bağlam yalnız kullanıcının açıkça oluşturduğu Handoff paketinden gelir. Başarılı MCP cevabı yalnız teslim makbuzudur; Test Oturumunun özel içeriğini geri döndürmez.

Secret taraması kesin token kalıbı bulursa bütün raporu reddeder; ürün kanıtı sessizce düzenlemez. Gözetimsiz MCP tesliminde belirsiz bulgu da reddedilir. MCP binary dosya veya yeni bağımsız Dosya Eki yükleyemez. Dosya veya MCP ile oluşan her yeni Test Oturumu Birleşik Bildirim Merkezinde tek incelenmemiş rapor sinyali üretir; idempotent tekrar teslim yeni sinyal oluşturmaz. Elle oluşturulan oturum ek bildirim üretmeden Testler alanında İncelenmedi olarak görünür.

Bu feature test raporu kabulünü tamamlar. İnceleme, açık, değerlendirme ve özet ayrı yolculuktadır.

## Tamamlanma Ölçütleri

- Manuel, dosya ve dar MCP yolları aynı tarihsel modele atomik ve idempotent yazar.
- Oturum ile madde sonucu ayrı katmandadır; ham sonuç normalize dilden ayrı korunur.
- Bozuk, kısmi veya desteklenmeyen zarf hiçbir kayıt bırakmadan reddedilir.
- Dar MCP yalnız `test-report/1` teslim eder; genel okuma veya yazma yüzeyi açılmaz.
- Secret tespiti sessiz kısmi kabul veya kanıt düzenlemesi üretmez.

## Kapsam Sınırları

- Bildirilen sonucu doğrulanmış ürün kabulü veya yayın kapısı sayma.
- Bozuk zarfı kısmen yazma veya satır satır ithal etme.
- Serbest notu Test Oturumu sayma.
- MCP'yi genel veritabanı yazma kanalı veya ajan araç pazarı yapmak.
- MCP'yi salt okunur bağlam köprüsüne veya kayıt okuma API'sine genişletme.
- Üç yolu ayrı kayıt türleri veya ayrı kabul kuyrukları sayma.
