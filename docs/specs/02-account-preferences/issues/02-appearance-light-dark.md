# 02 — Light/Dark görünüm ve iskelet tema düzeltmesi

**What to build:** Kurucu Hesap `Appearance` değerini `Light` veya `Dark` olarak kaydeder. Web ve macOS Tauri aynı Hesap değerini kullanır. İskeletteki cihaz-yerel tema anahtarı ve `System` seçeneği ürün tercihi olmaktan çıkar. Bitiriş efekti teması/paleti bu yüzeyde yoktur.

**Blocked by:** 01 — Locale, saat dilimi, tarih biçimi ve haftanın ilk günü

**Status:** ready-for-agent

- [ ] `Appearance` yalnız `Light` ve `Dark` kabul eder; Hesaba yazılır ve bütün Projelerde uygulanır.
- [ ] Kayıtlı değer web ve Tauri kabuğunda aynı görünümü üretir; OS-follow `System` Hesap değeri değildir.
- [ ] İskelet `localStorage` tema anahtarı kayıtlı Hesap görünümünün kaynağı değildir; header toggle bu kaydı okur/yazar.
- [ ] Bitiriş efekti etkinleştirme, tema ve palet kontrolü bu yüzeyde yoktur.
- [ ] `Appearance` tasarım tokenı, tema sistemi, Proje rengi veya white-label ürünü değildir; yalnız `Light`/`Dark` okunabilirlik tercihidir.
- [ ] İngilizce etiketler `Appearance`, `Light`, `Dark` PRD terim sözlüğüne aynı değişiklikle eklenir.
- [ ] Kabul kanıtı aynı Account Preferences seam'inde: Light, Dark, System'in Hesap değeri olmaması, cihaz anahtarının yok sayılması, Bitiriş efekti kontrolünün yokluğu. Yolculuk yine [İngilizce ürün dili](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) kalite matrisinin açık/koyu paketi.
