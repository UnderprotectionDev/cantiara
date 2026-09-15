# 01 — Yayın önizlemesi, public durum eşlemesi ve yer tutucu

**What to build:** Kurucu Proje bazında Build in Public'i açar ve yayımlanacak alanlar, public durum eşlemeleri ve metadata'yı kesin farkla onaylar. Varsayılan eşleme `Not Started→Planned`, `In Progress→In Progress`, `Closed+Completed→Completed`'dır. Yayımlanmış Proje Sürümü üyeliği `Released` önerebilir; snapshot yalnız onayla değişir. `Blocked` ve `Closed+Abandoned` varsayılan eşlemesizdir ve açık public etiket olmadan yayımlanamaz. İç durum değişimi public etiketi kendiliğinden yazmaz. Çözülmemiş `{{alan_adı}}` kaynak kayıt, alan ve metin bağlamıyla listelenir; kurucu çözer veya ayrı `Publish/share anyway` verir. Secret/token/parola kapsama girmez. İç durum adları ziyaretçiye sızmaz.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Önizleme seçili alan, eşleme, kesin Dosya Eki sürümü ve gömüleri kapalı dünya farkı olarak gösterir; onaysız öğe public olmaz.
- [ ] Varsayılan eşleme PRD matrisidir; `Released` önerisi onay olmadan uygulanmaz; `Blocked`/`Abandoned` etiket seçilmeden yayımlanamaz.
- [ ] İç İş akışı durumu public etiketi sessizce değiştirmez; public etiket iç durumu değiştirmez.
- [ ] İsteğe bağlı `Public title` / `Public summary` Roadmap İş yayın alanlarıdır; iç başlık değişince kendiliğinden yeniden yazılmaz ve ikinci herkese açık İş üretmez.
- [ ] `{{alan_adı}}` kaynak kayıt, alan ve metin bağlamıyla listelenir; kod eşleşmesi yoksayılır; kurucu çözer veya ayrı `Publish/share anyway` verir; Secret/token/parola kapsama girmez.
- [ ] İngilizce `Planned`, `In Progress`, `Completed`, `Released`, `Public Status Label` kullanılır; eksik etiketler terim sözlüğüne aynı değişiklikle eklenir.
- [ ] Kabul kanıtı Build in Public seam'inde durum/sonuç/etiket matrisi. Kanıt [Herkese açık yayın](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğuna bağlanır.
