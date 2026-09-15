# 02 — Arşivden Proje silme grubu; Keep approved surface yasak

**What to build:** `Delete Project` yalnız Arşiv görünümündedir. Onay, Proje silme grubunu (kanonik ait ana kayıt, sahipli bileşen, Dış yüzeyler) tek birim olarak 77 `Trash` saatine koyar. Proje kapsamlı Dış yüzeyler ve ziyaretçi oturumları derhal terminal iptal edilir. `Keep approved surface` sunulmaz ve API'de reddedilir. Çalışma Alanı, Hesap ve Kişisel Wiki kayıtları silinmez; yaşayan ilişkiler silinmiş hedef işareti gösterir. Çocuk bağımsız silinmez. 77'nin 30 gün tek birim kuralı uygulanır.

**Blocked by:** 01 — Proje arşivi: salt okunur ve güvenlik istisnası

**Status:** ready-for-agent

- [ ] `Delete Project` yalnız Arşivdeki Projede vardır; etkin Projede yoktur.
- [ ] Silme grubu 77 Trash'ine tek süre birimi olarak girer; kabuk-sil-çocuk-kal yok.
- [ ] Bütün Proje kapsamlı Dış yüzeyler ve ziyaretçi oturumları terminal iptal; `Keep approved surface` yok ve reddedilir.
- [ ] Önizleme duracak entegrasyonları, başka kapsamdaki yaşayan ilişkileri ve restore'un otomatik yayınlamayacağını gösterir.
- [ ] Kabul kanıtı Project Retirement seam'inde + Trash double: grup, iptal, keep yasağı. [Proje silme ve dış yüzey](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) silme dilimi.
