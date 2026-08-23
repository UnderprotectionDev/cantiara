# 01 — Hızlı yakalama ve Gelen Kutusu

**What to build:** Kurucu serbest metin veya isteğe bağlı mini şablonla Yakalama Gelen Kutusuna yazar. Mini şablon alan zorunlu kılmaz ve ana kayıt oluşturmaz. Proje bilinmiyorsa Çalışma Alanı kutusuna, tür belirsizse Proje kutusuna gider. Proje ve tür kesinse `Create Bug` (veya eşdeğer) doğrudan İş oluşturma komutunu çağırır; Gelen Kutusu öğesi kalmaz. Öğeler arama/planlama/paylaşım/export’ta yoktur ve süreyle silinmez. Bağlantı kesilince kuyruk oluşmaz.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Serbest biçim ve `Bug Capture` / `Feedback Capture` / `Research Fragment` isteğe bağlı alanlarla Inbox’a yazar; ana kayıt oluşmaz.
- [ ] `Create Bug` (Proje+tür kesin) bir İş oluşturma komutu çağırır ve Inbox öğesi bırakmaz; İş anahtarı bu ticket’ta üretilmez.
- [ ] Geçici öğe arama, paylaşım, yayın, export ve Backlog’a girmez; zaman ilerletme silmez; Taslak veya kaydedilmiş bookmark da değildir.
- [ ] Online-only: son başarılı kayıt ve yazılmamış risk; uzantı/yerel kuyruk yok.
- [ ] İngilizce şablon ve alan etiketleri PRD terim sözlüğüne aynı değişiklikle eklenir.
- [ ] Kabul kanıtı Capture Inbox seam'inde şema, süre karşıtı, doğrudan oluşturma. [Yakalama](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
