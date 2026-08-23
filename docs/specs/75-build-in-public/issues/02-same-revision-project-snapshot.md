# 02 — Aynı revizyondan Roadmap, changelog ve Proje görünümü

**What to build:** Onaylı snapshot Roadmap, değişiklik günlüğü ve herkese açık Proje görünümünü aynı revizyondan sunar; üçü farklı revizyona kaymaz. Proje görünümü yalnız o revizyondan onaylı Roadmap, İş, Belge, tasarım, Karar ve seçilmiş Proje Duvarı snapshot üyelerini gösterir. Duvar kart, kesin Dosya Eki sürümü, yerleşim ve canlı koleksiyon bloğunu ayrı onay öğesi olarak listeler; canlı blok tarih etiketli donar. Varsayılan kapalı öne çıkarma en fazla bir onaylı public Proje Sürümü veya Kararı sınırlı süre üstte tutar; özel veri yayımlamaz ve sinyal üretmez. Kaynak değişiklikleri `Unpublished changes` olarak durur ve yeni onay olmadan public olmaz. Ziyaretçi palet/arama/yazma yapamaz. Kurucu kendi public görünümünde yalnız kendine `Open source record` ve `Review publish diff` görür. Varsayılan `noindex`. YouTube onaylandıysa tıklayınca yüklenir. Görüntülenme sayacı yoktur. Ziyaretçi kullanılabilir ilk içerik p95 ≤ 2,5 sn / p99 ≤ 4 sn (küçük ve adversarial snapshot; masaüstü laboratuvar ve mobil Safari/Chrome). Her HTML/asset isteği cache'den önce yüzeyi doğrular.

**Blocked by:** 01 — Yayın önizlemesi, public durum eşlemesi ve yer tutucu

**Status:** ready-for-agent

- [ ] Roadmap, changelog ve Proje görünümü aynı Onaylı snapshot revizyonundandır; kaynak yazması `Unpublished changes` olur, onaysız yayımlanmaz.
- [ ] Proje görünümü yalnız o revizyonun onaylı Roadmap, İş, Belge, tasarım, Karar ve seçilmiş Proje Duvarı üyelerini gösterir; canlı Workspace sorgusu çalışmaz.
- [ ] Seçilen Duvar kart/alan/yerleşim/kesin Dosya Eki sürümünü ayrı onay öğesi olarak listeler; onaysız öğe yapı sızdırmaz; canlı koleksiyon bloğu tarih etiketli salt okunur snapshot olur.
- [ ] Öne çıkarma varsayılan kapalıdır; aynı anda en fazla bir onaylı public Proje Sürümü veya Karar; süre bitince kronolojik konuma döner; özel alan yayımlamaz ve Dikkat sinyali üretmez.
- [ ] Public tarih sunumu `Full date` / `Month` / `Quarter` / `Hidden` iç tarihten türetilir; ikinci public tarih alanı yoktur.
- [ ] Görüntülenme sayacı, son erişim, ziyaretçi kimliği ve analitik yoktur.
- [ ] Ziyaretçi ilk içerik bütçesi PRD 15 satırlarını karşılar; yayın isteği kabul bütçesi bu ölçümle karışmaz; cache yetkiyi atlamaz.
- [ ] Unpublish HTML/asset/range'i fail-closed gövdesiz `410 Gone` + `noindex` ile reddeder; URL yeniden kullanılmaz; yeni yüzeye veya özel içeriğe redirect yoktur; ziyaretçi yönetim kontrollerini görmez.
- [ ] Varsayılan `noindex` ve sitemap dışı; indeksleme açık eylem ve üçüncü taraf kopya uyarısı ister; üstveri varlığı indeksi kendiliğinden açmaz.
- [ ] Slug Çalışma Alanında benzersizdir; slug değişimi uygulanmadan redirect önizlenir; unpublish redirect'i öldürür ve özel içeriğe yönlendirmez.
- [ ] Herkese açık Proje / Roadmap indeksi / changelog indeksi kendi yayın başlığı ve özetini taşır; alanlar yüzeyler arasında miras olmaz.
- [ ] Oturum açmış sahip kendi public görünümünde yalnız kendine `Open source record` ve `Review publish diff` görür; ziyaretçi bu kontrolleri görmez.
- [ ] Onaylı YouTube kartı tıklayınca `Live external source` ile yüklenir; sayfa açılışında üçüncü taraf isteği yoktur.
- [ ] Kabul kanıtı aynı seam'de: revizyon birliği, fark, sayaç yokluğu, ilk içerik ölçümü, eski oturum, asset/range. Yolculuk asgari kanıtıdır.
