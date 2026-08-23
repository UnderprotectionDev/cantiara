# 03 — İş–GitHub bağlantıları ve PR rolleri

**What to build:** Issue/PR/commit/branch kayıtları açık seçim veya tekil iş anahtarıyla İşe bağlanır. Bağ İş durumunu, kapanışını veya blokajını değiştirmez. PR çoktan çoğa bağlanır; her bağ `Required for completion` veya `Contextual` rolü taşır. Manuel seçimde kurucu rolü seçer. `Fixes`/`Closes`/`Resolves` + tekil anahtar gerekli rol, diğer tekil eşleşme bağlamsal, belirsiz eşleşme yalnız öneridir. `Create work and link` bir defalık önizlemeli İş taslağıdır; sürekli alan senkronu kurmaz. Bağ Kanıt bağı veya kullanım gömüsü değildir. Hazır kural 62 bu rolleri tüketir; bu ticket İşi kapatmaz.

**Blocked by:** 02 — Webhook, durable inbox ve salt okunur uzlaştırma

**Status:** ready-for-agent

- [ ] Bağ kurmak/kaldırmak GitHub kaydını ve İş yaşamını yazmaz.
- [ ] Rol kataloğu kapalıdır; hiç gerekli PR yokken kapanış etkisi bu seam'de yoktur.
- [ ] Anahtar çakışması gizli ikinci İş üretmez.
- [ ] `Completed` İş + açık PR tarafsız dikkat sinyalidir; otomatik durum yazmaz.
- [ ] Projeye bağlı açık ve hiçbir İşe bağlanmamış PR, mevcut GitHub dış kaydı üzerinde tekilleştirilmiş kapatılabilir Bildirim Merkezi sinyalidir; Unlinked-PR kimliği veya İş türü üretmez. Commit/branch yalnız bağlanmamış diye aynı sinyali üretmez.
- [ ] Kabul kanıtı aynı seam'de: rol eşlemesi, durum değişmeme, kapanış yokluğu.
