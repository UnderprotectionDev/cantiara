# 01 — Önizleme, grant tüketimi ve yazılan hedef adı

**What to build:** Kurucu güvenlik redaksiyonunu etki önizlemesiyle başlatır. Account Access `Confirm GitHub Identity` grant'i bu işlem kimliğiyle bir kez tüketilir; etkilenen Hesap veya Proje adı yazılır (kayıt başlığı yetmez). İkinci kimlik teyit kartı, OAuth, PKCE veya `prompt=select_account` bu ticket'ta yoktur. Grant yoksa veya ad eşleşmezse içerik yazılmaz. UI eylemi parola/MFA/oturum yenileme olarak sunulmaz. Olağan düzenleme, istemci gizleme veya geçmiş satırını silmek redaksiyon değildir.

**Blocked by:** None — can start immediately (grant consume uses the Account Access test double).

**Status:** ready-for-agent

- [ ] Önizleme hassas değerin bulunduğu güncel alan, geçmiş revizyon, Dış yüzey snapshot, arama, export hazırlığı ve cache lokatörlerini listeler; onaydan önce içerik silinmez. Serbest Markdown'da secret tespit iddiası yoktur; önizleme bu PRD 13 sınırını söyler.
- [ ] Apply, Account Access grant'ini işlem kimliğiyle bir kez tüketir ve etkilenen Hesap veya Proje adını doğrular; kayıt başlığı yetmez; ikinci teyit kartı açılmaz.
- [ ] Grant yokluğu, süre aşımı, yanlış işlem kimliği, replay veya ad uyuşmazlığı redaksiyon yazması yapmadan reddedilir.
- [ ] Olağan düzenleme, istemci gizleme veya geçmiş satırını silmek `Redact` apply değildir ve irreversible güvenlik olayı yazmaz.
- [ ] İngilizce UI `Redact` kullanır; `Confirm GitHub Identity` 01'in etiketidir. Eylem parola, MFA veya genel oturum yenileme olarak gösterilmez.
- [ ] Kabul kanıtı Security Redaction seam'inde grant double ile: önizleme, eşleşen tüketim, eksik grant, replay, ad uyuşmazlığı. Kanıt [Hesap ve kişisel veri](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğunun redaksiyon teyit dilimidir.
