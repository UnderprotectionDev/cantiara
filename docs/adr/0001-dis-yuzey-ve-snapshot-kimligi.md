# Dış yüzey ile snapshot revizyonunu ayrı kimlikler olarak modelle

## Bağlam

Aynı paylaşım bağlantısının yeni onaylarda yaşamaya devam etmesi gerekirken geçmişte onaylanmış içeriğin geriye dönük değişmemesi gerekir. Tek kayıt iki farklı yaşam döngüsünü güvenli biçimde temsil edemez.

## Karar

URL, erişim anahtarı, parola, süre ve iptal durumunu taşıyan **Dış yüzey** ana kayıttır. Her onay, yüzeyden bağımsız yaşayamayan yeni ve değişmez bir **Onaylı snapshot revizyonu** üretir; yüzey yalnız güncel revizyona işaret eder.

Tekil kaynak Çöp Kutusuna alınırken kullanıcı açıkça korumayı seçerse yüzey son onaylı snapshot'ta donar ve kaynaktan ayrılır; kaynak geri yükleme otomatik yeniden bağlama veya yayın yapmaz. Proje, Çalışma Alanı veya Hesap silme bu istisnayı sunmaz: kapsanan yüzey terminal iptal edilir ve geri yükleme yeni yüzey/onay gerektirir.

## Sonuçlar

- Aynı URL yeni onaylarda korunabilir.
- Eski onaylar iç geçmişte değişmeden kalır.
- Kapsam değiştiren kaynak yeni bir yüzey ve onay zinciri gerektirir.
- Proje silme grubu ile aktif dış erişim aynı anda var olamaz.

## İlgili belgeler

- [Paylaşım sözleşmesi](../prd/14-sharing-and-public-publishing.md)
- [Ortak domain sözleşmesi](../prd/02-domain-model-and-lifecycle.md)
