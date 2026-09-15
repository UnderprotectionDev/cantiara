# 02 — Şablondan bağımsız İş oluşturma

**What to build:** Şablondan üretilen İş yeni anahtarlı bağımsız ana kayıttır ve şablona canlı bağlı kalmaz. Proje varsayılan başlangıç durumuyla açılır. Sonraki şablon değişikliği mevcut İşleri güncellemez. Oluşturma isteğe bağlıdır.

**Blocked by:** 01 — İş şablonu tanımı

**Status:** ready-for-agent

- [ ] `Create from template` yeni kimlik ve yeni İş anahtarı üretir; kaynak şablon kimliği veri kaynağı olmaz.
- [ ] Başlangıç durumu Proje varsayılanıdır; şablon mevcut durum veya kapanış sonucu yazamaz.
- [ ] Şablon düzeni daha önce oluşmuş İşleri değiştirmez.
- [ ] Komut taban revizyonu ve istemci idempotency anahtarı taşır; aynı anahtar aynı sonucu döner.
- [ ] Kullanım zorunlu workflow kapısı değildir; şablonsuz İş oluşturma açık kalır.
- [ ] Kabul kanıtı Work Templates seam'inde: instantiate, şablon edit sonrası eski İşin değişmemesi, idempotency. Kanıt [İş yaşam döngüsü](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) başlangıç dilimidir.
