# 03 — `work-blocked` sinyali ve bağımlılık türetme sözleşmesi

**What to build:** `Blokaj` dikkat sinyali yalnız iki olayda üretilir: engellenen İşe yeni `Active` ilişki ve çözülmüş ilişkinin yeniden `Active` yapılması. Sinyal engellenen İşi, kaynağı ve zamanı taşır; kayıtlı kimlik `work-blocked` / `Needs Action`. Süre, kaynak durumu, döngü veya `Resolved` geçişi sinyal basmaz. Bildirim merkezi inşa edilmez. Özellik ve Odak Dönemi için salt-okunur `Dependencies` türetme sözleşmesi mevcut ilişkilerden okunur; görünüm bu ticket'ta yoktur.

**Blocked by:** 01 — Aktif engelleme ilişkisi; 02 — Çözüm, yeniden etkinleştirme ve kaynak kapanışı

**Status:** ready-for-agent

- [ ] Yeni `Active` kurulum `work-blocked` üretir; Resolved→Active yeniden üretir.
- [ ] Süre, kaynak durumu değişimi, döngü tespiti ve `Resolved` geçişi sinyal üretmez.
- [ ] Sinyal kimliği kayıtlıdır; kayıtsız id yoktur. Merkez UI'si 71'dedir.
- [ ] Tüketici salt-okunur projeksiyon mevcut Active/Resolved ilişkileri, yönü ve güvenle saptanan döngüyü okur; yeni ilişki, Mermaid kaynağı veya manuel düğüm konumu yazmaz. Feature/Focus Period görünümü burada teslim edilmez.
- [ ] Workspace-geneli düzenlenebilir grafik, kritik yol ve otomatik yeniden zamanlama yoktur.
- [ ] Kabul kanıtı Work Blockers seam'inde sinyal matrisi ve türetme sözleşmesi; merkezde görünme 71'in karşılığıdır.
