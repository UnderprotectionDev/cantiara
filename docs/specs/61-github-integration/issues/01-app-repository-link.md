# 01 — GitHub App ile Repository bağlantısı

**What to build:** Kurucu GitHub App installation'ı ve seçili repository'leri Proje kapsamına kararlı GitHub kimliğiyle bağlar. Login OAuth kimliktir, App yetkisi değildir. İzinler PRD salt okunur kümesidir; Contents yalnız allow-list endpoint'ler. İlk bağlanışta atlanabilir toplu triage Issue'ları sessizce İşe çevirmez. Bağ Çalışma Alanı veya Hesap kapsamı değildir; Proje repository'den geniştir. App kaldırma oturumu öldürmez; login revoke installation'ı silmez.

**Blocked by:** None — can start immediately. Hesap oturumu Account Access fixture'ıdır; bu ticket login rotası açmaz.

**Status:** ready-for-agent

- [ ] Kararlı repository kimliği bağ kimliğidir; ad/sahip değişimi yeni bağ değildir.
- [ ] App izinleri yazma içermez; Contents yalnız allow-list sürümlü uçlar ve gerekçesi kurucuya gösterilir (ADR-0006); tree/blob/diff/full log çağrıları karşıt testle yasak.
- [ ] İlk triage onaysız İş yazmaz; atlanırsa kayıtlar GitHub dış kaydı olarak aranır.
- [ ] Login revoke ≠ uninstall; uninstall ≠ session kill. Giriş, oturum ve `Confirm GitHub Identity` 01'de kalır; bu ticket login rotası açmaz.
- [ ] İngilizce `Repository` / `GitHub App` / `Reconnect` / `Disconnect`.
- [ ] Kabul kanıtı GitHub Integration seam'inde App double ile: bağ, izin listesi, triage, login/App bağımsızlık. Erişilebilirlik **GitHub bağlantı ve durum**.
