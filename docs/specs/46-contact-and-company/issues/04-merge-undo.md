# 04 — Birleştirmeyi geri alma

**What to build:** Birleştirmeyi geri alma özgün emekli kimliği yeniden ana kayıt yapar ve yalnız birleştirme olayına atfedilebilen değer ve ilişkileri ayırır. Sonraki ilgisiz değişiklikler geri sarılmaz; aynı alanda çatışan sonraki değer kullanıcı kararı ister. Redaksiyon veya kalıcı silmeyle yok olmuş içerik tam geri alma vaadi değildir; eksik kısım önizlemede açıklanır. Kişisel veri silme bu ticket'ta yoktur.

**Blocked by:** 03 — Birleştirme önizlemesi ve atomik konsolidasyon

**Status:** ready-for-agent

- [ ] Geri alma emekli kimliği ana kayıt yapar ve yalnız birleştirme-atıflı uçları ayırır.
- [ ] Birleştirmeden sonraki ilgisiz düzenleme geri sarılmaz; çatışma kullanıcıya gösterilir.
- [ ] Redakte veya kalıcı silinmiş içerik önizlemede restor edilemez olarak durur; işlemi sessizce “tam geri aldı” diye etiketlemez.
- [ ] `Erase personal data` ve `Confirm GitHub Identity` bu ticket'ta yoktur.
- [ ] Kabul kanıtı aynı seam'de: geri alma, ilgisiz düzenleme karşıtı, eksik içerik önizlemesi. Bu kanıt kimlik defterinin [Hesap ve kişisel veri](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yarısıdır; silme paketi 81'dedir.
