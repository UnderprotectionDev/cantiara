# 01 — Sürüme sabit metin aralığı

**What to build:** Seçili metin kesin Kaynak, Belge, Diyagram veya Dosya Eki sürümüne pinlenir. `Bind as evidence to existing record` önizlemelidir; kaynak yerinde kalır. Yeni sürüm eski pin’i sessiz kaydırmaz. `Convert to new record and bind` tam olarak bir kayıt üretir, AI kullanmaz. Köken konumu sahipli bileşende sessizce başka öğeye kaymaz.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Pin sürüm kimliği, aralık ve sınırlı çevre metnini korur. Hedefte özgün kaynak açılır; kaynakta vurgu ve geri bağlantı vardır. `Bind as evidence to existing record` uçları PRD 02 `Kanıtı` satırıdır: kesin Source/Document/Diagram version, Feedback, User Research Session, Experiment/Validation, Session Test, veya File Attachment version → Work, Decision, Risk, Assumption, Open Question, Test, Project Release, veya ona ait Access/Outcome observation. `Convert to new record and bind` yalnız bir `Work`, `Decision`, `Risk`, `Assumption`, veya `Open Question` üretir.
- [ ] Yeni kaynak sürümü pin’i taşımaz; eski kanıt okunur, yeni sürüm bulunduğu belirtilir, rebind açık önizlemedir.
- [ ] `Origin Location` sahip + bileşen + kesin sürümü değişmez tutar; öğe yoksa `Source element no longer exists`, en yeniye kaymaz.
- [ ] Redaksiyon içerik erişimini kapatır, tarihsel bağın varlığını korur.
- [ ] Kabul kanıtı Evidence seam’inde: pin sürümü, sessiz kaymama, dönüşüm önizlemesi. [Kanıt akışı](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
