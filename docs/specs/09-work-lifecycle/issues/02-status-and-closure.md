# 02 — Durum ve kapanış sonucu

**What to build:** Korunan semantik `Not Started`, `In Progress`, `Blocked`, `Closed`’dur; görünen ad değişebilir, semantik silinemez. Terminal olmayanlar arasında serbest geçiş vardır. `Closed` her seferinde `Completed` veya `Abandoned` seçtiren açık kapatma adımı ister; iptal durum yazmaz. Yeniden açma onay ve terminal olmayan hedef ister; önceki sonuç geçmişte kalır. `Closure check` engelleyici değildir (`Return to work` / `Close anyway`). `Keep lasting context` isteğe bağlı önizlemedir. Planlama üyeliği durum yazmaz; `Closed` sonuçsuz reddedilir.

**Blocked by:** 01 — İş oluşturma, tür ve değişmez anahtar

**Status:** ready-for-agent

- [ ] Durum ve kapanış sonucu ayrı alanlardır; `Closed` sonuçsuz uygulanmaz.
- [ ] Kapatma iptali eski durumda bırakır; yeniden açma geçmiş sonucu silmez.
- [ ] Closure check blokaj/checklist varsa uyarır, zorunlu kapı değildir.
- [ ] Kanban veya başka planlama yüzeyi `Closed` yazısını sonuç seçmeden uygulayamaz; kapatma adımı atlanmaz.
- [ ] Keep lasting context Decision/Wiki komutunu önizler; metin üretmez ve kapatmayı bloklamaz.
- [ ] Vazgeçilen İş otomatik arşivlenmez; kapanış Proje aşaması değildir.
- [ ] Otomasyon veya GitHub olayı bu seam’de sonucu sessiz yazmaz; görünür kural sonraki feature’dadır.
- [ ] Kabul kanıtı Work Lifecycle seam'inde durum/sonuç matrisi ve planlama-üye karşıtı. İş yaşam döngüsü yolculuğu.
