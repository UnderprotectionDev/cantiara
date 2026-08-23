# 04 — Görsel işaretleme ve konuma bağlı İş bağlamı

**What to build:** Desteklenen görsel ve PDF üzerinde kalem, vurgulayıcı, ok ve dikdörtgen, kesin Dosya Eki sürümüne bağlı ayrı geri alınabilir katmanda durur. Katman özgün dosyayı, yeni sürümü veya ilişkiyi üretmez ve sonraki sürüme taşınmaz. Kurucu nokta veya bölge seçip yeni veya mevcut İşe köken olarak bağlar; bağ sürümü ve sahipliği değiştirmez. Wireframe ekran kökeni bu ticket'ta yoktur.

**Blocked by:** 01 — Dosya kabulü, kota ve atomik finalize; 03 — Güvenli önizleme ve türetilmiş thumbnail

**Status:** ready-for-agent

- [ ] İşaretleme katmanı kesin Dosya Eki sürümüne bağlıdır; özgün byte yazılmaz, yeni Dosya Eki/sürüm oluşmaz, sonraki sürüme sessizce taşınmaz.
- [ ] Araçlar kalem, vurgulayıcı, ok ve dikdörtgen ile sınırlıdır; yorum, mention, review, görev veya kalıcı ilişki üretmez.
- [ ] Paylaşım/yayın önizlemesi (tüketici) görsel ile katmanı ayrı öğe sayar; görseli onaylamak katmanı otomatik paylaşmaz. Paylaşım UI'si bu ticket'ta yoktur.
- [ ] Desteklenen görsel/PDF'de nokta veya bölge, önizlemeden sonra yeni veya mevcut tam İşe `Köken konumu` olarak bağlanır; gözlem kendiliğinden İş veya alt iş olmaz.
- [ ] Konum bağı seçilen kesin sürüme aittir; yeni sürüm bağı devralmaz. Dosya sahipliği değişmez.
- [ ] Ekran/Wireframe köken konumu yoktur. Çok kullanıcılı yorum dizisi, Approval veya otomatik subtask yoktur.
- [ ] İşaretleme üretim tasarım aracı veya Wireframe belgesi değildir; kanıt ve bağlam notudur.
- [ ] Kabul kanıtı File Attachments seam'inde: katman ≠ kaynak byte, sürüm pin, İş önizlemeli bağ, yeni sürümde bağın taşınmaması, Wireframe yolunun yokluğu. Kanıt [Dosya güvenliği](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) görsel kanıt dilimidir; erişilebilirlik yolculuğu **Belge sürümü ve Dosya Eki** bu yüzeyden de yürür.
