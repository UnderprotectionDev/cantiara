# 03 — Kimlik diriltmeme ve köken eşlemesi

**What to build:** Kaynak kararlı özgün anahtar taşıyorsa köken korunur; bu değer silinmiş ürün kimliğini diriltmez. Etkin kayıt kesin kökenle eşleşirse önizleme `update existing` / `skip` / `resolve conflict` sunar. Kalıcı silinmiş kimlik yeniden gelince yeni ürün kimliği ve anahtarı üretilir, önceki köken görünür kalır; emekli birleştirme kimliği emekli kalır. İlişkiler yeni kimliğe yalnız açık eşlemeyle bağlanır. CSV'de yalnız ürün export kökeniyle kanıtlanmış formül kaçışı kaldırılır. Bu ticket yedek restore (85) veya test-report (54) değildir.

**Blocked by:** 02 — Atomik ve idempotent Apply Import

**Status:** ready-for-agent

- [ ] Kalıcı silinmiş ürün kimliği Apply'da yeniden ana kayıt olmaz; yeni kimlik + görünür köken üretilir.
- [ ] Emekli birleştirme kimliği emekli kalır; ilişkiler yeni kimliğe yalnız önizlenen açık eşlemeyle kurulur.
- [ ] Canlı köken eşleşmesinde update/skip/conflict önizlenir; onaysız tahminî eşleme yoktur.
- [ ] Ürün CSV export kaçışı yalnız kanıtlı kökenle kaldırılır; kullanıcının olağan apostrof metni değişmez.
- [ ] Apply GitHub senkronu, operatör yedek restore (85) veya test-report kabulü (54) değildir; bu komutlar bu seam'de yoktur.
- [ ] Kabul kanıtı Standard Import seam'inde diriltme karşıtı, emekli kimlik, köken update, 54/85/61 yokluğu. [Taşınabilirlik](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) kimlik dilimidir.
