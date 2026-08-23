# 01 — İş oluşturma, tür ve değişmez anahtar

**What to build:** Kurucu Projede yalnız başlıkla İş oluşturur. Tür `Feature`, `Bug`, `Task`, `Research` veya `Improvement` olur. Kullanıcıya dönük anahtar kısa kod + Proje sayacıdır; boşluklar hata değildir; silinen/birleşen numara yeniden kullanılmaz. Proje kapsamı yaşam boyu değişmez. Feature dışı tür değişimi serbesttir; Feature’a giriş/çıkış etki önizlemesi ister. Taslak kesinleşmesi veya yakalama dönüşümü aynı ana kaydı üretir.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Başlık yeter; durum `Not Started` ile açılır; anahtar `{shortCode}-{n}` ve iç kimlik ayrıdır.
- [ ] Sayaç eşzamanlı oluşturmada tekil kalır; atlanan numara reuse edilmez.
- [ ] İlk İş Project Shell kısa kodunu kilitler (07 sözleşmesi); taşıma komutu yoktur.
- [ ] Beş tür UI’da İngilizce adlarıyla durur; epic/subtask hiyerarşisi yoktur.
- [ ] Feature dışı tür değişimi serbesttir; Feature’a giriş veya çıkış etki önizlemesi ister.
- [ ] Taslak kesinleşmesi ve yakalama dönüşümü aynı bağımsız İş ana kaydını üretir.
- [ ] Kabul kanıtı Work Lifecycle seam'inde tahsis, reuse karşıtı, tür matrisi. [İş yaşam döngüsü](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
