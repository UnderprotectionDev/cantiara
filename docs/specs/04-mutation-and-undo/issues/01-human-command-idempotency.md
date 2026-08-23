# 01 — İnsan komutu: taban revizyonu ve idempotency

**What to build:** Kurucunun durum değiştiren her komutu hedefin taban revizyonunu ve istemci idempotency anahtarını taşır. Aynı anahtar+payload önceki sonucu döndürür; farklı payload çatışmadır. Güncel olmayan taban sessizce ezmez; uzlaştırma akışı yoksa yazma reddedilir ve güncel değer gösterilir. Webhook, import, otomasyon ve restore replay insan gibi sahte taban üretmez; doğrulanmış kaynak kimliği kullanır.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] İnsan komutu taban revizyonu ve istemci anahtarı olmadan uygulanmaz.
- [ ] Aynı anahtar ve payload önceki makbuzu döndürür; aynı anahtar farklı payload `Conflict` olur.
- [ ] Eski taban sessiz last-write-wins uygulamaz; varsayılan yol reddeder ve `Current value` gösterir.
- [ ] İnsan-dışı köken doğrulanmış kaynak kimliği, kararlı teslim kimliği, payload parmak izi ve commit anı revizyon koşulu kullanır; sahte taban kabul edilmez.
- [ ] Aktör `User`, `System automation`, `GitHub` veya `Authorized integration` olarak Kayıt geçmişine yazılır.
- [ ] Kabul kanıtı Mutation Contract seam'inde dört köken sınıfı, tekrar, yeniden sıralama, eşzamanlı yazma. [Mutasyon sözleşmesi](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
