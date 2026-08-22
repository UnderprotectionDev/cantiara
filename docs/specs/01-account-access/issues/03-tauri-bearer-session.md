# 03 — Tauri tek kullanımlık kod ve bearer oturumu

**What to build:** macOS Tauri, GitHub girişini sistem tarayıcısında açar. Deep link yalnız tek kullanımlık, kısa ömürlü kod taşır. Backend bu kodu iptal edilebilir Better Auth bearer oturum token'ına çevirir; token Stronghold'da saklanır. Kabuk, web'den ayrı oturum politikası üretmez: aynı 12 saat / 30 gün, aynı liste ve iptal. İmza, notarization, updater ve online-only boş durum bu ticket'ta yoktur.

**Blocked by:** 01 — GitHub ile giriş, Hesap ve tek Çalışma Alanı; 02 — Oturum listesi, iptal ve süre

**Status:** ready-for-agent

- [ ] Sistem tarayıcısındaki GitHub girişinden sonra deep link yalnız tek kullanımlık kısa ömürlü kod taşır; oturum veya GitHub token'ı URL'de yoktur.
- [ ] Backend kodu iptal edilebilir bearer oturum token'ına çevirir; kod yeniden kullanılamaz ve kısa ömürlüdür.
- [ ] Bearer oturumu Stronghold'da saklanır ve 02'deki `Sessions` listesinde cihaz/son etkinlikle görünür; iptal yazmayı durdurur.
- [ ] Tauri oturumu web ile aynı hareketsizlik ve mutlak süre kurallarını kullanır; kabuk farkı ayrı politika açmaz.
- [ ] Kabul kanıtı Account Access seam'inde kod değişimi, tekrar kullanım reddi, URL'de token yokluğu ve listenin/iptalin bearer oturumuna uygulanmasıdır. Paket imzası ve updater ayrı feature'dadır.
