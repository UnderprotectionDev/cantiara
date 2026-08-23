# 03 — Kaydırma yalnız temsil edilen tarihi yazar

**What to build:** Kullanıcı bir tarih işaretini başka güne sürükleyerek yalnız temsil ettiği kaynak tarih alanını günceller. Tarih türü ve eski/yeni değer bırakmadan önce görünür olur. Değişiklik iş durumunu veya diğer tarih alanlarını etkilemez ve güvenli biçimde geri alınabilir. Bu yüzey kişisel hatırlatma veya dış takvim senkronu değildir.

**Blocked by:** 01 — Gün, hafta, ay; türler karışmaz

**Status:** ready-for-agent

- [ ] Hedef tarihi kaydırmak planlanan başlangıcı veya yeniden görünme tarihini yazmaz; tersi de geçerlidir.
- [ ] Bırakma öncesi tür ve eski/yeni değer görünür; iptal yazmaz.
- [ ] Durum değişmez; değişiklik güvenli geri alma sözleşmesiyle geri alınır.
- [ ] Dış takvim yükü veya hatırlatma Event’i üretilmez.
- [ ] Kabul kanıtı seam’de tek alan yazımı, durum karşıtı ve geri alma. Bu [Günlük planlama](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) değişiklik geçmişi paketidir.
