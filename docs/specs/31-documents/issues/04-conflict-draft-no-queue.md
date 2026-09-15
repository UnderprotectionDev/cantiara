# 04 — Çakışma Taslağı ve kuyruksuz yeniden bağlanma

**What to build:** Güncel olmayan taban revizyonuyla kayıt mevcut sürümü ezmez; reddedilen metin aynı kapsamda `Conflict Draft` olarak durur. Kullanıcı karşılaştırır; parça uygular, yeni kimlikli Belge üretir veya taslağı siler. Taslak çözülmeden arama, paylaşım, yayın, export veya Belge geçmişine girmez. Bağlantı kesilince tampon sonrası yeni düzenleme durur; son başarılı kayıt ve yazılmamış risk görünür; `Copy` ve `Download` kurtarma vardır. Yeniden bağlanınca son tabanla kayıt denenir; gerekirse taslak oluşur. Yerel yazma kuyruğu bu feature’da açılmaz; yasağın sahibi çevrimiçi istemcidir.

**Blocked by:** 03 — Sürüm karşılaştırma ve geri yükleme

**Status:** ready-for-agent

- [ ] Eski taban sessiz overwrite yapmaz; `Conflict Draft` oluşur.
- [ ] Uygulama, yeni Belge veya silme taslağı çözer; çözülmemiş taslak keşif/export’a girmez.
- [ ] Kesinti kuyruk biriktirmez; son başarılı kayıt ve yazılmamış risk görünür; `Copy` ve `Download` kurtarma sunulur; yeniden bağlanma sessiz basım yapmaz.
- [ ] Kabul kanıtı seam’de stale-base, taslak çözüm yolları ve reconnect. Bu [Belge bütünlüğü](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) çatışma paketidir.
