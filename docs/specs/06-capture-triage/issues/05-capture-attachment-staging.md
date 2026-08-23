# 05 — Yakalama eki staging

**What to build:** Yakalama eki yalnız öğeye ait şifreli staging nesnesidir; Dosya Eki değildir. Arama, paylaşım, yayın ve export dışındadır. Dönüşümde hedef kapsam gösterilir; Dosya Eki yaşamı File Attachment feature’ının atomik kesinleştirmesine bırakılır; başarısızlık görünür ek bırakmaz. Yakalama silinince staging silinir.

**Blocked by:** 01 — Hızlı yakalama ve Gelen Kutusu; 02 — Üç triage çıkışı

**Status:** ready-for-agent

- [ ] Staging nesnesi Inbox öğesine aittir; arama/paylaşım/yayın/export’ta yoktur.
- [ ] Dönüşüm hedef kapsamı gösterir ve Dosya Eki finalize’ını o feature’a bırakır; başarısızlıkta görünür ek kalmaz.
- [ ] Inbox silme staging nesnesini siler; paylaşılan medya kütüphanesi yoktur.
- [ ] Kabul kanıtı Capture Inbox seam'inde staging gizliliği, silme, finalize başarısızlığı karşıtı. Dosya Eki sürümleri bu ticket’ta yoktur.
