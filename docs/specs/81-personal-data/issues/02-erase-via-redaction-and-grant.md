# 02 — Kişisel veriyi sil (78 sözleşmesi + 01 grant)

**What to build:** `Erase Personal Data` etki önizlemesi gösterir. Account Access `Confirm GitHub Identity` grant'i bu işlem kimliğiyle tüketilir; hedef Hesap adı yazılır. İkinci teyit kartı ve OAuth/PKCE kopyası yoktur. Geri döndürülemez kaldırma Security Redaction (78) apply arayüzünü çağırır; ad, e-posta, özgün mesaj kalkar; içeriksiz tombstone kalabilir. Aktif paylaşım/yayın değeri aynı işlemde kaldırılır ve cache temizliğine alınır. Çöp Kutusu veya Hesap kapatma bu ticket değildir.

**Blocked by:** 01 — Contact için okunabilir kişisel veri paketi

**Status:** ready-for-agent

- [ ] Önizleme etkilenen Contact, Geri Bildirim, Araştırma, kanıt ve Dış yüzey kopyalarını listeler; onaydan önce redaksiyon yazılmaz.
- [ ] Apply, Account Access grant'ini bir kez tüketir, Hesap adını doğrular ve 78 sözleşmesini çağırır; kopya yayılım motoru yoktur.
- [ ] Grant yokluğu, replay veya ad uyuşmazlığı yazmadan reddedilir. UI parola/MFA olarak göstermez.
- [ ] Ad/e-posta/özgün mesaj okunamaz; tombstone içeriksizdir; paylaşılmış/yayındaki değer 78 apply + 01 grant ile aynı işlemde kalkar ve cache temizliğine alınır.
- [ ] Restore (Trash veya satır geri yükleme) değeri diriltmez (78 karşıtı bu çağrıda da geçerlidir).
- [ ] `Erase Personal Data` Hesap kapatma veya Çöp Kutusuna alma değildir; kayıt kimliği Trash'e girmeden 78 ile redakte edilir.
- [ ] Kabul kanıtı Personal Data Rights seam'inde grant double + 78 double: paket sonrası silme, teyit karşıtları, yayın kopyasının kalkması. [Hesap ve kişisel veri](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) silme dilimi; kapatma UI'si 84'tedir.
