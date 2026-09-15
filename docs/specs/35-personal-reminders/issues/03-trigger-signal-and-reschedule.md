# 03 — Tetik, sinyal ve yeniden zamanlama

**What to build:** Zamanı gelen `Planned` Hatırlatma koşulu sağlanınca `Triggered` olur ve tek dikkat sinyali üretir: `Remind me` → `personal-reminder`, `Review Later` (ve `Reassess impact`) → `review-later`; aynı ateşte ikisi birden yoktur. Kaynak kaydı açar. İş `Target date` vadesi bu seam’den `due-date` veya Hatırlatma satırı üretmez ve alanı yazmaz. `Only if still open` kaynak artık açık değilse sinyal basmaz, geçmiş nedeni gösterir. Kaynak yaşamı çözülemezse sessiz bastırma yoktur. Kapatma veya yeni zaman İş veya kopya üretmez. Arşivli Proje ateşlemez. Bildirim Merkezi UI’si bu ticket’ta yoktur.

**Blocked by:** 02 — Review Later, Belge bölümü ve açık kalma koşulu

**Status:** ready-for-agent

- [x] Ateşlemede koşul bir kez değerlendirilir; başarı `Triggered` ve tam olarak bir Hatırlatma sinyal kimliği üretir: `Remind me` → `personal-reminder`, `Review Later` → `review-later`. Merkez sunumu 71’dedir.
- [x] `Only if still open` başarısızsa sinyal yoktur ve hatırlatma geçmişi kaynak yaşamı ile nedeni gösterir.
- [x] Çözülemeyen kaynak yaşamı “koşul değerlendirilemedi” kaynak bağlı sinyal üretir; satır sessizce düşmez.
- [x] Sinyali kapatmak veya yeni zaman seçmek yeni İş, içerik kopyası veya planlama üyeliği yazmaz; kaynak durumu değişmez.
- [x] Vadesi gelen İş `Target date` bu seam’den Hatırlatma satırı veya `due-date` üretmez; alanı yazılmaz. `reappear-date` bu ticket’ta yoktur.
- [x] Arşivli Projedeki kayda ateşleme durur. Silinmiş kaynak kırık referans sunar, içerik dirilmez.
- [x] Kabul kanıtı aynı seam’de saat/scheduler double ile: ateşleme, id ayrımı, `due-date` yokluğu, bastırma+gerekçe, çözülememe, arşiv, yeniden zamanlama, kaynak yazmama. Kabuk 72 zamanı gelen öğeyi açar; üyelik burada kalır.
