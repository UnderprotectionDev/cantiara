# Bildirilen test sonucunu sürüm kabul kanıtından ayır

## Bağlam

Bir entegrasyon doğru build adını taşıyan sahte veya elle üretilmiş `Passed` sonucu gönderebilir. Artifact adresinin varlığı testin güvenilir bir iş akışında çalıştığını kanıtlamaz; kanıttaki secret'ı sessizce değiştirmek de tarihsel doğruluğu bozar.

## Karar

Test Oturumu bildirilen tarihsel gerçektir, tek başına sürüm kanıtı değildir. Her normatif vaat değişmez açık koşul ID'si taşır; doğal başlık kimlik değildir, kaldırılan ID yeniden kullanılmaz. Otomatik kabul yalnız repository, iş akışı sürümü, exact commit/build, şema sürümü, fixture, ortam, artifact adresi ve hash'i ile sağlayıcının kısa ömürlü imzalı kökenine bağlı güven kuralından gelir. Tek kanıt birden fazla koşul ID'sini kapsayabilir fakat her etkin ID en az bir geçen exact-build kanıtına eşlenir. Manuel kanıt yürüten ve zaman atfı taşır. Kabul manifesti ve digest değişmezdir; güvenlik redaksiyonu manifesti yeniden yazmak yerine içeriksiz redaksiyon işareti bırakır.

## Sonuçlar

- Manuel UX ve erişilebilirlik kontrolleri açık kurucu öz-beyanını kullanabilir; bu bağımsız inceleme sayılmaz.
- Otomatik doğrulanabilir güvenlik ve veri bütünlüğü ek otomatik veya adversarial kanıt ister.
- Bilinen secret veya yüksek güvenilirlikli token içeren rapor, kanıt metni değiştirilmeden atomik olarak reddedilir.
- Süresi dolmuş, çözümlenemeyen veya digest'i eşleşmeyen artifact adresi release kanıtı değildir; ham artifact en az release'in destek/dağıtım ömrü boyunca saklanır.

## İlgili belgeler

- [Test ve doğrulama](../prd/10-testing-and-validation.md)
- [Deneyim ve kabul](../prd/16-product-acceptance.md)
