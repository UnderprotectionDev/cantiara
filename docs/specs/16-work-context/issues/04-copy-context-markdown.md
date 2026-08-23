# 04 — Bağlamı Markdown kopyala

**What to build:** `Copy Context as Markdown` ve aynı Komut Paleti komutu iş anahtarı, başlık, tür, durum, açıklama, kontrol listesi, neden zinciri, Birincil spec, ilgili belirsizlik, aktif blokaj ve izinli dış bağlantıları okunabilir Markdown olarak panoya aktarır. Çıktı üretim zamanını, okunabilir kaynak kimliklerini ve `Primary source is in the app` notunu taşır. Yeni kayıt veya kalıcı snapshot yoktur. Secret ve özel ek içeriği girmez.

**Blocked by:** 02 — Canlı bağlam ve neden zinciri

**Status:** ready-for-agent

- [ ] Eylem panoya Markdown yazar; ana kayıt, snapshot veya paylaşım nesnesi oluşturmaz.
- [ ] Çıktı anahtar, başlık, tür, durum, açıklama, kontrol listesi, neden zinciri, Birincil spec, ilgili Karar/Risk/Açık Soru, aktif blokaj ve izinli GitHub/dış bağlantıları içerir.
- [ ] Üretim zamanı, okunabilir kaynak kimlikleri/bağlantıları ve `Primary source is in the app` notu vardır.
- [ ] Secret, erişilemeyen alan ve özel ek içeriği kapsama girmez; eylem erişimi genişletmez.
- [ ] Komut Paleti aynı komutu sunar; palet host'u bu ticket'ta inşa edilmez.
- [ ] Kabul kanıtı Work Context Card seam'inde: kopya içeriği, kayıt oluşmama, secret dışlama. Kanıt [İş bağlamı](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) kopyalama dilimidir.
