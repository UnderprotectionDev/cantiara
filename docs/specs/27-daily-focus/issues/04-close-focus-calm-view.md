# 04 — Close focus sakin kapanış görünümü

**What to build:** İsteğe bağlı `Close focus` seçili gün için sakin bir kapanış görünümü açar. Görünüm o gün tamamlanan, vazgeçilen, yeniden görünme tarihiyle ertelenen ve Günlük Odak’ta açık kalan İşleri kaynaklarından gruplar. Yeni özet kaydı, günlük snapshot, çalışma seansı veya ikinci geçmiş oluşmaz. Açık işler tamamlanmaz, Odaktan çıkarılmaz, başka güne taşınmaz; sıfır iş hedefi, seri, puan veya zorunlu ritüel yoktur. Kullanıcı aynı günün odağına dönebilir.

**Blocked by:** 01 — Kişisel gün üyeliği, yuvarlanma yok

**Status:** ready-for-agent

- [ ] `Close focus` salt görünümdür; açık İş `Closed` olmaz ve üyelik silinmez.
- [ ] Gruplar kaynak kayıtlardan türetilir; yeni özet ana kaydı yoktur.
- [ ] Çıkış aynı günün Günlük Odak görünümüne döner; seri/puan üretilmez.
- [ ] Bitiriş efekti tetiklenmez.
- [ ] Kabul kanıtı seam’de kapanışın durum/üyelik/gün yazmaması ve ritüel yokluğu. Kanıt [Günlük planlama](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğuna bağlanır.
