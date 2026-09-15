# 01 — Bütün Dış yüzeylerin tek dizini

**What to build:** Çalışma Alanı ve Proje düzeyindeki `Shares and Publications` aktif, süresi dolmuş ve iptal edilmiş bütün Dış yüzeyleri — bağlantı, Wiki, Build in Public — tek listede gösterir. Satır kaynak kaydı, görünürlük, parola varlığı (secret değil), süre, `Active`/`Expired`/`Revoked`, son onay zamanı, yayımlanmamış değişiklik bayrağı, redaksiyon durumu ve duruma uygun eylemleri taşır. Görüntülenme sayacı, son erişim, ziyaretçi kimliği ve analitik yoktur. Oluşturma sihirbazı bu yüzeyde yoktur.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Dizin bağlantı, Wiki ve Build in Public Dış yüzeylerini tür ayırmadan listeler; Proje kapsamı o Projenin satırlarını indirger.
- [ ] Satır görünürlük türü, kaynak, parola-var boolean, süre, yaşam durumu, son onay, yayımlanmamış değişiklik ve duruma uygun `Open source` / `Review diff` / `Change expiry / Reactivate` / `Revoke / Unpublish` / `Move to Trash` taşır; secret, token veya parola değeri yoktur.
- [ ] Redaksiyon durumu içerik sızdırmadan görünür; redakte değer eski ziyaretçi görünümü olarak sunulmaz.
- [ ] Tekil kaynakta korunan donmuş yüzey canlı kaynak bağlı veya yeni onaylı gibi gösterilmez; ziyaretçi hâlâ donmuş snapshot alır, 410 değil.
- [ ] Görüntülenme, son erişim, ziyaretçi kimliği, IP profili, cihaz izi ve kişi bazlı hareket alanları yoktur.
- [ ] `Share` / `Publish Wiki Document` / `Build in Public` oluşturma akışı bu dizinden başlatılmaz; eylemler mevcut yüzeyi yönetir.
- [ ] İngilizce UI `Shares and Publications`, `Active`, `Expired`, `Revoked` kullanır; eksik etiketler terim sözlüğüne aynı değişiklikle eklenir.
- [ ] Kabul kanıtı External Surface Management seam'inde fixture yüzeylerle: tam liste, secret yokluğu, oluşturma yokluğu. Kanıt [Bağlantıyla paylaşım](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) ve [Herkese açık yayın](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) dizin dilimidir.
