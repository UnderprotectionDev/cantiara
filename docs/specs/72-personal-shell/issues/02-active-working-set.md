# 02 — Oturumluk Aktif Çalışma Seti ve recent-context yokluğu

**What to build:** Kurucu üzerinde durduğu İş ve Belgeleri kaynak görünüm bağlamını kaybetmeden `Active Working Set`'e alır ve tek eylemle yeniden açar. Üyelik yalnız açık uygulama oturumunda yaşar; oturum bitince geri yüklenmez. Set Favori, Günlük Odak, bookmark, planlama üyeliği veya ana kayıt değildir; kaynak kaydı ve planlama yüzeylerini değiştirmez. Kaydedilmemiş düzenleme için ayrı dayanıklılık değildir. Set paylaşılmaz ve Dış yüzey üretmez. Canvas viewport bu ticket'ta yoktur.

**Blocked by:** 01 — Kabuk dört kişisel yüzeyi konum kaybetmeden açar

**Status:** ready-for-agent

- [ ] Set'e ekleme/çıkarma kaynak İş/Belge ve planlama üyeliğini yazmaz; tek eylemle yeniden açma kaynak bağlamını korur.
- [ ] Oturum sona erince set boştur; sonraki oturum restore etmez.
- [ ] Set paylaşılmaz, Dış yüzey üretmez, sıralama/tarih/bildirim semantiği taşımaz.
- [ ] Kaydedilmemiş düzenleme kendi Taslak/autosave sözleşmesinde kalır; set ikinci dayanıklılık yolu değildir.
- [ ] Aktif Çalışma Seti oturum bitince geri yüklenmez. Panel/scroll/kaynak konumunun oturumlar arası restore yasağı 01’dedir; bu ticket set üyeliğini kanıtlar.
- [ ] Proje Duvarı / Kullanıcı Akışı / Wireframe / Moodboard / Teknik Diyagram viewport API'si bu ticket'ta yazılmaz.
- [ ] Kabul kanıtı aynı seam'de: set yaşamı, oturum sonu, set restore karşıtı, canvas-yazmama. Panel restore karşıtı 01’dedir. Yolculuğun oturum kapatma/açma E2E dilimidir.
