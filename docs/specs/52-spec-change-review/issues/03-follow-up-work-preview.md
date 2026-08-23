# 03 — Önizlemeli takip İşi

**What to build:** `Create Follow-up Work` oluşacak İşi, hedef projeyi, başlangıç durumunu, değişen spec sürümlerini ve aday kaynak ilişkisini onaydan önce gösterir. Onay tam olarak bir İş açar ve spec sürümlerine görünür bağlar. İnceleme sonucu kendiliğinden kapanmaz. Kuyruk satırı İş olmaz. Zorunlu approval kapısı, otomatik alan güncellemesi, toplu takip, otomasyon kuralı, Test Açığı veya Çürütülen Varsayım incelemesi yoktur.

**Blocked by:** 02 — Kayıtlı bağ adayları ve inceleme üstverisi

**Status:** ready-for-agent

- [ ] Önizlemesiz İş oluşmaz; onay tam olarak bir İş üretir.
- [ ] İnceleme sonucu otomatik kapanmaz.
- [ ] Çürütülen Varsayım kuyruğu ve Test Açığı üretimi yoktur.
- [ ] İngilizce UI `Create Follow-up Work`, `Waiting`, `Reviewed`, `Not affected` kullanır; etiketler `Bekliyor` / `Gözden geçirildi` / `Etkilenmedi` karşılığıdır.
- [ ] Kabul kanıtı aynı seam'de: tek İş, kapanmama, 18/55 karşıtı. [Belge bütünlüğü](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) takip paketidir.
