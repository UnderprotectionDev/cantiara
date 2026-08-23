# 06 — Özellik kapsamı

**What to build:** Özellik isteğe bağlı bir seviye altında başka tam İşleri kapsar. Bir İş aynı anda en fazla bir birincil Özelliğin ilerleme kapsamındadır. Kapsanan İş bağımsız ana kayıttır. Türetilen ilerleme Özellik durumunu otomatik değiştirmez. İsteğe bağlı `On Track` / `At Risk` / `Off Track` sağlık güncellemesi Özellikte kalır; bildirim, ilerleme hesabı veya Manuel Proje Güncellemesi değildir. Başka Özelliklere `Related` katkı ikinci kapsam sayımı üretmez.

**Blocked by:** 01 — İş oluşturma, tür ve değişmez anahtar

**Status:** ready-for-agent

- [ ] `Includes` / `Included in` en fazla bir birincil Özellik dayatır; yazma Work Lifecycle seam’indedir. Workflow 12 paketi bu ticket’ı bloklamaz.
- [ ] Kapsanan İşin türü, durumu, planlaması ve geçmişi bağımsız kalır.
- [ ] İlerleme özeti durum yazmaz; sağlık güncellemesi Proje skoruna yuvarlanmaz.
- [ ] Feature’dan çıkış kapsanan İş, sağlık geçmişi veya Birincil spec varken önizlemesiz engellenir; sessiz ilişki yeniden yorumu yoktur (01’deki tür kuralı bozulmaz).
- [ ] Kabul kanıtı Work Lifecycle seam'inde kardinalite, bağımsızlık, otomatik durum karşıtı.
