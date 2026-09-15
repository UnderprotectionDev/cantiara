# Yapılandırılmış round-trip biçimi olarak sürümlü JSON kullan

## Bağlam

CSV ve Markdown insan tarafından okunabilir olsa da kimlik, özel alan tanımı, köken ve ilişkileri aynı kayıpsızlıkla taşıyamaz. Ürünün kendi eski export'unu ileride okuyamaması taşınabilirlik sözünü geçici hâle getirir.

## Karar

JSON desteklenen seçili kayıtların kanonik yapılandırılmış round-trip biçimidir ve açık şema sürümü taşır. Ürün, yayımladığı bütün birinci taraf şema sürümlerini test edilmiş dönüşümlerle içe aktarabilir tutar; bilinmeyen gelecek sürüm yazmadan reddedilir ve kaçınılmaz kayıp onaydan önce gösterilir.

## Sonuçlar

- CSV düz ve açıklanmış kayıplı görünüm; Markdown belge odaklı çıktı olarak kalır.
- Eski şemalar için kalıcı migration ve fixture bakım yükü oluşur.
- Export kimliği, kalıcı silinmiş ürün kimliğini diriltme yetkisi vermez.

## İlgili belgeler

- [Veri güvenliği ve taşınabilirlik](../prd/13-data-security-and-portability.md)
- [Belgeler ve bilgi](../prd/07-documents-and-knowledge.md)
