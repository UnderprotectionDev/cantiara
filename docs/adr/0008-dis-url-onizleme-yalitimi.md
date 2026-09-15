# Dış URL önizleme isteklerini ağdan yalıt

## Bağlam

Kullanıcının verdiği URL'yi sunucu tarafından açmak; yönlendirme, DNS rebinding veya sıkıştırılmış içerik üzerinden iç ağa erişim ve kaynak tüketimi riski oluşturur.

## Karar

Önizleme ayrı yetkisiz egress yolundan yapılır. Her DNS sonucu ve yönlendirme adımında loopback, özel, link-local ve ayrılmış hedefler reddedilir; yalnız HTTP(S), kimlik bilgisi olmayan istek, sınırlı yönlendirme/süre/byte/açılmış boyut ve sterilize çıktı kabul edilir. Belirsiz durumda ürün önizleme yerine düz bağlantı gösterir.

## Sonuçlar

- İç ağ ve metadata servisleri önizleme yolundan erişilemez kalır.
- Bazı geçerli fakat doğrulanamayan adresler zengin önizleme alamaz.
- DNS ve yönlendirme kontrolleri her ağ adımında tekrarlanır.

## İlgili belgeler

- [Arama, ilişkiler ve kanıt](../prd/08-search-relations-and-evidence.md)
