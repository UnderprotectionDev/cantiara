# 02 — İsteğe bağlı hatırlatma formu açar, atlamak yazmaz

**What to build:** Kurucu Proje bazında düzenlenebilir refleksiyon sorusu ve tekrar aralığıyla isteğe bağlı `Create Project Update` hatırlatmasını açar, duraklatır veya kapatır. Zamanı gelince hatırlatma Birleşik Bildirim Merkezi'nden mevcut Manuel Proje Güncellemesi formunu açar. Atlamak güncelleme üretmez. Güncelleme yalnız form açıkça kaydedilince oluşur. Zorunlu cadence, salt zaman staleness, otomatik güncelleme ve AI taslağı yoktur. Yeni sinyal kimliği eklenmez; üretim `personal-reminder` kuralına aittir.

**Blocked by:** 01 — Tarihli öznel sağlık ve kaynak snapshot'ı

**Status:** ready-for-agent

- [ ] Proje bazında hatırlatma açılır, duraklatılır, kapatılır; soru ve aralık düzenlenir.
- [ ] Vadesi gelen hatırlatma mevcut formu açar; ayrı editör veya ikinci kayıt türü doğmaz.
- [ ] Atlamak sıfır Manuel Proje Güncellemesi yazar; yalnız açık kaydetme 01'deki kaydı üretir.
- [ ] Zorunlu cadence, salt zaman geçmesine dayalı staleness bildirimi, otomatik güncelleme ve AI taslağı yoktur.
- [ ] Yeni Dikkat sinyali kimliği registry'ye eklenmez; merkez sunumu 71'e, `personal-reminder` üretimi 35'e aittir.
- [ ] Kabul kanıtı aynı seam'de: hatırlatma formu açar, skip yazmaz, kaydet yazır, yeni sinyal kimliği yoktur.
