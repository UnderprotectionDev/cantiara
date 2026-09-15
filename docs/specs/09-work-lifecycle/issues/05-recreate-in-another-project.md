# 05 — Başka Projede yeniden oluşturma

**What to build:** Yanlış Projedeki İş için `Recreate in another Project` hedefte yeni kimlikli ve yeni anahtarlı İş üretir. Kaynak durur ve değişmez. Kurucu taşınabilir alanları ve taşınabilir ilişkileri tek tek seçer; sahiplik veya yaşam döngüsü bağları gitmez. Eski anahtar yeni İşe yönlenmez. Bu taşıma, kapsam değiştirme veya kimliği koruyan kopya değildir.

**Blocked by:** 01 — İş oluşturma, tür ve değişmez anahtar

**Status:** ready-for-agent

- [ ] Önizleme hedef Proje, taşınabilir içerik ve her ilişkiyi gösterir; onay yeni İş + köken bağı yazar. Yeni İş yeni kimlik, yeni anahtar ve hedef Projenin varsayılan başlangıç durumuyla açılır (`Not Started` semantiği). Tür, başlık, açıklama ve hafif kontrol listesi varsayılan taşınabilir alandır; kurucu tek tek seçer.
- [ ] Kaynak İş yerinde kalır (durum, tür, kapanış sonucu değişmez); eski anahtar yeni İşe alias olmaz.
- [ ] Taşınamaz: GitHub tamamlanma bağı, otomasyon, planlama üyeliği, yayın, ebeveynlik, kopya-birleştirme durumu, kaynak geçmişi, kapanış sonucu, mevcut durum, tarih türündeki özel alan değerleri ve diğer mutlak tarihler.
- [ ] İngilizce `Recreate in another Project` terim tablosuna aynı değişiklikle eklenir.
- [ ] Kabul kanıtı Work Lifecycle seam'inde yeni kimlik, kaynak değişmezliği, taşınamaz bağ karşıtı. İş yaşam döngüsü düzeltme paketi.
