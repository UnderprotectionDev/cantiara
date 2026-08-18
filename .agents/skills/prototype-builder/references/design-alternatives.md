# Üç Tasarım Yönü Sözleşmesi

Bu dosyayı yalnız gereksinim tabanı tamamlandıktan ve üç çalışabilir yön tasarlanacağı zaman tamamen oku.

## Sabit Çekirdek

Üç yönde şunları sabit tut:

- Ana kullanıcı ve ulaşmak istediği sonuç
- Kaynak destekli zorunlu içerik ve eylemler
- İş anlamı, veri anlamı ve açık kurallar
- `implemented` ve `simulated` gereksinimlerin eksiksiz kapsamı
- Verilmiş marka, görsel dil ve tasarım sistemi kısıtları

Ekran sayısı, adım sırası ve görünür düzen aynı olmak zorunda değildir. Sonuç ve kapsam sabitken deneyim modeli değişebilir.

## Ayrışma Ekseni

Her yön için en az iki yüksek etkili eksen seç. En az biri ilk dört yapısal eksenden gelsin:

1. Bilgi mimarisi ve gruplama modeli
2. Gezinme ve yön bulma yaklaşımı
3. Görev akışı veya adım sırası
4. Etkileşim modeli ve kontrol yerleşimi
5. Layout, yoğunluk ve ana/ikincil bölge oranı
6. İçerik hiyerarşisi ve açıklama seviyesi
7. Görsel dil ve vurgu sistemi

Renk, font, shadow, radius veya kart biçimini tek başına yön farkı sayma. Aynı bileşen ağacını tema değiştirerek üç kez sunma.

Örnek gerçek ayrışma:

- **Operasyon merkezi:** Kalıcı yan gezinme, yoğun genel bakış, paralel görev erişimi.
- **Öncelik kuyruğu:** Üst seviye bağlam, durum tabanlı board, sıradaki işi öne çıkarma.
- **Yönlendirilmiş odak:** Tek görev, aşamalı açıklama, adım sonlarında karar özeti.

Bu örnekleri starter varsayılanı gibi kopyalama. Kaynak göreve uygun eksenleri yeniden seç.

## `design-directions.md` Çıktısı

Proje kökünde şu kısa yapıyı kullan:

```markdown
# Design Directions

## Shared requirement baseline
- Korunan kullanıcı sonucu
- Korunan zorunlu içerik ve davranışlar

## Alternative A — <kaynak-özgü ad>
- Hypothesis:
- Structural axes:
- Primary journey:
- Trade-off:

## Alternative B — <kaynak-özgü ad>
...

## Alternative C — <kaynak-özgü ad>
...

## Pairwise divergence proof
- A ↔ B:
- A ↔ C:
- B ↔ C:
```

Her çift için planlanan en az bir yapısal ve toplam iki yüksek etkili farkı açıkça yaz. Trade-off'u pazarlama cümlesine dönüştürme; o yönün gerçekten neyi zorlaştırdığını belirt.

Bu bölüm bir tasarım taahhüdüdür, render edilmiş ayrışma kanıtı değildir. Uygulama sonunda sayfaları tarayıcıda karşılaştır ve gözlenen farkları `verification.md` içine ayrıca yaz.

## Uygulama Sınırı

- Tek projede `/alternative-a`, `/alternative-b`, `/alternative-c` kullan.
- Mock veri şeması ve saf domain yardımcıları paylaşılabilir.
- Ekran iskeleti, navigasyon, akış durumu ve UI bileşenlerini yönler arasında ortaklaştırarak farkı eritme.
- Ana eylemleri in-memory durumla çalıştır. Kaynakta olmayan kalıcılık ve edge-case üretme.
- Starter'daki örnek yönleri yalnız teknik iskelet say; kaynak-özgü tasarım kararlarıyla değiştir.
- Üçünü de tamamla ve birlikte teslim et. Seçim kapısı, kazanan veya otomatik polish aşaması oluşturma.

## Tamamlanma Kapısı

Üç yön şu koşulların tamamında ayrışmıştır:

- Aynı kullanıcı sonucunu ve gereksinim kimliklerini kapsar.
- Her yönün kaynak-özgü hipotezi ve dürüst trade-off'u vardır.
- Her yön en az iki yüksek etkili eksende farklıdır.
- Her yön en az bir yapısal eksende farklıdır.
- A↔B, A↔C ve B↔C için uygulanacak farklar `design-directions.md` içinde açıkça taahhüt edilmiştir.
