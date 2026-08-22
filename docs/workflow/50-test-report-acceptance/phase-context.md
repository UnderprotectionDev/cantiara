# Test Raporu Kabulü

Kurucu manuel, dosya veya dar MCP yoluyla gelen dış test sonucunu aynı tarihsel modele atomik ve idempotent biçimde kabul eder. Bildirilen sonuç doğrulanmış ürün kabulü sayılmaz.

Üç yol tek modele yazar. Bozuk zarf kayıt bırakmaz; tekrar gönderim çoğalmaz. Kabul, inceleme veya yayın kapısı değildir.

Bu feature test raporu kabulünü tamamlar. İnceleme, açık, değerlendirme ve özet ayrı yolculuktadır.

## Alt Fazlar

### Manuel Test Oturumu

Manuel Test Oturumu oturum ve tekil test sonuçlarını iki katmanlı kaydeder. Oturum sonucu ile madde sonucu ayrıdır.

Kurucu kendi yürüttüğü testi yazar. Bu yazma inceleme tamamlanması değildir.

Oturum senaryo sürümüne bağlanır. Bağsız serbest not Test Oturumu olmaz.

### Dosya raporu

Dosya raporu sürümlü zarfı bütünüyle doğrular. Geçmezse hiçbir Test Oturumu veya madde kaydı kalmaz.

Kurucu hangi Handoff veya senaryo sürümüne oturduğunu görür. Kısmi satır ithali yoktur.

Dosya, rastgele JSON içe aktarma değildir. Test raporu sözleşmesidir.

### Dar MCP kabulü

Dar MCP kabulü yetkili istemcinin yalnız tanımlı test raporu sözleşmesini göndermesine izin verir. Genel kayıt yazımı açılmaz.

İstek idempotenttir. Aynı rapor ikinci bir oturum üretmez.

MCP, ürün API'sinin geniş yazma yüzeyi veya ajan araç pazarı değildir.

## Tamamlanma Ölçütleri

- Manuel oturum iki katmanlı sonuçla kaydedilir.
- Sürümlü rapor zarfı bütünüyle doğrulanır veya hiçbir kayıt bırakmadan reddedilir.
- Yetkili istemci yalnız tanımlı test raporu sözleşmesini gönderir.

## Kapsam Sınırları

- Bildirilen sonucu doğrulanmış ürün kabulü veya yayın kapısı sayma.
- Bozuk zarfı kısmen yazma.
- MCP'yi genel veritabanı yazma kanalı yapmak.
