# 03 — Beş dakikalık sunum kümesi

**What to build:** Aynı aktörün aynı ana kayıtta beş dakika içinde yaptığı güvenli alan değişiklikleri Proje Etkinliği'nde ve o kaydın kendi Kayıt geçmişi görünümünde açılabilir tek sunum kümesinde durur. Küme açılınca her atomik olay, zaman, önceki–sonraki değer, köken ve geri alma sınırı ayrı görünür. İnsan, otomasyon ve GitHub değişiklikleri birbirine karışmaz. Yorum, güvenlik olayı, yayın ve önemli yaşam döngüsü değişikliği sıradan alan düzenlemesi içinde gizlenmez. Gruplama Denetim kaydını veya Güvenli geri alma sınırını birleştirmez.

**Blocked by:** 02 — Proje Etkinliği, filtre ve önceki–sonraki değer

**Status:** ready-for-agent

- [ ] Aynı aktör + aynı ana kayıt + beş dakika içindeki güvenli alan değişiklikleri Proje Etkinliği'nde ve o kaydın Kayıt geçmişi görünümünde tek açılır sunum kümesi olur.
- [ ] Açılan küme her atomik olayı, zamanı, önceki–sonraki değeri, kökeni ve geri alma sınırını ayrı gösterir.
- [ ] İnsan, otomasyon ve GitHub satırları aynı kümede birleşmez.
- [ ] Yorum, güvenlik olayı, yayın ve önemli yaşam döngüsü değişikliği sıradan alan kümesinin içinde gizlenmez.
- [ ] Küme Denetim kaydı olaylarını veya Güvenli geri alma sınırlarını tek olay gibi yazmaz.
- [ ] Kabul kanıtı aynı Project History seam'inde: küme, açılım, aktör karışmama, gizli-olay karşıtı. 01'deki hikâye yüzeyi bu kümeyi hikâye olayı saymaz.
