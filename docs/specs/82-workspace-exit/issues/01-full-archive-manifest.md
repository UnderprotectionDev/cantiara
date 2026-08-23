# 01 — Tam arşiv içeriği ve manifest (secret'siz)

**What to build:** Kurucu yaşayan Hesaptan tam Çalışma Alanı çıkış paketinin **seçim ve manifest sözleşmesini** üretir (bellek/fixture): kullanıcı içeriği, ek sürümleri, kimlikler, ilişkiler, geçmiş, yapılandırma; okunabilir Markdown/JSON ve özgün binary adayları; tek manifest. Oturum, secret, dış erişim anahtarı, operasyon logu, türetilmiş cache ve Yakalama staging eki girmez. **İndirilebilir artefakt yoktur** — parola zarfı 02’nin ilk indirilebilir nesnesidir. Seçili CSV/JSON (79) bu paket değildir.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Paket manifesti kapsamı ve dosya listesini taşır; içerik aileleri PRD çıkış sözleşmesine uyar.
- [ ] Secret sınıfı, oturum, dış erişim anahtarı, operasyon logu, türetilmiş cache, Yakalama staging eki artifact'ta yoktur.
- [ ] Bu ticket indirilebilir şifresiz arşiv sunmaz; `Workspace Exit Package` adı 02 zarfıyla doğar. Selected Export veya operatör yedeği değildir.
- [ ] Canlı AB yerleşimi değişmez; paket bölge taşıması olarak sunulmaz.
- [ ] Kabul kanıtı Workspace Exit Package seam'inde içerik pozitifleri ve yasağın karşıtı. [Taşınabilirlik](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) tam-paket dilimi.
