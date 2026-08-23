# 03 — Değişiklikleri görsel olarak gez

**What to build:** Proje Duvarı, Kullanıcı Akışı, Ekran Wireframe’i, Moodboard veya Roadmap hedefi bulunan desteklenen olaylarda kurucu `Tour the visual changes` başlatır. Tur yalnız aynı `Since you last looked` kümesini kullanır. Kayıp hedef sessizce başka nesneye kaymaz. Kapanışta başlangıç viewport’u hâlâ anlamlıysa geri yüklenir; canvas oturum kalıcılığı tuval feature’ında kalır.

**Blocked by:** 02 — Son baktığından beri

**Status:** ready-for-agent

- [ ] Tur açık eylemle başlar ve yalnız 02’deki olay kümesinin desteklenen görsel hedeflerini sırayla kullanır; zaman ve gösterilme nedeni açıklanır.
- [ ] Roadmap turu yeni roadmap geçmişi, audit, snapshot veya önem skoru üretmez; mevcut olayın kesin İş veya Kilometre Taşı hedefini güncel görünümde çözümler.
- [ ] Silinmiş, erişilemeyen veya konumlandırılamayan hedef atlanır ve nedeni gösterilir; başka nesneye sessiz yönelme yoktur.
- [ ] Tur her an kapanır. Başlangıç viewport’u güvenle çözümleniyorsa geri yüklenir, aksi halde görünür içeriğe sığar. Oturumlar arası viewport sahipliği bu ticket’ta kopyalanmaz.
- [ ] Büyük kümelerde açıklanabilir üst sınır ve kalanı normal listede açma vardır. Tur kayıt, kalıcı rota veya ikinci liste üretmez.
- [ ] Kabul kanıtı aynı seam’de canvas viewport API double ile: sıra, atlama, kapanış geri yükleme, cap. Filtre/scroll hâlâ geri yüklenmez.
