# 01 — Kesin spec sürüm farkı

**What to build:** Bir Özelliğin `Primary spec` Belgesinde yeni sürüm kaydedildiğinde kuyruk önceki ve yeni Belge sürümünü değişen bölüm bağlamıyla gösterir. Fark sürüme bağlıdır; serbest metin karşılaştırması, Git diff veya dış review aracı değildir. Fark kaydı spec'in yerine geçmez.

**Blocked by:** None — can start immediately. Document versions can be a test double until Documents exist.

**Status:** ready-for-agent

- [ ] Kuyruk tam olarak bir Belge sürüm çiftini bölüm bağlamıyla gösterir.
- [ ] Kuyruk yalnız Özelliğin bağlanmış `Primary spec` Belge sürüm kaydında açılır; başka Belge sürümü bu kuyruğu açmaz.
- [ ] Git çalışma ağacı veya harici review UI'si yoktur.
- [ ] İnceleme kaydı spec gövdesinin yerine geçmez.
- [ ] İngilizce UI `Spec Change Review`, `Primary spec` kullanır; eksik etiketler PRD sözlüğüne aynı değişiklikle eklenir.
- [ ] Kabul kanıtı Spec Change Review seam'inde: sürüm bağlı fark. Kanıt [Belge bütünlüğü](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğuna bağlanır.
