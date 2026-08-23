# 03 — Önceliklendirme Oturumu

**What to build:** `Create Prioritization Session` Proje kapsamlı, adlandırılmış bir karar görünümü açar. Seçili İş kapsamı ve görünüm-yerel manuel sıra saklanır; Backlog sırası, ölçüt değerleri, roadmap ufku, durum veya başka görünüm sırası yazılmaz. Oturum kapanınca kapsam ve son sıra tarihli salt okunur kalır; yeni oturum eskisini silmez. Oturum Günlük Odak veya Odak Dönemi değildir.

**Blocked by:** 01 — Proje öncelik ölçütleri

**Status:** ready-for-agent

- [ ] Yalnız açık oluşturma eylemi oturum açar; normal Liste/Kanban/Akıllı Koleksiyon/Roadmap bağımsız manuel rank taşımaz.
- [ ] Kartlar başlık, ölçüt değerleri, hedef tarihi, Risk ve kanıt sayılarını canlı İşten gösterir.
- [ ] Yeniden sıralama yalnız oturum sırasını günceller; kapsama ekleme/çıkarma durum veya Backlog üyeliği yazmaz.
- [ ] Oturum sırası ile Backlog sırası yan yana karşılaştırılabilir; örtük eşitleme yoktur.
- [ ] Kapanış tarihli salt okunur bağlam korur; arşiv/silme İş ve Backlog sırasını etkilemez.
- [ ] Oturum skoru, otomatik kazanan, Karar kaydı veya ikinci öncelik gerçeği yoktur.
- [ ] Oturum Günlük Odak, Odak Dönemi veya değerlendirme çalışma penceresi değildir; kapanış tarihsel yerel bağlamdır, çalışma taahhüdü değildir.
- [ ] Kabul kanıtı Prioritization seam'inde: session rank ≠ Backlog, kapanışın tarihi koruması, eşitleme karşıtı. Kanıt [günlük planlama](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculüğünün planlama-üyeliği ayrımıdır; oturum sırası Backlog sırası, Kanban durumu, Günlük Odak veya Odak Dönemi yazmaz.
