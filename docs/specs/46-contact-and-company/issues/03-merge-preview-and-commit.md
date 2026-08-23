# 03 — Birleştirme önizlemesi ve atomik konsolidasyon

**What to build:** Kullanıcı ana Contact'ı seçer; çatışan alanlar, e-posta takma değerleri, Geri Bildirim geçmişi, Company ve Persona ilişkileri önizlenir. Onay tek hayatta kalan ana kayıtta atomik konsolide eder. Emekli kimlik içeriksiz yönlendirmedir; arama sonucu veya yeniden kullanılan anahtar değildir. Birleştirme Kanıt Rolü, kullanıcı yorumu, Kanıt niteliği veya öncelik ölçütü yazmaz. İlişkili Geri Bildirimler kaybolmaz.

**Blocked by:** 02 — Kopya adayları, otomatik birleştirme yok

**Status:** ready-for-agent

- [ ] Önizleme hayatta kalanı, alan çatışmalarını, takma değerleri, Geri Bildirim geçmişini, Company ve Persona bağlarını gösterir; onaydan önce yazma yoktur.
- [ ] Onay atomiktir; kopyalar canlı `Merged` kayıt olarak yaşamaz; emekli kimlik eski bağlantıyı görünür kökenle çözer ve arama sonucu olmaz.
- [ ] Birleştirme Kanıt Rolü, Kanıt niteliği, kullanıcı yorumu veya İş öncelik ölçütü değerini yazmaz.
- [ ] İlişkili Geri Bildirimler hayatta kalan kimlikten açılır.
- [ ] Denetim kaydı takma kimlik, olay türü, zaman ve aktör taşır; ham e-posta loga girmez.
- [ ] Kabul kanıtı aynı seam'de: önizleme, atomik onay, rol/öncelik karşıtı, Geri Bildirim kaybı karşıtı, emekli kimliğin arama dışı yönlendirmesi.
