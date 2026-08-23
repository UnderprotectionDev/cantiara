# 02 — Kopya adayları, otomatik birleştirme yok

**What to build:** Aynı normalize e-posta güçlü kopya adayıdır; ad veya Company benzerliği zayıf öneridir. Sistem hiçbir koşulda otomatik birleştirme yapmaz. Bilinmeyen gönderen bu modülde Contact oluşturmaya zorlanmaz. Aday listesi birleştirme yazması değildir.

**Blocked by:** 01 — Contact ve Company ana kayıtları

**Status:** ready-for-agent

- [ ] Aynı normalize e-posta güçlü aday olarak görünür; birleştirme uygulanmaz.
- [ ] Ad veya Company benzerliği yalnız zayıf öneridir; güçlü aday gibi birleştirme çağrısı açmaz.
- [ ] Otomatik birleştirme yolu yoktur; aday onayı olmadan ilişki uçları yeniden yazılmaz.
- [ ] Company-to-Company birleştirme yoktur.
- [ ] Kabul kanıtı aynı seam'de: güçlü/zayıf aday ayrımı, otomatik birleştirme yokluğu, Company birleştirme yokluğu.
