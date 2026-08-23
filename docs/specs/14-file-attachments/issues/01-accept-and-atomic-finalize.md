# 01 — Dosya kabulü, kota ve atomik finalize

**What to build:** Kurucu izin verilen tür, boyut, MIME/uzantı uyumu ve Çalışma Alanı kotası doğrulandıktan sonra dosyayı yükler. Finalize atomiktir: ya bağlanmış bir Dosya Eki görünür ya da yükleme tamamlanmamıştır. Normal yükleme yeni ana kayıt açar; `Upload new version` aynı kaydın sürüm zincirine ekler. Bağlantı kopunca aktarım sıfırdan başlar. SVG/HTML/çalıştırılabilir/script/macro-enabled/bilinmeyen tür reddedilir; MIME uyuşmazlığı sessiz düzeltilmez.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Dosya Eki tam olarak bir Proje veya Kişisel Wiki kapsamında ana kayıt olarak kesinleşir; kabul dış depolama gezgini veya Belge içe aktarma değildir.
- [ ] Tür matrisi (görsel 25 MB, PDF 50 MB, CSV 25 MB, metin 10 MB, ses 100 MB, video 250 MB, ZIP 100 MB) özgün byte üzerinden uygulanır; yasak türler finalize olmaz.
- [ ] MIME/uzantı uyuşmazlığı açık hata ile reddedilir ve sessizce onarılmaz.
- [ ] Kota 25 GB / 20.000 sürüm; Aktif, Arşiv ve Çöp sayılır; %80 uyarısı; aşımda yeni yükleme ve yeni sürüm engellenir, mevcut okuma/indirme/silme açık kalır. Kota ancak fiziksel kalıcı silmede serbestlenir.
- [ ] Geçici nesne erişilemez kalır; byte, MIME/uzantı, içerik hash'i ve tür güvenliği aynı idempotent commit bariyerinde Dosya Eki/sürüm üstverisiyle kesinleşir ([ADR-0004](../../../adr/0004-atomik-idempotent-kesinlestirme.md)).
- [ ] Finalize başarısızsa görünür Dosya Eki veya eksik nesneye işaret eden üstveri oluşmaz; sahipsiz geçici nesne süreli sweep ile temizlenir. Aynı anahtar+parmak izi önceki sonucu döner.
- [ ] Bağlantı kaybı sıfırdan yeniden başlar; başarısız deneme görünür ek bırakmaz. Kaldığı yerden sürdürme yoktur.
- [ ] Normal yükleme yeni Dosya Eki açar; `Upload new version` hedef ek, mevcut sürüm ve gelecek dosyayı önizler, önceki sürümler özgün kalır. İçerik/konum/yayın bağları yeni sürüme sessizce taşınmaz.
- [ ] Ham R2/CDN nesne URL'si istemciye açıklanmaz. ZIP içeriği çalıştırılmaz.
- [ ] İngilizce UI `File Attachment`, `Upload new version`, `Finalizing` kullanır.
- [ ] 25 MB sonrası tür/bütünlük doğrulaması [performans bütçesine](../../../prd/15-product-quality.md#performans-butcesi) bağlanır.
- [ ] Kabul kanıtı File Attachments seam'inde `Dosya sınırları` fixture ile: izin, red, kota, atomik ret, retry idempotency. Kanıt [Dosya güvenliği](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğudur.
