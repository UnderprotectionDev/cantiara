# Platform PRD

## İçindekiler

1. Hesap yaşam döngüsü
2. Arama
3. İadeler
4. Finansal kontroller
5. Bildirimler
6. Operasyon rolleri

## Hesap yaşam döngüsü

Hesap kapatma ve yeniden açma davranışları iade akışının kapsamı dışındadır.

## Arama

Arama sıralaması ve filtreleme ayrı bir ürün alanıdır.

## İadeler

Müşteri bir sipariş için teslimattan sonraki 30 gün içinde iade talebi açabilir. Talep,
aynı sipariş için yinelenen aktif iade oluşturmamalıdır.

İade durumu finansal ters kayıt tamamlanmadan `tamamlandı` olmamalıdır. Yetki sınırları için
Operasyon rolleri, parasal eşikler için Finansal kontroller bölümüne bakın.

## Finansal kontroller

500 USD üzerindeki iadelerde yönetici onayı gerekir. Kur dönüşümü, ödemenin muhasebeleştiği
para birimi üzerinden ele alınır.

## Bildirimler

Bildirim kanalı ve metni ayrı kaynaklarda tanımlanır; bu bölüm bağlayıcı gereksinim değildir.

## Operasyon rolleri

Destek temsilcisi iade talebi oluşturabilir. Yönetici onay verebilir. Talebi oluşturan kişi
kendi yönetici onayını veremez.

## Geçmiş prototip notu

Eski prototip her durum değişikliğinde ayrı CSV raporu üretiyordu. Bu davranış onaylanmış
bir gereksinim değildir.
