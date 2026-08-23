# 01 — Tek Wiki Belgesi kapalı dünya önizlemesi ve yayın

**What to build:** Kurucu bir Kişisel Wiki Belgesini dışarı çıkacak kesin kayıt, sürüm, alan ve Dosya Ekleriyle birlikte satır içi referans, geri bağlantı, ek, çocuk belge, canlı blok ve gömüleri tek tek listelenen kapalı dünya önizlemesiyle yayımlar. Onaysız gömü ve Wiki'nin geri kalanı sızmaz. Onay bağımsız herkese açık Dış yüzey ve Onaylı snapshot revizyonu üretir; Proje Build in Public doğmaz. Çözülmemiş `{{alan_adı}}` kaynak kayıt, alan ve metin bağlamıyla listelenir; kurucu çözer veya ayrı `Publish/share anyway` verir. Secret/token/parola kapsama girmez. Canlı bloklar onay anı kaynak+tarih etiketli salt okunur snapshot olur.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Önizleme dışarı çıkacak kesin kayıt, sürüm, alan ve Dosya Eklerini listeler; her gömü ayrı onay öğesidir; seçilmeyen çocuk/geri bağlantı/ek çıkmaz.
- [ ] Onay tek Wiki Belgesi için public snapshot üretir; Build in Public Proje yüzeyi oluşmaz; canlı Wiki sonraki yazması mevcut sayfayı güncellemez.
- [ ] Canlı bloklar tarih etiketli salt okunur snapshot'tır ve özel kayda geçiş vermez.
- [ ] `{{alan_adı}}` kaynak kayıt, alan ve metin bağlamıyla listelenir; kod eşleşmesi yoksayılır; kurucu çözer veya ayrı `Publish/share anyway` verir; Secret/token/parola kapsama girmez; ayrı policy fork'u yoktur.
- [ ] İngilizce UI `Publish Wiki Document` kullanır; eksik etiket terim sözlüğüne aynı değişiklikle eklenir.
- [ ] Kabul kanıtı Wiki Publishing seam'inde: üye listesi, sızıntı karşıtı, Proje-yayını yokluğu. Kanıt [Herkese açık yayın](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) wiki dilimidir.
