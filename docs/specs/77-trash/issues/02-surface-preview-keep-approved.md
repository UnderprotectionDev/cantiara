# 02 — Dış yüzey önizlemesi, varsayılan iptal ve Keep approved surface

**What to build:** `Move to Trash` önizlemesi kayda bağlı bütün Dış yüzeyleri listeler ve varsayılan olarak iptal eder. `Keep approved surface` yalnız yaşayan Çalışma Alanı, Proje veya Kişisel Wiki içindeki tekil kaynakta ve yalnız geri alınabilir silme süresince sunulur. Korunan yüzey son Onaylı snapshot revizyonunda donar; yeni içerik veya canlı alan yayımlamaz. Proje, Çalışma Alanı veya Hesap silmede seçenek yoktur. İptalin token/ziyaretçi/cache kesimi Dış yüzey sözleşmesini çağırır; bu ticket ikinci bir paylaşım motoru yazmaz.

**Blocked by:** 01 — Desteklenen kaydı Çöp Kutusuna alma ve 30 günlük kimlik

**Status:** ready-for-agent

- [ ] Taşıma önizlemesi bağlı bütün Dış yüzeyleri listeler; onay varsayılanı iptaldir (terminal; ziyaretçi oturumu kapanır).
- [ ] `Keep approved surface` yalnız yaşayan Çalışma Alanı/Proje/Kişisel Wiki tekil kaynağında ve yalnız geri alınabilir pencerede vardır.
- [ ] Korunan yüzey son Onaylı snapshot revizyonunda donar; yeni içerik, canlı alan veya kaynak düzenleme bağlantısı sunmaz.
- [ ] Proje silme grubu, Çalışma Alanı veya Hesap silme önizlemesinde `Keep approved surface` yoktur ve sunulursa fail-closed reddedilir.
- [ ] İptal edilmiş Dış yüzey olağan 30 günlük `Trash`'e alınabilir; kalıcı içerik kaldırma 03/05'tedir.
- [ ] Kabul kanıtı Trash seam'inde yüzey listesi, varsayılan iptal, tekil kaynak koruma, grup silmede yasağın karşıtı. Kanıt [Proje silme ve dış yüzey](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğunun yüzey dilimidir.
