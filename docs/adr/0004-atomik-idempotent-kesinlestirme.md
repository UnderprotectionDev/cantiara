# Çok adımlı yazmaları atomik ve idempotent kesinleştir

## Bağlam

Import, dosya yükleme, Web Yakalama ve arka plan işlemleri ağ kopması, tekrar, iptal veya yetki değişimi sırasında birden fazla sistem sınırını geçer. Doğrudan ve kısmi yazma görünür bozuk kayıt, kopya veri veya iptalden sonra geç yazma üretebilir.

## Karar

Çok adımlı yazma önce ana kayıtlardan yalıtılmış hazırlama alanına alınır. Kesinleştirme taban revizyonu, idempotency anahtarı, payload parmak izi, güncel yetki, hedef kapsam ve kotayı yeniden doğrulayan tek commit bariyeridir; sonuç yalnız tam commit makbuzu veya tam rollback olabilir.

## Sonuçlar

- Retry aynı işlem sonucunu bulur; değişmiş payload açık çatışmadır.
- Commit bariyerinden sonra sahte bir `İptal` yerine `Sonlandırılıyor` durumu gösterilir.
- Geçici veriler için süreli temizlik ve işlem makbuzu altyapısı gerekir.

## İlgili belgeler

- [Ortak kimlik ve idempotency sözleşmesi](../prd/02-domain-model-and-lifecycle.md#ortak-kimlik)
- [Veri güvenliği ve taşınabilirlik](../prd/13-data-security-and-portability.md)
- [Yakalama ve intake](../prd/05-capture-and-intake.md)
