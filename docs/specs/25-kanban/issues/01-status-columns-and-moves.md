# 01 — Durum sütunları ve kart hareketi

**What to build:** Kanban İşleri `Not Started`, `In Progress`, `In Review`, `Blocked` ve `Closed` sütunlarında gösterir. Terminal olmayan sütunlar arası kart hareketi ana İşin İş akışı durumuna yansır. Backlog, Günlük Odak, Takvim, Roadmap, Favori veya Odak Dönemi üyeliği durum yazmaz. Kart kaynak İş olarak açılır; tahta ikinci İş listesi üretmez. Üyelik Projedeki İş gerçeğidir. Sürükleme GitHub durumu yazmaz ve sessiz otomasyon tetiklemez.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Tahta beş korunan İş akışı durumunu bu sırayla sütun olarak sunar (`In Review`, `In Progress` ile `Blocked` arasındadır); altıncı semantik veya arşiv sütunu eklenmez.
- [ ] `Not Started`, `In Progress`, `In Review` ve `Blocked` arasında sürükleme İş durumunu hedef sütuna yazar; durum yalnız bu sütun hareketi veya açık durum eylemiyle değişir.
- [ ] Backlog, Günlük Odak, Takvim, Roadmap, Favori veya Odak Dönemi üyeliği İş akışı durumu yazmaz.
- [ ] Kart kayıtlı görünümün görünür alan özetini gösterir; `Open source record` kaynak İşi açar.
- [ ] Sütun hareketi GitHub durumu yazmaz ve sessiz otomasyon tetiklemez.
- [ ] Tahta sprint, yayın taahhüdü veya kapanış sonucu sütunu değildir.
- [ ] İngilizce UI `Board`, `Kanban`, `Not Started`, `In Progress`, `In Review`, `Blocked`, `Closed` kullanır.
- [ ] Kabul kanıtı Kanban seam’inde sütun hareketinin durum yazması ve tahtanın ikinci kayıt üretmemesi. Kanıt [Günlük planlama](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğuna bağlanır.
