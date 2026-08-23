# 02 — Maddeyi önizlemeyle bağımsız İşe dönüştür

**What to build:** Kurucu `Convert to independent Work` ile maddeyi açık önizlemeden sonra aynı Projede tam İşe dönüştürür. Eski madde yeni İşe giden bağlantıyla değişir; kaynak İşle köken ilişkisi ve `Origin Location` korunur. İlişki üst/alt iş hiyerarşisi değildir. Kutuyu işaretlemek dönüşüm başlatmaz. Dönüşüm atomiktir.

**Blocked by:** 01 — Hafif kontrol listesi maddeleri

**Status:** ready-for-agent

- [ ] Önizleme yeni İşin başlığını, Projesini ve başlangıç durumunu gösterir; başlangıç durumu hedef Projenin varsayılanı olan `Not Started` semantiğidir; onay olmadan yazma yoktur.
- [ ] Onay aynı Projede tam İş oluşturur; eski madde yinelenen ilerleme üretmemek için yeni İş bağlantısıyla değişir.
- [ ] `Kökeni` kaynak İşi gösterir; `Origin Location` sahip İş, bileşen kimliği ve kesin kaynak sürümünü taşır. Madde bağımsız ilişki ucu veya arama sonucu olmaz.
- [ ] İlişki parent/child veya subtask hiyerarşisi açmaz.
- [ ] Tamamlanma işareti dönüşüm başlatmaz. Dönüşüm isteğe bağlıdır.
- [ ] Yeni İş ve madde değişimi tek idempotent komutta birlikte commit veya rollback olur.
- [ ] Kabul kanıtı Work Checklists seam'inde: önizleme, köken, hiyerarşi karşıtı, otomatik dönüşüm yokluğu, atomiklik.
