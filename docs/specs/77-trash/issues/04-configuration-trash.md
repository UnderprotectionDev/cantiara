# 04 — Yapılandırma çöpü

**What to build:** Proje bazlı özel alan, öncelik ölçütü, Akıllı Koleksiyon, adlandırılmış görünüm, Önceliklendirme oturumu, otomasyon kuralı, kullanıcı tanımlı kayıt eylemi, belge şablonu ve iş öğesi şablonu aynı 30 günlük kuralla Yapılandırma çöpüne alınır. Çöpteki tanım etkin çalışmaz. Silme önizlemesi etkilenecek değerleri ve bağımlı görünüm veya kuralı gösterir. Geri yükleme aynı iç kimliği, tanımı, saklanan değerleri ve çözülebilen bağımlılıkları getirir; anlamı değişen bağımlılık sessizce yeni kimlik üretmez veya başka hedefe bağlanmaz.

**Blocked by:** 01 — Desteklenen kaydı Çöp Kutusuna alma ve 30 günlük kimlik; 03 — Geri yükleme, Proje silme grubu tek süre ve süre sonu

**Status:** ready-for-agent

- [ ] Desteklenen yapılandırma varlıkları `Trash`'e alınır ve 01/03'teki 30 gün, restore ve süre sonu kurallarını paylaşır.
- [ ] Çöpteki tanım çalışmaz: otomasyon tetiklenmez, görünüm/koleksiyon üyelik üretmez, şablon seçilemez.
- [ ] Silme önizlemesi etkilenecek kayıt değerlerini ve bağımlı görünüm, kural veya referansları gösterir.
- [ ] Restore aynı iç kimliği getirir; kalıcı silinmiş veya anlamı değişmiş bağımlılık çatışma önizlemesi ister, sessiz yeniden bağlama veya yeni kimlik yoktur.
- [ ] Yapılandırma çöpü kayıt Arşivi veya restore-point değildir.
- [ ] Kabul kanıtı Trash seam'inde tanımın durması, önizleme, aynı kimlikle restore, sessiz yeniden bağlama karşıtı.
