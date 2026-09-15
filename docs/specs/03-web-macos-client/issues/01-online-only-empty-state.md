# 01 — Online-only boş durum ve kuyruksuz yazma

**What to build:** Belge okuma, kayıt oluşturma ve planlama değişikliği aktif bağlantı ister. Bağlantı kesilince kurucu son başarılı kayıt zamanını ve yazılmamış değişiklik riskini görür; yerel kuyruk, offline cache veya otomatik eşitleme oluşmaz. Yeniden bağlanma bekleyen yazmayı gizlice tamamlamaz.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Bağlantı yokken durum değiştiren yazma uygulanmaz; kuyruk satırı veya cihaz-yerel DB oluşmaz.
- [ ] Boş durum `You’re offline`, `Last saved` ve `Unsaved changes may be lost` gösterir; zaman Hesap locale/dilimiyle biçimlenir (tercih şeması 02’dedir).
- [ ] Yeniden bağlanma gizli replay yapmaz; kurucu açıkça yeniden kaydeder.
- [ ] Web ve Tauri aynı kuralı kullanır; masaüstü ikinci doğruluk kaynağı veya proje klasörü açmaz ([ADR-0021](../../../adr/0021-icerigi-yalniz-veritabaninda-tut.md)).
- [ ] Kabuk oturumu barındırır; GitHub ile giriş, oturum çerezi/Stronghold politikası ve `Confirm GitHub Identity` workflow 01’de kalır.
- [ ] Kabul kanıtı Client Shell seam'inde: kesilme, kuyruk yokluğu, reconnect karşıtı, web–Tauri aynı davranış. [Platform kabulü](../../../prd/16-product-acceptance.md#platform-kabulu) online-only maddesi.
