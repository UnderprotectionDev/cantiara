# 01 — Close Account: grant, yazılan ad, Kapanış tamamlanıyor

**What to build:** `Close Account` Account Access grant'ini bu işlem kimliğiyle tüketir ve etkilenen Hesap adını yazdırır. İkinci teyit kartı ve OAuth/PKCE kopyası yoktur. Başarı görünür `Closing` geçişini açar: yeni normal mutasyon reddi, dış paylaşım/yayın fail-closed, entegrasyon kapanışı, normal oturumların sonu, uzantı bağlantılarının iptali. Bariyer öncesi import/yükleme/otomasyon/eşitleme makbuzla iptal. Bariyer sonrası ve başlamış irreversible redaksiyon/silme tam commit veya rollback makbuzuna ulaşmadan dondurma ve export açılmaz.

**Blocked by:** None — can start immediately (01 grant double, 78/82 doubles for in-flight work).

**Status:** ready-for-agent

- [ ] Grant yokluğu, replay veya yazılan Hesap adı uyuşmazlığı kapatma yazması yapmadan reddedilir; ikinci kimlik kartı yoktur.
- [ ] `Closing` sırasında yeni normal mutasyon ve dış erişim fail-closed; oturum ve uzantı bağlantıları biter; GitHub login ve App yetkileri kapatma yolunda birlikte iptale alınır (01/61 adaptör).
- [ ] Bariyer öncesi işler makbuzla iptal; bariyer sonrası `Closing` fail-closed tamamlanmadan 30 günlük dondurma başlamaz.
- [ ] İngilizce UI `Close Account` ve `Closing`. Parola/MFA kopyası yoktur.
- [ ] `Close Account` Proje silme grubu veya `Revoke Session` değildir; oturumlar kapanışın yan etkisi olarak biter, oturum listesinden kapatma açılmaz.
- [ ] Kabul kanıtı Account Closure seam'inde grant double ile start, `Closing` fail-closed, Proje silme karışmama. [Hesap ve kişisel veri](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) kapanış başlangıcı. Erişilebilirlik **Hesap kapatma ve export** bu yüzeyden yürür.
