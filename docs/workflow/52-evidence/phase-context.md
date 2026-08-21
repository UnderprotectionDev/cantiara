# Kanıt İlişkileri ve Kanıt Akışı

Kurucu kesin kaynak veya Belge sürümünü kanıt rolü ve yorumuyla ana kayda bağlar. Kanıt Akışı yalnız açık Kanıtı ilişkilerini tarihsel bağlamıyla gösterir.

Kanıt, "ilgili" değildir. Destekleyen, çelişen, bağlam veya null sonuç rolü yorumdan ayrıdır; metin aralığı sürüme sabitlenir.

Bu feature kanıt ilişkileri ve kanıt akışını tamamlar. Kaynak tazeliği, araştırma dönüşümü ve test sonucu kanıt bağı değildir.

## Alt Fazlar

### Sürüme sabit kanıt

Sürüme sabit kanıt metin aralığını kesin Kaynak, Belge, Diyagram veya Dosya Eki sürümüne bağlar. Sürüm kayınca pin sessizce kaymaz.

Kurucu alıntının hangi sürüme ait olduğunu görür. Yeni sürüm eski pin'i geçersiz kılmaz; ayrı karardır.

Pin vurgusu görsel işaretleme veya Wireframe öğesi değildir. Kanıt aralığıdır.

### Kanıt rolü ve yorum

Kanıt rolü destekleyen, çelişen, bağlam veya null sonuçtur. Kullanıcı yorumu rolden ayrı saklanır.

Kurucu rolü değiştirince yorum silinmez. Null sonuç "kanıt yok" hükmünü açık tutar.

Rol otomatik sınıflandırma veya model skoru değildir. Kullanıcı seçimidir.

### Kanıt Akışı

Kanıt Akışı yalnız açık Kanıtı ilişkilerini zaman sırasıyla kaynaklarına açar. Akış yeni kanıt uydurmaz.

Kurucu bir kaydın kanıt tarihçesini okur. Satır kaynağa döner.

Akış Geri Bildirim feed'i veya Proje Etkinliği değildir. Kanıt ilişkilerinin okunmasıdır.

## Tamamlanma Ölçütleri

- Metin aralığı kesin sürüm ve kanıt rolüyle ilişkilendirilir.
- Destekleyen, çelişen, bağlam veya null sonuç rolü kullanıcı yorumundan ayrı korunur.
- Açık Kanıtı ilişkileri zaman sırasıyla kaynaklarına açılır.

## Kapsam Sınırları

- Kanıt bağını ilgili ilişkisi veya belirsiz referans sayma.
- Kaynağın varlığını otomatik doğrulama sayma.
- Akışı bildirim feed'i veya sosyal zaman tüneli yapmak.
