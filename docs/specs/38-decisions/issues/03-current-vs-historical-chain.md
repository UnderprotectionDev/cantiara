# 03 — Güncel hüküm ile tarihsel zincir

**What to build:** Detay en eskiden güncel `Valid` Karara zinciri açar. `Superseded` üstünde güncel Karar, geçiş ve `Open current decision` vardır; eski içerik salt okunur kalır. Arama ve `All Decisions` varsayılanı `Valid` öne çıkarır. Dış görünürlük yeni snapshot’ta güncel Karardır; onaylı eski snapshot sessizce yönlenmez (ADR-0001). Spec inceleme kuyruğu bu ticket’ta yoktur.

**Blocked by:** 02 — Atomik, döngüsüz, tek halef yerine geçirme

**Status:** ready-for-agent

- [ ] Zincir Karar nesilleridir, değişiklik geçmişi satırlarının yerine geçmez. `Open current decision` nihai `Valid` kaydı açar.
- [ ] Arama ve `All Decisions` varsayılanı Geçerli Kararları öne çıkarır; eski ve geri çekilmiş durum filtresiyle bulunur.
- [ ] Kapalı dünya önizlemesi eski Karar, güncel Karar ve yerine-geçme ilişkisini ayrı öğe sayar. Daha önce yayımlanmış Karar yeni geçişle sessiz güncellenmez veya yönlenmez.
- [ ] Spec değişikliği inceleme kuyruğu (52) açılmaz ve dinlenmez.
- [ ] Kabul kanıtı aynı seam’de: varsayılan arama, zincir başlığı, snapshot sessiz güncelleme karşıtı. [Karar ve belirsizlik](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
