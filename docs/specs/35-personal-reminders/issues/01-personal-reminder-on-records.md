# 01 — Desteklenen kayda kişisel hatırlatma

**What to build:** Kurucu desteklenen Proje, Belge, İş, Karar, Risk, Tasarım, Kaynak, Kilometre Taşı, Proje Sürümü, Üretim Olayı veya Test Açığı kaydına Hesap kapsamındaki Hatırlatma koyar. Zaman, kaynak köken referansı ve oluşturan eylem (`Remind me` veya `Review Later`) kayıttadır. Yaşam `Planned` ile başlar. Oluşturma kaynak yaşamını, `Target date`’i, Yeniden görünme tarihini veya planlama üyeliğini yazmaz. Kaynaksız kuyruk yoktur.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Hatırlatma Hesap kapsamındadır; kaynak kimliği sahiplik değil köken referansıdır. Desteklenen türler PRD listesiyle kapalıdır.
- [ ] Yeni kayıt `Planned` açılır; `Cancelled` açık eylemle olur. Oluşturan eylem `Remind me` veya `Review Later` olarak saklanır. İngilizce UI `Remind me`, `Planned`, `Cancelled` kullanır; eksik etiket aynı değişiklikle terim sözlüğüne eklenir.
- [ ] Oluşturma ve iptal kaynak İş akışı durumunu, kapanış sonucunu, önceliği, aşamayı, Backlog/Kanban/Günlük Odak/Odak Dönemi üyeliğini, `Target date`’i ve Yeniden görünme tarihini değiştirmez.
- [ ] İş `Target date` vadesi kendiliğinden Hatırlatma açmaz; yaklaşan tarih için kurucu açıkça `Remind me` veya `Review Later` koyar.
- [ ] Kaynaksız standalone reminder veya tarihsiz Save for Later kuyruğu yoktur.
- [ ] Kabul kanıtı Personal Reminders seam’inde: tür listesi, Hesap kapsamı, kaynak yazmama karşıtı, kuyruk yokluğu. [kişisel bağlam](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğuna bağlanır.
