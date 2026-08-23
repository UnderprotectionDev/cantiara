# 02 — Kayıtlı bağ adayları ve inceleme üstverisi

**What to build:** Adaylar yalnız Birincil spec bağı, kararlı bölüm referansı, satır içi referans, canlı içerik kullanımı, sürüme sabit kanıt ve diğer açık ilişkilerden türetilir. AI, anlamsal tahmin veya başlık/metin benzerliği aday eklemez. Belge düzeyinde bağlı kayıtlar `Document-level candidate` olarak işaretlenir ve belirli bir span'den etkilenmiş gibi sunulmaz. Her aday bu kesin sürüm çiftinde `Bekliyor` (`Waiting`), `Gözden geçirildi` (`Reviewed`) veya `Etkilenmedi` (`Not affected`) plus isteğe bağlı not taşır; dördüncü durum yoktur; hedef kaydın durumu, içeriği, önceliği, ilişkileri veya planlaması yazılmaz. Bu değerler İş/Geri Bildirim durumu değildir. Yeni spec sürümü önceki açık incelemeyi ezmez. Toplu “hepsi etkilendi” örtük yazılmaz.

**Blocked by:** 01 — Kesin spec sürüm farkı

**Status:** ready-for-agent

- [ ] Aday kümesi kayıtlı bağ kapanışına eşittir; benzerlik/AI yolu yoktur.
- [ ] Belge düzeyi aday belirli metin değişikliğine yorulmaz.
- [ ] Her aday bu sürüm çiftinde tam olarak `Bekliyor` (`Waiting`), `Gözden geçirildi` (`Reviewed`) veya `Etkilenmedi` (`Not affected`) taşır; dördüncü durum yoktur.
- [ ] Üstveri hedef İş/plan/sürümü yazmaz; Geri Bildirim `İncelendi` veya İş akışı durumu değildir; yeni sürüm önceki çifti ezmez.
- [ ] Toplu örtük yazma yoktur.
- [ ] Kabul kanıtı aynı seam'de: bağ kapanışı, üç durum kataloğu (`Bekliyor`/`Gözden geçirildi`/`Etkilenmedi`), benzerlik karşıtı, üstveri yalıtımı, önceki çiftin korunması.
