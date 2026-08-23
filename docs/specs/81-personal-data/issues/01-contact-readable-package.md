# 01 — Contact için okunabilir kişisel veri paketi

**What to build:** Kurucu bir Contact için `Export Personal Data` ile Contact, e-posta takma değerleri, Geri Bildirim, Araştırma ve ilişkili kanıtı okunabilir pakette toplar. Paket secret, oturum, başka Contact veya tam Çalışma Alanı arşivi taşımaz. Ürün içi restore formatı değildir. Seçili kayıt export (79) ve `Workspace Exit Package` (82) bu ticket'ta yoktur.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Paket yalnız seçilen Contact'ın listedeki kaynaklarını okunabilir biçimde içerir; secret/token/parola ve başka kişiler girmez.
- [ ] Paket `Workspace Exit Package` veya Hesap kapatma arşivi olarak adlandırılmaz ve restore vaadi taşımaz.
- [ ] İngilizce UI `Export Personal Data` kullanır; kapalı dünya önizlemesi pakete girecek kaynakları onaydan önce listeler.
- [ ] Kabul kanıtı Personal Data Rights seam'inde `Kişisel veri` fixture'si ile paket kapsamı ve 82/79 karışmama karşıtı. Kanıt [Hesap ve kişisel veri](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğunun kişi-paketi dilimidir.
