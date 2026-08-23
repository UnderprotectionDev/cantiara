# 02 — Şema değişiklik taslağı ve yıkıcı önizleme

**What to build:** Kurucu aynı Veri Modeli Diyagramının iki kesin sürümünü seçer. Taslak kapalı operasyon kataloğu, PRD faz sırası ve yıkıcı uyarılarla schema-only listedir; metin diff'i veya ORM migrate değildir. Silme ve daraltma gizlenmez; onay olmadan artefakt kesinleşmez. Kullanıcı Up SQL'ini düzenleyebilir; generator vs kullanıcı farkı ayrıdır ve düzenlenmiş metin yeniden statik doğrulanır. Backfill ve keyfî veri SQL'i taslağa giremez. Katalogun ifade edemediği fark üretimi durdurur.

**Blocked by:** 01 — DDL üretimi ve Neon disposable doğrulama

**Status:** ready-for-agent

- [ ] Kaynak ve hedef sürümler taslakta değişmez pinlenir.
- [ ] Yıkıcı sınıf operasyonlar ekstra onay ister; gizlenmez.
- [ ] Desteklenmeyen fark (enum değeri kaldırma, serbest tip, view/function, veri SQL) adlandırılmış engeldir.
- [ ] Kullanıcı düzenlemesi veri SQL'i kaçırmaz; yeniden doğrulama 01 hattını kullanır.
- [ ] Kabul kanıtı aynı seam'de: katalog altınları, yıkıcı önizleme, yasak SQL karşıtı.
