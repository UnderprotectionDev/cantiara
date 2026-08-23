# 02 — Yinelenen devir ve donmuş paket

**What to build:** Aynı İş birden fazla devri kronolojik tutar. Yeni devir öncekinin gidiş veya dönüş bağlamını ezmez. Gönderilmiş paket, kaynaklar sonra değişince sessizce güncellenmez; kurucu aynı devirde yeni paket sürümü üretir veya yeni devir başlatır. Gidiş, dışarı verme ve sonraki olaylar aktör ve zamanıyla İşin normal değişiklik geçmişinde kalır.

**Blocked by:** 01 — Devir başlatma ve tarihli paket

**Status:** ready-for-agent

- [ ] Aynı İşte ikinci `Start Handoff` yeni bileşen üretir; birinci devrin paket ve alanları değişmez.
- [ ] Gönderilmiş paketin baytları kaynak Belge/Karar/İş değişince yeniden yazılmaz.
- [ ] Kullanıcı yeni paket sürümü veya yeni devir seçer; eski paket tarihsel kalır.
- [ ] Başlatma ve paket üretimi İş değişiklik geçmişinde aktör ve zamanla görünür; ikinci denetim günlüğü açılmaz.
- [ ] Kabul kanıtı aynı seam’de iki yinelenen kodlama devri ve kaynak değişiminin gönderilmiş paketi ezmediği karşıtı. Bu, [Dış yürütme devri](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğunun ezilmeme paketidir.
