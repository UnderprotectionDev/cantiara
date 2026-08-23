# 05 — Dönen devir dikkat sinyali

**What to build:** `Result returned` ve henüz terminal olmayan devir tek kaynak bağlantılı `external-run-returned` `Action needed` sinyali üretir. `Reconciled` veya `Canceled` sonuç, uzlaştırma veya zaman sinyali üretmez; önceki devir sinyalleri kapanır. `Open` ve sonuçsuz devir yalnız kurucu ayrıca hedef tarih veya `Review later` kurduysa o hatırlatma feature’ının sinyalini taşır; bu kart zaman sinyali basmaz. Bildirim Merkezi kabuğu burada yoktur.

**Blocked by:** 03 — Dönüş kaydı ve uzlaştırma; 04 — Gerekçeli iptal ve otomatik kapanmama

**Status:** ready-for-agent

- [ ] `Result returned` uzlaştırılmamış devir tam olarak bir `external-run-returned` üretir; kaynak devir ve İş açılır.
- [ ] `Reconcile` veya `Cancel Handoff` o sinyali kapatır; terminal devir yeni sonuç/zaman sinyali basmaz.
- [ ] Sonuçsuz `Open` devir `external-run-returned` basmaz; salt zaman geçmesi sinyal değildir.
- [ ] Kayıtsız sinyal kimliği üretilmez; merkez listesi, gruplama veya okundu durumu bu ticket’ta yoktur.
- [ ] Kabul kanıtı seam’de sinyal doğumu, uzlaştırma/iptal kapanışı ve sonuçsuz zaman karşıtı. Kanıt [Dış yürütme devri](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) ile [Dikkat sinyalleri](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) negatif matrisine bağlanır.
