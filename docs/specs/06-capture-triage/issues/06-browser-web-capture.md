# 06 — Tarayıcı uzantısıyla Web Yakalama

**What to build:** Eşlenmiş WXT uzantısı kullanıcının açık eylemiyle URL, seçili metin, seçili görsel veya başlattığı ekran görüntüsünü Gelen Kutusuna idempotent gönderir. Eşleşmemiş istemci yazamaz. Beş dakikalık tek kullanımlık kodla eşlenir; cihaz/tarayıcı/son kullanım listelenir ve tek tek iptal edilir. Çevrimdışı gönderim kuyruğu yoktur. Safari ilk üründe yoktur; Chromium ailesi ve Firefox vardır. Doğrudan ana kayıt üretmez.

**Blocked by:** 01 — Hızlı yakalama ve Gelen Kutusu

**Status:** ready-for-agent

- [ ] Gönderim önizlemesi içerik, köken URL ve hedef Inbox gösterir; hedef yetkili Projeler arasında aranır, yalnız son açılanlarla sınırlı değildir; arka plan tarama ve geçmiş toplama yoktur.
- [ ] Eşleme kodu beş dakika, tek kullanımlık; eşleşmemiş istemci yazamaz; iptal finalize öncesi hiçbir öğe yazmaz; 30 gün kullanılmayan bağlantı yeniden yetkilendirme olmadan yazamaz.
- [ ] Eşleme anahtarı sayfa içeriğine, loga veya yakalama payload’ına enjekte edilmez; reddedilen geniş okuma izni yakalamayı sessizce genişletmez.
- [ ] Aynı anahtar ve parmak izi önceki sonucu döndürür; içerik değişmişse çatışma.
- [ ] Uzantı offline kuyruk tutmaz; Safari iddiası yoktur.
- [ ] Gönderim Kaynak kaydı, sayfanın canlı kopyası veya uzantı-yanı clip arşivi üretmez; öğe Gelen Kutusuna gider.
- [ ] Kabul kanıtı Capture Inbox seam'inde Chromium ve Firefox E2E, idempotency, eşleşmeme, kuyruk karşıtı. [Yakalama](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) uzantı paketi.
