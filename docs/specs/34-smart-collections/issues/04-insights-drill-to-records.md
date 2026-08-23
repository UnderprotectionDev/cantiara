# 04 — Hafif İçgörüler kayda iner, skor yok

**What to build:** İş koleksiyonları mevcut filtre sonucundan `Insights` sunar: kayıt sayısı, durum dağılımı, efor dağılımı, yaş ve time-in-status. Dilim tıklanınca koleksiyon o kesin kayıtlara filtrelenir ve özet yeniden hesaplanır. Ayrı analitik veritabanı, coverage, kalite puanı, kapasite, cycle-time yönetimi veya yayın kapısı yoktur.

**Blocked by:** 01 — Canlı üyelik, manuel pin yok

**Status:** ready-for-agent

- [ ] Özetler aynı yetkili üyelik kümesinden türetilir; yetkisiz kayıt sayıya girmez.
- [ ] Dilim kayıtlara iner; skor veya readiness hükmü üretilmez.
- [ ] Test özeti, sürüm kanıt paketi veya sağlık dashboard’u bu yüzey değildir.
- [ ] Kabul kanıtı seam’de drill-down ve skor karşıtı. Kanıt [Arama ve ilişki](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğuna bağlanır.
