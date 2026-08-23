# 02 — Kaydedilmiş çapraz Proje listeleri

**What to build:** Kurucu Projeleri yaşam durumu, aşama, tarih, arşiv, desteklenen Proje alanları ve mevcut görünür koşullarla süzan adlandırılmış çapraz Proje listeleri kaydeder. Üyelik koşullardan canlı türetilir; sürükleyerek üye ekleme, Portfolio/Program kaydı veya Proje skoru yoktur. Görünüm kolon, sıralama ve gruplamayı saklayabilir. Son Manuel Proje Güncellemesi kullanılırsa tarihiyle `Last reported health` olur.

**Blocked by:** 01 — Genel bakış modülleri ve canlı bloklar

**Status:** ready-for-agent

- [ ] Adlandırılmış liste koşullardan canlı üyelik türetilir; koşul değişince üyelik değişir.
- [ ] Manuel sürükleme ile üye ekleme yoktur; Portfolio, Program, klasör veya üst Proje kaydı oluşmaz.
- [ ] Desteklenen kolonlar, sıralama ve gruplama saklanır; liste rapor doğruluk kaynağı değildir.
- [ ] Sağlık işareti varsa `Last reported health` tarihiyle gösterilir; güncel Project health alanı, otomatik hüküm veya tarihsiz rozet yoktur.
- [ ] Liste Akıllı Koleksiyonun Proje-içi hali değildir; yalnız Çalışma Alanı çapında Proje koşul listesidir.
- [ ] Exact-view CSV/PDF export bu ticket'ta yoktur; named view kimliği portability'nin sonra hedefleyeceği kadar kararlıdır.
- [ ] Kabul kanıtı Workspace Overview seam'inde: koşul üyeliği, sürükleme karşıtı, sağlık etiketi, Smart Collection ayrımı.
