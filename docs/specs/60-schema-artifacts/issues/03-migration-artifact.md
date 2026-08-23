# 03 — Migration Artefaktı ve Güvenli Down

**What to build:** Onay, kaynak/hedef sürüm, generator, statik doğrulama, düzen farkı, uyarı manifesti, model hash ve exact SQL byte'larını bağlayan `Migration Artifact Digest` ile değişmez Migration Artefaktı yazar. `Down` yalnız Güvenli Down ölçütü bütün küme için kanıtlanırsa üretilir; aksi hâlde `Safe Down could not be produced` ve düşüren operasyon görünür. Güvensiz Down uydurulmaz; kısmi ters SQL yoktur. `Applied` durumu yoktur. Sonraki düzeltme `Supersedes Migration Artifact` ile yeni artefakt yazar; eski kanıtı miras almaz. `.sql` export PRD 13 manifestini taşır; çalıştırmaz.

**Blocked by:** 02 — Şema değişiklik taslağı ve yıkıcı önizleme

**Status:** ready-for-agent

- [ ] Artefakt sahipli bileşendir; ana kayıt veya Diyagram Sürümü değildir; `Applied` / `Not applied` / `Çalıştırıldı` / `Production-ready` taşımaz. Disposable doğrulama bu durumları mint etmez.
- [ ] Güvenli Down ölçütü: bir operasyon yalnız katalogda `Yıkıcı değil` ise ve tersi kaynak ile hedef Diyagram Sürümünün tanımlarından bütünüyle belirleniyorsa tersine çevrilebilir. Uygun olmayan: `Drop table`, `Drop column`, `Narrow column type`, `Drop primary key`, `Drop foreign key`, `Drop unique constraint`, `Drop check constraint`, `Drop enum value`, `Drop enum type`, `Drop domain constraint`, `Drop domain`, and every `Desteklenmiyor` fark. Tek uygun olmayan operasyon bütün ters yönü düşürür; kısmi ters SQL yoktur; düşüren operasyon uyarısı görünür.
- [ ] Digest tek bayt veya operasyon farkında düşer; yalnız yerleşim düşürmez.
- [ ] Supersede eski artefaktı silmez ve PR/Test bağını devretmez.
- [ ] Kabul kanıtı aynı seam'de: digest, Down varlık/yokluk, appliedness yokluğu, export manifesti. [Teknik Diyagram ve şema](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) migration paketidir.
