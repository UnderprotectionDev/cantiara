# 02 — Yakalama ekini atomik Dosya Ekine terfi

**What to build:** Yakalama Gelen Kutusu öğesindeki şifreli Yakalama eki, kalıcı kayda dönüşümde hedef kapsamda Dosya Ekine aynı atomik finalize ile terfi eder. Kurucu hedef kapsamı görür. Başarısızlık görünür ek bırakmaz. Yakalama silinince staging nesnesi silinir. Bu ticket Gelen Kutusu triage UI'sini inşa etmez; yalnız terfi commit'ini tamamlar.

**Blocked by:** 01 — Dosya kabulü, kota ve atomik finalize

**Status:** ready-for-agent

- [ ] Dönüşümde Yakalama eki hedef Proje veya Kişisel Wiki kapsamında Dosya Eki olur; arama/paylaşım/yayın/export'a staging olarak girmez.
- [ ] Terfi 01'deki aynı doğrulama ve idempotent commit bariyerini kullanır; kısmi görünür ek yoktur.
- [ ] Başarısız terfi Inbox öğesini hayalet Dosya Eki ile bırakmaz; güvenli yeniden deneme açıklanır.
- [ ] Yakalama silinince staging nesnesi silinir; kalıcı Dosya Eki ancak başarılı terfiden sonra yaşar.
- [ ] Kota ve yasak tür kuralları terfide de uygulanır; Yakalama eki kota deliği değildir.
- [ ] Kabul kanıtı File Attachments seam'inde yakalama staging double ile: başarılı terfi, başarısız terfide görünür ek yokluğu, silmede staging temizliği. Kanıt [Dosya güvenliği](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) ile yakalama dönüşüm karşıtıdır.
