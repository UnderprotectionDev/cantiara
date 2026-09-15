# 01 — Kapalı dünya önizlemesi, yer tutucu ve onaylı snapshot

**What to build:** Kurucu seçili kaydı paylaşmadan önce kesin kayıt, sürüm, alan, gömü ve Dosya Eklerini kapalı dünya olarak görür ve onaylar. Onaysız bağlantı üretilmez. Onay Dış yüzey ile değişmez Onaylı snapshot revizyonu ayırır; sonraki kaynak değişiklikleri yeni onay olmadan dışarı akmaz. Secret, paylaşım token'ı ve bağlantı parolası kapsama girmez. Çözülmemiş `{{alan_adı}}` yer tutucuları kaynak kayıt, alan ve metin bağlamıyla listelenir; kod içi eşleşme uyarı üretmez; kurucu çözer veya ayrı `Publish/share anyway` verir. Canlı alanlar yalnız izin listesinden ayrıca `Live` işaretlenirse güncel kalır; karma yüzey `Some fields live` olur, yanıltıcı genel `Current` kullanılmaz.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Paylaşım kökü kurucunun seçtiği ana kayıtlardır: Document, Roadmap, Screen, Project Wall, Moodboard, Technical Diagram, Smart Collection, veya tekil Work, Decision, Risk, Feedback, Production Incident, Milestone, Project Release. Klasör/ilişki/görünüm kalıtımı kapsama eklemez; dolaylı sızıntı (ad, sayaç, boşluk) yoktur.
- [ ] Live allowlist: kullanıcıya dönük durum ve kapanış sonucu, öncelik, planlanan başlangıç/hedef/yeniden görünme tarihi, Roadmap ufku, Milestone durumu, Project Release durumu, kaynağı açılabilir sayısal veya tarihsel özet. Live değil: title, description, Markdown, yorum, ilişki gerekçesi, Contact/Company, URL, Dosya Eki, yeni ek sürümü, secret, özel alan.
- [ ] Ekran kesin Wireframe sürümü, ürün-owned diyagram kesin Diyagram Sürümü+Görünüm, dış bağlantı diyagramı köken snapshot'ı ister; iframe açılmaz. Proje Duvarı ve Moodboard kart, kesin Dosya Eki sürümü, yerleşim ve canlı koleksiyon bloğunu ayrı onay öğesi olarak listeler.
- [ ] Onay yeni Onaylı snapshot revizyonu üretir; Dış yüzey yalnız bu revizyonu gösterir; sonraki kaynak yazması sessiz yayımlanmaz.
- [ ] Secret, token ve parola manifestte yoktur; serbest metin secret taraması iddia edilmez.
- [ ] `{{alan_adı}}` kaynak kayıt, alan ve metin bağlamıyla listelenir; kod eşleşmesi yoksayılır; kapsam onayı bu uyarıyı tüketmez; kurucu içeriğe dönüp çözer veya ayrı `Publish/share anyway` verir.
- [ ] Canlı izin listesi PRD'deki kapalı alanlarla sınırlıdır; hibrit etiket `Some fields live` / `Approved snapshot` / `Live` doğrudur.
- [ ] Son kapsam onay zamanı paylaşım yüzeyinde görünür; yayımlanmamış fark ve yeni filtre adayları yalnız sahibin farkında durur, ziyaretçiye sayaç/boşluk/ipucu sızmaz.
- [ ] Filtreye yeni giren kayıt yalnız farkta adaydır; daha önce onaylı kayıt bağlantıdan yalnız canlı onaylı alanların üyelik kaybıyla düşer.
- [ ] Yakalama Gelen Kutusu öğesi, çözümlenmemiş Toplu Anlamlandırma ve kaydedilmemiş Taslak hiçbir paylaşım kapsamını miras almaz.
- [ ] Kabul kanıtı Link Sharing seam'inde: önizleme, kalıtım karşıtı, placeholder, onay, canlı liste. Kanıt [Bağlantıyla paylaşım](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğuna bağlanır.
