# 04 — Kayıtlı sıralama, bağımsız rank yok

**What to build:** Kanban bağımsız kalıcı manuel kart sırası tutmaz. Kartlar kayıtlı görünümün açık sıralama ayarını kullanır. Sütun hareketi Backlog manuel sırasını veya Önceliklendirme oturumu rank’ini yazmaz. Gelecek yeniden görünme tarihi varsayılan kümede kartı geri planda tutabilir; durum değişmez.

**Blocked by:** 01 — Durum sütunları ve kart hareketi

**Status:** ready-for-agent

- [ ] Tahtada kart bırakmak bağımsız Kanban rank’i üretmez; görünüm sıralaması geçerlidir.
- [ ] Sütun hareketi Backlog sırasını ve önceliklendirme oturumu sırasını değiştirmez.
- [ ] Gelecek yeniden görünme tarihi durumu yazmadan varsayılan kümede geri planda durabilir; tarih alanı bu ticket’ta tanımlanmaz.
- [ ] Arşivli İş varsayılan tahtada yoktur; arşiv sütunu açılmaz.
- [ ] Kabul kanıtı seam’de sıra karşıtı, Backlog sırasının dokunulmaması ve yeniden görünme tarihinin durum yazmaması. Bu [Günlük planlama](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) planlama-durum ayrımı paketidir.
