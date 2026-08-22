# 02 — Oturum listesi, iptal ve süre

**What to build:** Kurucu Hesap kapsamındaki aktif oturumları cihaz ve son etkinlikle görür; birini veya diğer bütün oturumları iptal eder. İptal edilen oturum yazamaz. Web oturumu 12 saat hareketsizlik veya oluşturulduktan 30 gün sonra biter. Çerezle kimlik doğrulanan durum değiştiren istekler CSRF koruması kullanır. İptal, Denetim kaydı ve geri döndürülemez güvenlik olay günlüğüne secret'siz yazılır; replay, restore edilmiş canlı oturum satırını yeniden yetkisiz bırakır.

**Blocked by:** 01 — GitHub ile giriş, Hesap ve tek Çalışma Alanı

**Status:** ready-for-agent

- [ ] Kurucu `Sessions` listesinde cihaz ve son etkinliği görür; `Revoke Session` ve `Revoke Other Sessions` çalışır.
- [ ] İptal edilen oturum korumalı yazmayı fail-closed reddeder; geçerli oturum aynı Hesap/Çalışma Alanında yazmaya devam eder.
- [ ] Süre 12 saat hareketsizlik veya oluşturulma + 30 gündür; süre uzatma GitHub kesintisine bağlı değildir (kesinti davranışı 04'tedir).
- [ ] Çerez oturumundaki durum değiştiren istekler CSRF olmadan uygulanmaz.
- [ ] Oturum token'ı Secret'tır; arama, export veya loga girmez. Denetim kaydı takma kimlik, olay türü, zaman ve aktör taşır.
- [ ] İptal, birincil restore biriminde yaşamayan append/replay arayüzüne secret'siz olay yazar; replay testi restore edilmiş hâlâ canlı oturum satırının yetkisiz kaldığını gösterir. Operatör yedek RPO/RTO'su bu ticket'ta yoktur.
- [ ] Kabul kanıtı aynı Account Access seam'inde: liste, tek iptal, diğerlerini iptal, CSRF karşıtı, süre dolumu, replay. Erişilebilirlik yolculuğu **Giriş ve oturum** bu yüzeyden yürür.
